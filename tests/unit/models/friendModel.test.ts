import { prisma } from "../../../src/lib/database.js";
import * as friendModel from "../../../src/models/friendModel.js";

// Mock de Prisma
jest.mock("../../../src/lib/database.js", () => ({
  prisma: {
    friend: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    friendRequest: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe("FriendModel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("findFriendship", () => {
    it("devrait trouver une amitié existante", async () => {
      const mockFriendship = {
        id: "friendship-id",
        userId: "user1",
        friendId: "user2",
        createdAt: new Date(),
      };
      (mockPrisma.friend.findUnique as jest.Mock).mockResolvedValue(
        mockFriendship
      );

      const result = await friendModel.findFriendship("user1", "user2");

      expect(mockPrisma.friend.findUnique).toHaveBeenCalledWith({
        where: {
          userId_friendId: { userId: "user1", friendId: "user2" },
        },
      });
      expect(result).toEqual(mockFriendship);
    });

    it("devrait retourner null si l'amitié n'existe pas", async () => {
      (mockPrisma.friend.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await friendModel.findFriendship("user1", "user2");

      expect(result).toBeNull();
    });
  });

  describe("findUserFriends", () => {
    it("devrait récupérer la liste des amis d'un utilisateur", async () => {
      const mockFriends = [
        {
          id: "friendship1",
          userId: "user1",
          friendId: "user2",
          createdAt: new Date(),
          friend: {
            id: "user2",
            name: "Friend 1",
            image: "image1.jpg",
            tag: "friend1",
            isOnline: true,
            lastSeen: new Date(),
          },
        },
      ];
      (mockPrisma.friend.findMany as jest.Mock).mockResolvedValue(mockFriends);

      const result = await friendModel.findUserFriends("user1");

      expect(mockPrisma.friend.findMany).toHaveBeenCalledWith({
        where: { userId: "user1" },
        include: {
          friend: {
            select: {
              id: true,
              name: true,
              image: true,
              tag: true,
              isOnline: true,
              lastSeen: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      expect(result).toEqual(mockFriends);
    });
  });

  describe("findPendingFriendRequest", () => {
    it("devrait trouver une demande d'ami en attente", async () => {
      const mockRequest = {
        id: "request-id",
        senderId: "user1",
        receiverId: "user2",
        status: "pending",
        createdAt: new Date(),
      };
      (mockPrisma.friendRequest.findFirst as jest.Mock).mockResolvedValue(
        mockRequest
      );

      const result = await friendModel.findPendingFriendRequest(
        "user1",
        "user2"
      );

      expect(mockPrisma.friendRequest.findFirst).toHaveBeenCalledWith({
        where: {
          senderId: "user1",
          receiverId: "user2",
          status: "pending",
        },
      });
      expect(result).toEqual(mockRequest);
    });

    it("devrait retourner null si aucune demande en attente", async () => {
      (mockPrisma.friendRequest.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await friendModel.findPendingFriendRequest(
        "user1",
        "user2"
      );

      expect(result).toBeNull();
    });
  });

  describe("createFriendRequest", () => {
    it("devrait créer une nouvelle demande d'ami", async () => {
      const mockRequest = {
        id: "request-id",
        senderId: "user1",
        receiverId: "user2",
        status: "pending",
        createdAt: new Date(),
      };
      (mockPrisma.friendRequest.deleteMany as jest.Mock).mockResolvedValue({
        count: 0,
      });
      (mockPrisma.friendRequest.create as jest.Mock).mockResolvedValue(
        mockRequest
      );

      const result = await friendModel.createFriendRequest("user1", "user2");

      expect(mockPrisma.friendRequest.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { senderId: "user1", receiverId: "user2" },
            { senderId: "user2", receiverId: "user1" },
          ],
        },
      });
      expect(mockPrisma.friendRequest.create).toHaveBeenCalledWith({
        data: { senderId: "user1", receiverId: "user2" },
      });
      expect(result).toEqual(mockRequest);
    });
  });

  describe("findFriendRequests", () => {
    it("devrait récupérer les demandes d'ami reçues", async () => {
      const mockRequests = [
        {
          id: "request1",
          senderId: "user1",
          receiverId: "user2",
          status: "pending",
          createdAt: new Date(),
          sender: {
            id: "user1",
            name: "Sender 1",
            image: "image1.jpg",
            tag: "sender1",
          },
        },
      ];
      (mockPrisma.friendRequest.findMany as jest.Mock).mockResolvedValue(
        mockRequests
      );

      const result = await friendModel.findFriendRequests("user2");

      expect(mockPrisma.friendRequest.findMany).toHaveBeenCalledWith({
        where: {
          receiverId: "user2",
          status: "pending",
        },
        include: {
          sender: {
            select: { id: true, name: true, image: true, tag: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      expect(result).toEqual(mockRequests);
    });
  });

  describe("updateFriendRequestStatus", () => {
    it("devrait mettre à jour le statut d'une demande d'ami", async () => {
      const mockRequest = {
        id: "request-id",
        senderId: "user1",
        receiverId: "user2",
        status: "accepted",
        createdAt: new Date(),
      };
      (mockPrisma.friendRequest.update as jest.Mock).mockResolvedValue(
        mockRequest
      );

      const result = await friendModel.updateFriendRequestStatus(
        "request-id",
        "accepted"
      );

      expect(mockPrisma.friendRequest.update).toHaveBeenCalledWith({
        where: { id: "request-id" },
        data: { status: "accepted" },
      });
      expect(result).toEqual(mockRequest);
    });
  });

  describe("createMutualFriendship", () => {
    it("devrait créer une amitié mutuelle", async () => {
      const mockFriendships = [
        {
          id: "friendship1",
          userId: "user1",
          friendId: "user2",
          createdAt: new Date(),
        },
        {
          id: "friendship2",
          userId: "user2",
          friendId: "user1",
          createdAt: new Date(),
        },
      ];
      (mockPrisma.$transaction as jest.Mock).mockResolvedValue(mockFriendships);

      const result = await friendModel.createMutualFriendship("user1", "user2");

      expect(mockPrisma.$transaction).toHaveBeenCalledWith([
        mockPrisma.friend.create({
          data: { userId: "user1", friendId: "user2" },
        }),
        mockPrisma.friend.create({
          data: { userId: "user2", friendId: "user1" },
        }),
      ]);
      expect(result).toEqual(mockFriendships);
    });
  });

  describe("removeMutualFriendship", () => {
    it("devrait supprimer une amitié mutuelle", async () => {
      const mockResult = [{ count: 1 }, { count: 1 }];
      (mockPrisma.$transaction as jest.Mock).mockResolvedValue(mockResult);

      const result = await friendModel.removeMutualFriendship("user1", "user2");

      expect(mockPrisma.$transaction).toHaveBeenCalledWith([
        mockPrisma.friend.deleteMany({
          where: { userId: "user1", friendId: "user2" },
        }),
        mockPrisma.friend.deleteMany({
          where: { userId: "user2", friendId: "user1" },
        }),
      ]);
      expect(result).toEqual(mockResult);
    });
  });

  describe("findFriendRequestById", () => {
    it("devrait trouver une demande d'ami par ID", async () => {
      const mockRequest = {
        id: "request-id",
        senderId: "user1",
        receiverId: "user2",
        status: "pending",
        createdAt: new Date(),
        sender: {
          id: "user1",
          name: "Sender User",
          email: "sender@example.com",
          emailVerified: false,
          image: null,
          tag: "sender-tag",
          isOnline: true,
          lastSeen: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };
      (mockPrisma.friendRequest.findUnique as jest.Mock).mockResolvedValue(
        mockRequest
      );

      const result = await friendModel.findFriendRequestById("request-id");

      expect(mockPrisma.friendRequest.findUnique).toHaveBeenCalledWith({
        where: { id: "request-id" },
        include: { sender: true },
      });
      expect(result).toEqual(mockRequest);
    });

    it("devrait retourner null si la demande n'existe pas", async () => {
      (mockPrisma.friendRequest.findUnique as jest.Mock).mockResolvedValue(
        null
      );

      const result = await friendModel.findFriendRequestById("invalid-id");

      expect(result).toBeNull();
    });
  });

  describe("findUserFriends", () => {
    it("devrait récupérer la liste des amis formatée", async () => {
      const mockFriends = [
        {
          id: "friendship1",
          userId: "user1",
          friendId: "user2",
          createdAt: new Date(),
          friend: {
            id: "user2",
            name: "Friend 1",
            image: "image1.jpg",
            tag: "friend1",
            isOnline: true,
            lastSeen: new Date(),
          },
        },
      ];
      (mockPrisma.friend.findMany as jest.Mock).mockResolvedValue(mockFriends);

      const result = await friendModel.findUserFriends("user1");

      expect(mockPrisma.friend.findMany).toHaveBeenCalledWith({
        where: { userId: "user1" },
        include: {
          friend: {
            select: {
              id: true,
              name: true,
              image: true,
              tag: true,
              isOnline: true,
              lastSeen: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      expect(result).toEqual(mockFriends);
    });
  });
});
