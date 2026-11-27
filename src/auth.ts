// Login via Supabase Auth. O JWT fica apenas na sessão do navegador.

async function callAuth(body: Record<string, unknown>, sharedKey = "") {
  const res = await fetch("/api/auth", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(sharedKey ? { "x-dojo-key": sharedKey } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(json.error || `Falha no login (${res.status})`);
  return json;
}

export async function supabaseSignIn(login: string, password: string) {
  const email = `${login}@dojo.local`;
  const json = await callAuth({ action: "signin", email, password });
  return String(json.access_token || "");
}

export async function supabaseCreateUser(login: string, password: string, sharedKey: string) {
  const email = `${login}@dojo.local`;
  return callAuth({ action: "create-user", email, password }, sharedKey);
}
