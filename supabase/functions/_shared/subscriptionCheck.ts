// Shared subscription verification utility for edge functions
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const BILLING_MODE = Deno.env.get("BILLING_MODE") || "SUBSCRIPTION";

interface SubscriptionCheckResult {
  hasAccess: boolean;
  isPremium: boolean;
  error?: string;
}

/**
 * Check if user has access based on billing mode
 * - CREDIT mode: Checks if user has credits > 0
 * - SUBSCRIPTION mode: Checks if subscription is active
 */
export async function checkSubscriptionAccess(
  supabase: SupabaseClient,
  userId: string
): Promise<SubscriptionCheckResult> {
  try {
    if (BILLING_MODE === "CREDIT") {
      // Credit mode: Check credit balance
      const { data, error } = await supabase
        .from("user_credits")
        .select("credits")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("[subscriptionCheck] Error fetching credits:", error);
        return { hasAccess: false, isPremium: false, error: error.message };
      }

      const credits = data?.credits || 0;
      return {
        hasAccess: credits > 0,
        isPremium: false, // Credit mode doesn't have premium tiers
      };
    } else {
      // Subscription mode: Check subscription status
      const { data, error } = await supabase
        .from("profiles")
        .select("subscription_active, subscription_status, subscription_plan")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("[subscriptionCheck] Error fetching subscription:", error);
        return { hasAccess: false, isPremium: false, error: error.message };
      }

      const isActive =
        data?.subscription_active &&
        ["active", "trialing"].includes(data?.subscription_status || "");

      // Check if premium plan
      const planId = data?.subscription_plan || "";
      const isPremium =
        planId === "25_monthly" ||
        planId === "subscription_professional" ||
        planId.toLowerCase().includes("premium");

      return {
        hasAccess: isActive,
        isPremium: isPremium && isActive,
      };
    }
  } catch (err) {
    console.error("[subscriptionCheck] Exception:", err);
    return {
      hasAccess: false,
      isPremium: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Check if user has premium plan access (for voice features)
 */
export async function checkPremiumAccess(
  supabase: SupabaseClient,
  userId: string
): Promise<SubscriptionCheckResult> {
  const result = await checkSubscriptionAccess(supabase, userId);
  
  if (BILLING_MODE === "CREDIT") {
    // In credit mode, premium features require credits
    return result;
  }

  // In subscription mode, premium features require premium plan
  return {
    ...result,
    hasAccess: result.hasAccess && result.isPremium,
  };
}

