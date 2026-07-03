/** Converte qualquer foto (incl. HEIC no iOS) em JPEG para o OCR. */
export async function prepareImageForOcr(file: Blob): Promise<Blob> {
  if (
    file.type === "image/jpeg" ||
    file.type === "image/png" ||
    file.type === "image/webp"
  ) {
    return file;
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await loadHtmlImage(url);
    const canvas = document.createElement("canvas");
    const maxSide = 2400;
    let { naturalWidth: w, naturalHeight: h } = img;

    if (w > maxSide || h > maxSide) {
      const scale = maxSide / Math.max(w, h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponível");

    ctx.drawImage(img, 0, 0, w, h);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Falha ao converter imagem"))),
        "image/jpeg",
        0.92
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível abrir a imagem"));
    img.src = src;
  });
}

export async function loadImageBitmap(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadHtmlImage(url);
      return await createImageBitmap(img);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}
