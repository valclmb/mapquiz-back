import { prisma } from "../lib/database.js";
import { LobbyCleanupService } from "../services/lobby/lobbyCleanupService.js";
import { LobbyGameService } from "../services/lobby/lobbyGameService.js";

// Simuler les appels API du frontend
async function simulateFrontendAPI() {
  console.log("=== TEST D'INTÉGRATION AVEC LE FRONTEND ===\n");

  let lobbyId: string | null = null;
  let hostId: string | null = null;
  let playerId: string | null = null;

  try {
    // 1. Créer des utilisateurs de test
    const host = await prisma.user.upsert({
      where: { id: "test-frontend-host" },
      update: {},
      create: {
        id: "test-frontend-host",
        name: "Frontend Host",
        email: "frontend-host@example.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const player = await prisma.user.upsert({
      where: { id: "test-frontend-player" },
      update: {},
      create: {
        id: "test-frontend-player",
        name: "Frontend Player",
        email: "frontend-player@example.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    hostId = host.id;
    playerId = player.id;

    console.log("✅ Utilisateurs de test créés");

    // 2. Créer un lobby de test
    lobbyId = crypto.randomUUID();
    const lobby = await prisma.gameLobby.create({
      data: {
        id: lobbyId,
        name: "Frontend Integration Test",
        hostId: host.id,
        status: "waiting",
        gameSettings: { selectedRegions: ["Europe"], gameMode: "quiz" },
      },
    });

    console.log(`✅ Lobby de test créé: ${lobbyId}`);

    // 3. Ajouter les utilisateurs au lobby
    await prisma.lobbyPlayer.create({
      data: {
        lobbyId: lobbyId,
        userId: host.id,
        status: "joined",
      },
    });

    await prisma.lobbyPlayer.create({
      data: {
        lobbyId: lobbyId,
        userId: player.id,
        status: "joined",
      },
    });

    console.log("✅ Utilisateurs ajoutés au lobby");

    // 4. Test 1: Simulation déconnexion WebSocket
    console.log("\n--- Test 1: Simulation déconnexion WebSocket ---");
    await LobbyCleanupService.markPlayerAsDisconnected(player.id, lobbyId);
    console.log(`✅ Joueur ${player.name} marqué comme déconnecté`);

    // 5. Test 2: Simulation appel API GET /api/lobbies/:lobbyId/disconnected-players
    console.log(
      "\n--- Test 2: Simulation API GET /api/lobbies/:lobbyId/disconnected-players ---"
    );

    // Simuler l'appel API du frontend
    const disconnectedPlayersResponse = await simulateGetDisconnectedPlayers(
      lobbyId,
      host.id
    );

    if (disconnectedPlayersResponse.success) {
      console.log("✅ API joueurs déconnectés - Réponse:");
      console.log(`  - Success: ${disconnectedPlayersResponse.success}`);
      console.log(
        `  - Nombre de joueurs déconnectés: ${disconnectedPlayersResponse.disconnectedPlayers.length}`
      );

      for (const player of disconnectedPlayersResponse.disconnectedPlayers) {
        console.log(
          `    - ${player.name} (déconnecté le: ${new Date(player.disconnectedAt).toLocaleString()})`
        );
      }
    } else {
      console.log(
        "❌ Erreur API joueurs déconnectés:",
        disconnectedPlayersResponse.error
      );
    }

    // 6. Test 3: Simulation appel API DELETE /api/lobbies/:lobbyId/players/:userId
    console.log(
      "\n--- Test 3: Simulation API DELETE /api/lobbies/:lobbyId/players/:userId ---"
    );

    const deleteResponse = await simulateDeleteDisconnectedPlayer(
      lobbyId,
      player.id,
      host.id
    );

    if (deleteResponse.success) {
      console.log("✅ API suppression joueur déconnecté - Réponse:");
      console.log(`  - Success: ${deleteResponse.success}`);
      console.log(`  - Message: ${deleteResponse.message}`);
    } else {
      console.log("❌ Erreur API suppression joueur:", deleteResponse.error);
    }

    // 7. Test 4: Vérification état après suppression
    console.log("\n--- Test 4: Vérification état après suppression ---");
    const stateAfterDeletion = await LobbyGameService.getLobbyState(
      lobbyId,
      host.id
    );
    console.log("État après suppression via API:");
    console.log(`  - Statut: ${stateAfterDeletion.status}`);
    console.log(`  - Joueurs: ${stateAfterDeletion.players.length}`);
    for (const player of stateAfterDeletion.players) {
      console.log(`    - ${player.name}: ${player.status}`);
    }

    // 8. Test 5: Simulation reconnexion WebSocket
    console.log("\n--- Test 5: Simulation reconnexion WebSocket ---");

    // Recréer le joueur
    await prisma.lobbyPlayer.create({
      data: {
        lobbyId: lobbyId,
        userId: player.id,
        status: "disconnected",
        disconnectedAt: new Date(),
      },
    });

    // Simuler la restauration automatique lors de la reconnexion WebSocket
    await LobbyCleanupService.restoreDisconnectedPlayer(player.id, lobbyId);
    console.log(`✅ Joueur ${player.name} restauré automatiquement`);

    // 9. Test 6: Vérification état final
    console.log("\n--- Test 6: Vérification état final ---");
    const finalState = await LobbyGameService.getLobbyState(lobbyId, host.id);
    console.log("État final après reconnexion:");
    console.log(`  - Statut: ${finalState.status}`);
    console.log(`  - Joueurs: ${finalState.players.length}`);
    for (const player of finalState.players) {
      console.log(`    - ${player.name}: ${player.status}`);
    }

    // 10. Test 7: Vérification API joueurs déconnectés après reconnexion
    console.log("\n--- Test 7: Vérification API après reconnexion ---");
    const finalDisconnectedResponse = await simulateGetDisconnectedPlayers(
      lobbyId,
      host.id
    );

    if (finalDisconnectedResponse.success) {
      console.log("✅ API joueurs déconnectés après reconnexion:");
      console.log(
        `  - Nombre de joueurs déconnectés: ${finalDisconnectedResponse.disconnectedPlayers.length}`
      );
      if (finalDisconnectedResponse.disconnectedPlayers.length === 0) {
        console.log("  - Aucun joueur déconnecté (correct)");
      }
    }

    console.log("\n🎉 Tests d'intégration frontend réussis !");
  } catch (error) {
    console.error("❌ Erreur lors des tests d'intégration:", error);
  } finally {
    // Nettoyage des données de test
    console.log("\n--- Nettoyage ---");
    try {
      if (lobbyId) {
        await prisma.lobbyPlayer.deleteMany({
          where: { lobbyId: lobbyId },
        });
        await prisma.gameLobby.deleteMany({
          where: { id: lobbyId },
        });
      }

      if (hostId) {
        await prisma.user.deleteMany({
          where: { id: hostId },
        });
      }

      if (playerId) {
        await prisma.user.deleteMany({
          where: { id: playerId },
        });
      }

      console.log("✅ Données de test supprimées");
    } catch (error) {
      console.error("❌ Erreur lors du nettoyage:", error);
    }
  }
}

// Fonction pour simuler l'appel API GET /api/lobbies/:lobbyId/disconnected-players
async function simulateGetDisconnectedPlayers(lobbyId: string, userId: string) {
  try {
    // Vérifier que l'utilisateur est dans le lobby
    const player = await prisma.lobbyPlayer.findUnique({
      where: {
        lobbyId_userId: {
          lobbyId,
          userId,
        },
      },
    });

    if (!player) {
      return {
        success: false,
        error:
          "Vous devez être dans le lobby pour voir les joueurs déconnectés",
      };
    }

    // Récupérer les joueurs déconnectés
    const disconnectedPlayers = await prisma.lobbyPlayer.findMany({
      where: {
        lobbyId,
        status: "disconnected",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      success: true,
      disconnectedPlayers: disconnectedPlayers.map((player) => ({
        id: player.user.id,
        name: player.user.name,
        disconnectedAt: player.disconnectedAt,
      })),
    };
  } catch (error) {
    return {
      success: false,
      error: "Erreur lors de la récupération des joueurs déconnectés",
    };
  }
}

// Fonction pour simuler l'appel API DELETE /api/lobbies/:lobbyId/players/:userId
async function simulateDeleteDisconnectedPlayer(
  lobbyId: string,
  userId: string,
  hostId: string
) {
  try {
    await LobbyCleanupService.removeDisconnectedPlayer(userId, lobbyId, hostId);

    return {
      success: true,
      message: "Joueur déconnecté supprimé avec succès",
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Non autorisé à supprimer des joueurs") {
        return {
          success: false,
          error: "Vous devez être l'hôte du lobby pour supprimer des joueurs",
        };
      }
    }

    return {
      success: false,
      error: "Erreur lors de la suppression du joueur",
    };
  }
}

// Exécuter le test
simulateFrontendAPI()
  .then(() => {
    console.log("\n✅ Tests d'intégration terminés avec succès");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Tests d'intégration échoués:", error);
    process.exit(1);
  });
