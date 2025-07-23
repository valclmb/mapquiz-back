import { prisma } from "../lib/database.js";
import { LobbyGameService } from "../services/lobby/lobbyGameService.js";

/**
 * Script de test pour simuler l'accès à un lobby
 */
async function testLobbyAccess(lobbyId: string, userId: string) {
  console.log(`=== TEST ACCÈS LOBBY ===`);
  console.log(`Lobby ID: ${lobbyId}`);
  console.log(`User ID: ${userId}`);
  console.log("");

  try {
    // 1. Vérifier si l'utilisateur existe
    console.log("1. Vérification de l'utilisateur...");
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      console.log("❌ Utilisateur non trouvé");
      return;
    }
    console.log(`✅ Utilisateur trouvé: ${user.name}`);

    // 2. Vérifier si le lobby existe
    console.log("\n2. Vérification du lobby...");
    const lobby = await prisma.gameLobby.findUnique({
      where: { id: lobbyId },
      include: {
        host: true,
        players: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!lobby) {
      console.log("❌ Lobby non trouvé");
      return;
    }
    console.log(`✅ Lobby trouvé: ${lobby.name} (${lobby.status})`);
    console.log(`   Hôte: ${lobby.host.name}`);
    console.log(`   Joueurs: ${lobby.players.length}`);

    // 3. Vérifier si l'utilisateur est dans le lobby
    console.log("\n3. Vérification de l'appartenance au lobby...");
    const player = await prisma.lobbyPlayer.findUnique({
      where: {
        lobbyId_userId: {
          lobbyId,
          userId,
        },
      },
    });

    if (!player) {
      console.log("❌ Utilisateur non trouvé dans le lobby");
      console.log("   Tentative d'ajout automatique...");

      // Ajouter l'utilisateur au lobby
      await prisma.lobbyPlayer.create({
        data: {
          lobbyId,
          userId,
          status: "joined",
        },
      });

      console.log("✅ Utilisateur ajouté au lobby");
    } else {
      console.log(
        `✅ Utilisateur trouvé dans le lobby (statut: ${player.status})`
      );
    }

    // 4. Tester l'accès via le service
    console.log("\n4. Test d'accès via LobbyGameService...");
    try {
      const lobbyState = await LobbyGameService.getLobbyState(lobbyId, userId);
      console.log("✅ Accès réussi via le service");
      console.log(`   Statut du lobby: ${lobbyState.status}`);
      console.log(`   Nombre de joueurs: ${lobbyState.players.length}`);
    } catch (error) {
      console.log("❌ Erreur lors de l'accès via le service:");
      console.log(
        `   ${error instanceof Error ? error.message : "Erreur inconnue"}`
      );
    }
  } catch (error) {
    console.error("❌ Erreur lors du test:", error);
  }
}

// Exécuter le script si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  const lobbyId = process.argv[2];
  const userId = process.argv[3];

  if (!lobbyId || !userId) {
    console.log("Usage: node testLobbyAccess.js <lobbyId> <userId>");
    process.exit(1);
  }

  testLobbyAccess(lobbyId, userId).finally(() => {
    prisma.$disconnect();
  });
}

export { testLobbyAccess };
