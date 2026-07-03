import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildOrderItems,
  orderItemsSubtotal,
  primaryOrderEmployeeId,
  type OrderItemInput,
} from "@/lib/build-order-items";
import { endOfDay, startOfDay } from "@/lib/utils";
import type { WorkflowTaskKey } from "@/lib/order-workflow";
import { hasSelectedWashService } from "@/lib/order-workflow";
import { paymentStatusForMethod } from "@/lib/payments";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const status = searchParams.get("status");
  const today = dateParam ? new Date(dateParam) : new Date();

  const orders = await prisma.serviceOrder.findMany({
    where: {
      entryAt: {
        gte: startOfDay(today),
        lte: endOfDay(today),
      },
      ...(status ? { status: status as never } : {}),
    },
    include: {
      client: true,
      vehicle: true,
      employee: true,
      items: { include: { employee: true } },
      payments: true,
    },
    orderBy: { entryAt: "desc" },
  });

  return NextResponse.json(orders);
}

type WorkflowTaskPayload = { key: WorkflowTaskKey; employeeId: string };
type ServiceItemPayload = { serviceId: string; employeeId: string };

function isWorkflowPayload(body: Record<string, unknown>) {
  return Array.isArray(body.workflowTasks) || Array.isArray(body.serviceItems);
}

export async function POST(request: Request) {
  const body = await request.json();

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: body.vehicleId },
  });

  if (!vehicle) {
    return NextResponse.json({ error: "Veículo não encontrado" }, { status: 404 });
  }

  let items: OrderItemInput[] = [];
  let orderEmployeeId: string | null = body.employeeId || null;

  if (isWorkflowPayload(body)) {
    const workflowTasks = (body.workflowTasks ?? []) as WorkflowTaskPayload[];
    const serviceItems = (body.serviceItems ?? []) as ServiceItemPayload[];

    const workflow = {
      lavagem: { employeeId: null as string | null },
      aspiracao: { employeeId: null as string | null },
      secagem: { employeeId: null as string | null },
    };

    for (const task of workflowTasks) {
      if (task.key in workflow && task.employeeId) {
        workflow[task.key as WorkflowTaskKey].employeeId = task.employeeId;
      }
    }

    const extras: Record<string, { selected: boolean; employeeId: string | null }> = {};
    for (const item of serviceItems) {
      if (item.serviceId && item.employeeId) {
        extras[item.serviceId] = { selected: true, employeeId: item.employeeId };
      }
    }

    const services = await prisma.service.findMany({
      where: { active: true },
      include: { vehiclePrices: true },
    });

    items = buildOrderItems({
      services,
      vehicleType: vehicle.vehicleType,
      workflow,
      extras,
    });

    if (items.length === 0) {
      return NextResponse.json(
        { error: "Selecione ao menos uma etapa ou serviço com funcionário." },
        { status: 400 }
      );
    }

    if (!hasSelectedWashService(services, extras)) {
      return NextResponse.json(
        { error: "Selecione o tipo de lavagem antes de registrar a ordem." },
        { status: 400 }
      );
    }

    orderEmployeeId = primaryOrderEmployeeId(workflow, items);
  } else {
    const services = await prisma.service.findMany({
      where: { id: { in: body.serviceIds ?? [] } },
      include: { vehiclePrices: true },
    });

    items = services.map((service) => {
      const vehiclePrice = service.vehiclePrices.find(
        (vp) => vp.vehicleType === vehicle.vehicleType
      );
      const price = vehiclePrice?.price ?? service.defaultPrice;
      return {
        serviceId: service.id,
        serviceName: service.name,
        price,
        employeeId: body.employeeId || null,
      };
    });
  }

  const subtotal = orderItemsSubtotal(items);
  const discount = Number(body.discount ?? 0);
  const total = Math.max(subtotal - discount, 0);
  const paymentMethod = body.paymentMethod ?? "PAGAR_DEPOIS";
  const paymentStatus = paymentStatusForMethod(paymentMethod);

  const order = await prisma.serviceOrder.create({
    data: {
      clientId: body.clientId,
      vehicleId: body.vehicleId,
      employeeId: orderEmployeeId,
      status: "AGUARDANDO",
      subtotal,
      discount,
      total,
      paymentMethod,
      paymentStatus,
      notes: body.notes || null,
      items: {
        create: items.map((item) => ({
          serviceId: item.serviceId,
          serviceName: item.serviceName,
          price: item.price,
          employeeId: item.employeeId,
        })),
      },
      payments:
        paymentStatus === "PAGO"
          ? {
              create: {
                method: paymentMethod,
                amount: total,
                type: "PAGAMENTO",
              },
            }
          : undefined,
    },
    include: {
      client: true,
      vehicle: true,
      employee: true,
      items: { include: { employee: true } },
      payments: true,
    },
  });

  return NextResponse.json(order, { status: 201 });
}
