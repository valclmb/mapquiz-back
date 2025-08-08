import {
  PlayerService,
  type PlayerProgress,
} from "../../../src/services/playerService.js";

describe("PlayerService", () => {
  describe("createPlayer", () => {
    it("devrait créer un nouveau joueur avec les données par défaut", () => {
      const player = PlayerService.createPlayer("Test Player");

      expect(player).toEqual({
        status: "joined",
        score: 0,
        progress: 0,
        name: "Test Player",
        validatedCountries: [],
        incorrectCountries: [],
      });
    });
  });

  describe("updatePlayerStatus", () => {
    it("devrait mettre à jour le statut d'un joueur", () => {
      const player: PlayerProgress = {
        status: "joined",
        score: 0,
        progress: 0,
        name: "Test Player",
        validatedCountries: [],
        incorrectCountries: [],
      };

      const updatedPlayer = PlayerService.updatePlayerStatus(player, "ready");

      expect(updatedPlayer.status).toBe("ready");
      expect(updatedPlayer).toEqual({
        ...player,
        status: "ready",
      });
    });
  });

  describe("updatePlayerScore", () => {
    // ✅ TESTS DE LOGIQUE MÉTIER COMPLEXE
    describe("Calculs de bonus combinés", () => {
      it("devrait cumuler correctement tous les bonus (vitesse + consécutif)", () => {
        const player: PlayerProgress = {
          status: "playing",
          score: 0,
          progress: 0,
          name: "Test Player",
          validatedCountries: [],
          incorrectCountries: [],
          consecutiveCorrect: 4, // 4 * 10 = 40 points bonus
        };

        // Score base: 100, vitesse: 1000ms → bonus = (3000-1000)/100 = 20
        // Consécutif: 4 * 10 = 40 → Total: 100 + 20 + 40 = 160
        const updatedPlayer = PlayerService.updatePlayerScore(
          player,
          100,
          50,
          1000, // Réponse rapide
          true // Consécutive correcte
        );

        expect(updatedPlayer.score).toBe(160); // Score + bonus vitesse + bonus consécutif
        expect(updatedPlayer.consecutiveCorrect).toBe(5); // Incrémenté
        expect(updatedPlayer.lastAnswerTime).toBe(1000);
      });

      it("devrait plafonner le bonus consécutif à 50 même avec haute série", () => {
        const player: PlayerProgress = {
          status: "playing",
          score: 0,
          progress: 0,
          name: "Test Player",
          validatedCountries: [],
          incorrectCountries: [],
          consecutiveCorrect: 15, // 15 * 10 = 150, mais plafonné à 50
        };

        const updatedPlayer = PlayerService.updatePlayerScore(
          player,
          100,
          50,
          undefined,
          true
        );

        // ✅ Test de la logique de plafonnement (ligne 60 du service)
        expect(updatedPlayer.score).toBe(150); // 100 + min(150, 50)
        expect(updatedPlayer.consecutiveCorrect).toBe(16);
      });

      it("ne devrait pas appliquer bonus vitesse pour réponses lentes (≥3000ms)", () => {
        const player: PlayerProgress = {
          status: "playing",
          score: 0,
          progress: 0,
          name: "Test Player",
          validatedCountries: [],
          incorrectCountries: [],
        };

        const updatedPlayer = PlayerService.updatePlayerScore(
          player,
          100,
          50,
          3500 // Réponse lente
        );

        // ✅ Test de la condition answerTime < 3000 (ligne 53)
        expect(updatedPlayer.score).toBe(100); // Pas de bonus vitesse
        expect(updatedPlayer.lastAnswerTime).toBe(3500);
        expect(updatedPlayer.consecutiveCorrect).toBe(0);
      });
    });

    describe("Gestion des cas limites", () => {
      it("devrait gérer consecutiveCorrect undefined sans crash", () => {
        const player: PlayerProgress = {
          status: "playing",
          score: 50,
          progress: 25,
          name: "Test Player",
          validatedCountries: [],
          incorrectCountries: [],
          // consecutiveCorrect: undefined (absent)
        };

        const updatedPlayer = PlayerService.updatePlayerScore(
          player,
          100,
          75,
          2000,
          true
        );

        // ✅ Test de || 0 fallback (ligne 70)
        expect(updatedPlayer.score).toBe(110); // 100 + (3000-2000)/100 + 0*10
        expect(updatedPlayer.consecutiveCorrect).toBe(1); // (0 || 0) + 1
      });

      it("devrait préserver les autres propriétés du joueur", () => {
        const player: PlayerProgress = {
          status: "playing",
          score: 25,
          progress: 30,
          name: "Joueur Test",
          validatedCountries: ["France", "Germany"],
          incorrectCountries: ["Spain"],
          consecutiveCorrect: 2,
        };

        const updatedPlayer = PlayerService.updatePlayerScore(
          player,
          80,
          60,
          2500,
          false // Réponse incorrecte
        );

        // ✅ Test de l'immutabilité et préservation des données
        expect(updatedPlayer.name).toBe("Joueur Test");
        expect(updatedPlayer.status).toBe("playing");
        expect(updatedPlayer.validatedCountries).toEqual(["France", "Germany"]);
        expect(updatedPlayer.incorrectCountries).toEqual(["Spain"]);
        expect(updatedPlayer.score).toBe(85); // 80 + (3000-2500)/100
        expect(updatedPlayer.progress).toBe(60);
        expect(updatedPlayer.consecutiveCorrect).toBe(0); // Réinitialisé
      });
    });
  });

  describe("updatePlayerProgress", () => {
    it("devrait mettre à jour la progression d'un joueur", () => {
      const player: PlayerProgress = {
        status: "playing",
        score: 0,
        progress: 0,
        name: "Test Player",
        validatedCountries: [],
        incorrectCountries: [],
      };

      const updatedPlayer = PlayerService.updatePlayerProgress(
        player,
        ["France", "Germany"],
        ["Spain"],
        100,
        10
      );

      expect(updatedPlayer.validatedCountries).toEqual(["France", "Germany"]);
      expect(updatedPlayer.incorrectCountries).toEqual(["Spain"]);
      expect(updatedPlayer.score).toBe(100);
      expect(updatedPlayer.progress).toBe(30); // (2+1)/10 * 100
    });

    it("devrait limiter la progression à 100%", () => {
      const player: PlayerProgress = {
        status: "playing",
        score: 0,
        progress: 0,
        name: "Test Player",
        validatedCountries: [],
        incorrectCountries: [],
      };

      const updatedPlayer = PlayerService.updatePlayerProgress(
        player,
        ["France", "Germany", "Spain", "Italy", "UK"],
        ["Portugal"],
        100,
        5
      );

      expect(updatedPlayer.progress).toBe(100); // Limité à 100%
    });

    it("devrait gérer le cas où totalQuestions est 0", () => {
      const player: PlayerProgress = {
        status: "playing",
        score: 0,
        progress: 0,
        name: "Test Player",
        validatedCountries: [],
        incorrectCountries: [],
      };

      const updatedPlayer = PlayerService.updatePlayerProgress(
        player,
        ["France"],
        ["Spain"],
        100,
        0
      );

      expect(updatedPlayer.progress).toBe(0);
    });
  });

  describe("areAllPlayersReady", () => {
    it("devrait retourner true si tous les joueurs sont prêts", () => {
      const players = new Map<string, PlayerProgress>([
        [
          "player1",
          {
            status: "ready",
            score: 0,
            progress: 0,
            name: "Player 1",
            validatedCountries: [],
            incorrectCountries: [],
          },
        ],
        [
          "player2",
          {
            status: "ready",
            score: 0,
            progress: 0,
            name: "Player 2",
            validatedCountries: [],
            incorrectCountries: [],
          },
        ],
      ]);

      const result = PlayerService.areAllPlayersReady(players, "player1");

      expect(result).toBe(true);
      expect(players.get("player1")?.status).toBe("ready");
      expect(players.get("player2")?.status).toBe("ready");
    });

    it("devrait retourner false si un joueur n'est pas prêt", () => {
      const players = new Map<string, PlayerProgress>([
        [
          "player1",
          {
            status: "ready",
            score: 0,
            progress: 0,
            name: "Player 1",
            validatedCountries: [],
            incorrectCountries: [],
          },
        ],
        [
          "player2",
          {
            status: "joined",
            score: 0,
            progress: 0,
            name: "Player 2",
            validatedCountries: [],
            incorrectCountries: [],
          },
        ],
      ]);

      const result = PlayerService.areAllPlayersReady(players, "player1");

      expect(result).toBe(false);
      expect(players.get("player1")?.status).toBe("ready");
      expect(players.get("player2")?.status).toBe("joined");
    });

    it("devrait vérifier tous les joueurs, y compris l'hôte", () => {
      const players = new Map<string, PlayerProgress>([
        [
          "host",
          {
            status: "joined", // L'hôte n'est pas prêt
            score: 0,
            progress: 0,
            name: "Host",
            validatedCountries: [],
            incorrectCountries: [],
          },
        ],
        [
          "player1",
          {
            status: "ready",
            score: 0,
            progress: 0,
            name: "Player 1",
            validatedCountries: [],
            incorrectCountries: [],
          },
        ],
        [
          "player2",
          {
            status: "ready",
            score: 0,
            progress: 0,
            name: "Player 2",
            validatedCountries: [],
            incorrectCountries: [],
          },
        ],
      ]);

      const result = PlayerService.areAllPlayersReady(players, "host");

      // Le service vérifie tous les joueurs, y compris l'hôte
      expect(result).toBe(false);
      expect(players.get("host")?.status).toBe("joined");
      expect(players.get("player1")?.status).toBe("ready");
      expect(players.get("player2")?.status).toBe("ready");
    });
  });

  describe("resetPlayersForNewGame", () => {
    it("devrait réinitialiser tous les joueurs pour une nouvelle partie", () => {
      const players = new Map<string, PlayerProgress>([
        [
          "player1",
          {
            status: "finished",
            score: 100,
            progress: 100,
            name: "Player 1",
            validatedCountries: ["France", "Germany"],
            incorrectCountries: ["Spain"],
          },
        ],
        [
          "player2",
          {
            status: "finished",
            score: 80,
            progress: 80,
            name: "Player 2",
            validatedCountries: ["France"],
            incorrectCountries: ["Germany", "Spain"],
          },
        ],
      ]);

      const resetPlayers = PlayerService.resetPlayersForNewGame(players);

      expect(resetPlayers.size).toBe(2);

      const player1 = resetPlayers.get("player1");
      expect(player1?.status).toBe("joined");
      expect(player1?.score).toBe(0);
      expect(player1?.progress).toBe(0);
      expect(player1?.validatedCountries).toEqual([]);
      expect(player1?.incorrectCountries).toEqual([]);

      const player2 = resetPlayers.get("player2");
      expect(player2?.status).toBe("joined");
      expect(player2?.score).toBe(0);
      expect(player2?.progress).toBe(0);
      expect(player2?.validatedCountries).toEqual([]);
      expect(player2?.incorrectCountries).toEqual([]);
    });

    it("devrait réinitialiser les propriétés optionnelles (lastAnswerTime, consecutiveCorrect)", () => {
      const players = new Map<string, PlayerProgress>([
        [
          "player1",
          {
            status: "finished",
            score: 250,
            progress: 100,
            name: "Player Expert",
            validatedCountries: ["France", "Germany", "Spain"],
            incorrectCountries: ["Italy"],
            lastAnswerTime: 1500, // Propriété optionnelle présente
            consecutiveCorrect: 8, // Propriété optionnelle présente
          },
        ],
      ]);

      const resetPlayers = PlayerService.resetPlayersForNewGame(players);

      const player1 = resetPlayers.get("player1");

      // ✅ Test de la réinitialisation complète (lignes 136-137)
      expect(player1?.lastAnswerTime).toBeUndefined();
      expect(player1?.consecutiveCorrect).toBe(0);
      expect(player1?.name).toBe("Player Expert"); // Nom préservé
      expect(player1?.status).toBe("joined");
      expect(player1?.score).toBe(0);
      expect(player1?.progress).toBe(0);
    });
  });

  describe("checkGameCompletion", () => {
    it("devrait retourner true quand progress >= totalQuestions", () => {
      const player: PlayerProgress = {
        status: "playing",
        score: 100,
        progress: 100, // ✅ Test selon service réel : progress >= totalQuestions
        name: "Test Player",
        validatedCountries: ["France", "Germany", "Spain"],
        incorrectCountries: ["Italy"],
      };

      // ✅ Logique réelle du service (ligne 151): progress >= totalQuestions
      const result = PlayerService.checkGameCompletion(player, 100);
      expect(result).toBe(true);
    });

    it("devrait retourner false si progress < totalQuestions", () => {
      const player: PlayerProgress = {
        status: "playing",
        score: 50,
        progress: 80, // 80 < 100
        name: "Test Player",
        validatedCountries: ["France"],
        incorrectCountries: ["Spain"],
      };

      const result = PlayerService.checkGameCompletion(player, 100);
      expect(result).toBe(false);
    });

    it("devrait gérer les cas limites de progression exacte", () => {
      const player: PlayerProgress = {
        status: "playing",
        score: 75,
        progress: 50, // Exactement égal à totalQuestions
        name: "Test Player",
        validatedCountries: ["France", "Spain"],
        incorrectCountries: ["Germany"],
      };

      // ✅ Test du cas limite progress === totalQuestions
      const result = PlayerService.checkGameCompletion(player, 50);
      expect(result).toBe(true); // 50 >= 50
    });
  });

  describe("calculateRankings", () => {
    it("devrait calculer les classements des joueurs", () => {
      const players = new Map<string, PlayerProgress>([
        [
          "player1",
          {
            status: "finished",
            score: 100,
            progress: 100,
            name: "Player 1",
            validatedCountries: ["France", "Germany"],
            incorrectCountries: [],
          },
        ],
        [
          "player2",
          {
            status: "finished",
            score: 80,
            progress: 80,
            name: "Player 2",
            validatedCountries: ["France"],
            incorrectCountries: ["Germany"],
          },
        ],
        [
          "player3",
          {
            status: "finished",
            score: 120,
            progress: 100,
            name: "Player 3",
            validatedCountries: ["France", "Germany", "Spain"],
            incorrectCountries: [],
          },
        ],
      ]);

      const rankings = PlayerService.calculateRankings(players);

      expect(rankings).toHaveLength(3);
      expect(rankings[0].id).toBe("player3"); // Score le plus élevé
      expect(rankings[0].score).toBe(120);
      expect(rankings[0].rank).toBe(1);
      expect(rankings[1].id).toBe("player1");
      expect(rankings[1].rank).toBe(2);
      expect(rankings[2].id).toBe("player2");
      expect(rankings[2].rank).toBe(3);
    });

    it("devrait trier par score puis progression en cas d'égalité", () => {
      const players = new Map<string, PlayerProgress>([
        [
          "player1",
          {
            status: "finished",
            score: 100,
            progress: 80, // Score égal mais progress plus faible
            name: "Player 1",
            validatedCountries: ["France", "Germany"],
            incorrectCountries: [],
          },
        ],
        [
          "player2",
          {
            status: "finished",
            score: 100,
            progress: 95, // Score égal mais progress plus élevée → meilleur rang
            name: "Player 2",
            validatedCountries: ["France", "Germany"],
            incorrectCountries: [],
          },
        ],
      ]);

      const rankings = PlayerService.calculateRankings(players);

      // ✅ Test de la logique de tri complexe (lignes 167-172)
      expect(rankings).toHaveLength(2);
      expect(rankings[0].id).toBe("player2"); // Meilleure progression
      expect(rankings[0].rank).toBe(1);
      expect(rankings[0].progress).toBe(95);
      expect(rankings[1].id).toBe("player1"); // Progression plus faible
      expect(rankings[1].rank).toBe(2);
      expect(rankings[1].progress).toBe(80);
    });

    it("devrait ajouter les propriétés manquantes (completionTime)", () => {
      const players = new Map<string, PlayerProgress>([
        [
          "player1",
          {
            status: "finished",
            score: 100,
            progress: 100,
            name: "Player 1",
            validatedCountries: ["France"],
            incorrectCountries: [],
          },
        ],
      ]);

      const rankings = PlayerService.calculateRankings(players);

      // ✅ Test des propriétés ajoutées (ligne 178)
      expect(rankings[0]).toMatchObject({
        id: "player1",
        name: "Player 1",
        score: 100,
        progress: 100,
        status: "finished",
        rank: 1,
        completionTime: null, // Propriété ajoutée par défaut
      });
    });

    it("devrait gérer Map vide sans erreur", () => {
      const players = new Map<string, PlayerProgress>();

      const rankings = PlayerService.calculateRankings(players);

      expect(rankings).toEqual([]);
      expect(rankings).toHaveLength(0);
    });
  });
});
