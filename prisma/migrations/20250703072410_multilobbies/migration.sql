-- CreateTable
CREATE TABLE "game_lobby" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "hostId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "gameSettings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_lobby_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lobby_player" (
    "id" TEXT NOT NULL,
    "lobbyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'invited',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lobby_player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "multiplayer_game_result" (
    "id" TEXT NOT NULL,
    "lobbyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "completionTime" INTEGER,
    "position" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "multiplayer_game_result_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lobby_player_lobbyId_userId_key" ON "lobby_player"("lobbyId", "userId");

-- AddForeignKey
ALTER TABLE "game_lobby" ADD CONSTRAINT "game_lobby_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lobby_player" ADD CONSTRAINT "lobby_player_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "game_lobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lobby_player" ADD CONSTRAINT "lobby_player_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "multiplayer_game_result" ADD CONSTRAINT "multiplayer_game_result_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "game_lobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "multiplayer_game_result" ADD CONSTRAINT "multiplayer_game_result_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
