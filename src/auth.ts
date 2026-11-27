// Login via Supabase Auth. O JWT fica apenas na sessão do navegador.

async function callAuth(body: Record<string, unknown>, token = "") {
  const res = await fetch("/api/auth", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

export async function supabaseCreateUser(login: string, password: string, token: string) {
  const email = `${login}@dojo.local`;
  return callAuth({ action: "create-user", email, password }, token);
}
