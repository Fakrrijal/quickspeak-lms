import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_EVENT_TYPES = new Set([
  "WAITING_STUDENTS",
  "WAITING_TEACHERS",
  "PAYMENT_VERIFICATION",
  "SYSTEM_ERROR",
]);

interface EmailQueueRow {
  id: string;
  event_type: string;
  target_id: string;
  recipient_email: string;
  subject: string;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  available_at: string;
  sent_at: string | null;
  last_error: string | null;
  created_at: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

   try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const adminNotificationEmail = Deno.env.get("ADMIN_NOTIFICATION_EMAIL");
    const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL");

    if (!supabaseUrl || !supabaseServiceRoleKey || !resendApiKey || !adminNotificationEmail || !resendFromEmail) {
      return new Response(
        JSON.stringify({ error: "Missing required environment variables" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

     const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

      const nowIso = new Date().toISOString();

      const { data: candidates, error: fetchError } = await supabase
        .from("email_queue")
        .select("*")
        .eq("status", "pending")
        .lte("available_at", nowIso)
        .order("created_at", { ascending: true })
        .limit(10);

      if (fetchError) {
        return new Response(
          JSON.stringify({ error: fetchError.message }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }

      const rows = (candidates ?? []) as EmailQueueRow[];
      if (rows.length === 0) {
        return new Response(
          JSON.stringify({ message: "No pending emails" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      const results: Array<{ id: string; status: string; error?: string }> = [];

      for (const candidate of rows) {
        try {
          const { data: claimed, error: claimError } = await supabase
            .from("email_queue")
            .update({
              status: "processing",
              attempts: candidate.attempts + 1,
            })
            .eq("id", candidate.id)
            .eq("status", "pending")
            .select("*")
            .maybeSingle();

          if (claimError || !claimed) {
            results.push({ id: candidate.id, status: "skipped", error: "Row already claimed by another worker" });
            continue;
          }

          const row = claimed as EmailQueueRow;

          if (!VALID_EVENT_TYPES.has(row.event_type)) {
            await supabase
              .from("email_queue")
              .update({
                status: "failed",
                last_error: `Invalid event_type: ${row.event_type}`,
              })
              .eq("id", row.id);

            results.push({ id: row.id, status: "failed", error: `Invalid event_type: ${row.event_type}` });
            continue;
          }

          const resendRequest = {
            url: "https://api.resend.com/emails",
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: resendFromEmail,
              to: [adminNotificationEmail],
              subject: row.subject,
              html: buildEmailHtml(row.event_type, row.payload),
            }),
          };

          const resendResponse = await fetch(resendRequest.url, {
            method: resendRequest.method,
            headers: resendRequest.headers,
            body: resendRequest.body,
          });

          if (resendResponse.ok) {
            await supabase
              .from("email_queue")
              .update({
                status: "sent",
                sent_at: nowIso,
                last_error: null,
              })
              .eq("id", row.id);

            results.push({ id: row.id, status: "sent" });
          } else {
            const errorText = await resendResponse.text();
            await supabase
              .from("email_queue")
              .update({
                status: "failed",
                last_error: errorText || `Resend API error: ${resendResponse.status}`,
              })
              .eq("id", row.id);

            results.push({ id: row.id, status: "failed", error: errorText || `Resend API error: ${resendResponse.status}` });
          }
        } catch (err) {
          const rowId = candidate.id;
          const message = (err as Error).message;
          await supabase
            .from("email_queue")
            .update({
              status: "failed",
              last_error: message,
            })
            .eq("id", rowId);

          results.push({ id: rowId, status: "failed", error: message });
        }
      }

      return new Response(
        JSON.stringify({ message: "Batch processed", processed: rows.length, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ error: (err as Error).message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
  });

function buildEmailHtml(eventType: string, payload: Record<string, unknown>): string {
  const data = JSON.stringify(payload, null, 2);
  switch (eventType) {
    case "WAITING_STUDENTS":
      return `<h2>New Student Waiting for Approval</h2><pre>${data}</pre>`;
    case "WAITING_TEACHERS":
      return `<h2>New Teacher Waiting for Approval</h2><pre>${data}</pre>`;
    case "PAYMENT_VERIFICATION":
      return `<h2>Payment Verification Required</h2><pre>${data}</pre>`;
    case "SYSTEM_ERROR":
      return `<h2>Critical System Error</h2><p>A system error has been reported and requires admin attention.</p><pre>${data}</pre>`;
    default:
      return `<p>Notification</p><pre>${data}</pre>`;
  }
}

export {};
