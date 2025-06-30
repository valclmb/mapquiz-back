import * as UserModel from "../models/userModel.js";

export const getUserOrCreateTag = async (userId: string) => {
  const user = await UserModel.findUserById(userId);

  if (user?.tag) {
    return { tag: user.tag };
  }

  // Générer un tag unique
  let newTag: string;
  let isUnique = false;

  while (!isUnique) {
    newTag = generateRandomTag();
    const exists = await UserModel.checkTagExists(newTag);
    if (!exists) {
      isUnique = true;
    }
  }

  await UserModel.updateUserTag(userId, newTag!);
  return { tag: newTag! };
};

export const searchUsers = async (query: string, userId: string) => {
  if (!query || query.trim().length < 2) {
    throw new Error(
      "La requête de recherche doit contenir au moins 2 caractères"
    );
  }

  const users = await UserModel.searchUsersByTag(query.trim(), userId);
  return { users };
};

// Fonction pour générer un tag aléatoire (déplacée depuis lib/generateTag.ts)
const generateRandomTag = (): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};
