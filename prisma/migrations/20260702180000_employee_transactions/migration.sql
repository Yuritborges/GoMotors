-- CreateEnum
CREATE TYPE "EmployeeTransactionType" AS ENUM ('VALE', 'REEMBOLSO', 'DESCONTO');

-- CreateTable
CREATE TABLE "EmployeeTransaction" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "EmployeeTransactionType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeTransaction_employeeId_date_idx" ON "EmployeeTransaction"("employeeId", "date");

-- AddForeignKey
ALTER TABLE "EmployeeTransaction" ADD CONSTRAINT "EmployeeTransaction_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey (ServiceOrder employee)
ALTER TABLE "ServiceOrder" DROP CONSTRAINT IF EXISTS "ServiceOrder_employeeId_fkey";

-- AddForeignKey with SetNull
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
