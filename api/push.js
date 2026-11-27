import { sendPush } from "../lib/push.js";

const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const PUB_KEY = String(process.env.SUPABASE_ANON_KEY || "");

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "method not allowed" }); return; }

  const bearer = String(req.headers.authorization || "");
  if (!bearer.startsWith("Bearer ")) { res.status(401).json({ error: "token required" }); return; }
  const check = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: PUB_KEY, Authorization: bearer },
  });
  if (!check.ok) { res.status(401).json({ error: "invalid token" }); return; }

  try {
    const { profile, sender, text } = req.body || {};
    if (!profile || !sender || !text) { res.status(400).json({ error: "missing fields" }); return; }
    const result = await sendPush(profile, sender, text);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
