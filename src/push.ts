import { api, getAuthToken } from "./api";

const PUBLIC_KEY = String(import.meta.env.VITE_VAPID_PUBLIC_KEY || "");
const COLLECTION = "dojo_push_subscriptions";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function getPushStatus() {
  const supported = pushSupported();
  let subscribed = false;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    if (reg) subscribed = !!(await reg.pushManager.getSubscription());
  } catch {
    subscribed = false;
  }
  const standalone = typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true);
  return {
    supported,
    subscribed,
    standalone,
    permission: supported ? Notification.permission : "unsupported",
    isIOS: typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent),
  };
}

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  return reg;
}

export async function enablePush(profile: string, groups: string[]) {
  if (!pushSupported()) throw new Error("Este navegador não suporta notificações push.");
  if (!PUBLIC_KEY) throw new Error("Chave de notificação não configurada no servidor.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Permissão negada. Ative notificações nas configurações do navegador.");
  const reg = await registerServiceWorker();
  if (!reg) throw new Error("Não foi possível registrar o service worker.");
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY) as any,
    });
  }
  const json = sub.toJSON();
  const value = {
    endpoint: sub.endpoint,
    subscription: { endpoint: sub.endpoint, keys: json.keys },
    profile,
    groups,
    updatedAt: new Date().toISOString(),
  };
  const list = await api("records.list", { collection: COLLECTION, limit: 200 }).catch(() => ({ records: [] as any[] }));
  const existing = (list.records || []).find((r: any) => r.value?.endpoint === sub!.endpoint);
  if (existing) await api("records.replace", { collection: COLLECTION, id: existing.id, value });
  else await api("records.create", { collection: COLLECTION, value });
  return true;
}

export async function notifyMessage(payload: { profile: string; sender: string; text: string }) {
  try {
    await fetch("/api/push", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // notificação é best-effort: não pode impedir o envio da mensagem
  }
}
