// Types pour les utilisateurs
export interface User {
  id: string;
  name: string;
  email: string;
  tag?: string;
}

export interface AuthenticatedRequest {
  user: User;
  session: any;
}

// Types pour les données de base de données
export interface DatabaseUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string;
  createdAt: Date;
  updatedAt: Date;
  tag?: string;
  isOnline: boolean;
  lastSeen: Date;
}

export interface UserListItem {
  id: string;
  name: string;
  tag?: string;
  isOnline: boolean;
  lastSeen: Date;
}
