import { prisma } from "../lib/database.js";
import { LobbyGameService } from "../services/lobby/lobbyGameService.js";

/**
 * Script de test pour vérifier la persistance du lobby
 */
async function testLobbyPersistence(lobbyId: string, userId: string) {
  console.log(`=== TEST PERSISTANCE LOBBY ===`);
  console.log(`Lobby ID: ${lobbyId}`);
  console.log(`User ID: ${userId}`);
  console.log("");

  try {
    // 1. Vérifier l'état initial
    console.log("1. État initial du lobby...");
    const initialLobby = await prisma.gameLobby.findUnique({
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

    if (!initialLobby) {
      console.log("❌ Lobby non trouvé au début du test");
      return;
    }

    console.log(
      `✅ Lobby trouvé: ${initialLobby.name} (${initialLobby.status})`
    );
    console.log(`   Hôte: ${initialLobby.host.name}`);
    console.log(`   Joueurs: ${initialLobby.players.length}`);

    // 2. Simuler plusieurs accès au lobby
    console.log("\n2. Test d'accès multiples au lobby...");

    for (let i = 1; i <= 3; i++) {
      console.log(`\n   Test ${i}:`);
      try {
        const lobbyState = await LobbyGameService.getLobbyState(
          lobbyId,
          userId
        );
        console.log(`   ✅ Accès ${i} réussi`);
        console.log(`      Statut: ${lobbyState.status}`);
        console.log(`      Joueurs: ${lobbyState.players.length}`);
      } catch (error) {
        console.log(
          `   ❌ Accès ${i} échoué: ${error instanceof Error ? error.message : "Erreur inconnue"}`
        );
      }

      // Attendre un peu entre les tests
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // 3. Vérifier l'état final
    console.log("\n3. État final du lobby...");
    const finalLobby = await prisma.gameLobby.findUnique({
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

    if (!finalLobby) {
      console.log("❌ Lobby supprimé pendant le test !");
      return;
    }

    console.log(
      `✅ Lobby toujours présent: ${finalLobby.name} (${finalLobby.status})`
    );
    console.log(`   Hôte: ${finalLobby.host.name}`);
    console.log(`   Joueurs: ${finalLobby.players.length}`);

    // 4. Comparer les états
    console.log("\n4. Comparaison des états...");
    if (initialLobby.id === finalLobby.id) {
      console.log("✅ Lobby persistant - même ID");
    } else {
      console.log("❌ Lobby différent - problème de persistance");
    }

    if (initialLobby.players.length === finalLobby.players.length) {
      console.log("✅ Nombre de joueurs constant");
    } else {
      console.log("❌ Nombre de joueurs différent");
    }

    const userStillInLobby = finalLobby.players.some(
      (p) => p.userId === userId
    );
    if (userStillInLobby) {
      console.log("✅ Utilisateur toujours dans le lobby");
    } else {
      console.log("❌ Utilisateur supprimé du lobby");
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
    console.log("Usage: node testLobbyPersistence.js <lobbyId> <userId>");
    process.exit(1);
  }

  testLobbyPersistence(lobbyId, userId).finally(() => {
    prisma.$disconnect();
  });
}

export { testLobbyPersistence };
