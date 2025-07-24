/*
  Warnings:

  - You are about to drop the column `disconnectedAt` on the `lobby_player` table. All the data in the column will be lost.
  - You are about to drop the column `presenceStatus` on the `lobby_player` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "lobby_player" DROP COLUMN "disconnectedAt",
DROP COLUMN "presenceStatus";
