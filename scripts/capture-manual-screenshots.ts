/**
 * Captura telas do sistema para o manual (localhost).
 * Uso: npx tsx scripts/capture-manual-screenshots.ts
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { createPrismaClient } from "../src/lib/create-prisma";
import { createSessionToken, SESSION_COOKIE } from "../src/lib/auth";

const BASE = process.env.MANUAL_BASE_URL ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "docs", "manual", "imagens");

const PAGES: { file: string; path: string; auth?: boolean; waitMs?: number }[] = [
  { file: "01-login.png", path: "/login", auth: false },
  { file: "02-dashboard.png", path: "/" },
  { file: "03-painel.png", path: "/painel", waitMs: 2000 },
  { file: "04-nova-ordem.png", path: "/ordens/nova" },
  { file: "05-ordens.png", path: "/ordens" },
  { file: "06-clientes.png", path: "/clientes" },
  { file: "07-caixa.png", path: "/caixa?date=2026-07-07", waitMs: 1500 },
  { file: "08-financeiro.png", path: "/financeiro", waitMs: 1500 },
  { file: "09-despesas.png", path: "/despesas" },
  { file: "10-funcionarios.png", path: "/funcionarios" },
  { file: "11-servicos.png", path: "/servicos" },
  { file: "12-estoque.png", path: "/estoque" },
  { file: "13-relatorios.png", path: "/relatorios" },
  { file: "14-usuarios.png", path: "/usuarios" },
  { file: "15-display.png", path: "/display", auth: false, waitMs: 2000 },
];

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const prisma = createPrismaClient();
  const owner = await prisma.user.findFirst({
    where: { role: "PROPRIETARIO", active: true },
  });
  await prisma.$disconnect();

  if (!owner) {
    throw new Error("Nenhum administrador encontrado no banco.");
  }

  const token = await createSessionToken({
    id: owner.id,
    name: owner.name,
    email: owner.email,
    role: owner.role,
  });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "pt-BR",
  });

  await context.addCookies([
    {
      name: SESSION_COOKIE,
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  const page = await context.newPage();

  for (const item of PAGES) {
    const url = `${BASE}${item.path}`;
    if (item.auth === false) {
      await context.clearCookies();
    } else {
      await context.addCookies([
        {
          name: SESSION_COOKIE,
          value: token,
          domain: "localhost",
          path: "/",
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
    }

    console.log(`Capturando ${item.file} …`);
    await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
    if (item.waitMs) await page.waitForTimeout(item.waitMs);
    await page.screenshot({
      path: path.join(OUT, item.file),
      fullPage: false,
    });
  }

  await browser.close();
  console.log(`\n${PAGES.length} imagens salvas em docs/manual/imagens/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
