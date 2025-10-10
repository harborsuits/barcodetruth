import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);
const WHSEC = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const toISO = (sec?: number | null) => (sec ? new Date(sec * 1000).toISOString() : null);
const nowIso = () => new Date().toISOString();

const ok = () =>
  new Response(JSON.stringify({ received: true }), { headers: { "content-type": "application/json" } });

const cors = { "access-control-allow-origin": "*" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;

  try {
    event = Stripe.webhooks.constructEvent(raw, sig, WHSEC);
  } catch (err) {
    return new Response(`Webhook error: ${(err as Error).message}`, { status: 400 });
  }

  // Idempotency guard
  const seen = await supabase.from("stripe_events").select("id").eq("id", event.id).maybeSingle();
  if (!seen.data) {
    await supabase.from("stripe_events").insert({ id: event.id });
  } else {
    return ok();
  }

  try {

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string | null;
        const subscriptionId = session.subscription as string | null;
        let userId =
          (session.client_reference_id as string | null) ??
          ((session.metadata?.user_id as string) || null);

        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          const productId = sub.items.data[0]?.price.product as string | null;
          const status = sub.status;
          const periodEndIso = toISO(sub.current_period_end);

          if (!userId && customerId) {
            userId = await lookupUserIdByCustomer(customerId);
          }

          if (userId) {
            await supabase.from("user_billing").upsert(
              {
                user_id: userId,
                stripe_customer_id: customerId ?? undefined,
                stripe_subscription_id: sub.id,
                status,
                product_id: productId,
                current_period_end: periodEndIso,
                updated_at: nowIso(),
              },
              { onConflict: "user_id" }
            );
          }
        } else if (customerId && userId) {
          await supabase.from("user_billing").upsert(
            {
              user_id: userId,
              stripe_customer_id: customerId,
              updated_at: nowIso(),
            },
            { onConflict: "user_id" }
          );
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        let userId = (sub.metadata?.user_id as string) || null;

        if (!userId) userId = await lookupUserIdByCustomer(customerId);

        const productId = sub.items.data[0]?.price.product as string | null;
        const periodEndIso = toISO(sub.current_period_end);
        const status = sub.status;

        if (userId) {
          await supabase.from("user_billing").upsert(
            {
              user_id: userId,
              stripe_customer_id: customerId,
              stripe_subscription_id: sub.id,
              status,
              product_id: productId,
              current_period_end: periodEndIso,
              updated_at: nowIso(),
            },
            { onConflict: "user_id" }
          );
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const inv = event.data.object as Stripe.Invoice;
        const customerId = inv.customer as string;
        const subscriptionId = inv.subscription as string | null;

        const userId = await lookupUserIdByCustomer(customerId);
        let productId = (inv.lines?.data?.[0]?.price?.product as string) || null;
        let status = "active";
        let periodEndIso: string | null = null;

        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          productId = (sub.items.data[0]?.price.product as string) ?? productId;
          status = sub.status;
          periodEndIso = toISO(sub.current_period_end);
        }

        if (userId) {
          await supabase.from("user_billing").upsert(
            {
              user_id: userId,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId ?? undefined,
              status,
              product_id: productId,
              current_period_end: periodEndIso,
              updated_at: nowIso(),
            },
            { onConflict: "user_id" }
          );
        }
        break;
      }

      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        const customerId = inv.customer as string;
        const userId = await lookupUserIdByCustomer(customerId);

        if (userId) {
          await supabase.from("user_billing").upsert(
            {
              user_id: userId,
              stripe_customer_id: customerId,
              stripe_subscription_id: (inv.subscription as string) ?? undefined,
              status: "past_due",
              updated_at: nowIso(),
            },
            { onConflict: "user_id" }
          );
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("webhook handler error", event.type, (err as Error).message);
  }

  return ok();
});

async function lookupUserIdByCustomer(customerId: string): Promise<string | null> {
  const { data } = await supabase
    .from("user_billing")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.user_id ?? null;
}
