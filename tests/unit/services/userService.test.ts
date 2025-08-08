import { generateRandomTag } from "../../../src/lib/generateTag.js";
import * as UserModel from "../../../src/models/userModel.js";
import { UserService } from "../../../src/services/userService.js";

// Mock des modules
jest.mock("../../../src/models/userModel.js");
jest.mock("../../../src/lib/generateTag.js");

const mockUserModel = UserModel as jest.Mocked<typeof UserModel>;
const mockGenerateRandomTag = generateRandomTag as jest.MockedFunction<
  typeof generateRandomTag
>;

describe("UserService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getUserById", () => {
    it("devrait récupérer un utilisateur par son ID", async () => {
      const mockUser = {
        id: "user-id",
        name: "Test User",
        email: "test@example.com",
        image: null,
        tag: "test-tag",
        isOnline: true,
        lastSeen: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: false,
      };

      mockUserModel.findUserById.mockResolvedValue(mockUser);

      const result = await UserService.getUserById("user-id");

      expect(mockUserModel.findUserById).toHaveBeenCalledWith("user-id");
      expect(result).toEqual(mockUser);
    });

    it("devrait échouer si l'utilisateur n'existe pas", async () => {
      mockUserModel.findUserById.mockResolvedValue(null);

      await expect(UserService.getUserById("invalid-user")).rejects.toThrow(
        "Utilisateur non trouvé"
      );
    });
  });

  describe("getUserByTag", () => {
    it("devrait récupérer un utilisateur par son tag", async () => {
      const mockUser = {
        id: "user-id",
        name: "Test User",
        email: "test@example.com",
        image: null,
        tag: "test-tag",
        isOnline: true,
        lastSeen: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: false,
      };

      mockUserModel.findUserByTag.mockResolvedValue(mockUser);

      const result = await UserService.getUserByTag("test-tag");

      expect(mockUserModel.findUserByTag).toHaveBeenCalledWith("test-tag");
      expect(result).toEqual(mockUser);
    });

    it("devrait échouer si l'utilisateur n'existe pas", async () => {
      mockUserModel.findUserByTag.mockResolvedValue(null);

      await expect(UserService.getUserByTag("invalid-tag")).rejects.toThrow(
        "Utilisateur non trouvé"
      );
    });
  });

  describe("updateUserStatus", () => {
    it("devrait mettre à jour le statut d'un utilisateur", async () => {
      mockUserModel.updateUserStatus.mockResolvedValue({} as any);

      const result = await UserService.updateUserStatus("user-id", true);

      expect(mockUserModel.updateUserStatus).toHaveBeenCalledWith(
        "user-id",
        true,
        expect.any(String)
      );
      expect(result).toEqual({ success: true });
    });

    it("devrait mettre à jour le statut hors ligne", async () => {
      mockUserModel.updateUserStatus.mockResolvedValue({} as any);

      const result = await UserService.updateUserStatus("user-id", false);

      expect(mockUserModel.updateUserStatus).toHaveBeenCalledWith(
        "user-id",
        false,
        expect.any(String)
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe("getUsersList", () => {
    it("devrait récupérer la liste des utilisateurs", async () => {
      const mockUsers = [
        {
          id: "user1",
          name: "User 1",
          email: "user1@example.com",
          image: null,
          tag: "user1-tag",
          isOnline: true,
          lastSeen: new Date("2023-01-01"),
          createdAt: new Date(),
          updatedAt: new Date(),
          emailVerified: false,
        },
        {
          id: "user2",
          name: "User 2",
          email: "user2@example.com",
          image: null,
          tag: "user2-tag",
          isOnline: false,
          lastSeen: new Date("2023-01-02"),
          createdAt: new Date(),
          updatedAt: new Date(),
          emailVerified: false,
        },
      ];

      mockUserModel.findAllUsers.mockResolvedValue(mockUsers);

      const result = await UserService.getUsersList();

      expect(mockUserModel.findAllUsers).toHaveBeenCalled();
      expect(result.users).toHaveLength(2);
      expect(result.users[0]).toEqual({
        id: "user1",
        name: "User 1",
        tag: "user1-tag",
        isOnline: true,
        lastSeen: new Date("2023-01-01"),
      });
      expect(result.users[1]).toEqual({
        id: "user2",
        name: "User 2",
        tag: "user2-tag",
        isOnline: false,
        lastSeen: new Date("2023-01-02"),
      });
    });
  });

  describe("getUserOrCreateTag", () => {
    it("devrait retourner le tag existant si l'utilisateur en a un", async () => {
      const mockUser = {
        id: "user-id",
        name: "Test User",
        email: "test@example.com",
        image: null,
        tag: "existing-tag",
        isOnline: true,
        lastSeen: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: false,
      };

      mockUserModel.findUserById.mockResolvedValue(mockUser);

      const result = await UserService.getUserOrCreateTag("user-id");

      expect(mockUserModel.findUserById).toHaveBeenCalledWith("user-id");
      expect(result).toEqual({ tag: "existing-tag" });
      expect(mockGenerateRandomTag).not.toHaveBeenCalled();
      expect(mockUserModel.checkTagExists).not.toHaveBeenCalled();
      expect(mockUserModel.updateUserTag).not.toHaveBeenCalled();
    });

    it("devrait créer un nouveau tag si l'utilisateur n'en a pas", async () => {
      const mockUser = {
        id: "user-id",
        name: "Test User",
        email: "test@example.com",
        image: null,
        tag: null,
        isOnline: true,
        lastSeen: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: false,
      };

      mockUserModel.findUserById.mockResolvedValue(mockUser);
      mockGenerateRandomTag.mockReturnValue("new-tag");
      mockUserModel.checkTagExists.mockResolvedValue(false);
      mockUserModel.updateUserTag.mockResolvedValue({} as any);

      const result = await UserService.getUserOrCreateTag("user-id");

      expect(mockUserModel.findUserById).toHaveBeenCalledWith("user-id");
      expect(mockGenerateRandomTag).toHaveBeenCalled();
      expect(mockUserModel.checkTagExists).toHaveBeenCalledWith("new-tag");
      expect(mockUserModel.updateUserTag).toHaveBeenCalledWith(
        "user-id",
        "new-tag"
      );
      expect(result).toEqual({ tag: "new-tag" });
    });

    it("devrait réessayer si le tag généré existe déjà", async () => {
      const mockUser = {
        id: "user-id",
        name: "Test User",
        email: "test@example.com",
        image: null,
        tag: null,
        isOnline: true,
        lastSeen: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: false,
      };

      mockUserModel.findUserById.mockResolvedValue(mockUser);
      mockGenerateRandomTag
        .mockReturnValueOnce("existing-tag")
        .mockReturnValueOnce("new-tag");
      mockUserModel.checkTagExists
        .mockResolvedValueOnce(true) // Premier tag existe
        .mockResolvedValueOnce(false); // Deuxième tag n'existe pas
      mockUserModel.updateUserTag.mockResolvedValue({} as any);

      const result = await UserService.getUserOrCreateTag("user-id");

      expect(mockGenerateRandomTag).toHaveBeenCalledTimes(2);
      expect(mockUserModel.checkTagExists).toHaveBeenCalledTimes(2);
      expect(mockUserModel.updateUserTag).toHaveBeenCalledWith(
        "user-id",
        "new-tag"
      );
      expect(result).toEqual({ tag: "new-tag" });
    });
  });
});
