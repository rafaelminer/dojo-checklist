import type { RefObject } from "react";

type Props = {
  open: boolean;
  title: string;
  label: string;
  description: string;
  url: string;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onClose: () => void;
};

export default function QrModal({ open, title, label, description, url, canvasRef, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[65] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label={`${title} — ${label}`}>
      <div className="w-full sm:max-w-[420px] card p-5 sheet rounded-b-none sm:rounded-2xl">
        <div className="flex items-start justify-between gap-2">
          <div><p className="text-[12px] font-bold uppercase text-[var(--muted)]">{title}</p><h2 className="font-extrabold text-[20px] mt-1">{label}</h2></div>
          <button onClick={onClose} aria-label="Fechar QR" className="w-10 h-10 grid place-items-center rounded-full bg-[var(--surface-2)] pressable">✕</button>
        </div>
        <p className="text-[13px] text-[var(--muted)] mt-2 leading-relaxed">{description}</p>
        <div className="bg-white rounded-2xl p-3 mt-4 mx-auto w-fit"><canvas ref={canvasRef} className="w-[240px] h-[240px] max-w-full block" aria-label="QR code" /></div>
        <p className="text-[11px] text-[var(--muted)] mt-2 [overflow-wrap:anywhere]">{url}</p>
        <button onClick={onClose} className="w-full mt-4 bg-[var(--primary)] text-white font-extrabold py-3.5 rounded-2xl">Fechar</button>
      </div>
    </div>
  );
}
