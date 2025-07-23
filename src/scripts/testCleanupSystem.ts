import { APP_CONSTANTS } from "../lib/config.js";
import { prisma } from "../lib/database.js";
import { LobbyCleanupService } from "../services/lobby/lobbyCleanupService.js";

async function testCleanupSystem() {
  console.log("=== TEST DU SYSTÈME DE NETTOYAGE AUTOMATIQUE ===\n");

  let lobbyId1: string | null = null;
  let lobbyId2: string | null = null;

  try {
    // 1. Créer des utilisateurs de test
    const testUser1 = await prisma.user.upsert({
      where: { id: "test-cleanup-user1" },
      update: {},
      create: {
        id: "test-cleanup-user1",
        name: "Test Cleanup User 1",
        email: "test-cleanup1@example.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const testUser2 = await prisma.user.upsert({
      where: { id: "test-cleanup-user2" },
      update: {},
      create: {
        id: "test-cleanup-user2",
        name: "Test Cleanup User 2",
        email: "test-cleanup2@example.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log("✅ Utilisateurs de test créés");

    // 2. Créer des lobbies de test
    lobbyId1 = crypto.randomUUID();
    const lobby1 = await prisma.gameLobby.create({
      data: {
        id: lobbyId1,
        name: "Test Cleanup Lobby 1",
        hostId: testUser1.id,
        status: "waiting",
        gameSettings: { selectedRegions: ["Europe"], gameMode: "quiz" },
        lastActivityAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes d'inactivité
      },
    });

    lobbyId2 = crypto.randomUUID();
    const lobby2 = await prisma.gameLobby.create({
      data: {
        id: lobbyId2,
        name: "Test Cleanup Lobby 2",
        hostId: testUser2.id,
        status: "waiting",
        gameSettings: { selectedRegions: ["Europe"], gameMode: "quiz" },
        lastActivityAt: new Date(), // Activité récente
      },
    });

    console.log("✅ Lobbies de test créés");

    // 3. Ajouter les utilisateurs aux lobbies
    await prisma.lobbyPlayer.create({
      data: {
        lobbyId: lobbyId1,
        userId: testUser1.id,
        status: "disconnected",
        disconnectedAt: new Date(Date.now() - 2 * 60 * 1000), // Déconnecté depuis 2 minutes
      },
    });

    await prisma.lobbyPlayer.create({
      data: {
        lobbyId: lobbyId2,
        userId: testUser2.id,
        status: "joined",
      },
    });

    console.log("✅ Utilisateurs ajoutés aux lobbies");

    // 4. Test 1: Nettoyage des joueurs déconnectés
    console.log("\n--- Test 1: Nettoyage des joueurs déconnectés ---");
    console.log("État avant nettoyage:");

    const playersBefore = await prisma.lobbyPlayer.findMany({
      where: { lobbyId: lobbyId1 },
      include: { user: true },
    });

    for (const player of playersBefore) {
      console.log(
        `  - ${player.user.name}: ${player.status} (déconnecté le: ${player.disconnectedAt})`
      );
    }

    // Exécuter le nettoyage des joueurs déconnectés
    await LobbyCleanupService.cleanupDisconnectedPlayers();

    console.log("\nÉtat après nettoyage des joueurs déconnectés:");
    const playersAfter = await prisma.lobbyPlayer.findMany({
      where: { lobbyId: lobbyId1 },
      include: { user: true },
    });

    if (playersAfter.length === 0) {
      console.log("✅ Joueur déconnecté supprimé automatiquement");
    } else {
      console.log("❌ Joueur déconnecté non supprimé");
      for (const player of playersAfter) {
        console.log(`  - ${player.user.name}: ${player.status}`);
      }
    }

    // 5. Test 2: Nettoyage des lobbies inactifs
    console.log("\n--- Test 2: Nettoyage des lobbies inactifs ---");
    console.log("État avant nettoyage des lobbies:");

    const lobbiesBefore = await prisma.gameLobby.findMany({
      where: { id: { in: [lobbyId1, lobbyId2] } },
      include: { players: true },
    });

    for (const lobby of lobbiesBefore) {
      console.log(
        `  - Lobby ${lobby.id}: ${lobby.status} (${lobby.players.length} joueurs, dernière activité: ${lobby.lastActivityAt})`
      );
    }

    // Exécuter le nettoyage des lobbies inactifs
    await LobbyCleanupService.cleanupInactiveLobbies();

    console.log("\nÉtat après nettoyage des lobbies inactifs:");
    const lobbiesAfter = await prisma.gameLobby.findMany({
      where: { id: { in: [lobbyId1, lobbyId2] } },
      include: { players: true },
    });

    if (lobbiesAfter.length === 0) {
      console.log("✅ Lobby inactif supprimé automatiquement");
    } else {
      console.log("❌ Lobby inactif non supprimé");
      for (const lobby of lobbiesAfter) {
        console.log(
          `  - Lobby ${lobby.id}: ${lobby.status} (${lobby.players.length} joueurs)`
        );
      }
    }

    // 6. Test 3: Vérification des constantes de délai
    console.log("\n--- Test 3: Vérification des délais ---");
    console.log(
      `Délai de suppression des joueurs déconnectés: ${APP_CONSTANTS.TIMEOUTS.PLAYER_DISCONNECT_TIMEOUT / 1000} secondes`
    );
    console.log(
      `Délai de suppression des lobbies inactifs: ${APP_CONSTANTS.TIMEOUTS.LOBBY_CLEANUP_DELAY / 1000} secondes`
    );

    console.log("\n🎉 Tests du système de nettoyage terminés !");
  } catch (error) {
    console.error("❌ Erreur lors des tests:", error);
  } finally {
    // Nettoyage des données de test
    console.log("\n--- Nettoyage ---");
    try {
      if (lobbyId1) {
        await prisma.lobbyPlayer.deleteMany({
          where: { lobbyId: lobbyId1 },
        });
        await prisma.gameLobby.deleteMany({
          where: { id: lobbyId1 },
        });
      }

      if (lobbyId2) {
        await prisma.lobbyPlayer.deleteMany({
          where: { lobbyId: lobbyId2 },
        });
        await prisma.gameLobby.deleteMany({
          where: { id: lobbyId2 },
        });
      }

      await prisma.user.deleteMany({
        where: {
          id: { in: ["test-cleanup-user1", "test-cleanup-user2"] },
        },
      });

      console.log("✅ Données de test supprimées");
    } catch (error) {
      console.error("❌ Erreur lors du nettoyage:", error);
    }
  }
}

// Exécuter le test
testCleanupSystem()
  .then(() => {
    console.log("\n✅ Test terminé avec succès");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Test échoué:", error);
    process.exit(1);
  });
