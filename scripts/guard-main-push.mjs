/**
 * Hook pre-push: exige confirmação explícita para push na main.
 * Ativar: git config core.hooksPath .githooks
 */
import { execSync } from "node:child_process";

const branch = execSync("git rev-parse --abbrev-ref HEAD", {
  encoding: "utf8",
}).trim();

if (branch === "main" && process.env.ALLOW_MAIN_PUSH !== "1") {
  console.error("");
  console.error("Push na MAIN bloqueado (produção do Matheus).");
  console.error("");
  console.error("  Fluxo correto:  npm run promote:prod");
  console.error("  Ou, se tiver certeza:  ALLOW_MAIN_PUSH=1 git push origin main");
  console.error("");
  console.error("  Veja WORKFLOW.md");
  console.error("");
  process.exit(1);
}
