import { FastifyReply, FastifyRequest } from "fastify";
import * as friendController from "../../../src/controllers/friendController.js";
import { FriendService } from "../../../src/services/friendService.js";

// Mock des services
jest.mock("../../../src/services/friendService.js");
jest.mock("../../../src/lib/errorHandler.js", () => ({
  asyncHandler: (handler: any) => handler,
}));

const mockFriendService = FriendService as jest.Mocked<typeof FriendService>;

describe("FriendController", () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    mockRequest = {
      user: { id: "test-user-id" } as any,
      body: {},
      params: {},
    } as any;
    mockReply = {
      send: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  describe("addFriend", () => {
    it("devrait ajouter un ami avec succès", async () => {
      const mockResult = {
        success: true,
        message: "Demande d'ami envoyée",
        receiverId: "friend-id",
      };
      mockFriendService.sendFriendRequest.mockResolvedValue(mockResult);
      mockRequest.body = { tag: "friend-tag" };

      await friendController.addFriend(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockFriendService.sendFriendRequest).toHaveBeenCalledWith(
        "test-user-id",
        "friend-tag"
      );
      expect(mockReply.send).toHaveBeenCalledWith(mockResult);
    });

    it("devrait gérer les erreurs lors de l'ajout d'ami", async () => {
      const error = new Error("Utilisateur non trouvé");
      mockFriendService.sendFriendRequest.mockRejectedValue(error);
      mockRequest.body = { tag: "invalid-tag" };

      await expect(
        friendController.addFriend(
          mockRequest as FastifyRequest,
          mockReply as FastifyReply
        )
      ).rejects.toThrow("Utilisateur non trouvé");
    });
  });

  describe("listFriends", () => {
    it("devrait récupérer la liste des amis", async () => {
      const mockFriends = {
        friends: [
          { id: "friend1", name: "Friend 1" },
          { id: "friend2", name: "Friend 2" },
        ],
      };
      mockFriendService.getFriendsList.mockResolvedValue(mockFriends);

      await friendController.listFriends(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockFriendService.getFriendsList).toHaveBeenCalledWith(
        "test-user-id"
      );
      expect(mockReply.send).toHaveBeenCalledWith(mockFriends);
    });
  });

  describe("getFriendRequests", () => {
    it("devrait récupérer les demandes d'ami", async () => {
      const mockRequests = [
        {
          id: "req1",
          senderId: "user1",
          receiverId: "test-user-id",
          status: "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
          sender: {
            id: "user1",
            name: "User 1",
            tag: "user1",
            image: null,
          },
        },
        {
          id: "req2",
          senderId: "user2",
          receiverId: "test-user-id",
          status: "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
          sender: {
            id: "user2",
            name: "User 2",
            tag: "user2",
            image: null,
          },
        },
      ];
      mockFriendService.getFriendRequests.mockResolvedValue(mockRequests);

      await friendController.getFriendRequests(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockFriendService.getFriendRequests).toHaveBeenCalledWith(
        "test-user-id"
      );
      expect(mockReply.send).toHaveBeenCalledWith({
        friendRequests: mockRequests,
      });
    });
  });

  describe("respondToFriendRequest", () => {
    it("devrait accepter une demande d'ami", async () => {
      const mockResult = { success: true, message: "Demande acceptée" };
      mockFriendService.respondToFriendRequest.mockResolvedValue(mockResult);
      mockRequest.params = { id: "request-id" };
      mockRequest.body = { action: "accept" };

      await friendController.respondToFriendRequest(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockFriendService.respondToFriendRequest).toHaveBeenCalledWith(
        "request-id",
        "accept",
        "test-user-id"
      );
      expect(mockReply.send).toHaveBeenCalledWith(mockResult);
    });

    it("devrait rejeter une demande d'ami", async () => {
      const mockResult = { success: true, message: "Demande rejetée" };
      mockFriendService.respondToFriendRequest.mockResolvedValue(mockResult);
      mockRequest.params = { id: "request-id" };
      mockRequest.body = { action: "reject" };

      await friendController.respondToFriendRequest(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockFriendService.respondToFriendRequest).toHaveBeenCalledWith(
        "request-id",
        "reject",
        "test-user-id"
      );
      expect(mockReply.send).toHaveBeenCalledWith(mockResult);
    });
  });

  describe("removeFriend", () => {
    it("devrait supprimer un ami", async () => {
      const mockResult = { success: true, message: "Ami supprimé" };
      mockFriendService.removeFriend.mockResolvedValue(mockResult);
      mockRequest.body = { friendId: "friend-id" };

      await friendController.removeFriend(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockFriendService.removeFriend).toHaveBeenCalledWith(
        "test-user-id",
        "friend-id"
      );
      expect(mockReply.send).toHaveBeenCalledWith(mockResult);
    });
  });
});
