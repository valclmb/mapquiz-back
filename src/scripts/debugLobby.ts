import { prisma } from "../lib/database.js";

/**
 * Script de debug pour examiner l'état des lobbies
 */
async function debugLobby(lobbyId: string, userId?: string) {
  console.log(`=== DEBUG LOBBY ${lobbyId} ===`);

  try {
    // Récupérer le lobby
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
      console.log("❌ Lobby non trouvé en base de données");
      return;
    }

    console.log("✅ Lobby trouvé:");
    console.log(`  - ID: ${lobby.id}`);
    console.log(`  - Nom: ${lobby.name}`);
    console.log(`  - Statut: ${lobby.status}`);
    console.log(`  - Hôte: ${lobby.host.name} (${lobby.hostId})`);
    console.log(`  - Créé le: ${lobby.createdAt}`);
    console.log(`  - Modifié le: ${lobby.updatedAt}`);

    console.log("\n👥 Joueurs dans le lobby:");
    if (lobby.players.length === 0) {
      console.log("  ❌ Aucun joueur");
    } else {
      lobby.players.forEach((player, index) => {
        console.log(
          `  ${index + 1}. ${player.user.name} (${player.userId}) - Statut: ${player.status}`
        );
      });
    }

    // Si un userId est fourni, vérifier s'il est dans le lobby
    if (userId) {
      console.log(`\n🔍 Vérification de l'utilisateur ${userId}:`);
      const player = await prisma.lobbyPlayer.findUnique({
        where: {
          lobbyId_userId: {
            lobbyId,
            userId,
          },
        },
        include: {
          user: true,
        },
      });

      if (player) {
        console.log(`  ✅ Utilisateur trouvé dans le lobby`);
        console.log(`     - Nom: ${player.user.name}`);
        console.log(`     - Statut: ${player.status}`);
        console.log(`     - Score: ${player.score}`);
        console.log(`     - Progression: ${player.progress}`);
        console.log(`     - Rejoint le: ${player.joinedAt}`);
      } else {
        console.log(`  ❌ Utilisateur NON trouvé dans le lobby`);

        // Vérifier si l'utilisateur existe
        const user = await prisma.user.findUnique({
          where: { id: userId },
        });

        if (user) {
          console.log(
            `  ✅ Utilisateur existe en base de données: ${user.name}`
          );
        } else {
          console.log(`  ❌ Utilisateur n'existe pas en base de données`);
        }
      }
    }

    // Vérifier les lobbies actifs en mémoire (approximation)
    console.log("\n🧠 Lobbies actifs (approximation):");
    const activeLobbies = await prisma.gameLobby.findMany({
      where: {
        status: {
          in: ["waiting", "playing"],
        },
      },
      select: {
        id: true,
        name: true,
        status: true,
        hostId: true,
        _count: {
          select: {
            players: true,
          },
        },
      },
    });

    if (activeLobbies.length === 0) {
      console.log("  ❌ Aucun lobby actif");
    } else {
      activeLobbies.forEach((lobby) => {
        console.log(
          `  - ${lobby.name} (${lobby.id}) - Statut: ${lobby.status} - ${lobby._count.players} joueurs`
        );
      });
    }
  } catch (error) {
    console.error("❌ Erreur lors du debug:", error);
  }
}

// Fonction pour ajouter un utilisateur à un lobby
async function addUserToLobby(lobbyId: string, userId: string) {
  console.log(`\n=== AJOUT UTILISATEUR ${userId} AU LOBBY ${lobbyId} ===`);

  try {
    // Vérifier si l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      console.log("❌ Utilisateur non trouvé");
      return;
    }

    // Vérifier si le lobby existe
    const lobby = await prisma.gameLobby.findUnique({
      where: { id: lobbyId },
    });

    if (!lobby) {
      console.log("❌ Lobby non trouvé");
      return;
    }

    // Vérifier si l'utilisateur est déjà dans le lobby
    const existingPlayer = await prisma.lobbyPlayer.findUnique({
      where: {
        lobbyId_userId: {
          lobbyId,
          userId,
        },
      },
    });

    if (existingPlayer) {
      console.log("⚠️ Utilisateur déjà dans le lobby");
      return;
    }

    // Ajouter l'utilisateur au lobby
    const newPlayer = await prisma.lobbyPlayer.create({
      data: {
        lobbyId,
        userId,
        status: "joined",
      },
      include: {
        user: true,
      },
    });

    console.log(`✅ Utilisateur ${user.name} ajouté au lobby avec succès`);
    console.log(`   - Statut: ${newPlayer.status}`);
    console.log(`   - Rejoint le: ${newPlayer.joinedAt}`);
  } catch (error) {
    console.error("❌ Erreur lors de l'ajout:", error);
  }
}

// Exécuter le script si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  const lobbyId = process.argv[2];
  const userId = process.argv[3];

  if (!lobbyId) {
    console.log("Usage: node debugLobby.js <lobbyId> [userId]");
    process.exit(1);
  }

  debugLobby(lobbyId, userId)
    .then(() => {
      if (userId) {
        return addUserToLobby(lobbyId, userId);
      }
    })
    .finally(() => {
      prisma.$disconnect();
    });
}

export { addUserToLobby, debugLobby };
