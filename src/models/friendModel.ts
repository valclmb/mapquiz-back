import { prisma } from "../lib/database.js";

export const findFriendship = async (userId: string, friendId: string) => {
  return prisma.friend.findUnique({
    where: {
      userId_friendId: { userId, friendId },
    },
  });
};

export const findUserFriends = async (userId: string) => {
  return prisma.friend.findMany({
    where: { userId },
    include: {
      friend: {
        select: {
          id: true,
          name: true,
          image: true,
          tag: true,
          isOnline: true,
          lastSeen: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const findPendingFriendRequest = async (
  senderId: string,
  receiverId: string
) => {
  return prisma.friendRequest.findFirst({
    where: {
      senderId,
      receiverId,
      status: "pending",
    },
  });
};

export const createFriendRequest = async (
  senderId: string,
  receiverId: string
) => {
  // Supprimer les anciennes demandes
  await prisma.friendRequest.deleteMany({
    where: {
      OR: [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: senderId },
      ],
    },
  });

  return prisma.friendRequest.create({
    data: { senderId, receiverId },
  });
};

export const findFriendRequests = async (userId: string) => {
  return prisma.friendRequest.findMany({
    where: {
      receiverId: userId,
      status: "pending",
    },
    include: {
      sender: {
        select: { id: true, name: true, image: true, tag: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const updateFriendRequestStatus = async (
  requestId: string,
  status: "accepted" | "rejected"
) => {
  return prisma.friendRequest.update({
    where: { id: requestId },
    data: { status },
  });
};

export const createMutualFriendship = async (
  userId1: string,
  userId2: string
) => {
  return prisma.$transaction([
    prisma.friend.create({
      data: { userId: userId1, friendId: userId2 },
    }),
    prisma.friend.create({
      data: { userId: userId2, friendId: userId1 },
    }),
  ]);
};

export const removeMutualFriendship = async (
  userId: string,
  friendId: string
) => {
  return prisma.$transaction([
    prisma.friend.deleteMany({
      where: { userId, friendId },
    }),
    prisma.friend.deleteMany({
      where: { userId: friendId, friendId: userId },
    }),
  ]);
};

export const findFriendRequestById = async (requestId: string) => {
  return prisma.friendRequest.findUnique({
    where: { id: requestId },
    include: { sender: true },
  });
};
