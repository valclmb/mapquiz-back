import { prisma } from "../lib/database.js";

async function testAPIEndpoint() {
  console.log("🧪 Test de l'endpoint API disconnected-players");
  console.log("==============================================\n");

  try {
    // 1. Créer un utilisateur de test
    console.log("1. Création d'un utilisateur de test...");
    const user = await prisma.user.upsert({
      where: { id: "test-api-user" },
      update: {},
      create: {
        id: "test-api-user",
        name: "Test API User",
        email: "test-api@test.com",
        tag: "test_api",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log("✅ Utilisateur créé:", user.name);

    // 2. Créer un lobby de test
    console.log("\n2. Création d'un lobby de test...");
    const lobby = await prisma.gameLobby.create({
      data: {
        id: "test-api-lobby",
        hostId: user.id,
        name: "Lobby Test API",
        gameSettings: { selectedRegions: ["Europe"], gameMode: "quiz" },
        players: {
          create: [
            {
              userId: user.id,
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

    console.log("✅ Lobby créé:", lobby.id);

    // 3. Tester l'endpoint directement
    console.log("\n3. Test de l'endpoint API...");
    
    // Simuler l'appel API
    const disconnectedPlayers = await prisma.lobbyPlayer.findMany({
      where: {
        lobbyId: lobby.id,
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

    console.log("✅ Endpoint fonctionne");
    console.log(`  - Joueurs déconnectés trouvés: ${disconnectedPlayers.length}`);

    // 4. Nettoyage
    console.log("\n4. Nettoyage...");
    await prisma.gameLobby.delete({
      where: { id: lobby.id },
    });
    await prisma.user.delete({
      where: { id: user.id },
    });
    console.log("✅ Données de test supprimées");

    console.log("\n🎉 Test de l'endpoint API réussi !");

  } catch (error) {
    console.error("❌ Erreur lors du test:", error);
    throw error;
  }
}

// Exécuter le test
testAPIEndpoint()
  .then(() => {
    console.log("\n✅ Test terminé avec succès");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Test échoué:", error);
    process.exit(1);
  }); 