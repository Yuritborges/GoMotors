/**
 * Promove dev → main com checklist e testes.
 * Uso: npm run promote:prod
 */
import { execSync } from "node:child_process";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

function run(command, options = {}) {
  console.log(`\n> ${command}`);
  execSync(command, { stdio: "inherit", ...options });
}

function branch() {
  return execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim();
}

function hasUncommitted() {
  const status = execSync("git status --porcelain", { encoding: "utf8" }).trim();
  return status.length > 0;
}

const rl = readline.createInterface({ input, output });

try {
  console.log("\n=== GoMotors — publicar dev → main (produção) ===\n");

  if (hasUncommitted()) {
    console.error("Erro: há alterações não commitadas. Commit ou stash antes.");
    process.exit(1);
  }

  const current = branch();
  if (current !== "dev") {
    console.log(`Branch atual: ${current}. Mudando para dev...`);
    run("git checkout dev");
  }

  run("git pull origin dev");

  console.log("\nRodando testes...");
  run("npm test");

  const answer = await rl.question(
    "\nTestou login, nova OS, painel e telão na dev/preview? (sim/não): "
  );

  if (!/^s(im)?$/i.test(answer.trim())) {
    console.log("\nPublicação cancelada. Teste na dev primeiro (WORKFLOW.md).");
    process.exit(0);
  }

  run("git checkout main");
  run("git pull origin main");
  run("git merge dev --no-edit");
  run("git push origin main", {
    env: { ...process.env, ALLOW_MAIN_PUSH: "1" },
  });
  run("git checkout dev");

  console.log("\n✓ Produção atualizada. Aguarde o deploy na Vercel (~2–5 min).");
  console.log("  https://go-motors-ten.vercel.app");
  console.log("\nSe houve migration nova: npm run db:migrate:deploy");
} catch (error) {
  console.error("\nFalha na publicação:", error.message ?? error);
  try {
    execSync("git checkout dev", { stdio: "inherit" });
  } catch {
    /* ignore */
  }
  process.exit(1);
} finally {
  rl.close();
}
