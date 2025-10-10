import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });

const PRICE_SUBSCRIPTION = Deno.env.get("PRICE_SUBSCRIPTION")!;

serve(async (req) => {
  console.log("[CREATE-CHECKOUT] Function invoked");
  
  if (req.method === "OPTIONS") {
    console.log("[CREATE-CHECKOUT] Handling OPTIONS request");
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    console.log("[CREATE-CHECKOUT] Authenticating user");
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[CREATE-CHECKOUT] No authorization header");
      throw new Error("No authorization header provided");
    }
    
    const token = authHeader.replace("Bearer ", "");
    const { data, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError) {
      console.error("[CREATE-CHECKOUT] Auth error:", authError.message);
      throw new Error(`Authentication error: ${authError.message}`);
    }
    
    const user = data.user;
    if (!user?.email) {
      console.error("[CREATE-CHECKOUT] No user or email found");
      throw new Error("User not authenticated or email not available");
    }
    
    console.log("[CREATE-CHECKOUT] User authenticated:", user.email);

    const { metadata = {} } = await req.json().catch(() => ({}));
    console.log("[CREATE-CHECKOUT] Creating subscription checkout");

    if (!PRICE_SUBSCRIPTION) {
      console.error("[CREATE-CHECKOUT] Missing PRICE_SUBSCRIPTION env var");
      throw new Error("Missing Stripe price ID. Please set PRICE_SUBSCRIPTION secret");
    }
    console.log("[CREATE-CHECKOUT] Using price:", PRICE_SUBSCRIPTION);

    const origin = req.headers.get("origin") || Deno.env.get("APP_URL") || "https://lovable.app";
    const successUrl = Deno.env.get("SUCCESS_URL") || origin;
    const cancelUrl = Deno.env.get("CANCEL_URL") || origin;
    console.log("[CREATE-CHECKOUT] success_url:", successUrl, "cancel_url:", cancelUrl);

    console.log("[CREATE-CHECKOUT] Looking up Stripe customer");
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      console.log("[CREATE-CHECKOUT] Found existing customer:", customerId);
    } else {
      console.log("[CREATE-CHECKOUT] No existing customer found");
    }

    console.log("[CREATE-CHECKOUT] Creating checkout session");
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: PRICE_SUBSCRIPTION, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
    });

    console.log("[CREATE-CHECKOUT] Session created successfully:", session.id);
    return new Response(JSON.stringify({ id: session.id, url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[CREATE-CHECKOUT] Error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
