import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_FEATURES = new Set([
  "LOGIN",
  "REGISTER",
  "DASHBOARD",
  "ATTENDANCE",
  "PAYMENT_UPLOAD",
  "TEACHER_FEE",
  "PAYMENT_VERIFICATION",
]);

const MAX_STRING_LENGTH = 500;
const FORBIDDEN_METADATA_KEYS = new Set([
  "password",
  "access_token",
  "refresh_token",
  "secret_key",
]);

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const anonymousRateLimitStore = new Map<string, number[]>();

interface ReportPayload {
  feature: string;
  action: string;
  message: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
  path?: string;
  userAgent?: string;
  timestamp?: string;
}

interface SystemErrorEventRow {
  id: string;
  occurrence_count: number;
}

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

function sanitizeMetadata(
  metadata: Record<string, unknown>
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (FORBIDDEN_METADATA_KEYS.has(key.toLowerCase())) continue;
    if (typeof value === "string") {
      sanitized[key] = truncate(value, MAX_STRING_LENGTH);
    } else if (typeof value === "number" || typeof value === "boolean") {
      sanitized[key] = value;
    } else if (value && typeof value === "object") {
      sanitized[key] = sanitizeMetadata(value as Record<string, unknown>);
    } else {
      sanitized[key] = null;
    }
  }
  return sanitized;
}

function buildFingerprint(
  feature: string,
  action: string,
  message: string,
  path: string
): string {
  return `${feature}|${action}|${message}|${path}`;
}

function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "anonymous"
  );
}

function checkAnonymousRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = anonymousRateLimitStore.get(ip) || [];
  const recent = timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    return false;
  }
  recent.push(now);
  anonymousRateLimitStore.set(ip, recent);
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 405 }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const adminNotificationEmail = Deno.env.get("ADMIN_NOTIFICATION_EMAIL");

    if (!supabaseUrl || !supabaseServiceRoleKey || !adminNotificationEmail) {
      return new Response(
        JSON.stringify({ error: "Missing required environment variables" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    let body: ReportPayload;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON payload" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const {
      feature,
      action,
      message,
      durationMs,
      metadata,
      path,
      userAgent,
      timestamp,
    } = body;

    if (!feature || !action || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: feature, action, message" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const normalizedFeature = feature.toUpperCase();
    if (!ALLOWED_FEATURES.has(normalizedFeature)) {
      return new Response(
        JSON.stringify({ error: "Feature not allowed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const safeFeature = truncate(normalizedFeature, MAX_STRING_LENGTH);
    const safeAction = truncate(action, MAX_STRING_LENGTH);
    const safeMessage = truncate(message, MAX_STRING_LENGTH);
    const safePath = path ? truncate(path, MAX_STRING_LENGTH) : null;
    const safeUserAgent = userAgent ? truncate(userAgent, MAX_STRING_LENGTH) : null;
    const safeMetadata = metadata ? sanitizeMetadata(metadata) : {};

    const isAnonymousFeature =
      normalizedFeature === "LOGIN" || normalizedFeature === "REGISTER";

    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");

    if (!isAnonymousFeature) {
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ error: "Missing authorization" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
        );
      }

      const token = authHeader.slice(7);
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
          return new Response(
            JSON.stringify({ error: "Invalid authorization" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
          );
        }
        userId = user.id;
      } catch {
        return new Response(
          JSON.stringify({ error: "Invalid authorization" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
        );
      }
    } else if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (!authError && user) {
          userId = user.id;
        }
      } catch {
        // ignore auth errors for anonymous feature
      }
    }

    const fingerprint = buildFingerprint(safeFeature, safeAction, safeMessage, safePath ?? "");

    if (isAnonymousFeature && userId === null) {
      const ip = getClientIp(req);
      if (!checkAnonymousRateLimit(ip)) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }
        );
      }
    }

    const { error: rpcError } = await supabase.rpc("upsert_system_error_event", {
      p_fingerprint: fingerprint,
      p_feature: safeFeature,
      p_action: safeAction,
      p_message: safeMessage,
      p_path: safePath,
      p_user_id: userId,
      p_metadata: safeMetadata,
    });

    if (rpcError) {
      return new Response(
        JSON.stringify({ error: rpcError.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: recentEmail, error: emailFetchError } = await supabase
      .from("email_queue")
      .select("id")
      .eq("event_type", "SYSTEM_ERROR")
      .gte("created_at", fifteenMinutesAgo)
      .contains("payload", { fingerprint })
      .maybeSingle();

    if (emailFetchError) {
      return new Response(
        JSON.stringify({ error: emailFetchError.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    if (!recentEmail) {
      const safePayload = {
        fingerprint,
        feature: safeFeature,
        action: safeAction,
        message: safeMessage,
        path: safePath,
        user_id: userId,
        durationMs: durationMs ?? null,
        userAgent: safeUserAgent,
        timestamp: timestamp ?? new Date().toISOString(),
        metadata: safeMetadata,
      };

      const { error: queueError } = await supabase
        .from("email_queue")
        .insert({
          event_type: "SYSTEM_ERROR",
          target_id: crypto.randomUUID(),
          recipient_email: adminNotificationEmail,
          subject: `[QuickSpeak] Critical System Error: ${safeFeature}`,
          payload: safePayload,
          status: "pending",
        });

      if (queueError) {
        return new Response(
          JSON.stringify({ error: queueError.message }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

export {};
