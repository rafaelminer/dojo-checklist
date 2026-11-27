type Props = {
  open: boolean;
  listening: boolean;
  speechAvailable: boolean;
  text: string;
  onText: (value: string) => void;
  onStart: () => void;
  onApply: () => void;
  onClose: () => void;
};

export default function VoiceModal({ open, listening, speechAvailable, text, onText, onStart, onApply, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[66] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label="Falar ou anotar item">
      <div className="w-full sm:max-w-[460px] card p-5 sheet rounded-b-none sm:rounded-2xl">
        <div className="flex items-start justify-between gap-2">
          <div><p className="text-[12px] font-bold uppercase text-[var(--muted)]">Mãos ocupadas</p><h2 className="font-extrabold text-[21px] mt-1">Falar ou anotar item</h2></div>
          <button onClick={onClose} aria-label="Fechar" className="w-10 h-10 grid place-items-center rounded-full bg-[var(--surface-2)] pressable">✕</button>
        </div>
        <p className="text-[13px] text-[var(--muted)] mt-2 leading-relaxed">Diga ou escreva o nome do produto e a quantidade. Exemplo: <b>Ebi Hot 12</b>. O item será marcado como Feito.</p>
        {speechAvailable && <button type="button" disabled={listening} onClick={onStart} className="w-full mt-4 bg-[var(--primary)] text-white font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-60">🎤 {listening ? "Ouvindo… fale agora" : "Falar item"}</button>}
        <label className="block mt-4"><span className="text-[13px] font-bold">Ou digite</span><input autoFocus value={text} onChange={e=>onText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&text.trim()) onApply();}} placeholder="Ex.: Ebi Hot 12" className="field mt-2" aria-label="Item e quantidade" /></label>
        <div className="flex gap-2 mt-3">
          <button onClick={onClose} className="flex-1 bg-[var(--surface-2)] text-[var(--ink)] font-bold py-3 rounded-2xl">Cancelar</button>
          <button disabled={!text.trim()} onClick={onApply} className="flex-1 bg-[var(--green)] text-white font-extrabold py-3 rounded-2xl disabled:opacity-50">Aplicar</button>
        </div>
        <p className="text-[11px] text-[var(--muted)] mt-3">Se o microfone não funcionar no seu navegador, use o campo de texto — faz a mesma coisa.</p>
      </div>
    </div>
  );
}
