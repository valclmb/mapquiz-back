import { prisma } from "../../../src/lib/database";
import { UserService } from "../../../src/services/userService";
import { testUtils } from "../../setup";

// Mock de better-auth
jest.mock("../../../src/lib/auth", () => ({
  auth: {
    api: {
      getSession: jest.fn(),
    },
  },
}));

describe("UserService", () => {
  beforeEach(async () => {
    await testUtils.wait(100);
  });

  describe("getUsersList", () => {
    it("devrait retourner la liste des utilisateurs", async () => {
      // Arrange
      const user1 = await testUtils.createTestUser("user1", "User 1");
      const user2 = await testUtils.createTestUser("user2", "User 2");

      // Act
      const result = await UserService.getUsersList();

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result.some((u: any) => u.id === user1.id)).toBe(true);
      expect(result.some((u: any) => u.id === user2.id)).toBe(true);
    });

    it("devrait retourner un tableau vide si aucun utilisateur", async () => {
      // Act
      const result = await UserService.getUsersList();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("getUserById", () => {
    it("devrait retourner un utilisateur par ID", async () => {
      // Arrange
      const user = await testUtils.createTestUser("test-user", "Test User");

      // Act
      const result = await UserService.getUserById(user.id);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(user.id);
      expect(result.name).toBe(user.name);
    });

    it("devrait retourner null pour un ID inexistant", async () => {
      // Act
      const result = await UserService.getUserById("inexistant-id");

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("getUserByTag", () => {
    it("devrait retourner un utilisateur par tag", async () => {
      // Arrange
      const user = await testUtils.createTestUser("test-user", "Test User");
      const tag = user.tag;

      // Act
      const result = await UserService.getUserByTag(tag!);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(user.id);
      expect(result.tag).toBe(tag);
    });

    it("devrait retourner null pour un tag inexistant", async () => {
      // Act
      const result = await UserService.getUserByTag("INEXISTANT");

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("getUserOrCreateTag", () => {
    it("devrait retourner le tag existant d'un utilisateur", async () => {
      // Arrange
      const user = await testUtils.createTestUser("test-user", "Test User");
      const existingTag = user.tag;

      // Act
      const result = await UserService.getUserOrCreateTag(user.id);

      // Assert
      expect(result).toBeDefined();
      expect(result.tag).toBe(existingTag);
    });

    it("devrait créer un nouveau tag si l'utilisateur n'en a pas", async () => {
      // Arrange
      const user = await prisma.user.create({
        data: {
          id: "user-sans-tag",
          name: "User Sans Tag",
          email: "sans-tag@test.com",
          tag: null,
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Act
      const result = await UserService.getUserOrCreateTag(user.id);

      // Assert
      expect(result).toBeDefined();
      expect(result.tag).toBeDefined();
      expect(result.tag).toMatch(/^TAG\d{4}$/);

      // Vérifier que le tag a été sauvegardé en base
      const updatedUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      expect(updatedUser?.tag).toBe(result.tag);
    });

    it("devrait gérer les conflits de tag et générer un nouveau tag", async () => {
      // Arrange
      const user1 = await testUtils.createTestUser("user1", "User 1");
      const user2 = await testUtils.createTestUser("user2", "User 2");

      // Forcer le même tag pour créer un conflit
      await prisma.user.update({
        where: { id: user2.id },
        data: { tag: user1.tag },
      });

      // Act - essayer de créer un tag pour user2
      const result = await UserService.getUserOrCreateTag(user2.id);

      // Assert
      expect(result).toBeDefined();
      expect(result.tag).toBeDefined();
      expect(result.tag).not.toBe(user1.tag);
      expect(result.tag).toMatch(/^TAG\d{4}$/);
    });
  });

  describe("updateUserProfile", () => {
    it("devrait mettre à jour le profil utilisateur", async () => {
      // Arrange
      const user = await testUtils.createTestUser("test-user", "Test User");
      const updates = {
        name: "Updated Name",
        email: "updated@test.com",
      };

      // Act
      const result = await UserService.updateUserProfile(user.id, updates);

      // Assert
      expect(result).toBeDefined();
      expect(result.name).toBe(updates.name);
      expect(result.email).toBe(updates.email);

      // Vérifier en base
      const updatedUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      expect(updatedUser?.name).toBe(updates.name);
      expect(updatedUser?.email).toBe(updates.email);
    });

    it("devrait retourner null pour un utilisateur inexistant", async () => {
      // Act
      const result = await UserService.updateUserProfile("inexistant-id", {
        name: "Test",
      });

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("deleteUser", () => {
    it("devrait supprimer un utilisateur", async () => {
      // Arrange
      const user = await testUtils.createTestUser(
        "user-to-delete",
        "User To Delete"
      );

      // Act
      const result = await UserService.deleteUser(user.id);

      // Assert
      expect(result).toBe(true);

      // Vérifier que l'utilisateur a été supprimé
      const deletedUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      expect(deletedUser).toBeNull();
    });

    it("devrait retourner false pour un utilisateur inexistant", async () => {
      // Act
      const result = await UserService.deleteUser("inexistant-id");

      // Assert
      expect(result).toBe(false);
    });
  });
});
