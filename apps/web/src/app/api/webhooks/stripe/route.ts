import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "@/lib/auth/supabase-server";
import { getCreditLimitByPriceId } from "@/lib/stripe-config";

function getStripe() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY environment variable");
  }

  return new Stripe(stripeSecretKey, {
    apiVersion: "2026-01-28.clover",
  });
}

function getStripeWebhookSecret() {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error("Missing STRIPE_WEBHOOK_SECRET environment variable");
  }

  return webhookSecret;
}

export async function POST(request: Request) {
  const payload = await request.text();
  const sig = request.headers.get("stripe-signature") || "";

  let stripe: Stripe;
  let endpointSecret: string;
  let event: Stripe.Event;

  try {
    stripe = getStripe();
    endpointSecret = getStripeWebhookSecret();
  } catch (err: any) {
    console.error(`Stripe configuration error: ${err.message}`);
    return NextResponse.json(
      { error: `Stripe configuration error: ${err.message}` },
      { status: 500 },
    );
  }

  try {
    event = stripe.webhooks.constructEvent(payload, sig, endpointSecret);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 },
    );
  }

  console.log(`Received webhook event: ${event.type}`);

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;

      console.log("Processing subscription:", subscription.id);
      console.log("Subscription metadata:", subscription.metadata);
      console.log("Customer ID:", subscription.customer);

      let userId = subscription.metadata.userId;

      if (!userId) {
        console.log(
          "No userId in subscription metadata, fetching from customer...",
        );
        try {
          const customer = await stripe.customers.retrieve(
            subscription.customer as string,
          );
          if (customer && !customer.deleted) {
            userId = customer.metadata.userId;
            console.log("Found userId in customer metadata:", userId);
          }
        } catch (err) {
          console.error("Error fetching customer:", err);
        }
      }

      if (!userId) {
        console.log("No userId found, searching database by customer ID...");
        const { data: userData, error } = await supabaseServer
          .from("users")
          .select("id")
          .eq("stripe_customer_id", subscription.customer as string)
          .single();

        if (!error && userData) {
          userId = userData.id;
          console.log("Found userId in database:", userId);
        } else if (error) {
          console.error("Database search error:", error);
        }
      }

      if (userId) {
        console.log("Updating user subscription for userId:", userId);

        let customerEmail = null;
        try {
          const customer = await stripe.customers.retrieve(
            subscription.customer as string,
          );
          if (customer && !customer.deleted && customer.email) {
            customerEmail = customer.email;
            console.log("Found customer email:", customerEmail);
          }
        } catch (err) {
          console.error("Error fetching customer email:", err);
        }

        if (!customerEmail) {
          console.log("No email from Stripe, checking existing user record...");
          const { data: existingUser, error: userError } = await supabaseServer
            .from("users")
            .select("email")
            .eq("id", userId)
            .single();

          if (!userError && existingUser?.email) {
            customerEmail = existingUser.email;
            console.log("Found email in existing user record:", customerEmail);
          }
        }

        let creditsAvailable = 0;

        if (subscription.status === "active") {
          creditsAvailable = getCreditLimitByPriceId(
            subscription.items.data[0].price.id,
          );
          console.log(
            "Credits calculated:",
            creditsAvailable,
            "for price:",
            subscription.items.data[0].price.id,
          );
        }

        const updateData = {
          id: userId,
          email: customerEmail,
          stripe_subscription_id: subscription.id,
          stripe_customer_id: subscription.customer as string,
          subscription_status: subscription.status,
          price_id: subscription.items.data[0].price.id,
          credits_available: creditsAvailable,
          current_period_end: (subscription as any).current_period_end
            ? new Date(
                (subscription as any).current_period_end * 1000,
              ).toISOString()
            : null,
        };

        console.log("Update data:", updateData);

        const { error } = await supabaseServer
          .from("users")
          .upsert(updateData, {
            onConflict: "id",
          });

        if (error) {
          console.error("Error updating user subscription:", error);
          throw new Error(`Database update failed: ${error.message}`);
        } else {
          console.log("Successfully updated user subscription");
        }
      } else {
        console.error(
          "Could not find userId for subscription:",
          subscription.id,
        );
        throw new Error("Could not find userId for subscription");
      }
      break;
    }

    case "customer.subscription.deleted": {
      const deletedSubscription = event.data.object as Stripe.Subscription;
      const deletedUserId = deletedSubscription.metadata.userId;

      if (deletedUserId) {
        const { error } = await supabaseServer
          .from("users")
          .update({
            subscription_status: "canceled",
            credits_available: 0,
          })
          .eq("stripe_subscription_id", deletedSubscription.id);

        if (error) {
          console.error("Error updating user subscription:", error);
        }
      }
      break;
    }

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
