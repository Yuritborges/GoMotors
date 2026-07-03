const BITMAP_OPTIONS: ImageBitmapOptions = {
  imageOrientation: "from-image",
};

/** Carrega bitmap respeitando rotação EXIF (fotos da câmera do celular). */
export async function loadImageBitmap(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, BITMAP_OPTIONS);
  } catch {
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
}

/**
 * Normaliza qualquer foto para JPEG com orientação correta e tamanho limitado.
 * Fotos tiradas na hora costumam ter EXIF de rotação — sem isso o OCR lê errado.
 */
export async function prepareImageForOcr(file: Blob): Promise<Blob> {
  const bitmap = await loadImageBitmap(file);

  try {
    const maxSide = 2400;
    let w = bitmap.width;
    let h = bitmap.height;

    if (w > maxSide || h > maxSide) {
      const scale = maxSide / Math.max(w, h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponível");

    ctx.drawImage(bitmap, 0, 0, w, h);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("Falha ao converter imagem")),
        "image/jpeg",
        0.92
      );
    });
  } finally {
    bitmap.close();
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
