import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";

export type AuditInput = {
  user?: SessionUser | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
};

export async function logAudit(input: AuditInput) {
  await prisma.auditLog.create({
    data: {
      userId: input.user?.id ?? null,
      userName: input.user?.name ?? "Sistema",
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      summary: input.summary,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}
