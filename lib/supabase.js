// Acesso ao Supabase usado pelas funções de servidor (cron e push).

const URL = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = String(process.env.SUPABASE_ANON_KEY || "");

function headers() {
  return { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
}

export async function listRecords(collection, limit = 500) {
  if (!URL || !KEY) throw new Error("Supabase não configurado");
  const url = `${URL}/rest/v1/records?collection=eq.${encodeURIComponent(collection)}&select=id,value&limit=${Math.min(limit, 1000)}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows.map((r) => ({ id: r.id, value: r.value })) : [];
}

export async function createRecord(collection, value) {
  if (!URL || !KEY) throw new Error("Supabase não configurado");
  const res = await fetch(`${URL}/rest/v1/records`, {
    method: "POST",
    headers: { ...headers(), Prefer: "return=representation" },
    body: JSON.stringify({ collection, value }),
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
  const rows = await res.json();
  return rows?.[0]?.id || null;
}

export function brazilDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function brazilTime() {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}
