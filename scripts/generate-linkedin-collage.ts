/**
 * Montagem de imagens para post no LinkedIn.
 * Uso: npx tsx scripts/generate-linkedin-collage.ts
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const IMG = path.join(process.cwd(), "docs", "manual", "imagens");
const OUT_DIR = path.join(process.cwd(), "docs", "linkedin");
const OUT = path.join(OUT_DIR, "gomotors-linkedin-collage.png");

const TILES = [
  { file: "03-painel.png", label: "Painel operacional" },
  { file: "04-nova-ordem.png", label: "Nova ordem" },
  { file: "07-caixa.png", label: "Caixa do dia" },
  { file: "08-financeiro.png", label: "Financeiro" },
  { file: "15-display.png", label: "Telão na TV" },
  { file: "02-dashboard.png", label: "Dashboard" },
];

const W = 1920;
const H = 1080;
const PAD = 24;
const HEADER = 120;
const COLS = 3;
const ROWS = 2;

async function tileWithLabel(
  file: string,
  label: string,
  w: number,
  h: number
): Promise<Buffer> {
  const src = path.join(IMG, file);
  const shot = await sharp(src)
    .resize(w, w, { fit: "cover", position: "top" })
    .png()
    .toBuffer();

  const labelSvg = `
    <svg width="${w}" height="${h}">
      <rect width="100%" height="100%" fill="#0f172a"/>
      <rect x="0" y="0" width="100%" height="${h - 36}" fill="#0f172a"/>
      <text x="16" y="${h - 12}" font-family="Segoe UI, Arial, sans-serif" font-size="18" fill="#e2e8f0" font-weight="600">${label}</text>
    </svg>`;

  const labelBuf = Buffer.from(labelSvg);
  const shotH = h - 36;

  const resized = await sharp(shot)
    .resize(w, shotH, { fit: "cover", position: "top" })
    .png()
    .toBuffer();

  return sharp({
    create: { width: w, height: h, channels: 4, background: "#0f172a" },
  })
    .composite([
      { input: resized, top: 0, left: 0 },
      { input: labelBuf, top: shotH, left: 0 },
    ])
    .png()
    .toBuffer();
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const innerW = W - PAD * 2;
  const innerH = H - HEADER - PAD * 2;
  const tileW = Math.floor((innerW - PAD * (COLS - 1)) / COLS);
  const tileH = Math.floor((innerH - PAD * (ROWS - 1)) / ROWS);

  const tiles: Buffer[] = [];
  for (const t of TILES) {
    tiles.push(await tileWithLabel(t.file, t.label, tileW, tileH));
  }

  const logoPath = path.join(IMG, "logo.png");
  const logo = fs.existsSync(logoPath)
    ? await sharp(logoPath).resize(200, 72, { fit: "inside" }).png().toBuffer()
    : null;

  const headerSvg = Buffer.from(`
    <svg width="${W}" height="${HEADER}">
      <rect width="100%" height="100%" fill="#020617"/>
      <text x="${W / 2}" y="52" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="34" fill="#38bdf8" font-weight="700">GoMotors</text>
      <text x="${W / 2}" y="88" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="20" fill="#94a3b8">Sistema de gestão para lava-rápido</text>
    </svg>`);

  const composites: sharp.OverlayOptions[] = [{ input: headerSvg, top: 0, left: 0 }];

  if (logo) {
    composites.push({ input: logo, top: 24, left: PAD });
  }

  let i = 0;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = PAD + col * (tileW + PAD);
      const y = HEADER + PAD + row * (tileH + PAD);
      composites.push({ input: tiles[i], top: y, left: x });
      i++;
    }
  }

  await sharp({
    create: { width: W, height: H, channels: 4, background: "#020617" },
  })
    .composite(composites)
    .png()
    .toFile(OUT);

  console.log(`Colagem gerada: ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
