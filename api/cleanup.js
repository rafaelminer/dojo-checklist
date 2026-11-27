import { deleteRecord, listOlderThan } from "../lib/supabase.js";

// Remove registros operacionais antigos conforme a política de retenção.
// Nunca apaga cadastros, modelos, regras ou limites.

const COLLECTIONS = [
  "dojo_entries",
  "dojo_submissions",
  "dojo_chat",
  "dojo_chat_reads",
  "dojo_quality_answers",
  "dojo_temps",
  "dojo_action_plans",
  "dojo_handovers",
  "dojo_shortages",
  "dojo_weekly",
  "dojo_expiries",
  "dojo_maintenance",
  "dojo_stock_counts",
  "dojo_receivings",
  "dojo_signatures",
  "dojo_logbook",
  "dojo_trainings",
  "dojo_item_catalog_meta",
];

export default async function handler(req, res) {
  const secret = String(process.env.CRON_SECRET || "");
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const days = Math.max(30, Math.min(3650, Number(req.query?.days || process.env.RETENTION_DAYS || 365)));
  const dry = String(req.query?.dry || "") === "1";
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  const result = {};
  try {
    for (const collection of COLLECTIONS) {
      const rows = await listOlderThan(collection, cutoff);
      result[collection] = rows.length;
      if (!dry) {
        for (const row of rows) await deleteRecord(row.id);
      }
    }
    res.status(200).json({ days, cutoff, dry, deleted: result });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
