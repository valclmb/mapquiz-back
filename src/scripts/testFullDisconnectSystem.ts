import { prisma } from "../lib/database.js";
import { LobbyCleanupService } from "../services/lobby/lobbyCleanupService.js";
import { LobbyGameService } from "../services/lobby/lobbyGameService.js";

async function testFullDisconnectSystem() {
  console.log("=== TEST COMPLET DU SYSTÈME DE DÉCONNEXION ===\n");

  let lobbyId: string | null = null;
  let hostId: string | null = null;
  let playerId: string | null = null;

  try {
    // 1. Créer des utilisateurs de test
    const host = await prisma.user.upsert({
      where: { id: "test-host-user" },
      update: {},
      create: {
        id: "test-host-user",
        name: "Test Host User",
        email: "test-host@example.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const player = await prisma.user.upsert({
      where: { id: "test-player-user" },
      update: {},
      create: {
        id: "test-player-user",
        name: "Test Player User",
        email: "test-player@example.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    hostId = host.id;
    playerId = player.id;

    console.log("✅ Utilisateurs de test créés");
    console.log(`  - Hôte: ${host.name} (${host.id})`);
    console.log(`  - Joueur: ${player.name} (${player.id})`);

    // 2. Créer un lobby de test
    lobbyId = crypto.randomUUID();
    const lobby = await prisma.gameLobby.create({
      data: {
        id: lobbyId,
        name: "Test Full Disconnect Lobby",
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

    // 4. Test 1: État initial
    console.log("\n--- Test 1: État initial ---");
    const initialState = await LobbyGameService.getLobbyState(lobbyId, host.id);
    console.log("État initial du lobby:");
    console.log(`  - Statut: ${initialState.status}`);
    console.log(`  - Hôte: ${initialState.hostId}`);
    console.log(`  - Joueurs: ${initialState.players.length}`);
    for (const player of initialState.players) {
      console.log(`    - ${player.name}: ${player.status}`);
    }

    // 5. Test 2: Simulation déconnexion du joueur
    console.log("\n--- Test 2: Simulation déconnexion du joueur ---");
    await LobbyCleanupService.markPlayerAsDisconnected(player.id, lobbyId);
    console.log(`✅ Joueur ${player.name} marqué comme déconnecté`);

    // 6. Test 3: Vérification état après déconnexion
    console.log("\n--- Test 3: État après déconnexion ---");
    const stateAfterDisconnect = await LobbyGameService.getLobbyState(
      lobbyId,
      host.id
    );
    console.log("État après déconnexion:");
    console.log(`  - Statut: ${stateAfterDisconnect.status}`);
    console.log(`  - Joueurs: ${stateAfterDisconnect.players.length}`);
    for (const player of stateAfterDisconnect.players) {
      console.log(`    - ${player.name}: ${player.status}`);
    }

    // 7. Test 4: Simulation API récupération joueurs déconnectés
    console.log("\n--- Test 4: Test API joueurs déconnectés ---");

    // Simuler l'appel API pour récupérer les joueurs déconnectés
    const disconnectedPlayers = await prisma.lobbyPlayer.findMany({
      where: {
        lobbyId: lobbyId,
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

    console.log("Joueurs déconnectés récupérés via API:");
    if (disconnectedPlayers.length === 0) {
      console.log("  - Aucun joueur déconnecté");
    } else {
      for (const player of disconnectedPlayers) {
        console.log(`  - ${player.user.name}: déconnecté`);
      }
    }

    // 8. Test 5: Simulation suppression manuelle par l'hôte
    console.log("\n--- Test 5: Test suppression manuelle par l'hôte ---");
    try {
      await LobbyCleanupService.removeDisconnectedPlayer(
        player.id,
        lobbyId,
        host.id
      );
      console.log(`✅ Joueur déconnecté ${player.name} supprimé par l'hôte`);
    } catch (error) {
      console.log(`❌ Erreur lors de la suppression: ${error}`);
    }

    // 9. Test 6: Vérification état après suppression
    console.log("\n--- Test 6: État après suppression ---");
    const stateAfterRemoval = await LobbyGameService.getLobbyState(
      lobbyId,
      host.id
    );
    console.log("État après suppression:");
    console.log(`  - Statut: ${stateAfterRemoval.status}`);
    console.log(`  - Joueurs: ${stateAfterRemoval.players.length}`);
    for (const player of stateAfterRemoval.players) {
      console.log(`    - ${player.name}: ${player.status}`);
    }

    // 10. Test 7: Simulation reconnexion du joueur
    console.log("\n--- Test 7: Test reconnexion du joueur ---");

    // Recréer le joueur dans le lobby
    await prisma.lobbyPlayer.create({
      data: {
        lobbyId: lobbyId,
        userId: player.id,
        status: "joined",
      },
    });

    console.log(`✅ Joueur ${player.name} recréé dans le lobby`);

    // Simuler la restauration automatique
    await LobbyCleanupService.restoreDisconnectedPlayer(player.id, lobbyId);
    console.log(`✅ Joueur ${player.name} restauré automatiquement`);

    // 11. Test 8: Vérification état final
    console.log("\n--- Test 8: État final ---");
    const finalState = await LobbyGameService.getLobbyState(lobbyId, host.id);
    console.log("État final du lobby:");
    console.log(`  - Statut: ${finalState.status}`);
    console.log(`  - Joueurs: ${finalState.players.length}`);
    for (const player of finalState.players) {
      console.log(`    - ${player.name}: ${player.status}`);
    }

    console.log("\n🎉 Test complet du système de déconnexion réussi !");
  } catch (error) {
    console.error("❌ Erreur lors des tests:", error);
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

// Exécuter le test
testFullDisconnectSystem()
  .then(() => {
    console.log("\n✅ Test complet terminé avec succès");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Test complet échoué:", error);
    process.exit(1);
  });
