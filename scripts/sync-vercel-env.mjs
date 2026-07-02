import fs from "node:fs";
import { execSync } from "node:child_process";

function parseEnvFile(path) {
  const vars = {};
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

const env = parseEnvFile(".env");

for (const name of ["DATABASE_URL", "DIRECT_URL", "AUTH_SECRET"]) {
  const value = env[name];
  if (!value) {
    console.warn(`Skip ${name}: not in .env`);
    continue;
  }
  try {
    execSync(`npx vercel env rm ${name} production -y`, { stdio: "pipe" });
  } catch {
    /* may not exist */
  }
  execSync(`npx vercel env add ${name} production --force`, {
    input: value,
    stdio: ["pipe", "inherit", "inherit"],
  });
  console.log(`Updated ${name} on Vercel (production)`);
}
