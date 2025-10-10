import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

// Helper to safely convert Unix seconds to ISO string
const toISO = (sec?: number | null): string | null => {
  if (!sec) return null;
  try {
    return new Date(sec * 1000).toISOString();
  } catch {
    return null;
  }
};

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  
  if (!signature || !webhookSecret) {
    console.error("Missing signature or webhook secret");
    return new Response("Webhook error", { status: 400 });
  }

  try {
    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    
    console.log(`Processing webhook: ${event.type}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Idempotency: skip if we've already processed this event
    const { data: existingEvent } = await supabase
      .from("stripe_events")
      .select("id")
      .eq("id", event.id)
      .maybeSingle();

    if (existingEvent) {
      console.log(`Event ${event.id} already processed, skipping`);
      return new Response(JSON.stringify({ received: true, skipped: true }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Record this event as processed
    await supabase.from("stripe_events").insert({ id: event.id });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.customer && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          const customerId = session.customer as string;
          
          // Get user_id from metadata or client_reference_id
          let userId = session.client_reference_id || subscription.metadata?.user_id;
          
          if (!userId) {
            // Fallback: lookup by customer email
            const customer = await stripe.customers.retrieve(customerId);
            if (customer.deleted) {
              console.error("Customer was deleted");
              break;
            }
            
            const email = customer.email;
            if (!email) {
              console.error("No customer email");
              break;
            }

            const { data: usersData } = await supabase.auth.admin.listUsers();
            const user = usersData.users.find(u => u.email === email);
            if (!user) {
              console.error(`User not found: ${email}`);
              break;
            }
            userId = user.id;
          }

          // Store customer mapping for future events
          await supabase.from("stripe_customers").upsert({
            user_id: userId,
            stripe_customer_id: customerId,
          }, { onConflict: "user_id" });

          // Create or update billing record
          const { error: upsertError } = await supabase.from("user_billing").upsert({
            user_id: userId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscription.id,
            status: subscription.status,
            product_id: subscription.items.data[0]?.price?.product as string || null,
            current_period_end: toISO(subscription.current_period_end),
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });

          if (upsertError) {
            console.error("Error upserting billing:", upsertError);
          } else {
            console.log(`Subscription created for user ${userId}`);
          }
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        
        // Try to get user_id from metadata first, then customer mapping
        let userId = subscription.metadata?.user_id;
        
        if (!userId) {
          const { data: customer } = await supabase
            .from("stripe_customers")
            .select("user_id")
            .eq("stripe_customer_id", customerId)
            .maybeSingle();
          userId = customer?.user_id;
        }

        if (!userId) {
          console.error(`No user mapping found for customer ${customerId}`);
          break;
        }

        if (userId) {
          // Log sensitive billing data access
          await supabase.rpc('log_sensitive_access', {
            p_action: 'subscription_updated',
            p_table_name: 'user_billing',
            p_record_id: userId,
            p_details: {
              subscription_id: subscription.id,
              status: subscription.status,
              event_type: event.type
            }
          });

          await supabase
            .from("user_billing")
            .upsert({
              user_id: userId,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscription.id,
              status: subscription.status,
              product_id: subscription.items.data[0]?.price?.product as string || null,
              current_period_end: toISO(subscription.current_period_end),
              updated_at: new Date().toISOString(),
            }, { onConflict: "user_id" });
          
          console.log(`Updated subscription for user ${userId}`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Get user_id from customer mapping
        const { data: customer } = await supabase
          .from("stripe_customers")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        const userId = customer?.user_id;
        if (!userId) {
          console.error(`No user mapping found for customer ${customerId}`);
          break;
        }

        if (userId) {
          // Log sensitive billing data access
          await supabase.rpc('log_sensitive_access', {
            p_action: 'subscription_canceled',
            p_table_name: 'user_billing',
            p_record_id: userId,
            p_details: {
              subscription_id: subscription.id,
              event_type: event.type
            }
          });

          await supabase
            .from("user_billing")
            .update({
              stripe_subscription_id: null,
              status: "canceled",
              product_id: null,
              current_period_end: null,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);
          
          console.log(`Canceled subscription for user ${userId}`);
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        
        console.log(`Payment succeeded for customer ${customerId}`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        
        console.log(`Payment failed for customer ${customerId}`);
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    // Log detailed error server-side for debugging
    console.error("Webhook error:", {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    
    // Return generic error to client (security best practice)
    return new Response(
      JSON.stringify({ error: "Webhook processing failed" }),
      { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
});
