/**
 * Avisa se o desenvolvedor está na branch main (produção do cliente).
 * Rodado automaticamente em `npm run dev`.
 */
import { execSync } from "node:child_process";

function currentBranch() {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

const branch = currentBranch();

if (branch === "main") {
  console.warn("");
  console.warn("╔══════════════════════════════════════════════════════════════╗");
  console.warn("║  ATENÇÃO: você está na branch MAIN (produção do Matheus).   ║");
  console.warn("║  Alterações aqui vão direto para o lava-rápido após push.   ║");
  console.warn("║                                                              ║");
  console.warn("║  Recomendado: git checkout dev                               ║");
  console.warn("║  Fluxo completo: WORKFLOW.md                                 ║");
  console.warn("╚══════════════════════════════════════════════════════════════╝");
  console.warn("");
}
