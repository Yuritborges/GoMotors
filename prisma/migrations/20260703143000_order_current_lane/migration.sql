-- Etapa operacional atual (coluna do painel/telão)
ALTER TABLE "ServiceOrder" ADD COLUMN "currentLane" TEXT NOT NULL DEFAULT 'AGUARDANDO';

UPDATE "ServiceOrder" SET "currentLane" = 'PRONTO' WHERE "status" = 'PRONTO';
UPDATE "ServiceOrder" SET "currentLane" = 'AGUARDANDO' WHERE "status" = 'AGUARDANDO';
UPDATE "ServiceOrder" SET "currentLane" = 'FINALIZACAO' WHERE "status" = 'FINALIZACAO';
UPDATE "ServiceOrder" SET "currentLane" = 'LAVAGEM' WHERE "status" = 'EM_LAVAGEM';
