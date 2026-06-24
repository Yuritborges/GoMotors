/**
 * Build de produção (Vercel/local).
 * Migrations ficam fora do build — rode `npm run db:migrate:deploy` ao alterar o schema.
 * Isso evita falha P1001 quando o Neon não responde na região de build da Vercel.
 */
import "dotenv/config";
import { execSync } from "node:child_process";

function run(command, env = process.env) {
  execSync(command, { stdio: "inherit", env });
}

run("npx prisma generate");

if (process.env.RUN_MIGRATE === "1") {
  const migrateUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!migrateUrl) {
    console.error("[build] RUN_MIGRATE=1 mas DATABASE_URL/DIRECT_URL não definidas.");
    process.exit(1);
  }
  run("npx prisma migrate deploy", {
    ...process.env,
    DATABASE_URL: migrateUrl,
  });
} else {
  console.log(
    "[build] Migrations omitidas no deploy (padrão). " +
      "Para aplicar schema: npm run db:migrate:deploy"
  );
}

run("npx next build");
