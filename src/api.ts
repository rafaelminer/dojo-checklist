// Adaptador de persistência: Supabase (produção) ou backend local do Vite.

export async function api(action: string, args: any) {
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
