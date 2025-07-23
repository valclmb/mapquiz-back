import { prisma } from "../lib/database.js";

async function diagnoseLobbyDeletion() {
  console.log("=== DIAGNOSTIC DE SUPPRESSION DE LOBBY ===\n");

  const lobbyId = "a4a24c2d-fc84-41a7-97e1-28060d576aee";

  try {
    // 1. Vérifier si le lobby existe encore
    console.log("--- Vérification existence du lobby ---");
    const lobby = await prisma.gameLobby.findUnique({
      where: { id: lobbyId },
      include: {
        host: true,
        players: {
          include: { user: true },
        },
      },
    });

    if (lobby) {
      console.log("✅ Le lobby existe encore en base de données");
      console.log("Informations du lobby:");
      console.log(`  - ID: ${lobby.id}`);
      console.log(`  - Nom: ${lobby.name}`);
      console.log(`  - Statut: ${lobby.status}`);
      console.log(`  - Hôte: ${lobby.host.name} (${lobby.hostId})`);
      console.log(`  - Créé le: ${lobby.createdAt}`);
      console.log(`  - Modifié le: ${lobby.updatedAt}`);
      console.log(`  - Nombre de joueurs: ${lobby.players.length}`);

      console.log("\nJoueurs dans le lobby:");
      lobby.players.forEach((player) => {
        console.log(
          `  - ${player.user.name} (${player.userId}): ${player.status}`
        );
      });
    } else {
      console.log("❌ Le lobby n'existe plus en base de données");

      // 2. Vérifier s'il y a des traces dans les logs ou autres tables
      console.log("\n--- Recherche de traces ---");

      // Vérifier s'il y a des résultats de jeu pour ce lobby
      const gameResults = await prisma.multiplayerGameResult.findMany({
        where: { lobbyId: lobbyId },
      });

      if (gameResults.length > 0) {
        console.log(
          `✅ ${gameResults.length} résultat(s) de jeu trouvé(s) pour ce lobby`
        );
        gameResults.forEach((result) => {
          console.log(
            `  - Joueur: ${result.userId}, Score: ${result.score}, Position: ${result.position}`
          );
        });
      } else {
        console.log("❌ Aucun résultat de jeu trouvé pour ce lobby");
      }

      // 3. Vérifier les lobbies récents pour comprendre le pattern
      console.log("\n--- Analyse des lobbies récents ---");
      const recentLobbies = await prisma.gameLobby.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Dernières 24h
          },
        },
        include: {
          host: true,
          players: {
            include: { user: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      console.log(
        `📊 ${recentLobbies.length} lobby(s) créé(s) dans les dernières 24h:`
      );
      recentLobbies.forEach((lobby) => {
        const playerCount = lobby.players.length;
        const isActive =
          lobby.status === "waiting" || lobby.status === "playing";
        const statusIcon = isActive ? "🟢" : "🔴";
        console.log(
          `  ${statusIcon} ${lobby.id.substring(0, 8)}... - ${lobby.host.name} - ${playerCount} joueur(s) - ${lobby.status}`
        );
      });

      // 4. Vérifier les utilisateurs récents
      console.log("\n--- Analyse des utilisateurs récents ---");
      const recentUsers = await prisma.user.findMany({
        where: {
          updatedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Dernières 24h
          },
        },
        include: {
          hostedLobbies: {
            include: {
              players: {
                include: { user: true },
              },
            },
          },
          lobbyPlayers: {
            include: {
              lobby: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
      });

      console.log(
        `👥 ${recentUsers.length} utilisateur(s) actif(s) dans les dernières 24h:`
      );
      recentUsers.forEach((user) => {
        const hostedCount = user.hostedLobbies.length;
        const joinedCount = user.lobbyPlayers.length;
        console.log(
          `  - ${user.name} (${user.id}): ${hostedCount} lobby(s) hébergé(s), ${joinedCount} lobby(s) rejoint(s)`
        );
      });
    }
  } catch (error) {
    console.error("❌ Erreur lors du diagnostic:", error);
  } finally {
    await prisma.$disconnect();
  }
}

diagnoseLobbyDeletion();
