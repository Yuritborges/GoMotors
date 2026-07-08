-- AlterEnum
ALTER TYPE "EmployeeTransactionType" ADD VALUE IF NOT EXISTS 'PAGAMENTO_SALARIO';

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "salary" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE IF NOT EXISTS "CashClosing" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "closedBy" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashClosing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CashClosing_date_key" ON "CashClosing"("date");
CREATE INDEX IF NOT EXISTS "CashClosing_date_idx" ON "CashClosing"("date");
