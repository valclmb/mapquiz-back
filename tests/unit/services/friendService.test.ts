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
    it("devrait envoyer une demande d'ami et notifier le destinataire", async () => {
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

      // Validation métier spécifique
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
      expect(result).toMatchObject({
        success: true,
        message: "Demande d'ami envoyée",
        receiverId: "friend-id",
      });
      expect(result.receiverId).toBe("friend-id");
    });

    it("devrait rejeter les tags vides avec message d'erreur approprié", async () => {
      await expect(
        FriendService.sendFriendRequest("sender-id", "")
      ).rejects.toThrow("Le tag est requis");
    });

    it("devrait rejeter les tags avec seulement des espaces", async () => {
      await expect(
        FriendService.sendFriendRequest("sender-id", "   ")
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

    // ✅ TESTS CRITIQUES DE LOGIQUE MÉTIER
    it("devrait prévenir les demandes bidirectionnelles (A→B puis B→A)", async () => {
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
      mockFriendModel.findPendingFriendRequest.mockResolvedValue({
        id: "existing-request",
        senderId: "friend-id", // Demande inverse déjà existante
        receiverId: "sender-id",
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        FriendService.sendFriendRequest("sender-id", "friend-tag")
      ).rejects.toThrow("Une demande est déjà en attente");

      // ✅ Vérification que la logique s'arrête avant création
      expect(mockFriendModel.createFriendRequest).not.toHaveBeenCalled();
      expect(mockSendToUser).not.toHaveBeenCalled();
    });

    it("devrait valider l'ordre des vérifications de sécurité", async () => {
      const spyOrder: string[] = [];

      // Mock qui track l'ordre des appels
      mockUserModel.findUserByTag.mockImplementation(async (tag) => {
        spyOrder.push("findUserByTag");
        return tag === "valid-tag"
          ? {
              id: "friend-id",
              name: "Friend User",
              image: null,
              tag: "valid-tag",
            }
          : null;
      });

      mockFriendModel.findFriendship.mockImplementation(async () => {
        spyOrder.push("findFriendship");
        return null;
      });

      mockFriendModel.findPendingFriendRequest.mockImplementation(async () => {
        spyOrder.push("findPendingRequest");
        return null;
      });

      // ✅ Validation que user inexistant échoue AVANT les autres vérifications
      await expect(
        FriendService.sendFriendRequest("sender-id", "invalid-tag")
      ).rejects.toThrow("Utilisateur non trouvé");

      expect(spyOrder).toEqual(["findUserByTag"]); // Pas d'autres appels
    });

    it("devrait résister aux attaques de concurrence sur les demandes", async () => {
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
      mockFriendModel.createFriendRequest.mockRejectedValue(
        new Error(
          "UNIQUE constraint failed: friend_requests.senderId_receiverId"
        )
      );

      // ✅ Validation que l'erreur de contrainte DB remonte correctement
      await expect(
        FriendService.sendFriendRequest("sender-id", "friend-tag")
      ).rejects.toThrow("UNIQUE constraint failed");
    });
  });

  describe("respondToFriendRequest", () => {
    it("devrait accepter une demande d'ami et créer une amitié mutuelle", async () => {
      const mockRequest = {
        id: "request-id",
        senderId: "sender-id",
        receiverId: "receiver-id",
        status: "pending",
        createdAt: new Date(),
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

      const mockUpdatedRequest = { ...mockRequest, status: "accepted" };
      const mockFriendship = [
        {
          id: "friendship1-id",
          userId: "sender-id",
          friendId: "receiver-id",
          createdAt: new Date(),
        },
        {
          id: "friendship2-id",
          userId: "receiver-id",
          friendId: "sender-id",
          createdAt: new Date(),
        },
      ] as [
        { id: string; userId: string; friendId: string; createdAt: Date },
        { id: string; userId: string; friendId: string; createdAt: Date }
      ];

      mockFriendModel.findFriendRequestById.mockResolvedValue(mockRequest);
      mockFriendModel.updateFriendRequestStatus.mockResolvedValue(
        mockUpdatedRequest
      );
      mockFriendModel.createMutualFriendship.mockResolvedValue(mockFriendship);

      const result = await FriendService.respondToFriendRequest(
        "request-id",
        "accept",
        "receiver-id"
      );

      // Validation métier spécifique et complète
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
      expect(result).toMatchObject({
        success: true,
        message: "Demande acceptée",
      });
      expect(mockSendToUser).toHaveBeenCalledWith("sender-id", {
        type: "friend_request_accepted",
        payload: {
          success: true,
          acceptedBy: "receiver-id",
          friendId: "receiver-id",
        },
      });
    });

    it("devrait rejeter une demande d'ami sans créer d'amitié", async () => {
      const mockRequest = {
        id: "request-id",
        senderId: "sender-id",
        receiverId: "receiver-id",
        status: "pending",
        createdAt: new Date(),
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

      const mockUpdatedRequest = { ...mockRequest, status: "rejected" };

      mockFriendModel.findFriendRequestById.mockResolvedValue(mockRequest);
      mockFriendModel.updateFriendRequestStatus.mockResolvedValue(
        mockUpdatedRequest
      );

      const result = await FriendService.respondToFriendRequest(
        "request-id",
        "reject",
        "receiver-id"
      );

      // Validation métier spécifique
      expect(mockFriendModel.findFriendRequestById).toHaveBeenCalledWith(
        "request-id"
      );
      expect(mockFriendModel.updateFriendRequestStatus).toHaveBeenCalledWith(
        "request-id",
        "rejected"
      );
      expect(mockFriendModel.createMutualFriendship).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        success: true,
        message: "Demande rejetée",
      });
      expect(mockSendToUser).not.toHaveBeenCalled();
    });

    it("devrait échouer si la demande n'existe pas", async () => {
      mockFriendModel.findFriendRequestById.mockResolvedValue(null);

      await expect(
        FriendService.respondToFriendRequest(
          "invalid-request-id",
          "accept",
          "receiver-id"
        )
      ).rejects.toThrow("Demande d'ami non trouvée");

      expect(mockFriendModel.updateFriendRequestStatus).not.toHaveBeenCalled();
      expect(mockFriendModel.createMutualFriendship).not.toHaveBeenCalled();
    });

    it("devrait échouer si l'utilisateur n'est pas le destinataire", async () => {
      const mockRequest = {
        id: "request-id",
        senderId: "sender-id",
        receiverId: "receiver-id",
        status: "pending",
        createdAt: new Date(),
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
          "wrong-user-id"
        )
      ).rejects.toThrow("Non autorisé");

      expect(mockFriendModel.updateFriendRequestStatus).not.toHaveBeenCalled();
      expect(mockFriendModel.createMutualFriendship).not.toHaveBeenCalled();
    });

    it("devrait échouer si la demande a déjà été traitée", async () => {
      const mockRequest = {
        id: "request-id",
        senderId: "sender-id",
        receiverId: "receiver-id",
        status: "accepted", // Déjà acceptée
        createdAt: new Date(),
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

    it("devrait échouer si l'action est invalide", async () => {
      const mockRequest = {
        id: "request-id",
        senderId: "sender-id",
        receiverId: "receiver-id",
        status: "pending",
        createdAt: new Date(),
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
          "invalid" as any,
          "receiver-id"
        )
      ).rejects.toThrow("Action invalide");
    });
  });

  describe("removeFriend", () => {
    it("devrait supprimer un ami directement", async () => {
      // Arrange: Mock de suppression mutuelle
      mockFriendModel.removeMutualFriendship.mockResolvedValue({} as any);

      // Act: Supprimer l'ami selon la logique réelle du service (ligne 127)
      const result = await FriendService.removeFriend("user-id", "friend-id");

      // Assert: Vérifications selon le service réel
      expect(mockFriendModel.removeMutualFriendship).toHaveBeenCalledWith(
        "user-id",
        "friend-id"
      );

      // ✅ Le service réel ne fait PAS de vérification findFriendship ni sendToUser
      expect(mockFriendModel.findFriendship).not.toHaveBeenCalled();
      expect(mockSendToUser).not.toHaveBeenCalled();

      expect(result).toEqual({
        success: true,
        message: "Ami supprimé avec succès",
      });
    });

    it("devrait échouer avec friendId vide ou null", async () => {
      // ✅ Test de validation selon le service réel (ligne 124-126)
      await expect(FriendService.removeFriend("user-id", "")).rejects.toThrow(
        "ID d'ami requis"
      );

      await expect(
        FriendService.removeFriend("user-id", null as any)
      ).rejects.toThrow("ID d'ami requis");

      // Vérification qu'aucune opération DB n'est tentée
      expect(mockFriendModel.findFriendship).not.toHaveBeenCalled();
      expect(mockFriendModel.removeMutualFriendship).not.toHaveBeenCalled();
    });

    it("devrait gérer les erreurs de suppression mutuelle", async () => {
      mockFriendModel.removeMutualFriendship.mockRejectedValue(
        new Error("Contrainte de clé étrangère violée")
      );

      // ✅ Test que l'erreur de DB remonte correctement
      await expect(
        FriendService.removeFriend("user-id", "friend-id")
      ).rejects.toThrow("Contrainte de clé étrangère violée");
    });
  });

  describe("getFriendRequests", () => {
    it("devrait récupérer les demandes d'ami avec les détails des expéditeurs", async () => {
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
      expect(result).toHaveLength(1);
      expect(result[0].sender.name).toBe("Sender 1");
      expect(result[0].status).toBe("pending");
    });

    it("devrait retourner un tableau vide si aucune demande", async () => {
      mockFriendModel.findFriendRequests.mockResolvedValue([]);

      const result = await FriendService.getFriendRequests("receiver-id");

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe("notifyFriendsOfStatusChange", () => {
    it("devrait notifier tous les amis du changement de statut", async () => {
      const mockUser = {
        id: "user-id",
        name: "Test User",
        email: "test@example.com",
        image: null,
        tag: "test-tag",
        isOnline: false,
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

      // Vérifier que tous les amis sont notifiés
      expect(mockSendToUser).toHaveBeenCalledTimes(2);
      expect(mockSendToUser).toHaveBeenCalledWith("friend1", {
        type: "friend_status_change",
        payload: {
          friendId: "user-id",
          isOnline: true,
          lastSeen: expect.any(String),
        },
      });
      expect(mockSendToUser).toHaveBeenCalledWith("friend2", {
        type: "friend_status_change",
        payload: {
          friendId: "user-id",
          isOnline: true,
          lastSeen: expect.any(String),
        },
      });

      expect(result).toBe(true);
    });

    it("devrait gérer le cas où l'utilisateur n'a pas d'amis", async () => {
      const mockUser = {
        id: "user-id",
        name: "Test User",
        email: "test@example.com",
        image: null,
        tag: "test-tag",
        isOnline: false,
        lastSeen: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: false,
      };

      mockUserModel.findUserById.mockResolvedValue(mockUser);
      mockUserModel.updateUserStatus.mockResolvedValue({} as any);
      mockFriendModel.findUserFriends.mockResolvedValue([]);

      const result = await FriendService.notifyFriendsOfStatusChange(
        "user-id",
        true
      );

      expect(mockUserModel.updateUserStatus).toHaveBeenCalledWith(
        "user-id",
        true,
        expect.any(String)
      );
      expect(mockSendToUser).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("devrait échouer si l'utilisateur n'existe pas", async () => {
      mockUserModel.findUserById.mockResolvedValue(null);

      const result = await FriendService.notifyFriendsOfStatusChange(
        "invalid-user-id",
        true
      );

      // ✅ Service retourne false au lieu de throw (ligne 148)
      expect(result).toBe(false);
      expect(mockFriendModel.findUserFriends).not.toHaveBeenCalled();
      expect(mockUserModel.updateUserStatus).not.toHaveBeenCalled();
    });

    it("devrait ignorer si le statut n'a pas changé (optimisation)", async () => {
      const mockUser = {
        id: "user-id",
        name: "Test User",
        email: "test@example.com",
        image: null,
        tag: "test-tag",
        isOnline: true, // ✅ Déjà en ligne
        lastSeen: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: false,
      };

      mockUserModel.findUserById.mockResolvedValue(mockUser);

      // ✅ Test de la logique d'optimisation (ligne 149-152)
      const result = await FriendService.notifyFriendsOfStatusChange(
        "user-id",
        true
      );

      expect(result).toBe(false); // Pas de changement détecté
      expect(mockFriendModel.findUserFriends).not.toHaveBeenCalled();
      expect(mockUserModel.updateUserStatus).not.toHaveBeenCalled();
      expect(mockSendToUser).not.toHaveBeenCalled();
    });

    it("devrait gérer les erreurs de notification avec resilience", async () => {
      const mockUser = {
        id: "user-id",
        name: "Test User",
        email: "test@example.com",
        image: null,
        tag: "test-tag",
        isOnline: false,
        lastSeen: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: false,
      };

      mockUserModel.findUserById.mockResolvedValue(mockUser);
      mockFriendModel.findUserFriends.mockRejectedValue(
        new Error("Database timeout")
      );

      // ✅ Test de la resilience aux erreurs (ligne 175-178)
      const result = await FriendService.notifyFriendsOfStatusChange(
        "user-id",
        true
      );

      expect(result).toBe(false); // Erreur gérée élégamment
      expect(mockUserModel.updateUserStatus).not.toHaveBeenCalled();
    });
  });
});
