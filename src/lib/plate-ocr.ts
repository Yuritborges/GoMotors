import { formatPlate } from "@/lib/utils";

/** Placa Mercosul (ABC1D23) ou antiga (ABC1234) */
const MERCOSUL_RE = /^[A-Z]{3}\d[A-Z0-9]\d{2}$/;
const OLD_RE = /^[A-Z]{3}\d{4}$/;

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

/** Extrai a melhor placa brasileira encontrada no texto do OCR. */
export function extractPlateFromText(raw: string): string | null {
  const upper = raw.toUpperCase();
  const candidates = new Set<string>();

  const compact = upper.replace(/[^A-Z0-9]/g, "");
  for (let i = 0; i <= compact.length - 7; i++) {
    candidates.add(compact.slice(i, i + 7));
  }

  const tokens = upper.split(/[^A-Z0-9]+/).filter(Boolean);
  for (const token of tokens) {
    if (token.length >= 7) {
      for (let i = 0; i <= token.length - 7; i++) {
        candidates.add(token.slice(i, i + 7));
      }
    }
  }

  for (const candidate of candidates) {
    const normalized = normalizePlateGuess(candidate);
    if (isValidBrazilianPlate(normalized)) return normalized;
  }

  return null;
}

/** Pré-processa imagem para melhorar leitura OCR (contraste + escala de cinza). */
export async function preprocessPlateImage(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    const contrast = Math.min(255, Math.max(0, (gray - 128) * 1.6 + 128));
    const value = contrast > 140 ? 255 : contrast < 90 ? 0 : contrast;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }

  ctx.putImageData(imageData, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Falha ao processar imagem"))),
      "image/jpeg",
      0.92
    );
  });
}
