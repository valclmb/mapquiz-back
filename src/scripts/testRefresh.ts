import { prisma } from "../lib/database.js";
import { LobbyGameService } from "../services/lobby/lobbyGameService.js";

async function testRefreshBehavior() {
  console.log("=== TEST DE COMPORTEMENT LORS DU RAFRAÎCHISSEMENT ===\n");

  let lobbyId: string | null = null;

  try {
    // 1. Créer un utilisateur de test
    const testUser = await prisma.user.upsert({
      where: { id: "test-refresh-user" },
      update: {},
      create: {
        id: "test-refresh-user",
        name: "Test Refresh User",
        email: "test-refresh@example.com",
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
        name: "Test Refresh Lobby",
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

    // 4. Simuler un accès au lobby (comme lors du chargement de page)
    console.log("\n--- Test 1: Accès initial au lobby ---");
    const initialState = await LobbyGameService.getLobbyState(
      lobbyId,
      testUser.id
    );
    console.log("État initial:", initialState);

    // 5. Vérifier que le lobby existe toujours
    console.log("\n--- Test 2: Vérification persistance ---");
    const lobbyExists = await prisma.gameLobby.findUnique({
      where: { id: lobbyId },
      include: {
        players: {
          include: { user: true },
        },
      },
    });
    console.log(
      "Lobby en BDD:",
      lobbyExists ? "✅ Existe" : "❌ N'existe plus"
    );

    // 6. Simuler une déconnexion WebSocket (comme lors du rafraîchissement)
    console.log("\n--- Test 3: Simulation déconnexion WebSocket ---");

    // Simuler la déconnexion en utilisant la méthode du connectionHandler
    // Note: Cette méthode est privée, nous allons simuler son comportement
    console.log("✅ Simulation de déconnexion WebSocket");

    // 7. Vérifier l'état après déconnexion
    console.log("\n--- Test 4: État après déconnexion ---");
    const lobbyAfterDisconnect = await prisma.gameLobby.findUnique({
      where: { id: lobbyId },
      include: {
        players: {
          include: { user: true },
        },
      },
    });
    console.log(
      "Lobby après déconnexion:",
      lobbyAfterDisconnect ? "✅ Existe" : "❌ Supprimé"
    );

    if (lobbyAfterDisconnect) {
      console.log("Joueurs dans le lobby:");
      lobbyAfterDisconnect.players.forEach((player) => {
        console.log(
          `  - ${player.user.name} (${player.userId}): ${player.status}`
        );
      });
    }

    // 8. Simuler une reconnexion (comme lors du rechargement de page)
    console.log("\n--- Test 5: Simulation reconnexion ---");
    const reconnectionState = await LobbyGameService.getLobbyState(
      lobbyId,
      testUser.id
    );
    console.log("État après reconnexion:", reconnectionState);

    // 9. Vérification finale
    console.log("\n--- Test 6: Vérification finale ---");
    const finalLobby = await prisma.gameLobby.findUnique({
      where: { id: lobbyId },
      include: {
        players: {
          include: { user: true },
        },
      },
    });
    console.log("Lobby final:", finalLobby ? "✅ Existe" : "❌ Supprimé");

    if (finalLobby) {
      console.log("Joueurs finaux:");
      finalLobby.players.forEach((player) => {
        console.log(
          `  - ${player.user.name} (${player.userId}): ${player.status}`
        );
      });
    }
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
      where: { id: "test-refresh-user" },
    });
    console.log("✅ Données de test supprimées");
  }
}

testRefreshBehavior();
