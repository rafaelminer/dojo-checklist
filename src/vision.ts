// Comparação leve de fotos: amostra as imagens em 32x32 e mede a diferença média de cor.
// Não é um modelo de visão, mas dá um parecer automático útil sem serviço externo.

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("could not load image"));
    img.src = src;
  });
}

function sample(img: HTMLImageElement): number[] {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, 32, 32);
  const data = ctx.getImageData(0, 0, 32, 32).data;
  const out: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    out.push(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255);
  }
  return out;
}

export async function comparePhotos(reference: string, captured: string): Promise<{ score: number; verdict: "Conforme" | "Parcial" | "Não conforme"; opinion: string }> {
  try {
    const [refImg, shotImg] = await Promise.all([loadImage(reference), loadImage(captured)]);
    const a = sample(refImg);
    const b = sample(shotImg);
    if (!a.length || !b.length) throw new Error("sample failed");
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff += Math.abs(a[i] - b[i]);
    diff /= a.length;
    const score = Math.max(0, Math.min(10, Math.round((1 - diff) * 10)));
    const verdict = score >= 7 ? "Conforme" : score >= 5 ? "Parcial" : "Não conforme";
    const opinion = verdict === "Conforme"
      ? `Foto próxima ao padrão (${score}/10).`
      : verdict === "Parcial"
        ? `Foto com diferenças em relação ao padrão (${score}/10). Conferir enquadramento e organização.`
        : `Foto muito diferente do padrão (${score}/10). Pode estar fora do local/ângulo correto — conferir.`;
    return { score, verdict, opinion };
  } catch {
    return { score: 0, verdict: "Parcial", opinion: "Não foi possível comparar automaticamente. Conferir manualmente." };
  }
}
