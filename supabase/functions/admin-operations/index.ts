import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase environment variables");
}

// Initialize admin client (service role)
const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Verify that the requesting user is an admin
 */
async function verifyAdmin(userId: string): Promise<boolean> {
  const { data, error } = await adminClient.rpc("check_user_admin_role", {
    user_id_param: userId,
  });

  if (error) {
    console.error("Error checking admin role:", error);
    return false;
  }

  return data === true;
}

/**
 * Get authenticated user ID from request
 */
async function getAuthUserId(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Error("Missing authorization header");
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await adminClient.auth.getUser(token);

  if (error || !user) {
    throw new Error("Invalid token");
  }

  return user.id;
}

interface HandlerContext {
  admin: SupabaseClient;
  userId: string;
  body: any;
}

type Handler = (ctx: HandlerContext) => Promise<Response>;

const handlers: Record<string, Handler> = {
  /**
   * List all users with their profiles and roles
   */
  async list_users({ admin }: HandlerContext) {
    // Fetch users from auth
    const { data: authUsers, error: authError } = await admin.auth.admin.listUsers();

    if (authError) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch users: ${authError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch profiles
    const { data: profiles, error: profileError } = await admin
      .from("profiles")
      .select("id, display_name, subscription_plan, subscription_status, subscription_active, credits");

    if (profileError) {
      console.error("Error fetching profiles:", profileError);
    }

    // Fetch user roles
    const { data: roles, error: rolesError } = await admin
      .from("user_roles")
      .select("user_id, role");

    if (rolesError) {
      console.error("Error fetching roles:", rolesError);
    }

    // Combine data
    const users = authUsers.users.map((authUser) => {
      const profile = profiles?.find((p) => p.id === authUser.id);
      const userRole = roles?.find((r) => r.user_id === authUser.id);

      return {
        id: authUser.id,
        email: authUser.email ?? "",
        created_at: authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at ?? null,
        profile: profile
          ? {
              display_name: profile.display_name,
              subscription_plan: profile.subscription_plan,
              subscription_status: profile.subscription_status,
              subscription_active: profile.subscription_active,
              credits: profile.credits || 0,
            }
          : undefined,
        role: userRole?.role,
      };
    });

    return new Response(JSON.stringify({ data: users }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  },

  /**
   * Update user credits
   */
  async update_credits({ admin, body }: HandlerContext) {
    const { user_id, amount, operation, reason } = body;

    if (!user_id || !amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid user_id or amount" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["add", "remove"].includes(operation)) {
      return new Response(
        JSON.stringify({ error: "Invalid operation. Must be 'add' or 'remove'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      // Get current credits
      const { data: profile, error: fetchError } = await admin
        .from("profiles")
        .select("credits")
        .eq("id", user_id)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      const currentCredits = profile?.credits || 0;
      const newCredits =
        operation === "add"
          ? currentCredits + amount
          : Math.max(0, currentCredits - amount);

      // Update credits
      const { error: updateError } = await admin
        .from("profiles")
        .update({ credits: newCredits })
        .eq("id", user_id);

      if (updateError) {
        throw updateError;
      }

      // Log transaction
      const { error: logError } = await admin.from("credit_transactions").insert({
        user_id,
        amount: operation === "add" ? amount : -amount,
        description: reason || `Admin ${operation === "add" ? "added" : "removed"} credits`,
        transaction_type: "admin_adjustment",
      });

      if (logError) {
        console.error("Error logging credit transaction:", logError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Successfully ${operation === "add" ? "added" : "removed"} ${amount} credits`,
          new_credits: newCredits,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error: any) {
      console.error("Error updating credits:", error);
      return new Response(
        JSON.stringify({ error: error.message || "Failed to update credits" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  },

  /**
   * Update user subscription
   */
  async update_subscription({ admin, body }: HandlerContext) {
    const { user_id, subscription_plan, subscription_active } = body;

    if (!user_id || !subscription_plan) {
      return new Response(
        JSON.stringify({ error: "Missing user_id or subscription_plan" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      const { error } = await admin
        .from("profiles")
        .update({
          subscription_plan,
          subscription_active: subscription_active ?? true,
          subscription_status: subscription_active ? "active" : "inactive",
        })
        .eq("id", user_id);

      if (error) {
        throw error;
      }

      return new Response(
        JSON.stringify({ success: true, message: "Subscription updated successfully" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error: any) {
      console.error("Error updating subscription:", error);
      return new Response(
        JSON.stringify({ error: error.message || "Failed to update subscription" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  },

  /**
   * Toggle admin role for a user
   */
  async toggle_admin_role({ admin, body }: HandlerContext) {
    const { user_id, grant } = body;

    if (!user_id || typeof grant !== "boolean") {
      return new Response(
        JSON.stringify({ error: "Missing user_id or invalid grant parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      if (grant) {
        // Add admin role
        const { error } = await admin.from("user_roles").insert({
          user_id,
          role: "admin",
        });

        if (error) {
          throw error;
        }

        return new Response(
          JSON.stringify({ success: true, message: "Admin role granted successfully" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        // Remove admin role
        const { error } = await admin
          .from("user_roles")
          .delete()
          .eq("user_id", user_id)
          .eq("role", "admin");

        if (error) {
          throw error;
        }

        return new Response(
          JSON.stringify({ success: true, message: "Admin role revoked successfully" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch (error: any) {
      console.error("Error updating role:", error);
      return new Response(
        JSON.stringify({ error: error.message || "Failed to update role" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  },

  /**
   * Get admin logs
   */
  async get_admin_logs({ admin, body }: HandlerContext) {
    const limit = body.limit || 100;

    try {
      const { data, error } = await admin
        .from("admin_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return new Response(JSON.stringify({ data: data || [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error: any) {
      console.error("Error fetching admin logs:", error);
      return new Response(
        JSON.stringify({ error: error.message || "Failed to fetch admin logs" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  },

};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Get authenticated user
    const userId = await getAuthUserId(req);

    // Verify user is admin
    const isAdmin = await verifyAdmin(userId);
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json().catch(() => ({}));

    // Get action from query parameter or body
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || body.action;

    if (!action) {
      return new Response(
        JSON.stringify({ error: "Missing action parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const handler = handlers[action];
    if (!handler) {
      return new Response(
        JSON.stringify({ error: `Unknown action: ${action}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Execute handler
    const response = await handler({
      admin: adminClient,
      userId,
      body,
    });

    return response;
  } catch (error: any) {
    console.error("Unhandled error in admin-operations:", error);
    const status = error.message?.includes("Unauthorized") || error.message?.includes("token")
      ? 401
      : 500;
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

