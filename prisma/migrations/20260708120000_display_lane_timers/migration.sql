-- AlterTable ServiceOrder
ALTER TABLE "ServiceOrder" ADD COLUMN IF NOT EXISTS "laneEnteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "ServiceOrder" SET "laneEnteredAt" = "entryAt" WHERE "laneEnteredAt" IS NULL;

-- AlterTable OrderItem
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "estimatedMinutes" INTEGER NOT NULL DEFAULT 20;

-- CreateTable ShopSettings
CREATE TABLE IF NOT EXISTS "ShopSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "laneLavagemMinutes" INTEGER NOT NULL DEFAULT 20,
    "laneAspiracaoMinutes" INTEGER NOT NULL DEFAULT 20,
    "laneSecagemMinutes" INTEGER NOT NULL DEFAULT 20,
    "laneFinalizacaoMinutes" INTEGER NOT NULL DEFAULT 20,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ShopSettings" ("id", "laneLavagemMinutes", "laneAspiracaoMinutes", "laneSecagemMinutes", "laneFinalizacaoMinutes", "updatedAt")
VALUES ('default', 20, 20, 20, 20, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
