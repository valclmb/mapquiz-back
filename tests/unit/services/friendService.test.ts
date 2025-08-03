import { prisma } from "../../../src/lib/database";
import { FriendService } from "../../../src/services/friendService";
import { testUtils } from "../../setup";

describe("FriendService", () => {
  beforeEach(async () => {
    await testUtils.wait(100);
  });

  describe("sendFriendRequest", () => {
    it("devrait envoyer une demande d'ami", async () => {
      // Arrange
      const sender = await testUtils.createTestUser("sender", "Sender User");
      const receiver = await testUtils.createTestUser(
        "receiver",
        "Receiver User"
      );

      // Act
      const result = await FriendService.sendFriendRequest(
        sender.id,
        receiver.tag!
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain("Demande d'ami envoyée");

      // Vérifier en base
      const friendRequest = await prisma.friendRequest.findFirst({
        where: {
          senderId: sender.id,
          receiverId: receiver.id,
        },
      });
      expect(friendRequest).toBeDefined();
      expect(friendRequest?.status).toBe("pending");
    });

    it("devrait échouer si l'utilisateur n'existe pas", async () => {
      // Arrange
      const sender = await testUtils.createTestUser("sender", "Sender User");

      // Act
      const result = await FriendService.sendFriendRequest(
        sender.id,
        "INEXISTANT"
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain("Utilisateur non trouvé");
    });

    it("devrait échouer si on s'ajoute soi-même", async () => {
      // Arrange
      const user = await testUtils.createTestUser("user", "User");

      // Act
      const result = await FriendService.sendFriendRequest(user.id, user.tag!);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain(
        "Vous ne pouvez pas vous ajouter vous-même"
      );
    });

    it("devrait échouer si une demande existe déjà", async () => {
      // Arrange
      const sender = await testUtils.createTestUser("sender", "Sender User");
      const receiver = await testUtils.createTestUser(
        "receiver",
        "Receiver User"
      );

      // Créer une première demande
      await prisma.friendRequest.create({
        data: {
          senderId: sender.id,
          receiverId: receiver.id,
          status: "pending",
        },
      });

      // Act
      const result = await FriendService.sendFriendRequest(
        sender.id,
        receiver.tag!
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain("Demande d'ami déjà envoyée");
    });

    it("devrait échouer si les utilisateurs sont déjà amis", async () => {
      // Arrange
      const user1 = await testUtils.createTestUser("user1", "User 1");
      const user2 = await testUtils.createTestUser("user2", "User 2");

      // Créer une amitié
      await prisma.friendship.create({
        data: {
          userId: user1.id,
          friendId: user2.id,
        },
      });

      // Act
      const result = await FriendService.sendFriendRequest(
        user1.id,
        user2.tag!
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain("Vous êtes déjà amis");
    });
  });

  describe("getFriendsList", () => {
    it("devrait retourner la liste des amis", async () => {
      // Arrange
      const user = await testUtils.createTestUser("user", "User");
      const friend1 = await testUtils.createTestUser("friend1", "Friend 1");
      const friend2 = await testUtils.createTestUser("friend2", "Friend 2");

      // Créer des amitiés
      await prisma.friendship.createMany({
        data: [
          { userId: user.id, friendId: friend1.id },
          { userId: user.id, friendId: friend2.id },
        ],
      });

      // Act
      const result = await FriendService.getFriendsList(user.id);

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result.some((f: any) => f.id === friend1.id)).toBe(true);
      expect(result.some((f: any) => f.id === friend2.id)).toBe(true);
    });

    it("devrait retourner un tableau vide si aucun ami", async () => {
      // Arrange
      const user = await testUtils.createTestUser("user", "User");

      // Act
      const result = await FriendService.getFriendsList(user.id);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("getFriendRequests", () => {
    it("devrait retourner les demandes d'ami reçues", async () => {
      // Arrange
      const receiver = await testUtils.createTestUser("receiver", "Receiver");
      const sender1 = await testUtils.createTestUser("sender1", "Sender 1");
      const sender2 = await testUtils.createTestUser("sender2", "Sender 2");

      // Créer des demandes
      await prisma.friendRequest.createMany({
        data: [
          { senderId: sender1.id, receiverId: receiver.id, status: "pending" },
          { senderId: sender2.id, receiverId: receiver.id, status: "pending" },
        ],
      });

      // Act
      const result = await FriendService.getFriendRequests(receiver.id);

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result.some((r: any) => r.senderId === sender1.id)).toBe(true);
      expect(result.some((r: any) => r.senderId === sender2.id)).toBe(true);
    });

    it("devrait retourner un tableau vide si aucune demande", async () => {
      // Arrange
      const user = await testUtils.createTestUser("user", "User");

      // Act
      const result = await FriendService.getFriendRequests(user.id);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("respondToFriendRequest", () => {
    it("devrait accepter une demande d'ami", async () => {
      // Arrange
      const sender = await testUtils.createTestUser("sender", "Sender");
      const receiver = await testUtils.createTestUser("receiver", "Receiver");

      const request = await prisma.friendRequest.create({
        data: {
          senderId: sender.id,
          receiverId: receiver.id,
          status: "pending",
        },
      });

      // Act
      const result = await FriendService.respondToFriendRequest(
        request.id,
        "accept",
        receiver.id
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain("Demande d'ami acceptée");

      // Vérifier que l'amitié a été créée
      const friendship = await prisma.friendship.findFirst({
        where: {
          userId: sender.id,
          friendId: receiver.id,
        },
      });
      expect(friendship).toBeDefined();

      // Vérifier que la demande a été mise à jour
      const updatedRequest = await prisma.friendRequest.findUnique({
        where: { id: request.id },
      });
      expect(updatedRequest?.status).toBe("accepted");
    });

    it("devrait refuser une demande d'ami", async () => {
      // Arrange
      const sender = await testUtils.createTestUser("sender", "Sender");
      const receiver = await testUtils.createTestUser("receiver", "Receiver");

      const request = await prisma.friendRequest.create({
        data: {
          senderId: sender.id,
          receiverId: receiver.id,
          status: "pending",
        },
      });

      // Act
      const result = await FriendService.respondToFriendRequest(
        request.id,
        "reject",
        receiver.id
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain("Demande d'ami refusée");

      // Vérifier que la demande a été mise à jour
      const updatedRequest = await prisma.friendRequest.findUnique({
        where: { id: request.id },
      });
      expect(updatedRequest?.status).toBe("rejected");
    });

    it("devrait échouer si la demande n'existe pas", async () => {
      // Arrange
      const receiver = await testUtils.createTestUser("receiver", "Receiver");

      // Act
      const result = await FriendService.respondToFriendRequest(
        "inexistant-id",
        "accept",
        receiver.id
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain("Demande d'ami non trouvée");
    });

    it("devrait échouer si l'utilisateur n'est pas le destinataire", async () => {
      // Arrange
      const sender = await testUtils.createTestUser("sender", "Sender");
      const receiver = await testUtils.createTestUser("receiver", "Receiver");
      const otherUser = await testUtils.createTestUser("other", "Other User");

      const request = await prisma.friendRequest.create({
        data: {
          senderId: sender.id,
          receiverId: receiver.id,
          status: "pending",
        },
      });

      // Act
      const result = await FriendService.respondToFriendRequest(
        request.id,
        "accept",
        otherUser.id
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain("Non autorisé");
    });
  });

  describe("removeFriend", () => {
    it("devrait supprimer un ami", async () => {
      // Arrange
      const user = await testUtils.createTestUser("user", "User");
      const friend = await testUtils.createTestUser("friend", "Friend");

      // Créer une amitié
      await prisma.friendship.create({
        data: {
          userId: user.id,
          friendId: friend.id,
        },
      });

      // Act
      const result = await FriendService.removeFriend(user.id, friend.id);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain("Ami supprimé");

      // Vérifier que l'amitié a été supprimée
      const friendship = await prisma.friendship.findFirst({
        where: {
          userId: user.id,
          friendId: friend.id,
        },
      });
      expect(friendship).toBeNull();
    });

    it("devrait échouer si l'amitié n'existe pas", async () => {
      // Arrange
      const user = await testUtils.createTestUser("user", "User");
      const friend = await testUtils.createTestUser("friend", "Friend");

      // Act
      const result = await FriendService.removeFriend(user.id, friend.id);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain("Amitié non trouvée");
    });
  });

  describe("checkFriendshipStatus", () => {
    it("devrait retourner 'friends' si les utilisateurs sont amis", async () => {
      // Arrange
      const user = await testUtils.createTestUser("user", "User");
      const friend = await testUtils.createTestUser("friend", "Friend");

      await prisma.friendship.create({
        data: {
          userId: user.id,
          friendId: friend.id,
        },
      });

      // Act
      const result = await FriendService.checkFriendshipStatus(
        user.id,
        friend.id
      );

      // Assert
      expect(result).toBe("friends");
    });

    it("devrait retourner 'pending_sent' si une demande a été envoyée", async () => {
      // Arrange
      const sender = await testUtils.createTestUser("sender", "Sender");
      const receiver = await testUtils.createTestUser("receiver", "Receiver");

      await prisma.friendRequest.create({
        data: {
          senderId: sender.id,
          receiverId: receiver.id,
          status: "pending",
        },
      });

      // Act
      const result = await FriendService.checkFriendshipStatus(
        sender.id,
        receiver.id
      );

      // Assert
      expect(result).toBe("pending_sent");
    });

    it("devrait retourner 'pending_received' si une demande a été reçue", async () => {
      // Arrange
      const sender = await testUtils.createTestUser("sender", "Sender");
      const receiver = await testUtils.createTestUser("receiver", "Receiver");

      await prisma.friendRequest.create({
        data: {
          senderId: sender.id,
          receiverId: receiver.id,
          status: "pending",
        },
      });

      // Act
      const result = await FriendService.checkFriendshipStatus(
        receiver.id,
        sender.id
      );

      // Assert
      expect(result).toBe("pending_received");
    });

    it("devrait retourner 'none' si aucune relation", async () => {
      // Arrange
      const user1 = await testUtils.createTestUser("user1", "User 1");
      const user2 = await testUtils.createTestUser("user2", "User 2");

      // Act
      const result = await FriendService.checkFriendshipStatus(
        user1.id,
        user2.id
      );

      // Assert
      expect(result).toBe("none");
    });
  });
});
