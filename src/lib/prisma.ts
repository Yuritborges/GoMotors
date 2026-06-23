import { createPrismaClient } from "@/lib/create-prisma";

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

function isPrismaClientReady(
  client: ReturnType<typeof createPrismaClient> | undefined
): client is ReturnType<typeof createPrismaClient> {
  return Boolean(client && typeof client.user !== "undefined");
}

const cached = globalForPrisma.prisma;
export const prisma = isPrismaClientReady(cached) ? cached : createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
