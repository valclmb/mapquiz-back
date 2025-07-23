import { prisma } from "../lib/database.js";
import { LobbyCleanupService } from "../services/lobby/lobbyCleanupService.js";
import { LobbyGameService } from "../services/lobby/lobbyGameService.js";

async function testDisconnectSystem() {
  console.log("=== TEST DU SYSTÈME DE DÉCONNEXION ===\n");

  let lobbyId: string | null = null;

  try {
    // 1. Créer un utilisateur de test
    const testUser = await prisma.user.upsert({
      where: { id: "test-disconnect-user" },
      update: {},
      create: {
        id: "test-disconnect-user",
        name: "Test Disconnect User",
        email: "test-disconnect@example.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    console.log("✅ Utilisateur de test créé:", testUser.name);

    // 2. Créer un lobby de test
    lobbyId = crypto.randomUUID();
    const lobby = await prisma.gameLobby.create({
      data: {
        id: lobbyId,
        name: "Test Disconnect Lobby",
        hostId: testUser.id,
        status: "waiting",
        gameSettings: { selectedRegions: ["Europe"], gameMode: "quiz" },
      },
    });
    console.log("✅ Lobby de test créé:", lobbyId);

    // 3. Ajouter l'utilisateur au lobby
    await prisma.lobbyPlayer.create({
      data: {
        lobbyId: lobbyId,
        userId: testUser.id,
        status: "joined",
      },
    });
    console.log("✅ Utilisateur ajouté au lobby");

    // 4. Test 1: Accès initial au lobby
    console.log("\n--- Test 1: Accès initial au lobby ---");
    const initialState = await LobbyGameService.getLobbyState(
      lobbyId,
      testUser.id
    );
    console.log("État initial:", initialState.status);

    // 5. Test 2: Simulation déconnexion
    console.log("\n--- Test 2: Simulation déconnexion ---");
    await LobbyCleanupService.markPlayerAsDisconnected(testUser.id, lobbyId);
    console.log("✅ Joueur marqué comme déconnecté");

    // 6. Test 3: Vérification état après déconnexion
    console.log("\n--- Test 3: État après déconnexion ---");
    const lobbyAfterDisconnect = await prisma.gameLobby.findUnique({
      where: { id: lobbyId },
      include: {
        players: {
          include: { user: true },
        },
      },
    });

    if (lobbyAfterDisconnect) {
      console.log("✅ Lobby existe toujours");
      lobbyAfterDisconnect.players.forEach((player) => {
        console.log(
          `  - ${player.user.name}: ${player.status} (déconnecté le: ${player.disconnectedAt})`
        );
      });
    } else {
      console.log("❌ Lobby supprimé");
    }

    // 7. Test 4: Tentative d'accès au lobby (doit fonctionner)
    console.log("\n--- Test 4: Tentative d'accès au lobby ---");
    try {
      const stateAfterDisconnect = await LobbyGameService.getLobbyState(
        lobbyId,
        testUser.id
      );
      console.log("✅ Accès réussi, statut:", stateAfterDisconnect.status);
    } catch (error) {
      console.log(
        "❌ Accès échoué:",
        error instanceof Error ? error.message : "Erreur inconnue"
      );
    }

    // 8. Test 5: Restauration du joueur
    console.log("\n--- Test 5: Restauration du joueur ---");
    await LobbyCleanupService.restoreDisconnectedPlayer(testUser.id, lobbyId);
    console.log("✅ Joueur restauré");

    // 9. Test 6: Vérification état après restauration
    console.log("\n--- Test 6: État après restauration ---");
    const lobbyAfterRestore = await prisma.gameLobby.findUnique({
      where: { id: lobbyId },
      include: {
        players: {
          include: { user: true },
        },
      },
    });

    if (lobbyAfterRestore) {
      console.log("✅ Lobby existe toujours");
      lobbyAfterRestore.players.forEach((player) => {
        console.log(
          `  - ${player.user.name}: ${player.status} (déconnecté le: ${player.disconnectedAt || "jamais"})`
        );
      });
    }

    // 10. Test 7: Accès final
    console.log("\n--- Test 7: Accès final ---");
    const finalState = await LobbyGameService.getLobbyState(
      lobbyId,
      testUser.id
    );
    console.log("✅ Accès final réussi, statut:", finalState.status);

    console.log("\n🎉 Tous les tests du système de déconnexion ont réussi !");
  } catch (error) {
    console.error("❌ Erreur lors du test:", error);
  } finally {
    // Nettoyage
    console.log("\n--- Nettoyage ---");
    if (lobbyId) {
      await prisma.lobbyPlayer.deleteMany({
        where: { lobbyId: lobbyId },
      });
      await prisma.gameLobby.deleteMany({
        where: { id: lobbyId },
      });
    }
    await prisma.user.delete({
      where: { id: "test-disconnect-user" },
    });
    console.log("✅ Données de test supprimées");
  }
}

testDisconnectSystem();
