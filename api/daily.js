import { brazilDate, brazilDateTime, brazilTime, createRecord, listRecords } from "../lib/supabase.js";
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

    const [chats, credentials, catalog, entries, tasks, submissions] = await Promise.all([
      listRecords("dojo_chat", 1000),
      listRecords("dojo_credentials", 500),
      listRecords("dojo_item_catalog", 500),
      listRecords("dojo_entries", 1000),
      listRecords("dojo_tasks", 500),
      listRecords("dojo_submissions", 500),
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

    if (String(req.query?.modo || "") === "resumo") {
      const marker = `📋 Resumo 22h — ${today}`;
      if (!has(marker)) {
        const subs = submissions.filter((r) => r.value?.date === today);
        const feitos = Object.values(entries).filter((r) => r.value?.date === today && r.value.status === "Feito").length;
        const nao = Object.values(entries).filter((r) => r.value?.date === today && r.value.status === "Não feito").length;
        const text = `${marker}\nChecklists concluídos: ${subs.length}\nItens: ${feitos} feitos · ${nao} não feitos.\nEquipe: ${people.join(", ")}.`;
        await sendChat("Gerência", text);
        for (const g of GROUPS) await sendChat(g, text);
        summaries = 1;
      }
      res.status(200).json({ today, summaries, mode: "resumo" });
      return;
    }

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

    let overdue = 0;
    const nowBR = brazilDateTime();
    for (const row of tasks) {
      const v = row.value || {};
      if (v.status !== "Aberta") continue;
      const deadline = `${v.dueDate || ""}T${v.dueTime || "23:59"}`;
      if (!v.dueDate || deadline >= nowBR) continue;
      const marker = `⏰ Tarefa atrasada — ${today} — ${v.title}`;
      if (has(marker)) continue;
      const text = `${marker}. Responsável: ${v.owner}. Prazo era ${v.dueDate} ${v.dueTime || ""}.`;
      await sendChat(v.owner, text);
      await sendChat("Gerência", text);
      overdue++;
    }

    res.status(200).json({ today, yesterday, people: people.length, reminders, summaries, overdue, alreadySent: { reminder: has(reminderMarker), summary: has(summaryMarker) } });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
