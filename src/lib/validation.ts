import { z } from "zod";

// Schémas de validation pour les amis
export const addFriendSchema = z.object({
  tag: z.string().min(1, "Le tag est requis"),
});

export const friendRequestActionSchema = z.object({
  action: z.enum(["accept", "reject"]),
});

// Schémas de validation pour les lobbies
export const createLobbySchema = z.object({
  name: z.string().optional(),
  settings: z.record(z.string(), z.any()),
});

export const joinLobbySchema = z.object({
  lobbyId: z.string().min(1),
});

// Schémas de validation pour les scores
export const saveScoreSchema = z.object({
  score: z.number().min(0),
  totalQuestions: z.number().min(1),
  selectedRegions: z.array(z.string()),
  gameMode: z.enum(["quiz", "training"]),
  duration: z.number().optional(),
});

// Schémas de validation pour les utilisateurs
export const updateUserSchema = z.object({
  tag: z.string().min(1).optional(),
  isOnline: z.boolean().optional(),
});

// Types TypeScript dérivés des schémas
export type AddFriendRequest = z.infer<typeof addFriendSchema>;
export type FriendRequestAction = z.infer<typeof friendRequestActionSchema>;
export type CreateLobbyRequest = z.infer<typeof createLobbySchema>;
export type JoinLobbyRequest = z.infer<typeof joinLobbySchema>;
export type SaveScoreRequest = z.infer<typeof saveScoreSchema>;
export type UpdateUserRequest = z.infer<typeof updateUserSchema>; 