// Proxy server-side para o Supabase. A service_role fica apenas nesta função.

const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SERVICE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
const SHARED_KEY = String(process.env.DOJO_API_SECRET || "");
const PUB_KEY = String(process.env.SUPABASE_ANON_KEY || "");

const headers = () => ({
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
});

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-dojo-key");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  const bearer = String(req.headers.authorization || "");
  if (bearer.startsWith("Bearer ")) {
    const token = bearer.slice(7);
    const check = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: PUB_KEY, Authorization: `Bearer ${token}` },
    });
    if (!check.ok) {
      res.status(401).json({ error: "invalid token" });
      return;
    }
  } else if (!SHARED_KEY || req.headers["x-dojo-key"] !== SHARED_KEY) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    res.status(500).json({ error: "backend not configured" });
    return;
  }

  try {
    const { action, args } = req.body || {};
    const collection = String(args?.collection || "");
    const base = `${SUPABASE_URL}/rest/v1/records`;
    const filter = (extra) => `${base}?collection=eq.${encodeURIComponent(collection)}${extra}`;
    let data = {};

    if (action === "records.list") {
      const limit = Math.min(Number(args?.limit) || 200, 1000);
      const r = await fetch(filter(`&select=id,value&limit=${limit}`), { headers: headers() });
      if (!r.ok) throw new Error(`supabase ${r.status}`);
      const rows = await r.json();
      data = { records: (Array.isArray(rows) ? rows : []).map((row) => ({ id: row.id, value: row.value })) };
    } else if (action === "records.create") {
      const r = await fetch(base, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ collection, value: args.value }),
      });
      if (!r.ok) throw new Error(`supabase ${r.status}`);
      const rows = await r.json();
      data = { id: rows?.[0]?.id || null };
    } else if (action === "records.replace") {
      const r = await fetch(filter(`&id=eq.${encodeURIComponent(String(args.id))}`), {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ value: args.value }),
      });
      if (!r.ok) throw new Error(`supabase ${r.status}`);
      data = {};
    } else if (action === "records.delete") {
      const r = await fetch(filter(`&id=eq.${encodeURIComponent(String(args.id))}`), {
        method: "DELETE",
        headers: headers(),
      });
      if (!r.ok) throw new Error(`supabase ${r.status}`);
      data = {};
    } else {
      throw new Error(`unknown action ${action}`);
    }

    res.status(200).json({ data });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
