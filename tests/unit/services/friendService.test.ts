import * as FriendModel from "../../../src/models/friendModel.js";
import * as UserModel from "../../../src/models/userModel.js";
import { FriendService } from "../../../src/services/friendService.js";
import { sendToUser } from "../../../src/websocket/core/connectionManager.js";

// Mock des modules
jest.mock("../../../src/models/friendModel.js");
jest.mock("../../../src/models/userModel.js");
jest.mock("../../../src/websocket/core/connectionManager.js");

const mockFriendModel = FriendModel as jest.Mocked<typeof FriendModel>;
const mockUserModel = UserModel as jest.Mocked<typeof UserModel>;
const mockSendToUser = sendToUser as jest.MockedFunction<typeof sendToUser>;

describe("FriendService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("sendFriendRequest", () => {
    it("devrait envoyer une demande d'ami avec succès", async () => {
      const mockFriendUser = {
        id: "friend-id",
        name: "Friend User",
        email: "friend@example.com",
        image: null,
        tag: "friend-tag",
        isOnline: true,
        lastSeen: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: false,
      };

      mockUserModel.findUserByTag.mockResolvedValue(mockFriendUser);
      mockFriendModel.findFriendship.mockResolvedValue(null);
      mockFriendModel.findPendingFriendRequest.mockResolvedValue(null);
      mockFriendModel.createFriendRequest.mockResolvedValue({} as any);

      const result = await FriendService.sendFriendRequest(
        "sender-id",
        "friend-tag"
      );

      expect(mockUserModel.findUserByTag).toHaveBeenCalledWith("friend-tag");
      expect(mockFriendModel.findFriendship).toHaveBeenCalledWith(
        "sender-id",
        "friend-id"
      );
      expect(mockFriendModel.findPendingFriendRequest).toHaveBeenCalledWith(
        "sender-id",
        "friend-id"
      );
      expect(mockFriendModel.createFriendRequest).toHaveBeenCalledWith(
        "sender-id",
        "friend-id"
      );
      expect(mockSendToUser).toHaveBeenCalledWith("friend-id", {
        type: "friend_request_received",
      });
      expect(result).toEqual({
        success: true,
        message: "Demande d'ami envoyée",
        receiverId: "friend-id",
      });
    });

    it("devrait échouer si le tag est vide", async () => {
      await expect(
        FriendService.sendFriendRequest("sender-id", "")
      ).rejects.toThrow("Le tag est requis");
    });

    it("devrait échouer si l'utilisateur n'existe pas", async () => {
      mockUserModel.findUserByTag.mockResolvedValue(null);

      await expect(
        FriendService.sendFriendRequest("sender-id", "invalid-tag")
      ).rejects.toThrow("Utilisateur non trouvé");
    });

    it("devrait échouer si l'utilisateur essaie de s'ajouter lui-même", async () => {
      const mockUser = {
        id: "sender-id",
        name: "Sender User",
        email: "sender@example.com",
        image: null,
        tag: "sender-tag",
        isOnline: true,
        lastSeen: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: false,
      };

      mockUserModel.findUserByTag.mockResolvedValue(mockUser);

      await expect(
        FriendService.sendFriendRequest("sender-id", "sender-tag")
      ).rejects.toThrow("Vous ne pouvez pas vous ajouter vous-même");
    });

    it("devrait échouer si les utilisateurs sont déjà amis", async () => {
      const mockFriendUser = {
        id: "friend-id",
        name: "Friend User",
        email: "friend@example.com",
        image: null,
        tag: "friend-tag",
        isOnline: true,
        lastSeen: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: false,
      };

      mockUserModel.findUserByTag.mockResolvedValue(mockFriendUser);
      mockFriendModel.findFriendship.mockResolvedValue({} as any);

      await expect(
        FriendService.sendFriendRequest("sender-id", "friend-tag")
      ).rejects.toThrow("Vous êtes déjà amis avec cet utilisateur");
    });

    it("devrait échouer si une demande est déjà en attente", async () => {
      const mockFriendUser = {
        id: "friend-id",
        name: "Friend User",
        email: "friend@example.com",
        image: null,
        tag: "friend-tag",
        isOnline: true,
        lastSeen: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: false,
      };

      mockUserModel.findUserByTag.mockResolvedValue(mockFriendUser);
      mockFriendModel.findFriendship.mockResolvedValue(null);
      mockFriendModel.findPendingFriendRequest.mockResolvedValue({} as any);

      await expect(
        FriendService.sendFriendRequest("sender-id", "friend-tag")
      ).rejects.toThrow("Une demande est déjà en attente");
    });
  });

  describe("respondToFriendRequest", () => {
    it("devrait accepter une demande d'ami avec succès", async () => {
      const mockRequest = {
        id: "request-id",
        senderId: "sender-id",
        receiverId: "receiver-id",
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
        sender: {
          id: "sender-id",
          name: "Sender User",
          email: "sender@example.com",
          image: null,
          tag: "sender-tag",
          isOnline: true,
          lastSeen: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          emailVerified: false,
        },
      } as any;

      mockFriendModel.findFriendRequestById.mockResolvedValue(mockRequest);
      mockFriendModel.updateFriendRequestStatus.mockResolvedValue({} as any);
      mockFriendModel.createMutualFriendship.mockResolvedValue({} as any);

      const result = await FriendService.respondToFriendRequest(
        "request-id",
        "accept",
        "receiver-id"
      );

      expect(mockFriendModel.findFriendRequestById).toHaveBeenCalledWith(
        "request-id"
      );
      expect(mockFriendModel.updateFriendRequestStatus).toHaveBeenCalledWith(
        "request-id",
        "accepted"
      );
      expect(mockFriendModel.createMutualFriendship).toHaveBeenCalledWith(
        "sender-id",
        "receiver-id"
      );
      expect(mockSendToUser).toHaveBeenCalledWith("sender-id", {
        type: "friend_request_accepted",
        payload: {
          success: true,
          acceptedBy: "receiver-id",
          friendId: "receiver-id",
        },
      });
      expect(result).toEqual({
        success: true,
        message: "Demande acceptée",
      });
    });

    it("devrait rejeter une demande d'ami avec succès", async () => {
      const mockRequest = {
        id: "request-id",
        senderId: "sender-id",
        receiverId: "receiver-id",
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
        sender: {
          id: "sender-id",
          name: "Sender User",
          email: "sender@example.com",
          image: null,
          tag: "sender-tag",
          isOnline: true,
          lastSeen: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          emailVerified: false,
        },
      } as any;

      mockFriendModel.findFriendRequestById.mockResolvedValue(mockRequest);
      mockFriendModel.updateFriendRequestStatus.mockResolvedValue({} as any);

      const result = await FriendService.respondToFriendRequest(
        "request-id",
        "reject",
        "receiver-id"
      );

      expect(mockFriendModel.updateFriendRequestStatus).toHaveBeenCalledWith(
        "request-id",
        "rejected"
      );
      expect(mockFriendModel.createMutualFriendship).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        message: "Demande rejetée",
      });
    });

    it("devrait échouer si l'action est invalide", async () => {
      await expect(
        FriendService.respondToFriendRequest(
          "request-id",
          "invalid" as any,
          "receiver-id"
        )
      ).rejects.toThrow("Action invalide");
    });

    it("devrait échouer si la demande n'existe pas", async () => {
      mockFriendModel.findFriendRequestById.mockResolvedValue(null);

      await expect(
        FriendService.respondToFriendRequest(
          "invalid-request",
          "accept",
          "receiver-id"
        )
      ).rejects.toThrow("Demande d'ami non trouvée");
    });

    it("devrait échouer si l'utilisateur n'est pas autorisé", async () => {
      const mockRequest = {
        id: "request-id",
        senderId: "sender-id",
        receiverId: "receiver-id",
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
        sender: {
          id: "sender-id",
          name: "Sender User",
          email: "sender@example.com",
          image: null,
          tag: "sender-tag",
          isOnline: true,
          lastSeen: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          emailVerified: false,
        },
      } as any;

      mockFriendModel.findFriendRequestById.mockResolvedValue(mockRequest);

      await expect(
        FriendService.respondToFriendRequest(
          "request-id",
          "accept",
          "unauthorized-user"
        )
      ).rejects.toThrow("Non autorisé");
    });

    it("devrait échouer si la demande est déjà traitée", async () => {
      const mockRequest = {
        id: "request-id",
        senderId: "sender-id",
        receiverId: "receiver-id",
        status: "accepted",
        createdAt: new Date(),
        updatedAt: new Date(),
        sender: {
          id: "sender-id",
          name: "Sender User",
          email: "sender@example.com",
          image: null,
          tag: "sender-tag",
          isOnline: true,
          lastSeen: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          emailVerified: false,
        },
      } as any;

      mockFriendModel.findFriendRequestById.mockResolvedValue(mockRequest);

      await expect(
        FriendService.respondToFriendRequest(
          "request-id",
          "accept",
          "receiver-id"
        )
      ).rejects.toThrow("Demande déjà traitée");
    });
  });

  describe("getFriendsList", () => {
    it("devrait récupérer la liste des amis", async () => {
      const mockFriends = [
        {
          id: "friendship1",
          userId: "user-id",
          friendId: "friend1",
          createdAt: new Date(),
          friend: {
            id: "friend1",
            name: "Friend 1",
            email: "friend1@example.com",
            image: null,
            tag: "friend1-tag",
            isOnline: true,
            lastSeen: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            emailVerified: false,
          },
        },
        {
          id: "friendship2",
          userId: "user-id",
          friendId: "friend2",
          createdAt: new Date(),
          friend: {
            id: "friend2",
            name: "Friend 2",
            email: "friend2@example.com",
            image: null,
            tag: "friend2-tag",
            isOnline: false,
            lastSeen: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            emailVerified: false,
          },
        },
      ];

      mockFriendModel.findUserFriends.mockResolvedValue(mockFriends);

      const result = await FriendService.getFriendsList("user-id");

      expect(mockFriendModel.findUserFriends).toHaveBeenCalledWith("user-id");
      expect(result).toEqual({
        friends: mockFriends.map((f) => f.friend),
      });
    });
  });

  describe("removeFriend", () => {
    it("devrait supprimer un ami avec succès", async () => {
      mockFriendModel.removeMutualFriendship.mockResolvedValue({} as any);

      const result = await FriendService.removeFriend("user-id", "friend-id");

      expect(mockFriendModel.removeMutualFriendship).toHaveBeenCalledWith(
        "user-id",
        "friend-id"
      );
      expect(result).toEqual({
        success: true,
        message: "Ami supprimé avec succès",
      });
    });
  });

  describe("getFriendRequests", () => {
    it("devrait récupérer les demandes d'ami", async () => {
      const mockRequests = [
        {
          id: "request1",
          senderId: "sender1",
          receiverId: "receiver-id",
          status: "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
          sender: {
            id: "sender1",
            name: "Sender 1",
            email: "sender1@example.com",
            image: null,
            tag: "sender1-tag",
            isOnline: true,
            lastSeen: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            emailVerified: false,
          },
        },
      ];

      mockFriendModel.findFriendRequests.mockResolvedValue(mockRequests);

      const result = await FriendService.getFriendRequests("receiver-id");

      expect(mockFriendModel.findFriendRequests).toHaveBeenCalledWith(
        "receiver-id"
      );
      expect(result).toEqual(mockRequests);
    });
  });

  describe("notifyFriendsOfStatusChange", () => {
    it("devrait notifier les amis du changement de statut", async () => {
      const mockUser = {
        id: "user-id",
        name: "Test User",
        email: "test@example.com",
        image: null,
        tag: "test-tag",
        isOnline: false, // Différent de true pour déclencher la notification
        lastSeen: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: false,
      };

      const mockFriends = [
        {
          id: "friendship1",
          userId: "user-id",
          friendId: "friend1",
          createdAt: new Date(),
          friend: {
            id: "friend1",
            name: "Friend 1",
            email: "friend1@example.com",
            image: null,
            tag: "friend1-tag",
            isOnline: true,
            lastSeen: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            emailVerified: false,
          },
        },
      ];

      mockUserModel.findUserById.mockResolvedValue(mockUser);
      mockUserModel.updateUserStatus.mockResolvedValue({} as any);
      mockFriendModel.findUserFriends.mockResolvedValue(mockFriends);

      const result = await FriendService.notifyFriendsOfStatusChange(
        "user-id",
        true
      );

      expect(mockUserModel.findUserById).toHaveBeenCalledWith("user-id");
      expect(mockFriendModel.findUserFriends).toHaveBeenCalledWith("user-id");
      expect(mockUserModel.updateUserStatus).toHaveBeenCalledWith(
        "user-id",
        true,
        expect.any(String)
      );
      expect(mockSendToUser).toHaveBeenCalledWith("friend1", {
        type: "friend_status_change",
        payload: {
          friendId: "user-id",
          isOnline: true,
          lastSeen: expect.any(String),
        },
      });
      expect(result).toBe(true);
    });
  });
});
