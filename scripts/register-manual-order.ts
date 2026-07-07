/**
 * Registra uma ordem manual (ex.: lavagem do dia não lançada no sistema).
 * Uso: npx tsx scripts/register-manual-order.ts
 */
import "dotenv/config";
import { createPrismaClient } from "../src/lib/create-prisma";
import { paymentStatusForMethod } from "../src/lib/payments";

const PLATE = "EOC4B27";
const MODEL = "VIRTUS";
const SERVICE_NAME = "Lavagem simples";
const AMOUNT = 55;
const PAYMENT_METHOD = "DEBITO" as const;
const ENTRY_DATE = "2026-07-07T14:00:00"; // 07/07/2026, horário aproximado do dia

const prisma = createPrismaClient();

async function main() {
  const entryAt = new Date(ENTRY_DATE);
  const dayStart = new Date(`${ENTRY_DATE.slice(0, 10)}T00:00:00`);
  const dayEnd = new Date(`${ENTRY_DATE.slice(0, 10)}T23:59:59.999`);

  let vehicle = await prisma.vehicle.findUnique({
    where: { plate: PLATE },
    include: { client: true },
  });

  if (!vehicle) {
    const client = await prisma.client.create({
      data: {
        name: `Cliente ${PLATE}`,
        phone: "—",
        notes: "Cadastro manual — lavagem avulsa",
        vehicles: {
          create: {
            plate: PLATE,
            model: MODEL,
            vehicleType: "CARRO",
          },
        },
      },
      include: { vehicles: true },
    });
    vehicle = { ...client.vehicles[0]!, client };
    console.log(`Veículo criado: ${PLATE} (${MODEL})`);
  } else if (!vehicle.model && MODEL) {
    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: { model: MODEL },
    });
    console.log(`Modelo atualizado: ${MODEL}`);
  }

  const existing = await prisma.serviceOrder.findFirst({
    where: {
      vehicleId: vehicle.id,
      entryAt: { gte: dayStart, lte: dayEnd },
      total: AMOUNT,
      paymentMethod: PAYMENT_METHOD,
    },
    include: { items: true, vehicle: true },
  });

  if (existing) {
    console.log("Ordem já existe para este veículo/data/valor:");
    console.log({
      id: existing.id,
      plate: existing.vehicle.plate,
      total: existing.total,
      payment: existing.paymentMethod,
      status: existing.status,
      items: existing.items.map((i) => i.serviceName),
    });
    return;
  }

  const service = await prisma.service.findFirst({
    where: { name: SERVICE_NAME, active: true },
  });

  const paymentStatus = paymentStatusForMethod(PAYMENT_METHOD);

  const order = await prisma.serviceOrder.create({
    data: {
      clientId: vehicle.clientId,
      vehicleId: vehicle.id,
      status: "ENTREGUE",
      currentLane: "ENTREGUE",
      subtotal: AMOUNT,
      total: AMOUNT,
      discount: 0,
      paymentMethod: PAYMENT_METHOD,
      paymentStatus,
      notes: "Lançamento manual — planilha do dia 07/07/2026",
      entryAt,
      deliveredAt: entryAt,
      items: {
        create: {
          serviceId: service?.id ?? null,
          serviceName: SERVICE_NAME,
          price: AMOUNT,
        },
      },
      payments: {
        create: {
          method: PAYMENT_METHOD,
          amount: AMOUNT,
          type: "PAGAMENTO",
          notes: "Débito — registro manual",
          createdAt: entryAt,
        },
      },
    },
    include: {
      vehicle: true,
      client: true,
      items: true,
    },
  });

  console.log("Ordem registrada:");
  console.log({
    id: order.id,
    data: entryAt.toLocaleDateString("pt-BR"),
    cliente: order.client.name,
    placa: order.vehicle.plate,
    modelo: order.vehicle.model,
    servico: order.items[0]?.serviceName,
    total: order.total,
    pagamento: order.paymentMethod,
    status: order.paymentStatus,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
