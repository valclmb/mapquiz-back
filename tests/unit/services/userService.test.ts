import * as UserModel from "../../../src/models/userModel.js";
import { UserService } from "../../../src/services/userService.js";

// Mock des dépendances
jest.mock("../../../src/models/userModel.js");

describe("UserService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getUserById", () => {
    it("devrait trouver un utilisateur par ID", async () => {
      // Arrange
      const userId = "test-user-id";
      const mockUser = {
        id: userId,
        name: "Test User",
        email: "test@example.com",
        tag: "TAG1234",
      };

      (UserModel.findUserById as jest.Mock).mockResolvedValue(mockUser);

      // Act
      const result = await UserService.getUserById(userId);

      // Assert
      expect(result).toEqual(mockUser);
      expect(UserModel.findUserById).toHaveBeenCalledWith(userId);
    });

    it("devrait retourner une erreur si l'utilisateur n'existe pas", async () => {
      // Arrange
      const userId = "non-existent-user";

      (UserModel.findUserById as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(UserService.getUserById(userId)).rejects.toThrow(
        "Utilisateur non trouvé"
      );
    });

    it("devrait gérer les erreurs de base de données", async () => {
      // Arrange
      const userId = "test-user-id";

      (UserModel.findUserById as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      // Act & Assert
      await expect(UserService.getUserById(userId)).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("getUserByTag", () => {
    it("devrait trouver un utilisateur par tag", async () => {
      // Arrange
      const tag = "TAG1234";
      const mockUser = {
        id: "test-user-id",
        name: "Test User",
        email: "test@example.com",
        tag,
      };

      (UserModel.findUserByTag as jest.Mock).mockResolvedValue(mockUser);

      // Act
      const result = await UserService.getUserByTag(tag);

      // Assert
      expect(result).toEqual(mockUser);
      expect(UserModel.findUserByTag).toHaveBeenCalledWith(tag);
    });

    it("devrait retourner une erreur si l'utilisateur n'existe pas", async () => {
      // Arrange
      const tag = "NONEXISTENT";

      (UserModel.findUserByTag as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(UserService.getUserByTag(tag)).rejects.toThrow(
        "Utilisateur non trouvé"
      );
    });
  });

  describe("updateUserStatus", () => {
    it("devrait mettre à jour le statut d'un utilisateur", async () => {
      // Arrange
      const userId = "test-user-id";
      const isOnline = true;

      (UserModel.updateUserStatus as jest.Mock).mockResolvedValue({
        id: userId,
        isOnline,
        lastSeen: new Date().toISOString(),
      });

      // Act
      const result = await UserService.updateUserStatus(userId, isOnline);

      // Assert
      expect(result.success).toBe(true);
      expect(UserModel.updateUserStatus).toHaveBeenCalledWith(
        userId,
        isOnline,
        expect.any(String)
      );
    });

    it("devrait gérer les erreurs lors de la mise à jour", async () => {
      // Arrange
      const userId = "test-user-id";
      const isOnline = true;

      (UserModel.updateUserStatus as jest.Mock).mockRejectedValue(
        new Error("Update failed")
      );

      // Act & Assert
      await expect(
        UserService.updateUserStatus(userId, isOnline)
      ).rejects.toThrow("Update failed");
    });
  });

  describe("getUsersList", () => {
    it("devrait récupérer la liste des utilisateurs", async () => {
      // Arrange
      const mockUsers = [
        {
          id: "user1",
          name: "User 1",
          tag: "TAG1234",
          isOnline: true,
          lastSeen: new Date(),
        },
        {
          id: "user2",
          name: "User 2",
          tag: "TAG5678",
          isOnline: false,
          lastSeen: new Date(),
        },
      ];

      (UserModel.findAllUsers as jest.Mock).mockResolvedValue(mockUsers);

      // Act
      const result = await UserService.getUsersList();

      // Assert
      expect(result.users).toEqual(mockUsers);
      expect(UserModel.findAllUsers).toHaveBeenCalled();
    });

    it("devrait retourner une liste vide si aucun utilisateur", async () => {
      // Arrange
      (UserModel.findAllUsers as jest.Mock).mockResolvedValue([]);

      // Act
      const result = await UserService.getUsersList();

      // Assert
      expect(result.users).toEqual([]);
    });
  });

  describe("getUserOrCreateTag", () => {
    it("devrait retourner le tag existant", async () => {
      // Arrange
      const userId = "test-user-id";
      const mockUser = {
        id: userId,
        name: "Test User",
        tag: "EXISTING123",
      };

      (UserModel.findUserById as jest.Mock).mockResolvedValue(mockUser);

      // Act
      const result = await UserService.getUserOrCreateTag(userId);

      // Assert
      expect(result.tag).toBe("EXISTING123");
      expect(UserModel.findUserById).toHaveBeenCalledWith(userId);
    });

    it("devrait créer un nouveau tag si l'utilisateur n'en a pas", async () => {
      // Arrange
      const userId = "test-user-id";
      const mockUser = {
        id: userId,
        name: "Test User",
        tag: null,
      };

      (UserModel.findUserById as jest.Mock).mockResolvedValue(mockUser);
      (UserModel.checkTagExists as jest.Mock).mockResolvedValue(false);
      (UserModel.updateUserTag as jest.Mock).mockResolvedValue({
        id: userId,
        tag: "NEWTAG123",
      });

      // Act
      const result = await UserService.getUserOrCreateTag(userId);

      // Assert
      expect(result.tag).toBeDefined();
      expect(UserModel.updateUserTag).toHaveBeenCalledWith(
        userId,
        expect.any(String)
      );
    });

    it("devrait gérer les erreurs lors de la création de tag", async () => {
      // Arrange
      const userId = "test-user-id";
      const mockUser = {
        id: userId,
        name: "Test User",
        tag: null,
      };

      (UserModel.findUserById as jest.Mock).mockResolvedValue(mockUser);
      (UserModel.checkTagExists as jest.Mock).mockRejectedValue(
        new Error("Tag creation failed")
      );

      // Act & Assert
      await expect(UserService.getUserOrCreateTag(userId)).rejects.toThrow(
        "Tag creation failed"
      );
    });
  });
});
