import { FastifyReply, FastifyRequest } from "fastify";
import * as userController from "../../../src/controllers/userController.js";
import { UserService } from "../../../src/services/userService.js";

// Mock des services
jest.mock("../../../src/services/userService.js");
jest.mock("../../../src/lib/errorHandler.js", () => ({
  asyncHandler: (handler: any) => handler,
}));

const mockUserService = UserService as jest.Mocked<typeof UserService>;

describe("UserController", () => {
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

  describe("getUsers", () => {
    it("devrait récupérer la liste des utilisateurs", async () => {
      const mockUsers = {
        users: [
          {
            id: "user1",
            name: "User 1",
            tag: "user1",
            image: null,
            isOnline: true,
            lastSeen: new Date(),
          },
          {
            id: "user2",
            name: "User 2",
            tag: "user2",
            image: null,
            isOnline: false,
            lastSeen: new Date(),
          },
        ],
      };
      mockUserService.getUsersList.mockResolvedValue(mockUsers);

      await userController.getUsers(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockUserService.getUsersList).toHaveBeenCalled();
      expect(mockReply.send).toHaveBeenCalledWith(mockUsers);
    });

    it("devrait gérer les erreurs lors de la récupération des utilisateurs", async () => {
      const error = new Error("Erreur de base de données");
      mockUserService.getUsersList.mockRejectedValue(error);

      await expect(
        userController.getUsers(
          mockRequest as FastifyRequest,
          mockReply as FastifyReply
        )
      ).rejects.toThrow("Erreur de base de données");
    });
  });

  describe("getUserById", () => {
    it("devrait récupérer un utilisateur par ID", async () => {
      const mockUser = {
        id: "user1",
        name: "User 1",
        tag: "user1",
        image: null,
        isOnline: true,
        lastSeen: new Date(),
      };
      mockUserService.getUserById.mockResolvedValue(mockUser);
      mockRequest.params = { id: "user1" };

      await userController.getUserById(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockUserService.getUserById).toHaveBeenCalledWith("user1");
      expect(mockReply.send).toHaveBeenCalledWith({ user: mockUser });
    });

    it("devrait gérer les erreurs lors de la récupération par ID", async () => {
      const error = new Error("Utilisateur non trouvé");
      mockUserService.getUserById.mockRejectedValue(error);
      mockRequest.params = { id: "invalid-id" };

      await expect(
        userController.getUserById(
          mockRequest as FastifyRequest,
          mockReply as FastifyReply
        )
      ).rejects.toThrow("Utilisateur non trouvé");
    });
  });

  describe("getUserByTag", () => {
    it("devrait récupérer un utilisateur par tag", async () => {
      const mockUser = {
        id: "user1",
        name: "User 1",
        tag: "user1",
        image: null,
      };
      mockUserService.getUserByTag.mockResolvedValue(mockUser);
      mockRequest.params = { tag: "user1" };

      await userController.getUserByTag(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockUserService.getUserByTag).toHaveBeenCalledWith("user1");
      expect(mockReply.send).toHaveBeenCalledWith({ user: mockUser });
    });

    it("devrait gérer les erreurs lors de la récupération par tag", async () => {
      const error = new Error("Utilisateur non trouvé");
      mockUserService.getUserByTag.mockRejectedValue(error);
      mockRequest.params = { tag: "invalid-tag" };

      await expect(
        userController.getUserByTag(
          mockRequest as FastifyRequest,
          mockReply as FastifyReply
        )
      ).rejects.toThrow("Utilisateur non trouvé");
    });
  });

  describe("getUserTag", () => {
    it("devrait récupérer ou créer un tag utilisateur", async () => {
      const mockResult = { tag: "user123" };
      mockUserService.getUserOrCreateTag.mockResolvedValue(mockResult);

      await userController.getUserTag(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockUserService.getUserOrCreateTag).toHaveBeenCalledWith(
        "test-user-id"
      );
      expect(mockReply.send).toHaveBeenCalledWith(mockResult);
    });

    it("devrait gérer les erreurs lors de la récupération/création de tag", async () => {
      const error = new Error("Erreur lors de la création du tag");
      mockUserService.getUserOrCreateTag.mockRejectedValue(error);

      await expect(
        userController.getUserTag(
          mockRequest as FastifyRequest,
          mockReply as FastifyReply
        )
      ).rejects.toThrow("Erreur lors de la création du tag");
    });
  });
});
