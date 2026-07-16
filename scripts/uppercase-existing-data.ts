/**
 * Converte textos livres do banco para MAIÚSCULA (padronização).
 * E-mail e senha não são alterados.
 *
 * Uso: npx tsx scripts/uppercase-existing-data.ts
 */
import "dotenv/config";
import { createPrismaClient } from "../src/lib/create-prisma";
import { toUpperText } from "../src/lib/uppercase-data";

function up(value: string | null | undefined): string | null | undefined {
  if (value == null) return value;
  const next = toUpperText(value);
  return next === value ? undefined : next;
}

async function main() {
  const prisma = createPrismaClient();
  let changed = 0;

  console.log("Padronizando textos em MAIÚSCULA...");

  const clients = await prisma.client.findMany();
  for (const row of clients) {
    const data: { name?: string; phone?: string; notes?: string | null } = {};
    const name = up(row.name);
    const phone = up(row.phone);
    const notes = up(row.notes);
    if (name !== undefined) data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (notes !== undefined) data.notes = notes;
    if (Object.keys(data).length) {
      await prisma.client.update({ where: { id: row.id }, data });
      changed += 1;
    }
  }
  console.log(`Clientes: ${changed} atualizados`);

  let n = 0;
  const vehicles = await prisma.vehicle.findMany();
  for (const row of vehicles) {
    const data: Record<string, string | null> = {};
    for (const key of ["plate", "brand", "model", "color", "notes"] as const) {
      const next = up(row[key]);
      if (next !== undefined) data[key] = next;
    }
    if (Object.keys(data).length) {
      await prisma.vehicle.update({ where: { id: row.id }, data });
      n += 1;
    }
  }
  console.log(`Veículos: ${n} atualizados`);

  n = 0;
  const services = await prisma.service.findMany();
  for (const row of services) {
    const data: Record<string, string> = {};
    const name = up(row.name);
    const category = up(row.category);
    if (name !== undefined) data.name = name;
    if (category !== undefined) data.category = category;
    if (Object.keys(data).length) {
      await prisma.service.update({ where: { id: row.id }, data });
      n += 1;
    }
  }
  console.log(`Serviços: ${n} atualizados`);

  n = 0;
  const products = await prisma.product.findMany();
  for (const row of products) {
    const data: Record<string, string | null> = {};
    const name = up(row.name);
    const category = up(row.category);
    const description = up(row.description);
    if (name !== undefined) data.name = name;
    if (category !== undefined) data.category = category;
    if (description !== undefined) data.description = description;
    if (Object.keys(data).length) {
      await prisma.product.update({ where: { id: row.id }, data });
      n += 1;
    }
  }
  console.log(`Produtos: ${n} atualizados`);

  n = 0;
  const employees = await prisma.employee.findMany();
  for (const row of employees) {
    const name = up(row.name);
    if (name !== undefined) {
      await prisma.employee.update({ where: { id: row.id }, data: { name } });
      n += 1;
    }
  }
  console.log(`Funcionários: ${n} atualizados`);

  n = 0;
  const users = await prisma.user.findMany();
  for (const row of users) {
    const name = up(row.name);
    if (name !== undefined) {
      await prisma.user.update({ where: { id: row.id }, data: { name } });
      n += 1;
    }
  }
  console.log(`Usuários (nome): ${n} atualizados — e-mails preservados`);

  n = 0;
  const partners = await prisma.partnerStore.findMany();
  for (const row of partners) {
    const data: Record<string, string | null> = {};
    const name = up(row.name);
    const phone = up(row.phone);
    const notes = up(row.notes);
    if (name !== undefined) data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (notes !== undefined) data.notes = notes;
    if (Object.keys(data).length) {
      await prisma.partnerStore.update({ where: { id: row.id }, data });
      n += 1;
    }
  }
  console.log(`Lojas parceiras: ${n} atualizadas`);

  n = 0;
  const partnerEntries = await prisma.partnerLedgerEntry.findMany();
  for (const row of partnerEntries) {
    const data: Record<string, string | null> = {};
    const description = up(row.description);
    const installment = up(row.installment);
    if (description !== undefined) data.description = description;
    if (installment !== undefined) data.installment = installment;
    if (Object.keys(data).length) {
      await prisma.partnerLedgerEntry.update({ where: { id: row.id }, data });
      n += 1;
    }
  }
  console.log(`Lançamentos de lojas: ${n} atualizados`);

  n = 0;
  const orders = await prisma.serviceOrder.findMany({ select: { id: true, notes: true } });
  for (const row of orders) {
    const notes = up(row.notes);
    if (notes !== undefined) {
      await prisma.serviceOrder.update({ where: { id: row.id }, data: { notes } });
      n += 1;
    }
  }
  console.log(`Ordens (notas): ${n} atualizadas`);

  n = 0;
  const items = await prisma.orderItem.findMany({ select: { id: true, serviceName: true } });
  for (const row of items) {
    const serviceName = up(row.serviceName);
    if (serviceName !== undefined) {
      await prisma.orderItem.update({
        where: { id: row.id },
        data: { serviceName },
      });
      n += 1;
    }
  }
  console.log(`Itens de OS: ${n} atualizados`);

  n = 0;
  const payments = await prisma.payment.findMany({ select: { id: true, notes: true } });
  for (const row of payments) {
    const notes = up(row.notes);
    if (notes !== undefined) {
      await prisma.payment.update({ where: { id: row.id }, data: { notes } });
      n += 1;
    }
  }
  console.log(`Pagamentos (notas): ${n} atualizados`);

  n = 0;
  const expenses = await prisma.expense.findMany();
  for (const row of expenses) {
    const description = up(row.description);
    if (description !== undefined) {
      await prisma.expense.update({
        where: { id: row.id },
        data: { description },
      });
      n += 1;
    }
  }
  console.log(`Despesas: ${n} atualizadas`);

  n = 0;
  const empTx = await prisma.employeeTransaction.findMany();
  for (const row of empTx) {
    const description = up(row.description);
    if (description !== undefined) {
      await prisma.employeeTransaction.update({
        where: { id: row.id },
        data: { description },
      });
      n += 1;
    }
  }
  console.log(`Transações de funcionários: ${n} atualizadas`);

  n = 0;
  const stock = await prisma.stockMovement.findMany();
  for (const row of stock) {
    const data: Record<string, string | null> = {};
    const notes = up(row.notes);
    const userName = up(row.userName);
    if (notes !== undefined) data.notes = notes;
    if (userName !== undefined) data.userName = userName;
    if (Object.keys(data).length) {
      await prisma.stockMovement.update({ where: { id: row.id }, data });
      n += 1;
    }
  }
  console.log(`Movimentos de estoque: ${n} atualizados`);

  n = 0;
  const audits = await prisma.auditLog.findMany();
  for (const row of audits) {
    const data: Record<string, string> = {};
    const userName = up(row.userName);
    const summary = up(row.summary);
    if (userName !== undefined) data.userName = userName;
    if (summary !== undefined) data.summary = summary;
    if (Object.keys(data).length) {
      await prisma.auditLog.update({ where: { id: row.id }, data });
      n += 1;
    }
  }
  console.log(`Auditoria: ${n} atualizados`);

  n = 0;
  const closings = await prisma.cashClosing.findMany();
  for (const row of closings) {
    const closedBy = up(row.closedBy);
    if (closedBy !== undefined) {
      await prisma.cashClosing.update({
        where: { id: row.id },
        data: { closedBy },
      });
      n += 1;
    }
  }
  console.log(`Fechamentos de caixa: ${n} atualizados`);

  await prisma.$disconnect();
  console.log("Concluído.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
