import { prisma } from "../lib/database.js";

export const findUserById = async (id: string) => {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      image: true,
      tag: true,
      isOnline: true,
      lastSeen: true,
    },
  });
};

export const findUserByTag = async (tag: string) => {
  return prisma.user.findUnique({
    where: { tag },
    select: { id: true, name: true, image: true, tag: true },
  });
};

export const updateUserTag = async (userId: string, tag: string) => {
  return prisma.user.update({
    where: { id: userId },
    data: { tag },
  });
};

export const checkTagExists = async (tag: string) => {
  const user = await prisma.user.findUnique({
    where: { tag },
    select: { id: true },
  });
  return !!user;
};

export const searchUsersByTag = async (
  query: string,
  excludeUserId: string
) => {
  return prisma.user.findMany({
    where: {
      tag: {
        contains: query,
        mode: "insensitive",
      },
      id: {
        not: excludeUserId,
      },
    },
    select: {
      id: true,
      name: true,
      image: true,
      tag: true,
      isOnline: true,
    },
    take: 10, // Limiter les résultats
  });
};
