import { useEffect, useRef, useState } from "react";

type Props = {
  reference?: string;
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
};

export default function CameraGuide({ reference, onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no camera api");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        setError("Câmera indisponível. Use o botão para escolher uma foto da galeria.");
      }
    })();
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) { setError("Aguarde a câmera carregar."); return; }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    onCapture(canvas.toDataURL("image/jpeg", 0.85));
    onClose();
  }

  function pickFile(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { onCapture(String(reader.result || "")); onClose(); };
    reader.readAsDataURL(file);
  }

  return (
    <div className="fixed inset-0 z-[69] bg-black/85 flex flex-col" role="dialog" aria-modal="true" aria-label="Câmera com guia">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <div><p className="text-[12px] font-bold uppercase text-white/60">Guia de câmera</p><h2 className="font-extrabold text-[18px]">Enquadre igual ao padrão</h2></div>
        <button onClick={onClose} aria-label="Fechar câmera" className="w-10 h-10 grid place-items-center rounded-full bg-white/15">✕</button>
      </div>
      <div className="relative flex-1 mx-4 mb-4 rounded-2xl overflow-hidden bg-black">
        <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
        {reference && <img src={reference} alt="Referência sobreposta" className="absolute inset-0 w-full h-full object-cover opacity-45 pointer-events-none" style={{ mixBlendMode: "screen" }} />}
        {reference && <p className="absolute left-3 top-3 bg-black/60 text-white text-[11px] font-bold px-2.5 py-1 rounded-full">Referência sobreposta</p>}
      </div>
      {error && <p className="text-center text-[13px] text-[#FFB4B0] px-4 pb-2">{error}</p>}
      <div className="flex gap-2 px-4 pb-[max(20px,var(--safe-area-inset-bottom))]">
        <button onClick={() => fileRef.current?.click()} className="flex-1 bg-white/15 text-white font-bold py-3.5 rounded-2xl">Da galeria</button>
        <button onClick={capture} className="flex-1 bg-[#FF6B1A] text-white font-extrabold py-3.5 rounded-2xl">📸 Capturar</button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
    </div>
  );
}
