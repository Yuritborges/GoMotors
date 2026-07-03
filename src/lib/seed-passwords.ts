import { randomBytes } from "node:crypto";

/** Senha para seed/import — exige env ou gera uma aleatória (nunca hardcoded). */
export function resolveSeedPassword(envKey: string, label: string): string {
  const fromEnv = process.env[envKey]?.trim();
  if (fromEnv && fromEnv.length >= 8) return fromEnv;

  const generated = randomBytes(18).toString("base64url");
  console.warn(
    `[seed] ${label}: defina ${envKey} no .env (mín. 8 caracteres).\n` +
      `       Senha gerada só para esta execução: ${generated}`
  );
  return generated;
}

/** Impede seed acidental em banco remoto (Neon/produção). */
export function assertSeedAllowed(): void {
  if (process.env.SEED_FORCE === "1") return;

  const url = process.env.DATABASE_URL ?? "";
  const looksRemote =
    url.includes("neon.tech") ||
    url.includes("vercel-storage.com") ||
    url.includes("supabase.co");

  if (looksRemote) {
    console.error(
      "[seed] Banco remoto detectado. O seed APAGA todos os dados.\n" +
        "       Para demo vazia: SEED_FORCE=1 npm run db:seed\n" +
        "       Para produção: use npm run db:import ou cadastro manual — nunca db:seed."
    );
    process.exit(1);
  }
}
