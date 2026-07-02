import { formatPlate } from "@/lib/utils";

/** Placa Mercosul (ABC1D23) ou antiga (ABC1234) */
const MERCOSUL_RE = /^[A-Z]{3}\d[A-Z0-9]\d{2}$/;
const OLD_RE = /^[A-Z]{3}\d{4}$/;
const MERCOSUL_FIND = /[A-Z]{3}\d[A-Z0-9]\d{2}/g;
const OLD_FIND = /[A-Z]{3}\d{4}/g;

export function isValidBrazilianPlate(plate: string): boolean {
  const p = formatPlate(plate);
  return p.length === 7 && (MERCOSUL_RE.test(p) || OLD_RE.test(p));
}

const LETTER_TO_DIGIT: Record<string, string> = {
  O: "0",
  Q: "0",
  D: "0",
  I: "1",
  L: "1",
  Z: "2",
  S: "5",
  G: "6",
  B: "8",
};

const DIGIT_TO_LETTER: Record<string, string> = {
  "0": "O",
  "1": "I",
  "2": "Z",
  "5": "S",
  "6": "G",
  "8": "B",
};

function fixCharForPosition(char: string, index: number): string {
  const c = char.toUpperCase();
  const isLetterSlot = index < 3 || index === 4;

  if (isLetterSlot) {
    if (/[A-Z]/.test(c)) return c;
    return DIGIT_TO_LETTER[c] ?? c;
  }

  if (/\d/.test(c)) return c;
  return LETTER_TO_DIGIT[c] ?? c;
}

/** Corrige confusões comuns do OCR (O/0, I/1, etc.) por posição na placa. */
export function normalizePlateGuess(raw: string): string {
  const compact = formatPlate(raw).slice(0, 7);
  if (compact.length < 7) return compact;
  return compact
    .split("")
    .map((ch, i) => fixCharForPosition(ch, i))
    .join("");
}

function candidatesPush(set: Set<string>, compact: string) {
  for (let i = 0; i <= compact.length - 7; i++) {
    set.add(compact.slice(i, i + 7));
  }
}

function scorePlateGuess(plate: string, compactSource: string): number {
  let score = 0;
  const idx = compactSource.indexOf(plate);
  if (idx !== -1) {
    const before = compactSource[idx - 1];
    const after = compactSource[idx + 7];
    if (!before) score += 2;
    if (!after) score += 2;
    if (before && !/[A-Z0-9]/.test(before)) score += 1;
    if (after && !/[A-Z0-9]/.test(after)) score += 1;
  }
  if (/^[A-Z]{3}\d[A-Z]\d{2}$/.test(plate)) score += 1;
  return score;
}

/** Extrai a melhor placa brasileira encontrada no texto do OCR. */
export function extractPlateFromText(raw: string): string | null {
  const upper = raw.toUpperCase();
  const candidates = new Set<string>();

  for (const match of upper.match(MERCOSUL_FIND) ?? []) {
    candidates.add(match);
  }
  for (const match of upper.match(OLD_FIND) ?? []) {
    candidates.add(match);
  }

  const compact = upper.replace(/[^A-Z0-9]/g, "");
  candidatesPush(candidates, compact);

  const withoutNoise = compact
    .replace(/BRASIL/g, "")
    .replace(/MERCOSUL/g, "")
    .replace(/DETRAN/g, "");
  candidatesPush(candidates, withoutNoise);

  const ranked: string[] = [];
  for (const candidate of candidates) {
    const normalized = normalizePlateGuess(candidate);
    if (isValidBrazilianPlate(normalized)) {
      ranked.push(normalized);
    }
  }

  if (ranked.length === 0) return null;

  ranked.sort((a, b) => scorePlateGuess(b, compact) - scorePlateGuess(a, compact));
  return ranked[0] ?? null;
}

type CropRegion = { x: number; y: number; w: number; h: number };

const CROP_REGIONS: CropRegion[] = [
  { x: 0.04, y: 0.22, w: 0.92, h: 0.38 },
  { x: 0.08, y: 0.28, w: 0.84, h: 0.28 },
  { x: 0.02, y: 0.35, w: 0.96, h: 0.32 },
];

type EnhanceMode = "none" | "soft" | "strong";

const OCR_JOBS: { region: CropRegion | null; enhance: EnhanceMode }[] = [
  { region: null, enhance: "none" },
  { region: CROP_REGIONS[0], enhance: "soft" },
  { region: CROP_REGIONS[0], enhance: "strong" },
  { region: CROP_REGIONS[1], enhance: "soft" },
  { region: CROP_REGIONS[2], enhance: "soft" },
];

async function canvasToBlob(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Falha ao processar imagem"))),
      "image/jpeg",
      quality
    );
  });
}

function drawRegion(
  ctx: CanvasRenderingContext2D,
  bitmap: ImageBitmap,
  region: CropRegion,
  targetW: number,
  enhance: "none" | "soft" | "strong"
) {
  const sx = Math.round(bitmap.width * region.x);
  const sy = Math.round(bitmap.height * region.y);
  const sw = Math.max(1, Math.round(bitmap.width * region.w));
  const sh = Math.max(1, Math.round(bitmap.height * region.h));
  const scale = targetW / sw;
  const dw = Math.round(sw * scale);
  const dh = Math.round(sh * scale);

  ctx.canvas.width = dw;
  ctx.canvas.height = dh;
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, dw, dh);

  if (enhance === "none") return;

  const imageData = ctx.getImageData(0, 0, dw, dh);
  const { data } = imageData;
  const factor = enhance === "strong" ? 2.2 : 1.4;

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    const contrast = Math.min(255, Math.max(0, (gray - 128) * factor + 128));
    let value = gray;

    if (enhance === "strong") {
      value = contrast > 155 ? 255 : contrast < 100 ? 0 : contrast;
    } else {
      value = contrast;
    }

    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }

  ctx.putImageData(imageData, 0, 0);
}

/** Gera recortes da foto onde a placa costuma aparecer (foto vertical no celular). */
export async function buildOcrImageVariants(file: Blob): Promise<Blob[]> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return [file];
  }

  const variants: Blob[] = [];
  const targetW = 1400;
  const fullRegion: CropRegion = { x: 0, y: 0, w: 1, h: 1 };

  try {
    for (const job of OCR_JOBS) {
      const region = job.region ?? fullRegion;
      drawRegion(ctx, bitmap, region, targetW, job.enhance);
      variants.push(await canvasToBlob(canvas));
    }
  } finally {
    bitmap.close();
  }

  return variants;
}

const PSM_MODES = ["SPARSE_TEXT", "SINGLE_BLOCK", "AUTO"] as const;

/** Roda OCR em vários recortes e modos até encontrar uma placa válida. */
export async function recognizePlateFromImage(
  file: Blob,
  onProgress?: (pct: number) => void
): Promise<string | null> {
  const Tesseract = (await import("tesseract.js")).default;
  const variants = await buildOcrImageVariants(file);
  const worker = await Tesseract.createWorker("eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        onProgress?.(Math.round(m.progress * 100));
      }
    },
  });

  await worker.setParameters({
    tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  });

  let best: string | null = null;

  try {
    const total = variants.length * PSM_MODES.length;
    let step = 0;

    for (const variant of variants) {
      for (const psm of PSM_MODES) {
        step += 1;
        onProgress?.(Math.min(99, Math.round((step / total) * 100)));

        await worker.setParameters({
          tessedit_pageseg_mode: Tesseract.PSM[psm],
        });
        const { data } = await worker.recognize(variant);
        const found = extractPlateFromText(data.text);
        if (found) {
          best = found;
          break;
        }
      }
      if (best) break;
    }
  } finally {
    await worker.terminate();
  }

  onProgress?.(100);
  return best;
}

/** @deprecated Use recognizePlateFromImage */
export async function preprocessPlateImage(file: Blob): Promise<Blob> {
  const variants = await buildOcrImageVariants(file);
  return variants[1] ?? file;
}
