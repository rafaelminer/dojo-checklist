type Viewer = { src: string; label: string; onDelete?: () => void } | null;

type Props = { viewer: Viewer; onClose: () => void };

export default function PhotoViewerModal({ viewer, onClose }: Props) {
  if (!viewer) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`Foto — ${viewer.label}`}>
      <div className="w-full max-w-[620px] sheet">
        <div className="flex items-center justify-between gap-2 text-white/90 mb-3">
          <p className="font-bold text-[14px] truncate">{viewer.label}</p>
          <button onClick={onClose} aria-label="Fechar foto" className="w-10 h-10 grid place-items-center rounded-full bg-white/15 pressable">✕</button>
        </div>
        <img src={viewer.src} alt={`Foto — ${viewer.label}`} className="w-full max-h-[70dvh] object-contain rounded-2xl bg-black/40" />
        <div className="flex gap-2 mt-3">
          {viewer.onDelete && <button onClick={viewer.onDelete} className="flex-1 bg-[var(--danger)] text-white font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-1.5 pressable">🗑 Excluir foto</button>}
          <button onClick={onClose} className="flex-1 bg-white/15 text-white font-extrabold py-3.5 rounded-2xl pressable">Fechar</button>
        </div>
      </div>
    </div>
  );
}
