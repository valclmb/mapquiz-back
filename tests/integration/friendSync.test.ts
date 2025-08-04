import WebSocket from "ws";
import { testUtils } from "../setup.js";

describe("Friend Synchronization Tests", () => {
  let server: any;
  let wsUserA: WebSocket;
  let wsUserB: WebSocket;
  const baseUrl = "ws://localhost:3000";

  beforeAll(async () => {
    // Démarrer le serveur de test
    const { createServer } = await import("../../src/server.js");
    server = await createServer();
    await server.listen({ port: 3000 });
  });

  afterAll(async () => {
    if (server) {
      await server.close();
    }
  });

  afterEach(() => {
    if (wsUserA) {
      wsUserA.close();
    }
    if (wsUserB) {
      wsUserB.close();
    }
  });

  describe("Friend Request Synchronization", () => {
    it("devrait synchroniser la liste d'amis en temps réel pour les deux utilisateurs (après correction)", async (done) => {
      // Créer deux utilisateurs de test
      const userAId = testUtils.generateId();
      const userBId = testUtils.generateId();

      await testUtils.createTestUser(userAId);
      await testUtils.createTestUser(userBId);

      // Connecter les deux utilisateurs via WebSocket
      wsUserA = new WebSocket(baseUrl);
      wsUserB = new WebSocket(baseUrl);

      let userAConnected = false;
      let userBConnected = false;
      let friendRequestSent = false;
      let friendRequestReceived = false;
      let friendRequestAccepted = false;
      let userAUpdated = false;
      let userBUpdated = false;

      // Attendre que les deux utilisateurs soient connectés
      wsUserA.on("open", () => {
        userAConnected = true;
        if (userAConnected && userBConnected && !friendRequestSent) {
          // Envoyer la demande d'ami
          wsUserA.send(
            JSON.stringify({
              type: "send_friend_request",
              payload: { targetUserId: userBId },
            })
          );
          friendRequestSent = true;
        }
      });

      wsUserB.on("open", () => {
        userBConnected = true;
        if (userAConnected && userBConnected && !friendRequestSent) {
          // Envoyer la demande d'ami
          wsUserA.send(
            JSON.stringify({
              type: "send_friend_request",
              payload: { targetUserId: userBId },
            })
          );
          friendRequestSent = true;
        }
      });

      // Écouter les messages pour User A
      wsUserA.on("message", (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === "friend_request_sent") {
          // User A a envoyé la demande
          expect(message.data.success).toBe(true);
        }

        if (message.type === "friend_request_accepted") {
          // User A devrait recevoir la notification d'acceptation
          expect(message.data.acceptedBy).toBe(userBId);
          userAUpdated = true;

          // Vérifier que les deux utilisateurs ont été mis à jour
          if (userAUpdated && userBUpdated) {
            done();
          }
        }
      });

      // Écouter les messages pour User B
      wsUserB.on("message", (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === "friend_request_received") {
          // User B reçoit la demande
          expect(message.data.fromUserId).toBe(userAId);
          friendRequestReceived = true;

          // Accepter la demande
          if (friendRequestReceived && !friendRequestAccepted) {
            wsUserB.send(
              JSON.stringify({
                type: "accept_friend_request",
                payload: { fromUserId: userAId },
              })
            );
            friendRequestAccepted = true;
          }
        }

        if (message.type === "friend_request_accepted") {
          // User B confirme l'acceptation
          expect(message.data.success).toBe(true);
          userBUpdated = true;

          // Vérifier que les deux utilisateurs ont été mis à jour
          if (userAUpdated && userBUpdated) {
            done();
          }
        }
      });

      // Timeout pour éviter que le test ne bloque
      setTimeout(() => {
        if (!userAUpdated || !userBUpdated) {
          done(new Error("Synchronisation des amis en temps réel échouée"));
        }
      }, 10000);
    });

    it("devrait détecter le problème de synchronisation unidirectionnelle (avant correction)", async (done) => {
      // Ce test simule le bug actuel où User A ne reçoit pas la mise à jour
      const userAId = testUtils.generateId();
      const userBId = testUtils.generateId();

      await testUtils.createTestUser(userAId);
      await testUtils.createTestUser(userBId);

      wsUserA = new WebSocket(baseUrl);
      wsUserB = new WebSocket(baseUrl);

      let userAConnected = false;
      let userBConnected = false;
      let friendRequestSent = false;
      let friendRequestAccepted = false;
      let userAReceivedUpdate = false;

      wsUserA.on("open", () => {
        userAConnected = true;
        if (userAConnected && userBConnected && !friendRequestSent) {
          wsUserA.send(
            JSON.stringify({
              type: "send_friend_request",
              payload: { targetUserId: userBId },
            })
          );
          friendRequestSent = true;
        }
      });

      wsUserB.on("open", () => {
        userBConnected = true;
      });

      // Écouter les messages pour User A
      wsUserA.on("message", (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === "friend_request_accepted") {
          userAReceivedUpdate = true;
        }
      });

      // Écouter les messages pour User B
      wsUserB.on("message", (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === "friend_request_received") {
          // Accepter la demande
          wsUserB.send(
            JSON.stringify({
              type: "accept_friend_request",
              payload: { fromUserId: userAId },
            })
          );
          friendRequestAccepted = true;

          // Attendre un peu puis vérifier si User A a reçu la mise à jour
          setTimeout(() => {
            if (!userAReceivedUpdate) {
              // Ceci simule le bug actuel - User A ne reçoit pas la mise à jour
              done(
                new Error(
                  "BUG DÉTECTÉ: User A n'a pas reçu la mise à jour en temps réel"
                )
              );
            } else {
              done();
            }
          }, 3000);
        }
      });

      // Timeout pour le test
      setTimeout(() => {
        if (!friendRequestAccepted) {
          done(new Error("Test timeout"));
        }
      }, 10000);
    });
  });
});
