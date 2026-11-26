import webpush from "web-push";

const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY = String(process.env.SUPABASE_ANON_KEY || "");
const VAPID_PUBLIC = String(process.env.VAPID_PUBLIC_KEY || "");
const VAPID_PRIVATE = String(process.env.VAPID_PRIVATE_KEY || "");
const VAPID_SUBJECT = String(process.env.VAPID_SUBJECT || "mailto:contato@dojo.local");

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  try {
    const { profile, sender, text } = req.body || {};
    if (!profile || !sender || !text) {
      res.status(400).json({ error: "missing fields" });
      return;
    }
    if (!SUPABASE_URL || !SUPABASE_KEY || !VAPID_PUBLIC || !VAPID_PRIVATE) {
      res.status(500).json({ error: "push not configured" });
      return;
    }

    const url = `${SUPABASE_URL}/rest/v1/records?collection=eq.dojo_push_subscriptions&select=id,value&limit=500`;
    const listRes = await fetch(url, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!listRes.ok) throw new Error(`supabase ${listRes.status}`);
    const rows = await listRes.json();

    const isGroup = String(profile).startsWith("grupo:");
    const targets = (Array.isArray(rows) ? rows : [])
      .map((r) => r.value)
      .filter((v) => {
        if (!v || !v.subscription || !v.subscription.endpoint) return false;
        if (v.profile === sender) return false;
        if (isGroup) return Array.isArray(v.groups) && v.groups.includes(profile);
        return v.profile === profile;
      });

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    const payload = JSON.stringify({
      title: `Dojo — ${sender}`,
      body: String(text).slice(0, 180),
      url: `/?chat=${encodeURIComponent(String(profile))}`,
      tag: `dojo-${Date.now()}`,
    });

    const results = await Promise.allSettled(targets.map((v) => webpush.sendNotification(v.subscription, payload)));
    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - sent;
    res.status(200).json({ sent, failed });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
