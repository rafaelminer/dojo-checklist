// Adaptador de persistência: proxy da Vercel, Supabase direto (dev) ou backend local.
// Escritas que falham por rede ficam numa fila e são reenviadas quando a conexão volta.

const QUEUE_KEY = "dojo_offline_queue";
const TOKEN_KEY = "dojo_jwt";

export function setAuthToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export function getAuthToken() {
  try { return sessionStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
}
type QueueItem = { action: string; args: any; ts: number };

function readQueue(): QueueItem[] {
  try {
    const value = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueueItem[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    // sem armazenamento local, a fila não é persistida
  }
}

export function queueSize() {
  return readQueue().length;
}

function isNetworkError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return /failed to fetch|networkerror|network error|falha na conex|offline|load failed|timeout/i.test(msg);
}

async function send(action: string, args: any) {
  const actionsUrl = String(import.meta.env.VITE_ACTIONS_URL || "");
  if (actionsUrl) {
    const res = await fetch(actionsUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
      },
      body: JSON.stringify({ action, args }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) throw new Error(json.error || `Falha na conexão (${res.status})`);
    return json.data;
  }

  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const supabaseKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "");
  if (supabaseUrl && supabaseKey) {
    const headers: Record<string, string> = {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };
    const collection = String(args?.collection || "");
    const base = `${supabaseUrl}/rest/v1/records`;
    const fail = async (res: Response) => {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || body.error || `Falha na conexão (${res.status})`);
    };
    const filter = (extra: string) => `${base}?collection=eq.${encodeURIComponent(collection)}${extra}`;

    if (action === "records.list") {
      const limit = Math.min(Number(args?.limit) || 200, 1000);
      const res = await fetch(filter(`&select=id,value&limit=${limit}`), { headers });
      if (!res.ok) return await fail(res);
      const rows: any[] = await res.json();
      return { records: (Array.isArray(rows) ? rows : []).map((r) => ({ id: r.id, value: r.value })) };
    }
    if (action === "records.create") {
      const res = await fetch(base, {
        method: "POST",
        headers,
        body: JSON.stringify({ collection, value: args.value }),
      });
      if (!res.ok) return await fail(res);
      const rows: any[] = await res.json();
      return { id: rows?.[0]?.id || `${collection}-${Date.now()}` };
    }
    if (action === "records.replace") {
      const res = await fetch(filter(`&id=eq.${encodeURIComponent(String(args.id))}`), {
        method: "PATCH",
        headers,
        body: JSON.stringify({ value: args.value }),
      });
      if (!res.ok) return await fail(res);
      return {};
    }
    if (action === "records.delete") {
      const res = await fetch(filter(`&id=eq.${encodeURIComponent(String(args.id))}`), {
        method: "DELETE",
        headers,
      });
      if (!res.ok) return await fail(res);
      return {};
    }
    throw new Error(`Ação desconhecida: ${action}`);
  }

  const res = await fetch("actions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, args }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(json.error || `Falha na conexão (${res.status})`);
  return json.data;
}

export async function api(action: string, args: any) {
  try {
    return await send(action, args);
  } catch (err) {
    if (action !== "records.list" && isNetworkError(err)) {
      const queue = readQueue();
      queue.push({ action, args, ts: Date.now() });
      writeQueue(queue.slice(-500));
      if (action === "records.create") return { id: `queued-${Date.now()}` };
      return {};
    }
    throw err;
  }
}

export async function flushQueue() {
  const queue = readQueue();
  if (!queue.length) return 0;
  const pending: QueueItem[] = [];
  let sent = 0;
  for (const item of queue) {
    try {
      await send(item.action, item.args);
      sent++;
    } catch (err) {
      if (isNetworkError(err)) pending.push(item);
    }
  }
  writeQueue(pending);
  return sent;
}
