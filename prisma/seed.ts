import "dotenv/config";
import { createPrismaClient } from "../src/lib/create-prisma";
import bcrypt from "bcryptjs";

const prisma = createPrismaClient();

const services = [
  { name: "Lavagem simples", category: "Lavagem", defaultPrice: 35, estimatedMinutes: 20 },
  { name: "Lavagem completa", category: "Lavagem", defaultPrice: 70, estimatedMinutes: 45 },
  { name: "Higienização", category: "Detalhamento", defaultPrice: 180, estimatedMinutes: 120 },
  { name: "Enceramento", category: "Detalhamento", defaultPrice: 120, estimatedMinutes: 60 },
  { name: "Lavagem de motor", category: "Lavagem", defaultPrice: 50, estimatedMinutes: 30 },
  { name: "Polimento", category: "Detalhamento", defaultPrice: 250, estimatedMinutes: 180 },
  { name: "Serviços adicionais", category: "Extras", defaultPrice: 40, estimatedMinutes: 15 },
];

const vehiclePriceMultipliers: Record<string, number> = {
  MOTO: 0.7,
  CARRO: 1,
  SUV: 1.2,
  CAMINHONETE: 1.3,
  OUTRO: 1,
};

async function main() {
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.serviceOrder.deleteMany();
  await prisma.serviceVehiclePrice.deleteMany();
  await prisma.service.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.client.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();

  const ownerPassword = await bcrypt.hash("admin123", 12);
  const attendantPassword = await bcrypt.hash("atendente123", 12);

  await prisma.user.createMany({
    data: [
      {
        name: "Proprietário",
        email: "admin@gomotors.local",
        passwordHash: ownerPassword,
        role: "PROPRIETARIO",
      },
      {
        name: "Atendente Demo",
        email: "atendente@gomotors.local",
        passwordHash: attendantPassword,
        role: "ATENDENTE",
      },
    ],
  });

  await prisma.product.createMany({
    data: [
      {
        name: "Cera líquida premium",
        category: "Produtos",
        price: 45,
        stock: 20,
        description: "Venda avulsa para clientes",
      },
      {
        name: "Aromatizante",
        category: "Produtos",
        price: 25,
        stock: 30,
      },
      {
        name: "Shampoo automotivo 5L",
        category: "Insumos",
        price: 89.9,
        stock: 10,
        description: "Uso interno / revenda",
      },
    ],
  });

  const employees = await Promise.all(
    TEAM_EMPLOYEES.map((name) => prisma.employee.create({ data: { name, active: true } }))
  );

  for (const svc of services) {
    const service = await prisma.service.create({ data: svc });

    for (const [vehicleType, multiplier] of Object.entries(vehiclePriceMultipliers)) {
      await prisma.serviceVehiclePrice.create({
        data: {
          serviceId: service.id,
          vehicleType: vehicleType as "MOTO" | "CARRO" | "SUV" | "CAMINHONETE" | "OUTRO",
          price: Math.round(svc.defaultPrice * multiplier * 100) / 100,
        },
      });
    }
  }

  const client1 = await prisma.client.create({
    data: {
      name: "João Silva",
      phone: "(11) 98765-4321",
      vehicles: {
        create: [
          {
            plate: "ABC1234",
            brand: "Toyota",
            model: "Corolla",
            color: "Prata",
            vehicleType: "CARRO",
          },
        ],
      },
    },
    include: { vehicles: true },
  });

  const client2 = await prisma.client.create({
    data: {
      name: "Maria Santos",
      phone: "(11) 91234-5678",
      vehicles: {
        create: [
          {
            plate: "DEF5678",
            brand: "Honda",
            model: "HR-V",
            color: "Branco",
            vehicleType: "SUV",
          },
        ],
      },
    },
    include: { vehicles: true },
  });

  const lavagemCompleta = await prisma.service.findFirst({
    where: { name: "Lavagem completa" },
  });
  const higienizacao = await prisma.service.findFirst({
    where: { name: "Higienização" },
  });

  if (lavagemCompleta && higienizacao) {
    const price1 = await prisma.serviceVehiclePrice.findFirst({
      where: { serviceId: lavagemCompleta.id, vehicleType: "CARRO" },
    });
    const price2 = await prisma.serviceVehiclePrice.findFirst({
      where: { serviceId: higienizacao.id, vehicleType: "SUV" },
    });

    await prisma.serviceOrder.create({
      data: {
        clientId: client1.id,
        vehicleId: client1.vehicles[0].id,
        employeeId: employees[0].id,
        status: "EM_LAVAGEM",
        subtotal: price1?.price ?? 70,
        total: price1?.price ?? 70,
        paymentMethod: "PIX",
        paymentStatus: "PAGO",
        items: {
          create: {
            serviceId: lavagemCompleta.id,
            serviceName: lavagemCompleta.name,
            price: price1?.price ?? 70,
          },
        },
        payments: {
          create: {
            method: "PIX",
            amount: price1?.price ?? 70,
            type: "PAGAMENTO",
          },
        },
      },
    });

    await prisma.serviceOrder.create({
      data: {
        clientId: client2.id,
        vehicleId: client2.vehicles[0].id,
        status: "AGUARDANDO",
        subtotal: price2?.price ?? 180,
        total: price2?.price ?? 180,
        paymentMethod: "PENDENTE",
        paymentStatus: "PENDENTE",
        items: {
          create: {
            serviceId: higienizacao.id,
            serviceName: higienizacao.name,
            price: price2?.price ?? 180,
          },
        },
      },
    });
  }

  console.log("Seed concluído com sucesso!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
