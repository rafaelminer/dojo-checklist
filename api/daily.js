import { brazilDate, brazilTime, createRecord, listRecords } from "../lib/supabase.js";
import { sendPush } from "../lib/push.js";

const BASE_PEOPLE = ["Wesley", "Brianny", "Felipe", "Jessica", "Quitéria", "Nathi", "Eliane", "Michele", "Laís", "Cleide", "Talia", "Tayara", "Paola", "Ricardo"];
const GROUPS = ["grupo:cozinha", "grupo:copa", "grupo:quiosque"];

async function sendChat(profile, text) {
  await createRecord("dojo_chat", { profile, sender: "Gerência", text, time: brazilTime() });
  try {
    await sendPush(profile, "Gerência", text);
  } catch {
    // push é best-effort
  }
}

export default async function handler(req, res) {
  const secret = String(process.env.CRON_SECRET || "");
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  try {
    const today = brazilDate(0);
    const yesterday = brazilDate(-1);

    const [chats, credentials, catalog, entries] = await Promise.all([
      listRecords("dojo_chat", 1000),
      listRecords("dojo_credentials", 500),
      listRecords("dojo_item_catalog", 500),
      listRecords("dojo_entries", 1000),
    ]);

    const replaced = new Set(credentials.map((r) => r.value?.replacesProfile).filter(Boolean));
    const people = Array.from(new Set([
      ...BASE_PEOPLE.filter((p) => !replaced.has(p)),
      ...credentials.map((r) => r.value?.profile).filter((p) => p && p !== "Gerência"),
    ]));

    const nameOf = (id) => catalog.find((r) => r.value?.id === id)?.value?.name || id;
    const byProfile = {};
    entries
      .filter((r) => r.value?.date === yesterday && r.value?.status === "Feito")
      .forEach((r) => {
        const p = r.value.profile;
        (byProfile[p] || (byProfile[p] = [])).push({
          id: r.value.itemId,
          name: nameOf(r.value.itemId),
          feito: String(r.value.feito || "").trim(),
        });
      });

    const has = (needle) => chats.some((r) => String(r.value?.text || "").includes(needle));
    let reminders = 0;
    let summaries = 0;

    const reminderMarker = `🔔 Lembrete diário — ${today}`;
    if (!has(reminderMarker)) {
      for (const p of people) {
        await sendChat(p, `${reminderMarker}. Complete seu checklist e conclua a produção de hoje.`);
        reminders++;
      }
      for (const g of GROUPS) {
        await sendChat(g, `${reminderMarker}. Equipe, confiram o checklist de hoje.`);
        reminders++;
      }
    }

    const summaryMarker = `📋 Produção de ontem — ${yesterday}`;
    if (!has(summaryMarker)) {
      for (const p of people) {
        const mine = byProfile[p] || [];
        const lines = mine.map((x) => `${x.name}${x.feito ? ` (${x.feito})` : ""}`);
        const colleagues = new Set();
        mine.forEach((m) => {
          people.forEach((other) => {
            if (other !== p && (byProfile[other] || []).some((x) => x.id === m.id)) colleagues.add(other);
          });
        });
        const text = `${summaryMarker}\n${lines.length ? lines.join(" · ") : "Nenhum item registrado."}${colleagues.size ? `\nQuem mais fez estes itens: ${Array.from(colleagues).join(", ")}.` : ""}`;
        await sendChat(p, text);
        summaries++;
      }
    }

    res.status(200).json({ today, yesterday, people: people.length, reminders, summaries, alreadySent: { reminder: has(reminderMarker), summary: has(summaryMarker) } });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
