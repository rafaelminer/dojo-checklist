import type { Item } from "../data";

type Colleague = { name: string; status: string };

type Props = {
  item: Item | null;
  photo?: string;
  instruction?: string;
  suggestion?: { value: number; days: number } | null;
  section: string;
  yesterday: string;
  colleagues: Colleague[];
  saving: boolean;
  readOnly: boolean;
  onStatus: (status: "Feito" | "Não feito") => void;
  onClose: () => void;
};

export default function ProductSheet({ item, photo, instruction, suggestion, section, yesterday, colleagues, saving, readOnly, onStatus, onClose }: Props) {
  if (!item) return null;
  return (
    <div className="fixed inset-0 z-[65] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label={`Ficha — ${item.name}`}>
      <div className="w-full sm:max-w-[520px] max-h-[88dvh] overflow-y-auto card p-5 sheet rounded-b-none sm:rounded-2xl">
        <div className="flex items-start justify-between gap-2">
          <div><p className="text-[12px] font-bold tracking-wide uppercase text-[var(--muted)]">Ficha do produto</p><h2 className="font-extrabold text-[22px] leading-tight mt-1 [overflow-wrap:anywhere]">{item.name}</h2></div>
          <button onClick={onClose} aria-label="Fechar ficha" className="w-10 h-10 grid place-items-center rounded-full bg-[var(--surface-2)] pressable">✕</button>
        </div>
        {photo && <img src={photo} alt={`Referência de ${item.name}`} className="w-full max-h-[220px] object-contain rounded-2xl bg-[var(--surface-inset)] mt-3" />}
        <div className="grid grid-cols-2 gap-2 mt-4 text-[13px]">
          <div className="rounded-xl bg-[var(--surface-2)] p-3"><span className="block text-[11px] font-bold uppercase text-[var(--muted)]">A produzir</span><b className="[overflow-wrap:anywhere]">{item.target}</b></div>
          <div className="rounded-xl bg-[var(--surface-2)] p-3"><span className="block text-[11px] font-bold uppercase text-[var(--muted)]">Frequência</span><b>{item.freq}</b></div>
        </div>
        <p className="text-[13px] text-[var(--muted)] mt-3">Seção: <b>{section}</b></p>
        {item.detail && <p className="text-[14px] mt-2 leading-relaxed">{item.detail}</p>}
        {instruction && <p className="mt-3 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] p-3 text-[13px] leading-relaxed">📋 {instruction}</p>}
        {suggestion && <p className="mt-3 text-[13px] font-bold text-[var(--muted)]">📈 Sugestão do dia: {suggestion.value} un. ({suggestion.days} dias iguais)</p>}
        <p className="mt-2 text-[13px] text-[var(--muted)]">Ontem: <b>{yesterday}</b></p>
        <div className="mt-3"><p className="text-[12px] font-bold uppercase text-[var(--muted)]">Colegas que fazem este item</p><div className="flex flex-wrap gap-2 mt-2">{colleagues.length ? colleagues.map(c=><span key={c.name} className="chip">{c.name} · {c.status}</span>) : <span className="text-[13px] text-[var(--muted)]">Ninguém.</span>}</div></div>
        <div className="flex flex-wrap gap-2 mt-5">
          <button disabled={saving||readOnly} onClick={()=>onStatus("Feito")} className="flex-1 bg-[var(--green)] text-white font-extrabold py-3.5 rounded-2xl">Feito</button>
          <button disabled={saving||readOnly} onClick={()=>onStatus("Não feito")} className="flex-1 bg-[var(--danger)] text-white font-extrabold py-3.5 rounded-2xl">Não feito</button>
          <button onClick={onClose} className="w-full bg-[var(--surface-2)] text-[var(--ink)] font-bold py-3 rounded-2xl">Fechar</button>
        </div>
      </div>
    </div>
  );
}
