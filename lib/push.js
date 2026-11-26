import { setVapidDetails, sendNotification } from "web-push";
import { listRecords } from "./supabase.js";

const VAPID_PUBLIC = String(process.env.VAPID_PUBLIC_KEY || "");
const VAPID_PRIVATE = String(process.env.VAPID_PRIVATE_KEY || "");
const VAPID_SUBJECT = String(process.env.VAPID_SUBJECT || "mailto:contato@dojo.local");

export async function sendPush(profile, sender, text, target) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return { sent: 0, failed: 0 };
  const to = target || profile;
  const rows = await listRecords("dojo_push_subscriptions", 500);
  const isGroup = String(to).startsWith("grupo:");
  const targets = rows
    .map((r) => r.value)
    .filter((v) => {
      if (!v || !v.subscription || !v.subscription.endpoint) return false;
      if (v.profile === sender) return false;
      if (isGroup) return Array.isArray(v.groups) && v.groups.includes(to);
      return v.profile === to;
    });

  if (!targets.length) return { sent: 0, failed: 0 };
  setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  const payload = JSON.stringify({
    title: `Dojo — ${sender}`,
    body: String(text).slice(0, 180),
    url: `/?chat=${encodeURIComponent(String(to))}`,
    tag: `dojo-${Date.now()}`,
  });
  const results = await Promise.allSettled(targets.map((v) => sendNotification(v.subscription, payload)));
  const sent = results.filter((r) => r.status === "fulfilled").length;
  return { sent, failed: results.length - sent };
}
