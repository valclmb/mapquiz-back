# Map Quiz - Backend API

## 🚀 Description

API backend pour l'application Map Quiz, construite avec Fastify, Prisma et Better Auth. Cette API gère l'authentification, les utilisateurs et le système d'amis.

## 🛠️ Technologies

- **Framework**: Fastify
- **Base de données**: PostgreSQL avec Prisma ORM
- **Authentification**: Better Auth avec Google OAuth
- **Sécurité**: Helmet, CORS, Rate Limiting
- **Langage**: TypeScript

## 📋 Prérequis

- Node.js 18+
- PostgreSQL
- Compte Google Cloud (pour OAuth)

## 🔧 Installation

1. Clonez le repository

```bash
git clone <votre-repo>
cd backend
```

2. Installez les dépendances

```
npm install
```

3. Configurez les variables d'environnement

```
cp .env.example .env
```

Variables requises :

```
DATABASE_URL="postgresql://
user:password@localhost:5432/mapquiz"
BETTER_AUTH_SECRET="votre-secret-aleatoire"
BETTER_AUTH_URL="http://localhost:5173"
GOOGLE_CLIENT_ID="votre-google-client-id"
GOOGLE_CLIENT_SECRET="votre-google-client-secre
t"
SERVER_URL="http://localhost:3000"
```

4. Configurez la base de données

```
npm run db:push
npm run db:generate
```

## 🚀 Démarrage

### Développement

```
npm run dev
```

### Production

```
npm run build
npm start
```

## 📚 API Endpoints

### Authentification

- GET/POST /auth/\* - Gestion de l'authentification Better Auth
- GET /auth/callback/google - Callback OAuth Google

### Utilisateurs

- GET /users - Liste des utilisateurs
- GET /users/:id - Profil utilisateur

### Amis

- GET /friends - Liste des amis
- POST /friends/add - Ajouter un ami
- DELETE /friends/remove - Supprimer un ami
- GET /friends/requests - Demandes d'amis

### Santé

- GET /health - Vérification de l'état de l'API

## 🗄️ Base de données

Le schéma Prisma inclut :

- User : Utilisateurs avec authentification
- Session : Sessions utilisateur
- Account : Comptes OAuth
- Friendship : Relations d'amitié

## 🔒 Sécurité

- Helmet : Protection des headers HTTP
- CORS : Configuration cross-origin
- Rate Limiting : 100 requêtes/minute
- Better Auth : Authentification sécurisée

## 📝 Scripts disponibles

- npm run dev - Démarrage en mode développement
- npm run build - Build de production
- npm start - Démarrage en production
- npm run db:push - Synchroniser le schéma DB
- npm run db:migrate - Créer une migration
- npm run db:studio - Interface Prisma Studio

## 🔧 Configuration

### Fastify

- Configuration dans src/server.ts
- Plugins : CORS, Helmet, Rate Limiting
- Routes modulaires dans /routes

### Prisma

- Schéma dans prisma/schema.prisma
- Migrations dans prisma/migrations/
- Client généré automatiquement

### Better Auth

- Configuration OAuth Google
- Sessions sécurisées
- Middleware d'authentification
