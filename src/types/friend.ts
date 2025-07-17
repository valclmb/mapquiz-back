// Types pour les amis
export interface FriendRequest {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: Date;
}

export interface Friend {
  id: string;
  name: string;
  tag: string;
  isOnline: boolean;
}
