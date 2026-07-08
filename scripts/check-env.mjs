import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env");

console.log("Raiz do projeto:", root);
console.log(".env existe:", fs.existsSync(envPath));

dotenv.config({ path: envPath });

function describeUrl(name, value) {
  if (!value) {
    console.log(`${name}: (vazio)`);
    return;
  }
  if (value.includes("USER:PASSWORD") || value.includes("ep-xxx")) {
    console.log(`${name}: PLACEHOLDER — ainda não foi alterado`);
    return;
  }
  try {
    const u = new URL(value);
    console.log(
      `${name}: postgresql://${u.username}:***@${u.hostname}${u.pathname}${u.search}`
    );
  } catch {
    console.log(`${name}: FORMATO INVÁLIDO`);
  }
}

describeUrl("DATABASE_URL", process.env.DATABASE_URL);
describeUrl("DIRECT_URL", process.env.DIRECT_URL);

if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("ep-xxx")) {
  try {
    const { createPrismaClient } = await import("../src/lib/create-prisma.ts");
    const prisma = createPrismaClient();
    const count = await prisma.user.count();
    console.log("Conexão Neon: OK —", count, "usuário(s)");
    await prisma.$disconnect();
  } catch (e) {
    console.log("Conexão Neon: FALHOU —", e instanceof Error ? e.message : e);
  }
}
