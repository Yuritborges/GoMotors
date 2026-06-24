/**
 * Build de produção (Vercel/local).
 * Migrations usam DIRECT_URL quando disponível — obrigatório no Neon durante o build.
 */
import "dotenv/config";
import { execSync } from "node:child_process";

function run(command, env = process.env) {
  execSync(command, { stdio: "inherit", env });
}

run("npx prisma generate");

const migrateUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!migrateUrl) {
  console.error(
    "\n[build] Erro: defina DATABASE_URL e DIRECT_URL (Neon) nas variáveis de ambiente.\n" +
      "Vercel → Settings → Environment Variables → Production\n"
  );
  process.exit(1);
}

if (!process.env.DIRECT_URL) {
  console.warn(
    "[build] Aviso: DIRECT_URL não definida — migrate usará DATABASE_URL (pooler). " +
      "No Neon, prefira DIRECT_URL para migrations."
  );
}

run("npx prisma migrate deploy", {
  ...process.env,
  DATABASE_URL: migrateUrl,
});

run("npx next build");
