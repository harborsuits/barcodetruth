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

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.customer && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          const customer = await stripe.customers.retrieve(session.customer as string);
          
          if (customer.deleted) {
            console.error("Customer was deleted");
            break;
          }
          
          const email = customer.email;
          if (!email) {
            console.error("No customer email");
            break;
          }

          // Get user from email
          const { data: usersData } = await supabase.auth.admin.listUsers();
          const user = usersData.users.find(u => u.email === email);
          if (!user) {
            console.error(`User not found: ${email}`);
            break;
          }

          // Create or update billing record
          const { error: upsertError } = await supabase.from("user_billing").upsert({
            user_id: user.id,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: subscription.id,
            status: subscription.status,
            product_id: subscription.items.data[0]?.price?.product as string || null,
            current_period_end: toISO(subscription.current_period_end),
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });

          if (upsertError) {
            console.error("Error upserting billing:", upsertError);
          } else {
            console.log(`Subscription created for user ${user.id}`);
          }
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        
        // Get user by customer ID (use maybeSingle to handle edge cases)
        const { data: billing, error: billingError } = await supabase
          .from("user_billing")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (billingError) {
          console.error(`Error fetching billing for customer ${customerId}:`, billingError);
          return new Response(JSON.stringify({ error: 'Database error' }), { status: 500 });
        }

        if (billing) {
          // Log sensitive billing data access
          await supabase.rpc('log_sensitive_access', {
            p_action: 'subscription_updated',
            p_table_name: 'user_billing',
            p_record_id: billing.user_id,
            p_details: {
              subscription_id: subscription.id,
              status: subscription.status,
              event_type: event.type
            }
          });

          await supabase
            .from("user_billing")
            .update({
              stripe_subscription_id: subscription.id,
              status: subscription.status,
              product_id: subscription.items.data[0]?.price?.product as string || null,
              current_period_end: toISO(subscription.current_period_end),
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", billing.user_id);
          
          console.log(`Updated subscription for user ${billing.user_id}`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data: billing, error: billingError } = await supabase
          .from("user_billing")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (billingError) {
          console.error(`Error fetching billing for customer ${customerId}:`, billingError);
          return new Response(JSON.stringify({ error: 'Database error' }), { status: 500 });
        }

        if (billing) {
          // Log sensitive billing data access
          await supabase.rpc('log_sensitive_access', {
            p_action: 'subscription_canceled',
            p_table_name: 'user_billing',
            p_record_id: billing.user_id,
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
            .eq("user_id", billing.user_id);
          
          console.log(`Canceled subscription for user ${billing.user_id}`);
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
