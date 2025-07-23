-- AlterTable
ALTER TABLE "game_lobby" ADD COLUMN     "authorizedPlayers" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "lobby_player" ADD COLUMN     "disconnectedAt" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'joined';
