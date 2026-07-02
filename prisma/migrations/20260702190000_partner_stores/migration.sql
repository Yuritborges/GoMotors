-- CreateEnum
CREATE TYPE "PartnerEntryType" AS ENUM ('DIVIDA', 'PRODUTO', 'PARCELA', 'PAGAMENTO', 'AJUSTE');

-- CreateTable
CREATE TABLE "PartnerStore" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerStore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerLedgerEntry" (
    "id" TEXT NOT NULL,
    "partnerStoreId" TEXT NOT NULL,
    "type" "PartnerEntryType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "installment" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerStore_name_key" ON "PartnerStore"("name");

-- CreateIndex
CREATE INDEX "PartnerLedgerEntry_partnerStoreId_date_idx" ON "PartnerLedgerEntry"("partnerStoreId", "date");

-- AddForeignKey
ALTER TABLE "PartnerLedgerEntry" ADD CONSTRAINT "PartnerLedgerEntry_partnerStoreId_fkey" FOREIGN KEY ("partnerStoreId") REFERENCES "PartnerStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "ServiceOrder" ADD COLUMN "partnerStoreId" TEXT;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_partnerStoreId_fkey" FOREIGN KEY ("partnerStoreId") REFERENCES "PartnerStore"("id") ON DELETE SET NULL ON UPDATE CASCADE;
