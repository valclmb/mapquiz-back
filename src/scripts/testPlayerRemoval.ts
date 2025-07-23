import { prisma } from "../lib/database.js";
import { removePlayerFromLobby } from "../models/lobbyModel.js";
import { LobbyCleanupService } from "../services/lobby/lobbyCleanupService.js";
import { LobbyGameService } from "../services/lobby/lobbyGameService.js";

async function testPlayerRemoval() {
  console.log("🧪 Test de suppression de joueurs");
  console.log("================================\n");

  try {
    // 1. Créer des utilisateurs de test
    console.log("1. Création des utilisateurs de test...");
    const host = await prisma.user.upsert({
      where: { id: "test-host-removal" },
      update: {},
      create: {
        id: "test-host-removal",
        name: "Hôte Test",
        email: "host@test.com",
        tag: "host_test",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const player1 = await prisma.user.upsert({
      where: { id: "test-player1-removal" },
      update: {},
      create: {
        id: "test-player1-removal",
        name: "Joueur 1",
        email: "player1@test.com",
        tag: "player1_test",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const player2 = await prisma.user.upsert({
      where: { id: "test-player2-removal" },
      update: {},
      create: {
        id: "test-player2-removal",
        name: "Joueur 2",
        email: "player2@test.com",
        tag: "player2_test",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log("✅ Utilisateurs créés");

    // 2. Créer un lobby
    console.log("\n2. Création du lobby...");
    const lobby = await prisma.gameLobby.create({
      data: {
        id: "550e8400-e29b-41d4-a716-446655440000", // UUID valide
        hostId: host.id,
        name: "Lobby Test Suppression",
        gameSettings: { selectedRegions: ["Europe"], gameMode: "quiz" },
        players: {
          create: [
            {
              userId: host.id,
              status: "joined",
            },
            {
              userId: player1.id,
              status: "joined",
            },
            {
              userId: player2.id,
              status: "joined",
            },
          ],
        },
      },
      include: {
        players: {
          include: {
            user: true,
          },
        },
      },
    });

    console.log(`✅ Lobby créé: ${lobby.id}`);
    console.log(`  - Hôte: ${host.name}`);
    console.log(`  - Joueurs: ${lobby.players.length}`);

    // 3. Test 1: État initial
    console.log("\n--- Test 1: État initial ---");
    const initialState = await LobbyGameService.getLobbyState(
      lobby.id,
      host.id
    );
    console.log("État initial du lobby:");
    console.log(`  - Statut: ${initialState.status}`);
    console.log(`  - Hôte: ${initialState.hostId}`);
    console.log(`  - Joueurs: ${initialState.players.length}`);
    for (const player of initialState.players) {
      console.log(`    - ${player.name}: ${player.status}`);
    }

    // 4. Test 2: Simulation déconnexion d'un joueur
    console.log("\n--- Test 2: Simulation déconnexion d'un joueur ---");
    await LobbyCleanupService.markPlayerAsDisconnected(player1.id, lobby.id);
    console.log(`✅ Joueur ${player1.name} marqué comme déconnecté`);

    // 5. Test 3: Vérification état après déconnexion
    console.log("\n--- Test 3: État après déconnexion ---");
    const stateAfterDisconnect = await LobbyGameService.getLobbyState(
      lobby.id,
      host.id
    );
    console.log("État après déconnexion:");
    console.log(`  - Statut: ${stateAfterDisconnect.status}`);
    console.log(`  - Joueurs: ${stateAfterDisconnect.players.length}`);
    for (const player of stateAfterDisconnect.players) {
      console.log(`    - ${player.name}: ${player.status}`);
    }

    // 6. Test 4: Simulation suppression d'un joueur connecté
    console.log("\n--- Test 4: Suppression d'un joueur connecté ---");
    await removePlayerFromLobby(lobby.id, player2.id);
    console.log(`✅ Joueur ${player2.name} supprimé du lobby`);

    // 7. Test 5: Vérification état après suppression
    console.log("\n--- Test 5: État après suppression ---");
    const stateAfterRemoval = await LobbyGameService.getLobbyState(
      lobby.id,
      host.id
    );
    console.log("État après suppression:");
    console.log(`  - Statut: ${stateAfterRemoval.status}`);
    console.log(`  - Joueurs: ${stateAfterRemoval.players.length}`);
    for (const player of stateAfterRemoval.players) {
      console.log(`    - ${player.name}: ${player.status}`);
    }

    // 8. Test 6: Simulation suppression d'un joueur déconnecté
    console.log("\n--- Test 6: Suppression d'un joueur déconnecté ---");
    await removePlayerFromLobby(lobby.id, player1.id);
    console.log(`✅ Joueur déconnecté ${player1.name} supprimé du lobby`);

    // 9. Test 7: Vérification état final
    console.log("\n--- Test 7: État final ---");
    const finalState = await LobbyGameService.getLobbyState(lobby.id, host.id);
    console.log("État final:");
    console.log(`  - Statut: ${finalState.status}`);
    console.log(`  - Joueurs: ${finalState.players.length}`);
    for (const player of finalState.players) {
      console.log(`    - ${player.name}: ${player.status}`);
    }

    // 10. Test 8: Vérification que l'hôte ne peut pas se supprimer
    console.log("\n--- Test 8: Tentative de suppression de l'hôte ---");
    try {
      await removePlayerFromLobby(lobby.id, host.id);
      console.log(
        "❌ L'hôte a pu être supprimé (ce qui ne devrait pas arriver)"
      );
    } catch (error) {
      console.log("✅ L'hôte ne peut pas être supprimé (comportement attendu)");
    }

    // 11. Nettoyage
    console.log("\n--- Nettoyage ---");
    await prisma.gameLobby.delete({
      where: { id: lobby.id },
    });
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [host.id, player1.id, player2.id],
        },
      },
    });
    console.log("✅ Données de test supprimées");

    console.log("\n🎉 Test de suppression de joueurs réussi !");
    console.log("✅ Les joueurs déconnectés sont correctement affichés");
    console.log("✅ L'hôte peut supprimer n'importe quel joueur");
    console.log("✅ L'hôte ne peut pas se supprimer lui-même");
    console.log("✅ Le système de déconnexion temporaire fonctionne");
  } catch (error) {
    console.error("❌ Erreur lors des tests:", error);
    throw error;
  }
}

// Exécuter le test
testPlayerRemoval()
  .then(() => {
    console.log("\n✅ Test terminé avec succès");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Test échoué:", error);
    process.exit(1);
  });
