import type { PointerEvent, RefObject } from "react";

type Props = {
  open: boolean;
  label: string;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onDown: (e: PointerEvent<HTMLCanvasElement>) => void;
  onMove: (e: PointerEvent<HTMLCanvasElement>) => void;
  onUp: () => void;
  onClear: () => void;
  onSave: () => void;
  onClose: () => void;
};

export default function SignatureModal({ open, label, canvasRef, onDown, onMove, onUp, onClear, onSave, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[68] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label="Assinatura do turno">
      <div className="w-full sm:max-w-[520px] card p-5 sheet rounded-b-none sm:rounded-2xl">
        <div className="flex items-start justify-between gap-2">
          <div><p className="text-[12px] font-bold uppercase text-[var(--muted)]">Assinatura</p><h2 className="font-extrabold text-[21px] mt-1">Assinar turno — {label}</h2></div>
          <button onClick={onClose} aria-label="Fechar assinatura" className="w-10 h-10 grid place-items-center rounded-full bg-[var(--surface-2)] pressable">✕</button>
        </div>
        <p className="text-[13px] text-[var(--muted)] mt-2">Desenhe sua assinatura com o dedo ou o mouse.</p>
        <canvas ref={canvasRef} width={900} height={320} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} className="w-full h-[180px] bg-white rounded-2xl border border-[var(--line)] mt-3 touch-none" aria-label="Área da assinatura" />
        <div className="flex gap-2 mt-3">
          <button onClick={onClear} className="flex-1 bg-[var(--surface-2)] text-[var(--ink)] font-bold py-3 rounded-2xl">Limpar</button>
          <button onClick={onSave} className="flex-1 bg-[var(--primary)] text-white font-extrabold py-3 rounded-2xl">Salvar assinatura</button>
        </div>
      </div>
    </div>
  );
}
