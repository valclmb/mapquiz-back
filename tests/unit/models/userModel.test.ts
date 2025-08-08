import { prisma } from "../../../src/lib/database.js";
import {
  checkTagExists,
  findAllUsers,
  findUserById,
  findUserByTag,
  searchUsersByTag,
  updateUserStatus,
  updateUserTag,
} from "../../../src/models/userModel.js";

// Mock de Prisma
jest.mock("../../../src/lib/database.js", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe("UserModel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("findUserById", () => {
    it("devrait trouver un utilisateur par ID", async () => {
      const mockUser = {
        id: "user-id",
        name: "Test User",
        image: "https://example.com/avatar.jpg",
        tag: "TAG123",
        isOnline: true,
        lastSeen: new Date(),
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await findUserById("user-id");

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user-id" },
        select: {
          id: true,
          name: true,
          image: true,
          tag: true,
          isOnline: true,
          lastSeen: true,
        },
      });
      expect(result).toEqual(mockUser);
    });

    it("devrait retourner null si l'utilisateur n'existe pas", async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await findUserById("invalid-id");

      expect(result).toBeNull();
    });
  });

  describe("findUserByTag", () => {
    it("devrait trouver un utilisateur par tag", async () => {
      const mockUser = {
        id: "user-id",
        name: "Test User",
        image: "https://example.com/avatar.jpg",
        tag: "TAG123",
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await findUserByTag("TAG123");

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { tag: "TAG123" },
        select: { id: true, name: true, image: true, tag: true },
      });
      expect(result).toEqual(mockUser);
    });

    it("devrait retourner null si le tag n'existe pas", async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await findUserByTag("INVALID");

      expect(result).toBeNull();
    });
  });

  describe("updateUserTag", () => {
    it("devrait mettre à jour le tag d'un utilisateur", async () => {
      const mockUser = {
        id: "user-id",
        name: "Test User",
        tag: "NEWTAG",
      };

      (mockPrisma.user.update as jest.Mock).mockResolvedValue(mockUser);

      const result = await updateUserTag("user-id", "NEWTAG");

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-id" },
        data: { tag: "NEWTAG" },
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe("checkTagExists", () => {
    it("devrait retourner true si le tag existe", async () => {
      const mockUser = { id: "user-id", tag: "EXISTING" };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await checkTagExists("EXISTING");

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { tag: "EXISTING" },
        select: { id: true },
      });
      expect(result).toBe(true);
    });

    it("devrait retourner false si le tag n'existe pas", async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await checkTagExists("NONEXISTENT");

      expect(result).toBe(false);
    });
  });

  describe("searchUsersByTag", () => {
    it("devrait rechercher des utilisateurs par tag", async () => {
      const mockUsers = [
        { id: "user1", name: "User 1", tag: "TAG1" },
        { id: "user2", name: "User 2", tag: "TAG2" },
      ];

      (mockPrisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);

      const result = await searchUsersByTag("TAG", "exclude-id");

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: {
          tag: {
            contains: "TAG",
            mode: "insensitive",
          },
          id: {
            not: "exclude-id",
          },
        },
        select: {
          id: true,
          name: true,
          image: true,
          tag: true,
          isOnline: true,
        },
        take: 10,
      });
      expect(result).toEqual(mockUsers);
    });

    it("devrait retourner un tableau vide si aucun utilisateur trouvé", async () => {
      (mockPrisma.user.findMany as jest.Mock).mockResolvedValue([]);

      const result = await searchUsersByTag("NONEXISTENT", "exclude-id");

      expect(result).toEqual([]);
    });
  });

  describe("updateUserStatus", () => {
    it("devrait mettre à jour le statut d'un utilisateur", async () => {
      const mockUser = {
        id: "user-id",
        name: "Test User",
        isOnline: true,
        lastSeen: "2023-01-01T00:00:00Z",
      };

      (mockPrisma.user.update as jest.Mock).mockResolvedValue(mockUser);

      const result = await updateUserStatus(
        "user-id",
        true,
        "2023-01-01T00:00:00Z"
      );

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-id" },
        data: {
          isOnline: true,
          lastSeen: "2023-01-01T00:00:00Z",
        },
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe("findAllUsers", () => {
    it("devrait récupérer tous les utilisateurs", async () => {
      const mockUsers = [
        { id: "user1", name: "User 1", tag: "TAG1" },
        { id: "user2", name: "User 2", tag: "TAG2" },
      ];

      (mockPrisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);

      const result = await findAllUsers();

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          name: true,
          tag: true,
          isOnline: true,
          lastSeen: true,
        },
      });
      expect(result).toEqual(mockUsers);
    });

    it("devrait retourner un tableau vide si aucun utilisateur", async () => {
      (mockPrisma.user.findMany as jest.Mock).mockResolvedValue([]);

      const result = await findAllUsers();

      expect(result).toEqual([]);
    });
  });
});
