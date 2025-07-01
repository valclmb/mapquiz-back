-- CreateTable
CREATE TABLE "game_score" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "selectedRegions" TEXT[],
    "gameMode" TEXT NOT NULL DEFAULT 'quiz',
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_score_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "game_score" ADD CONSTRAINT "game_score_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
