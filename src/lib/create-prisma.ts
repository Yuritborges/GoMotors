import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";
import { uppercaseWriteData } from "@/lib/uppercase-data";

const WRITE_OPERATIONS = new Set([
  "create",
  "update",
  "upsert",
  "createMany",
  "createManyAndReturn",
  "updateMany",
  "updateManyAndReturn",
]);

export function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL não configurado no .env");
  }

  const adapter = new PrismaNeon({ connectionString });

  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  const extended = client.$extends({
    name: "uppercase-text",
    query: {
      $allModels: {
        $allOperations({ operation, args, query }) {
          if (WRITE_OPERATIONS.has(operation)) {
            const a = args as Record<string, unknown>;
            uppercaseWriteData(a.data);
            uppercaseWriteData(a.create);
            uppercaseWriteData(a.update);
          }
          return query(args);
        },
      },
    },
  });

  // O client estendido mantém a mesma API; o cast evita propagar o tipo
  // dinâmico do $extends para o resto do código.
  return extended as unknown as PrismaClient;
}
