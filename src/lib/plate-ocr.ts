import { formatPlate } from "@/lib/utils";
import { loadImageBitmap } from "@/lib/plate-image";

const OCR_TIMEOUT_MS = 90_000;

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

/** Extrai todas as placas candidatas, da mais provável à menos. */
export function extractAllPlateCandidates(raw: string): string[] {
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
    .replace(/DETRAN/g, "")
    .replace(/BR/g, "");
  candidatesPush(candidates, withoutNoise);

  const ranked: string[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const normalized = normalizePlateGuess(candidate);
    if (isValidBrazilianPlate(normalized) && !seen.has(normalized)) {
      seen.add(normalized);
      ranked.push(normalized);
    }
  }

  ranked.sort((a, b) => scorePlateGuess(b, compact) - scorePlateGuess(a, compact));
  return ranked;
}

/** Extrai a melhor placa brasileira encontrada no texto do OCR. */
export function extractPlateFromText(raw: string): string | null {
  return extractAllPlateCandidates(raw)[0] ?? null;
}

type CropRegion = { x: number; y: number; w: number; h: number };

const CROP_REGIONS: CropRegion[] = [
  { x: 0.04, y: 0.22, w: 0.92, h: 0.38 },
  { x: 0.08, y: 0.28, w: 0.84, h: 0.28 },
  { x: 0.02, y: 0.35, w: 0.96, h: 0.32 },
];

/** Faixa central — foto só da placa (horizontal, close-up). */
const CLOSEUP_REGIONS: CropRegion[] = [
  { x: 0.02, y: 0.28, w: 0.96, h: 0.44 },
  { x: 0.05, y: 0.32, w: 0.9, h: 0.36 },
  { x: 0, y: 0.35, w: 1, h: 0.3 },
];

type EnhanceMode = "none" | "soft" | "strong";

function buildOcrJobs(bitmap: ImageBitmap): { region: CropRegion | null; enhance: EnhanceMode }[] {
  const aspect = bitmap.width / bitmap.height;
  const isCloseup = aspect > 1.15;

  const jobs: { region: CropRegion | null; enhance: EnhanceMode }[] = [];

  if (isCloseup) {
    jobs.push(
      { region: null, enhance: "strong" },
      { region: CLOSEUP_REGIONS[0], enhance: "strong" },
      { region: CLOSEUP_REGIONS[1], enhance: "soft" },
      { region: null, enhance: "soft" },
      { region: CLOSEUP_REGIONS[2], enhance: "strong" }
    );
  }

  jobs.push(
    { region: null, enhance: "none" },
    { region: CROP_REGIONS[0], enhance: "soft" },
    { region: CROP_REGIONS[0], enhance: "strong" },
    { region: CROP_REGIONS[1], enhance: "soft" },
    { region: CROP_REGIONS[2], enhance: "soft" }
  );

  return jobs;
}

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
  const bitmap = await loadImageBitmap(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return [file];
  }

  const variants: Blob[] = [];
  const targetW = 1400;
  const fullRegion: CropRegion = { x: 0, y: 0, w: 1, h: 1 };
  const jobs = buildOcrJobs(bitmap);

  try {
    for (const job of jobs) {
      const region = job.region ?? fullRegion;
      drawRegion(ctx, bitmap, region, targetW, job.enhance);
      variants.push(await canvasToBlob(canvas));
    }
  } finally {
    bitmap.close();
  }

  return variants;
}

const PSM_MODES = ["SINGLE_LINE", "SINGLE_BLOCK"] as const;

const TESSERACT_CDN = "https://cdn.jsdelivr.net/npm";
const TESSERACT_VER = "7.0.0";

function getBrowserTesseractWorkerOptions(
  onProgress?: (pct: number) => void
) {
  return {
    workerPath: `${TESSERACT_CDN}/tesseract.js@${TESSERACT_VER}/dist/worker.min.js`,
    corePath: `${TESSERACT_CDN}/tesseract.js-core@${TESSERACT_VER}/tesseract-core-simd-lstm.wasm.js`,
    langPath: "https://tessdata.projectnaptha.com/4.0.0",
    logger: (m: { status: string; progress?: number }) => {
      if (
        m.status === "loading tesseract core" ||
        m.status === "initializing tesseract" ||
        m.status === "loading language traineddata"
      ) {
        onProgress?.(12);
      }
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        onProgress?.(Math.max(15, Math.round(m.progress * 100)));
      }
    },
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function collectHitsFromOcr(
  text: string,
  confidence: number,
  hits: Map<string, number>,
  bonus = 0
) {
  for (const plate of extractAllPlateCandidates(text)) {
    const prev = hits.get(plate) ?? 0;
    hits.set(
      plate,
      prev +
        confidence +
        bonus +
        scorePlateGuess(plate, text.replace(/[^A-Z0-9]/gi, "").toUpperCase()) * 8
    );
  }
}

/** Roda OCR e devolve candidatos ordenados por confiança. */
export async function recognizePlateCandidatesFromImage(
  file: Blob,
  onProgress?: (pct: number) => void
): Promise<string[]> {
  onProgress?.(1);

  const run = async (): Promise<string[]> => {
    const Tesseract = (await import("tesseract.js")).default;
    onProgress?.(5);

    const variants = await buildOcrImageVariants(file);
    onProgress?.(10);

    const worker = await Tesseract.createWorker("eng", 1, getBrowserTesseractWorkerOptions(onProgress));

    await worker.setParameters({
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    });

    const hits = new Map<string, number>();

    try {
      const total = variants.length * PSM_MODES.length;
      let step = 0;

      for (let vi = 0; vi < variants.length; vi++) {
        const variant = variants[vi];
        const closeupBonus = vi < 5 ? 20 : 0;

        for (const psm of PSM_MODES) {
          step += 1;
          onProgress?.(Math.min(99, 10 + Math.round((step / total) * 85)));

          await worker.setParameters({
            tessedit_pageseg_mode: Tesseract.PSM[psm],
          });
          const { data } = await worker.recognize(variant);
          const page = data as {
            text: string;
            confidence: number;
            lines?: { text: string; confidence: number }[];
            words?: { text: string; confidence: number }[];
          };

          collectHitsFromOcr(page.text, page.confidence, hits, closeupBonus);

          for (const line of page.lines ?? []) {
            collectHitsFromOcr(line.text, line.confidence, hits, closeupBonus + 5);
          }
          for (const word of page.words ?? []) {
            if (word.text.length >= 6) {
              collectHitsFromOcr(word.text, word.confidence, hits, closeupBonus);
            }
          }
        }
      }
    } finally {
      await worker.terminate();
    }

    onProgress?.(100);

    return [...hits.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([plate]) => plate);
  };

  return withTimeout(
    run(),
    OCR_TIMEOUT_MS,
    "O leitor de placa demorou demais. Tente outra foto ou digite a placa."
  );
}

/** Roda OCR em vários recortes e modos até encontrar uma placa válida. */
export async function recognizePlateFromImage(
  file: Blob,
  onProgress?: (pct: number) => void
): Promise<string | null> {
  const candidates = await recognizePlateCandidatesFromImage(file, onProgress);
  return candidates[0] ?? null;
}

/** Gera variantes comuns de confusão OCR para busca no banco. */
export function generatePlateLookupVariants(plate: string): string[] {
  const base = formatPlate(plate).slice(0, 7);
  if (base.length < 7) return [base];

  const variants = new Set<string>([base, normalizePlateGuess(base)]);

  const swaps: [string, string][] = [
    ["O", "0"],
    ["0", "O"],
    ["I", "1"],
    ["1", "I"],
    ["S", "5"],
    ["5", "S"],
    ["B", "8"],
    ["8", "B"],
    ["G", "6"],
    ["6", "G"],
    ["Z", "2"],
    ["2", "Z"],
  ];

  for (let i = 0; i < base.length; i++) {
    for (const [from, to] of swaps) {
      if (base[i] === from) {
        const next = base.slice(0, i) + to + base.slice(i + 1);
        variants.add(next);
        variants.add(normalizePlateGuess(next));
      }
    }
  }

  return [...variants];
}
