import { prisma } from "../lib/database.js";
import { LobbyGameService } from "../services/lobby/lobbyGameService.js";

/**
 * Test rapide de persistance du lobby
 */
async function quickTest() {
  console.log("=== TEST RAPIDE DE PERSISTANCE ===");
  
  // Créer un lobby de test
  const testUserId = "test-user-id";
  const testLobbyName = "Test Lobby";
  const testSettings = { selectedRegions: ["Europe"], gameMode: "quiz" };
  
  try {
    // Créer un utilisateur de test
    const testUser = await prisma.user.upsert({
      where: { id: testUserId },
      update: {},
      create: {
        id: testUserId,
        name: "Test User",
        email: "test@example.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    
    console.log("✅ Utilisateur de test créé:", testUser.name);
    
    // Créer un lobby de test
    const testLobby = await prisma.gameLobby.create({
      data: {
        name: testLobbyName,
        hostId: testUserId,
        gameSettings: testSettings,
        players: {
          create: {
            userId: testUserId,
            status: "joined",
          },
        },
      },
      include: {
        host: true,
        players: {
          include: {
            user: true,
          },
        },
      },
    });
    
    console.log("✅ Lobby de test créé:", testLobby.id);
    
    // Test 1: Accès au lobby
    console.log("\n--- Test 1: Accès au lobby ---");
    try {
      const lobbyState = await LobbyGameService.getLobbyState(testLobby.id, testUserId);
      console.log("✅ Accès réussi, statut:", lobbyState.status);
    } catch (error) {
      console.log("❌ Accès échoué:", error instanceof Error ? error.message : "Erreur inconnue");
    }
    
    // Test 2: Vérifier que le lobby existe toujours
    console.log("\n--- Test 2: Vérification de persistance ---");
    const lobbyStillExists = await prisma.gameLobby.findUnique({
      where: { id: testLobby.id },
    });
    
    if (lobbyStillExists) {
      console.log("✅ Lobby toujours présent en base de données");
    } else {
      console.log("❌ Lobby supprimé de la base de données");
    }
    
    // Test 3: Accès multiple
    console.log("\n--- Test 3: Accès multiple ---");
    for (let i = 1; i <= 3; i++) {
      try {
        const lobbyState = await LobbyGameService.getLobbyState(testLobby.id, testUserId);
        console.log(`✅ Accès ${i} réussi`);
      } catch (error) {
        console.log(`❌ Accès ${i} échoué: ${error instanceof Error ? error.message : "Erreur inconnue"}`);
      }
    }
    
    // Nettoyer
    console.log("\n--- Nettoyage ---");
    await prisma.gameLobby.delete({ where: { id: testLobby.id } });
    await prisma.user.delete({ where: { id: testUserId } });
    console.log("✅ Données de test supprimées");
    
  } catch (error) {
    console.error("❌ Erreur lors du test:", error);
  }
}

// Exécuter le test
quickTest().finally(() => {
  prisma.$disconnect();
}); 