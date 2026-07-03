import Tesseract from "tesseract.js";
import { extractPlateFromText } from "@/lib/plate-ocr";

const PSM_MODES = ["SINGLE_LINE", "SINGLE_BLOCK", "SPARSE_TEXT"] as const;

/** OCR no servidor — mais confiável que WASM no celular. */
export async function recognizePlateOnServer(
  imageBuffer: Buffer
): Promise<string | null> {
  const worker = await Tesseract.createWorker("eng", 1);

  await worker.setParameters({
    tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  });

  try {
    for (const psm of PSM_MODES) {
      await worker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM[psm],
      });
      const { data } = await worker.recognize(imageBuffer);
      const plate = extractPlateFromText(data.text);
      if (plate) return plate;
    }
    return null;
  } finally {
    await worker.terminate();
  }
}
