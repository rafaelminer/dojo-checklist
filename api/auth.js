// Autenticação Supabase (JWT) e criação de usuários pelo gerente.

const URL = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const PUB = String(process.env.SUPABASE_ANON_KEY || "");
const SERVICE = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");


export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "method not allowed" }); return; }

  const { action, email, password } = req.body || {};
  if (!URL || !PUB) { res.status(500).json({ error: "auth not configured" }); return; }

  try {
    if (action === "signin") {
      if (!email || !password) { res.status(400).json({ error: "missing credentials" }); return; }
      const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: PUB, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await r.json();
      if (!r.ok) { res.status(401).json({ error: body.msg || body.error_description || "invalid credentials" }); return; }
      res.status(200).json({ access_token: body.access_token, user: body.user });
      return;
    }

    if (action === "create-user") {
      const bearer = String(req.headers.authorization || "");
      if (!bearer.startsWith("Bearer ")) { res.status(401).json({ error: "token required" }); return; }
      const check = await fetch(`${URL}/auth/v1/user`, {
        headers: { apikey: PUB, Authorization: bearer },
      });
      if (!check.ok) { res.status(401).json({ error: "invalid token" }); return; }
      const who = await check.json();
      if (who?.user?.email !== "gerencia@dojo.local") { res.status(403).json({ error: "only manager" }); return; }
      if (!SERVICE || !email || !password) { res.status(400).json({ error: "missing data" }); return; }
      const r = await fetch(`${URL}/auth/v1/admin/users`, {
        method: "POST",
        headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, email_confirm: true }),
      });
      const body = await r.json();
      if (!r.ok) { res.status(400).json({ error: body.msg || body.message || "could not create user" }); return; }
      res.status(200).json({ id: body.id });
      return;
    }

    res.status(400).json({ error: "unknown action" });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
