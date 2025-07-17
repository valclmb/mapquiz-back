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
