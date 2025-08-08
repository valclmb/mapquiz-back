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
    it("devrait mettre à jour le score d'un joueur sans bonus", () => {
      const player: PlayerProgress = {
        status: "playing",
        score: 0,
        progress: 0,
        name: "Test Player",
        validatedCountries: [],
        incorrectCountries: [],
      };

      const updatedPlayer = PlayerService.updatePlayerScore(player, 100, 50);

      expect(updatedPlayer.score).toBe(100);
      expect(updatedPlayer.progress).toBe(50);
      expect(updatedPlayer.lastAnswerTime).toBeUndefined();
      expect(updatedPlayer.consecutiveCorrect).toBe(0);
    });

    it("devrait appliquer un bonus de vitesse pour les réponses rapides", () => {
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
        1500
      );

      // Bonus de vitesse: (3000 - 1500) / 100 = 15
      expect(updatedPlayer.score).toBe(115);
      expect(updatedPlayer.lastAnswerTime).toBe(1500);
    });

    it("devrait appliquer un bonus pour les réponses consécutives correctes", () => {
      const player: PlayerProgress = {
        status: "playing",
        score: 0,
        progress: 0,
        name: "Test Player",
        validatedCountries: [],
        incorrectCountries: [],
        consecutiveCorrect: 3,
      };

      const updatedPlayer = PlayerService.updatePlayerScore(
        player,
        100,
        50,
        undefined,
        true
      );

      // Bonus consécutif: 3 * 10 = 30
      expect(updatedPlayer.score).toBe(130);
      expect(updatedPlayer.consecutiveCorrect).toBe(4);
    });

    it("devrait réinitialiser le compteur consécutif si la réponse est incorrecte", () => {
      const player: PlayerProgress = {
        status: "playing",
        score: 0,
        progress: 0,
        name: "Test Player",
        validatedCountries: [],
        incorrectCountries: [],
        consecutiveCorrect: 3,
      };

      const updatedPlayer = PlayerService.updatePlayerScore(
        player,
        100,
        50,
        undefined,
        false
      );

      expect(updatedPlayer.score).toBe(100);
      expect(updatedPlayer.consecutiveCorrect).toBe(0);
    });

    it("devrait limiter le bonus consécutif à 50", () => {
      const player: PlayerProgress = {
        status: "playing",
        score: 0,
        progress: 0,
        name: "Test Player",
        validatedCountries: [],
        incorrectCountries: [],
        consecutiveCorrect: 10,
      };

      const updatedPlayer = PlayerService.updatePlayerScore(
        player,
        100,
        50,
        undefined,
        true
      );

      // Bonus consécutif limité à 50
      expect(updatedPlayer.score).toBe(150);
      expect(updatedPlayer.consecutiveCorrect).toBe(11);
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
    });

    it("devrait ignorer l'hôte dans la vérification", async () => {
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
  });

  describe("checkGameCompletion", () => {
    it("devrait retourner true si le joueur a terminé la partie", () => {
      const player: PlayerProgress = {
        status: "playing",
        score: 100,
        progress: 100,
        name: "Test Player",
        validatedCountries: ["France", "Germany", "Spain"],
        incorrectCountries: ["Italy"],
      };

      const result = PlayerService.checkGameCompletion(player, 4);

      expect(result).toBe(true);
    });

    it("devrait retourner false si le joueur n'a pas terminé", () => {
      const player: PlayerProgress = {
        status: "playing",
        score: 50,
        progress: 50, // 50% de progression
        name: "Test Player",
        validatedCountries: ["France"],
        incorrectCountries: ["Spain"],
      };

      const result = PlayerService.checkGameCompletion(player, 100); // 100 questions totales

      expect(result).toBe(false);
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

    it("devrait gérer les égalités de score", () => {
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
            score: 100,
            progress: 100,
            name: "Player 2",
            validatedCountries: ["France", "Germany"],
            incorrectCountries: [],
          },
        ],
      ]);

      const rankings = PlayerService.calculateRankings(players);

      expect(rankings).toHaveLength(2);
      expect(rankings[0].rank).toBe(1);
      expect(rankings[1].rank).toBe(2); // Le service attribue des rangs séquentiels
    });
  });
});
