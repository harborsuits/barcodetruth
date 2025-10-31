import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders, okJson, errJson } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(req) });
  }

  try {
    console.log("[run-enrichment-queue] Starting queue processing");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Pull up to 15 queued jobs
    const { data: jobs, error } = await supabase
      .from("brand_enrichment_queue")
      .select("id, brand_id, task, attempts")
      .eq("status", "queued")
      .lte("run_after", new Date().toISOString())
      .lt("attempts", 5)
      .order("created_at", { ascending: true })
      .limit(15);

    if (error) {
      console.error("[run-enrichment-queue] fetch error", error);
      return errJson(500, error.message, req);
    }

    if (!jobs?.length) {
      console.log("[run-enrichment-queue] No jobs to process");
      return okJson({ ok: true, processed: 0 }, req);
    }

    console.log(`[run-enrichment-queue] Processing ${jobs.length} jobs`);

    let ok = 0, fail = 0;

    for (const j of jobs) {
      // Mark as running
      await supabase
        .from("brand_enrichment_queue")
        .update({ status: "running" })
        .eq("id", j.id);

      try {
        console.log(`[run-enrichment-queue] Enriching brand ${j.brand_id} (task: ${j.task})`);

        // Call existing enrichment function
        const res = await supabase.functions.invoke("enrich-brand-wiki", {
          body: {
            brand_id: j.brand_id,
            mode: j.task === "full" ? "full" : "fast"
          }
        });

        if (res.error) {
          throw new Error(res.error.message || "enrich error");
        }

        // Mark as done
        await supabase
          .from("brand_enrichment_queue")
          .update({ status: "done" })
          .eq("id", j.id);

        ok++;
        console.log(`[run-enrichment-queue] Successfully enriched brand ${j.brand_id}`);

        // Polite spacing between API calls
        await new Promise(r => setTimeout(r, 250));

      } catch (e: any) {
        fail++;
        console.error(`[run-enrichment-queue] Failed to enrich brand ${j.brand_id}:`, e.message);

        // Exponential backoff: 5, 10, 20, 40, 60 minutes
        const backoffMin = Math.min(60, Math.pow(2, (j.attempts ?? 0)) * 5);
        const runAfter = new Date(Date.now() + backoffMin * 60000).toISOString();

        await supabase
          .from("brand_enrichment_queue")
          .update({
            status: "queued",
            attempts: (j.attempts ?? 0) + 1,
            last_error: e?.message ?? "unknown",
            run_after: runAfter
          })
          .eq("id", j.id);
      }
    }

    console.log(`[run-enrichment-queue] Complete: ${ok} ok, ${fail} failed`);
    return okJson({ ok: true, processed: jobs.length, succeeded: ok, failed: fail }, req);
  } catch (e: any) {
    console.error("[run-enrichment-queue] error", e);
    return errJson(500, e?.message ?? "internal error", req);
  }
});
