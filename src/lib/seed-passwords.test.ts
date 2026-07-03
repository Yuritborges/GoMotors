import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveSeedPassword } from "./seed-passwords";

describe("seed-passwords", () => {
  it("usa senha do ambiente quando definida", () => {
    const key = "TEST_SEED_PASSWORD_KEY";
    process.env[key] = "senha-segura-123";
    assert.equal(resolveSeedPassword(key, "Teste"), "senha-segura-123");
    delete process.env[key];
  });

  it("gera senha aleatória quando env ausente", () => {
    const key = "TEST_SEED_MISSING_KEY";
    delete process.env[key];
    const password = resolveSeedPassword(key, "Teste");
    assert.ok(password.length >= 8);
  });
});
