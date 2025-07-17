-- AlterTable
ALTER TABLE "game_lobby" ADD COLUMN     "gameState" JSONB;

-- AlterTable
ALTER TABLE "lobby_player" ADD COLUMN     "incorrectCountries" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "progress" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "score" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "validatedCountries" TEXT[] DEFAULT ARRAY[]::TEXT[];
