import "dotenv/config";
import { createPrismaClient } from "../src/lib/create-prisma.ts";

const prisma = createPrismaClient();
const checks = [];

async function run() {
  try {
    const users = await prisma.user.count();
    checks.push({ name: "Usuários", ok: users >= 2, detail: `${users} usuário(s)` });

    const admin = await prisma.user.findUnique({
      where: { email: "matheuspoli@gomotors.local" },
    });
    checks.push({
      name: "Admin demo",
      ok: !!admin?.active,
      detail: admin ? admin.email : "não encontrado",
    });

    const attendant = await prisma.user.findUnique({
      where: { email: "atendente@gomotors.local" },
    });
    checks.push({
      name: "Atendente demo",
      ok: !!attendant?.active,
      detail: attendant ? attendant.email : "não encontrado",
    });

    checks.push({
      name: "Clientes",
      ok: (await prisma.client.count()) >= 1,
      detail: `${await prisma.client.count()} cliente(s)`,
    });
    checks.push({
      name: "Serviços",
      ok: (await prisma.service.count()) >= 1,
      detail: `${await prisma.service.count()} serviço(s)`,
    });
    checks.push({
      name: "Ordens",
      ok: (await prisma.serviceOrder.count()) >= 1,
      detail: `${await prisma.serviceOrder.count()} ordem(ns)`,
    });
    checks.push({
      name: "Produtos/Estoque",
      ok: (await prisma.product.count()) >= 1,
      detail: `${await prisma.product.count()} produto(s)`,
    });
    checks.push({
      name: "Funcionários",
      ok: (await prisma.employee.count()) >= 1,
      detail: `${await prisma.employee.count()} funcionário(s)`,
    });
  } catch (error) {
    checks.push({
      name: "Conexão Neon",
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await prisma.$disconnect();
  }

  console.log("=== NEON DATABASE ===");
  for (const c of checks) {
    console.log(`${c.ok ? "PASS" : "FAIL"} | ${c.name} | ${c.detail}`);
  }

  process.exit(checks.some((c) => !c.ok) ? 1 : 0);
}

run();
