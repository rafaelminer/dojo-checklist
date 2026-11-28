import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Camera, Check, ClipboardCheck, Share2, Sparkles, X } from "lucide-react";
import { api } from "../api";
import { comparePhotos } from "../vision";
import CameraGuide from "./CameraGuide";
import type { QuestionRecord } from "../data";
type Verdict = "Conforme" | "Parcial" | "NÃ£o conforme";
type Step = { id: string; question: string; section: string; type: QuestionRecord["type"]; weight: number; minScore: number; options?: string; correct?: string; hint?: string; referencePhoto?: string };
type Answer = { verdict: Verdict; score: number; answer: string; note: string; photo: string; opinion: string; belowMin: boolean };
function verdictFor(score: number): Verdict { return score >= 7.5 ? "Conforme" : score >= 5 ? "Parcial" : "NÃ£o conforme"; }
export default function GuidedRun({ open, onClose, profile, date, sections, questions, items, PhotoField, onPreview, onSaved, t }: any) {
  const [section, setSection] = useState("");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [showResult, setShowResult] = useState(false);
  const [cameraFor, setCameraFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const sectionOptions = useMemo(() => ["Todas as seÃ§Ãµes", ...sections.filter(Boolean)], [sections]);
  const activeSection = section || sectionOptions[0];
  const steps = useMemo<Step[]>(() => {
    const inSection = (s: string) => activeSection === "Todas as seÃ§Ãµes" || s === activeSection;
    const qs = questions.filter((q: any) => q.value?.question && inSection(q.value.section || "Geral"));
    if (qs.length) return qs.map((q: any) => ({ id: q.id, question: q.value.question, section: q.value.section || "Geral", type: q.value.type || "check", weight: Math.max(1, Number(q.value.weight) || 1), minScore: Number(q.value.minScore) || 7.5, options: q.value.options, correct: q.value.correct, hint: q.value.hint, referencePhoto: q.value.referencePhoto }));
    return items.filter((i: any) => inSection(i.section)).slice(0, 30).map((i: any) => ({ id: i.id, question: i.name, section: i.section, type: "foto_veredito" as QuestionRecord["type"], weight: 1, minScore: 7.5, hint: i.target, referencePhoto: i.photo || i.photo_url || "" }));
  }, [questions, items, activeSection]);
  useEffect(() => { if (!open) return; setIndex(0); setAnswers({}); setShowResult(false); setDone(false); }, [open]);
  useEffect(() => { setIndex(0); setAnswers({}); setShowResult(false); }, [activeSection]);
  const step = steps[index];
  const current: Answer = answers[step?.id] || { verdict: "Conforme", score: 0, answer: "", note: "", photo: "", opinion: "", belowMin: false };
  function patch(next: Partial<Answer>) {
    if (!step) return;
    const base = { ...current, ...next };
    if (next.score !== undefined) base.verdict = verdictFor(next.score);
    base.belowMin = base.score < step.minScore;
    setAnswers((p) => ({ ...p, [step.id]: base }));
  }
  async function setPhoto(data: string) {
    if (!data) { patch({ photo: "", score: 0, opinion: "" }); return; }
    patch({ photo: data });
    if (step?.referencePhoto) {
      try { const cmp = await comparePhotos(step.referencePhoto, data); patch({ photo: data, score: cmp.score, verdict: cmp.verdict, opinion: cmp.opinion }); }
      catch { patch({ photo: data, opinion: "NÃ£o foi possÃ­vel comparar automaticamente. Conferir manualmente." }); }
    }
  }
  const needs = (() => {
    if (!step) return false;
    const type = step.type;
    if ((type === "foto_veredito" || type === "photo") && !current.photo) return true;
    if ((type === "texto_veredito" || type === "text") && !current.note.trim()) return true;
    if (["sim_nao","multipla","numero","classificacao","data","hora","temperature"].includes(type) && !current.answer.trim()) return true;
    return false;
  })();
  function computeScore(a: Answer, s?: Step) {
    const type = s?.type || step?.type;
    if (s && a.opinion && a.score) return a.score;
    if (type === "check" || type === "foto_veredito" || type === "texto_veredito") return a.verdict === "Conforme" ? 10 : a.verdict === "Parcial" ? 6 : 0;
    if (type === "sim_nao") return a.answer === "Sim" ? 10 : 0;
    if (type === "multipla") return s?.correct && a.answer === s.correct ? 10 : 0;
    if (type === "numero" || type === "classificacao") { const n = Number(a.answer); return Number.isFinite(n) ? Math.max(0, Math.min(10, n * 2)) : 0; }
    return a.answer.trim() ? 10 : 0;
  }
  function advance() {
    if (needs || !step) return;
    const score = computeScore(current);
    setAnswers((p) => ({ ...p, [step.id]: { ...current, score, verdict: verdictFor(score), belowMin: score < step.minScore, opinion: current.opinion || (score >= 7.5 ? "Dentro do padrÃ£o definido." : score >= 5 ? "AtenÃ§Ã£o: verificar o ponto sinalizado." : "Fora do padrÃ£o: corrigir e reavaliar.") } }));
    if (index < steps.length - 1) setIndex(index + 1); else setShowResult(true);
  }
  const finalScore = useMemo(() => {
    let total = 0, weight = 0;
    steps.forEach((s) => { const a = answers[s.id]; if (!a) return; total += (a.score || computeScore(a, s)) * s.weight; weight += s.weight; });
    return weight ? Math.round((total / weight) * 10) / 10 : 0;
  }, [answers, steps]);
  const finalVerdict = verdictFor(finalScore);
  const allAnswered = steps.length > 0 && steps.every((s) => !!answers[s.id]);
  async function saveRun() {
    if (saving || done) return;
    setSaving(true);
    try {
      await api("records.create", { collection: "dojo_guided_runs", value: { profile, date, section: activeSection, title: activeSection === "Todas as seÃ§Ãµes" ? "ExecuÃ§Ã£o guiada" : activeSection, score: finalScore, verdict: finalVerdict, totalSteps: steps.length, answers: steps.map((s) => ({ ...answers[s.id], id: s.id, question: s.question, section: s.section, weight: s.weight, minScore: s.minScore, referencePhoto: s.referencePhoto })), finishedAt: new Date().toISOString(), by: profile } });
      setDone(true); onSaved?.();
    } catch { setDone(true); }
    setSaving(false);
  }
  async function share() {
    const text = `Dojo Checklist â€” ${activeSection}\n${profile} Â· ${date}\nNota ${finalScore}/10 Â· ${finalVerdict}\n${steps.length} itens executados.`;
    try { if (navigator.share) await navigator.share({ title: "Dojo Checklist", text }); else await navigator.clipboard?.writeText(text); } catch {}
  }
  if (!open) return null;
            <p className={`text-[64px] leading-none font-black mt-3 ${finalScore>=7.5?"text-[var(--green)]":finalScore>=5?"text-[var(--warning-text)]":"text-[var(--danger-text)]"}`}>{finalScore}<span className="text-[22px] text-[var(--muted)]">/10</span></p>
            <p className="mt-2 inline-flex items-center gap-2 text-[15px] font-extrabold"><Sparkles size={17}/>{finalVerdict}</p>
            <p className="text-[12px] text-[var(--muted)] mt-3">{t("Média ponderada dos critérios · Conforme ≥ 7,5 · Parcial ≥ 5")}</p>
          </div>
          <ul className="mt-4 space-y-2">{steps.map((s) => {
            const a = answers[s.id];
            const sc = a?.score || computeScore(a || current, s);
            return <li key={s.id} className="card p-4 flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1"><p className="font-bold text-[14px] [overflow-wrap:anywhere]">{s.question}</p><p className="text-[12px] text-[var(--muted)]">{s.section} · peso {s.weight}{a?.belowMin ? " · abaixo do mínimo" : ""}</p>{a?.opinion && <p className="text-[12px] text-[var(--muted)] mt-1">{a.opinion}</p>}</div><span className="font-black text-[18px]">{sc}</span><span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full ${sc>=7.5?"bg-[var(--success-bg)] text-[var(--success-text)]":sc>=5?"bg-[var(--warning-bg)] text-[var(--warning-text)]":"bg-[var(--danger-bg)] text-[var(--danger-text)]"}`}>{verdictFor(sc)}</span>{a?.photo && <button onClick={() => onPreview?.(a.photo, s.question)} className="text-[12px] font-bold text-[var(--primary)] underline">Ver foto</button>}</li>;
          })}</ul>
          <div className="flex gap-2 mt-5"><button onClick={() => setShowResult(false)} className="flex-1 bg-[var(--surface-2)] border border-[var(--line)] text-[var(--text)] font-extrabold rounded-2xl py-4 text-[14px]">{t("Voltar")}</button><button onClick={share} className="flex-1 bg-[var(--surface-2)] border border-[var(--line)] text-[var(--text)] font-extrabold rounded-2xl py-4 text-[14px] flex items-center justify-center gap-2"><Share2 size={17}/>{t("Compartilhar")}</button></div>
          <button disabled={saving || !allAnswered} onClick={saveRun} className="mt-2 w-full bg-[var(--primary)] text-white font-extrabold rounded-2xl py-4 text-[15px] disabled:opacity-50">{saving ? "Salvando…" : "Concluir e salvar execução"}</button>
        </div>
      ) : !step ? (
        <div className="p-8 text-center"><ClipboardCheck size={34} className="mx-auto text-[var(--muted)]"/><p className="font-bold mt-3">Nenhuma pergunta cadastrada para esta seção.</p><p className="text-[13px] text-[var(--muted)] mt-2">A Gerência pode cadastrar perguntas com peso, nota mínima e foto de referência na aba Qualidade.</p><button onClick={onClose} className="mt-5 bg-[var(--primary)] text-white font-extrabold rounded-2xl px-6 py-3.5">Fechar</button></div>
          <div className="flex gap-2 mt-5"><button onClick={() => setShowResult(false)} className="flex-1 bg-[var(--surface-2)] border border-[var(--line)] text-[var(--text)] font-extrabold rounded-2xl py-4 text-[14px]">{t("Voltar")}</button><button onClick={share} className="flex-1 bg-[var(--surface-2)] border border-[var(--line)] text-[var(--text)] font-extrabold rounded-2xl py-4 text-[14px] flex items-center justify-center gap-2"><Share2 size={17}/>{t("Compartilhar")}</button></div>
          <button disabled={saving || !allAnswered} onClick={saveRun} className="mt-2 w-full bg-[var(--primary)] text-white font-extrabold rounded-2xl py-4 text-[15px] disabled:opacity-50">{saving ? "Salvando…" : "Concluir e salvar execução"}</button>
        </div>
      ) : !step ? (
        <div className="p-8 text-center"><ClipboardCheck size={34} className="mx-auto text-[var(--muted)]"/><p className="font-bold mt-3">Nenhuma pergunta cadastrada para esta seção.</p><p className="text-[13px] text-[var(--muted)] mt-2">A Gerência pode cadastrar perguntas com peso, nota mínima e foto de referência na aba Qualidade.</p><button onClick={onClose} className="mt-5 bg-[var(--primary)] text-white font-extrabold rounded-2xl px-6 py-3.5">Fechar</button></div>
        </div>
      ) : !step ? (
