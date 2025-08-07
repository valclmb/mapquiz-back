import {
  addFriendSchema,
  createLobbySchema,
  friendRequestActionSchema,
  joinLobbySchema,
  saveScoreSchema,
  updateUserSchema,
} from "../../../src/lib/validation.js";

describe("Validation Schemas", () => {
  describe("addFriendSchema", () => {
    it("devrait valider un tag valide", () => {
      // Arrange
      const validData = {
        tag: "TAG1234",
      };

      // Act
      const result = addFriendSchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    it("devrait rejeter un tag vide", () => {
      // Arrange
      const invalidData = {
        tag: "",
      };

      // Act
      const result = addFriendSchema.safeParse(invalidData);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Le tag est requis");
      }
    });

    it("devrait rejeter un tag manquant", () => {
      // Arrange
      const invalidData = {};

      // Act
      const result = addFriendSchema.safeParse(invalidData);

      // Assert
      expect(result.success).toBe(false);
    });
  });

  describe("friendRequestActionSchema", () => {
    it("devrait valider une action 'accept'", () => {
      // Arrange
      const validData = {
        action: "accept" as const,
      };

      // Act
      const result = friendRequestActionSchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    it("devrait valider une action 'reject'", () => {
      // Arrange
      const validData = {
        action: "reject" as const,
      };

      // Act
      const result = friendRequestActionSchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    it("devrait rejeter une action invalide", () => {
      // Arrange
      const invalidData = {
        action: "invalid",
      };

      // Act
      const result = friendRequestActionSchema.safeParse(invalidData);

      // Assert
      expect(result.success).toBe(false);
    });
  });

  describe("createLobbySchema", () => {
    it("devrait valider des données de lobby valides", () => {
      // Arrange
      const validData = {
        name: "Test Lobby",
        settings: {
          gameMode: "quiz",
          selectedRegions: ["Europe"],
        },
      };

      // Act
      const result = createLobbySchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    it("devrait valider un lobby sans nom", () => {
      // Arrange
      const validData = {
        settings: {
          gameMode: "quiz",
        },
      };

      // Act
      const result = createLobbySchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    it("devrait rejeter des données sans settings", () => {
      // Arrange
      const invalidData = {
        name: "Test Lobby",
      };

      // Act
      const result = createLobbySchema.safeParse(invalidData);

      // Assert
      expect(result.success).toBe(false);
    });
  });

  describe("joinLobbySchema", () => {
    it("devrait valider un lobbyId valide", () => {
      // Arrange
      const validData = {
        lobbyId: "test-lobby-id",
      };

      // Act
      const result = joinLobbySchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    it("devrait rejeter un lobbyId vide", () => {
      // Arrange
      const invalidData = {
        lobbyId: "",
      };

      // Act
      const result = joinLobbySchema.safeParse(invalidData);

      // Assert
      expect(result.success).toBe(false);
    });

    it("devrait rejeter un lobbyId manquant", () => {
      // Arrange
      const invalidData = {};

      // Act
      const result = joinLobbySchema.safeParse(invalidData);

      // Assert
      expect(result.success).toBe(false);
    });
  });

  describe("saveScoreSchema", () => {
    it("devrait valider des données de score valides", () => {
      // Arrange
      const validData = {
        score: 100,
        totalQuestions: 10,
        selectedRegions: ["Europe", "Asia"],
        gameMode: "quiz" as const,
        duration: 300,
      };

      // Act
      const result = saveScoreSchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    it("devrait valider des données sans duration", () => {
      // Arrange
      const validData = {
        score: 100,
        totalQuestions: 10,
        selectedRegions: ["Europe"],
        gameMode: "training" as const,
      };

      // Act
      const result = saveScoreSchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    it("devrait rejeter un score négatif", () => {
      // Arrange
      const invalidData = {
        score: -10,
        totalQuestions: 10,
        selectedRegions: ["Europe"],
        gameMode: "quiz" as const,
      };

      // Act
      const result = saveScoreSchema.safeParse(invalidData);

      // Assert
      expect(result.success).toBe(false);
    });

    it("devrait rejeter un totalQuestions invalide", () => {
      // Arrange
      const invalidData = {
        score: 100,
        totalQuestions: 0,
        selectedRegions: ["Europe"],
        gameMode: "quiz" as const,
      };

      // Act
      const result = saveScoreSchema.safeParse(invalidData);

      // Assert
      expect(result.success).toBe(false);
    });

    it("devrait rejeter un gameMode invalide", () => {
      // Arrange
      const invalidData = {
        score: 100,
        totalQuestions: 10,
        selectedRegions: ["Europe"],
        gameMode: "invalid",
      };

      // Act
      const result = saveScoreSchema.safeParse(invalidData);

      // Assert
      expect(result.success).toBe(false);
    });
  });

  describe("updateUserSchema", () => {
    it("devrait valider des données de mise à jour valides", () => {
      // Arrange
      const validData = {
        tag: "NEWTAG123",
        isOnline: true,
      };

      // Act
      const result = updateUserSchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    it("devrait valider des données partielles", () => {
      // Arrange
      const validData = {
        tag: "NEWTAG123",
      };

      // Act
      const result = updateUserSchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    it("devrait rejeter un tag vide", () => {
      // Arrange
      const invalidData = {
        tag: "",
      };

      // Act
      const result = updateUserSchema.safeParse(invalidData);

      // Assert
      expect(result.success).toBe(false);
    });

    it("devrait valider un objet vide", () => {
      // Arrange
      const validData = {};

      // Act
      const result = updateUserSchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });
  });
});
