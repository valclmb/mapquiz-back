# MAP2 Backend

Backend pour l'application MAP2 - Quiz géographique avec mode multijoueur.

## 🚀 Installation

### Prérequis
- Node.js 18+
- PostgreSQL
- pnpm (recommandé) ou npm

### 1. Installation des dépendances
```bash
pnpm install
```

### 2. Configuration de la base de données
```bash
# Copier le fichier d'environnement
cp .env.example .env

# Modifier les variables dans .env
DATABASE_URL="postgresql://username:password@localhost:5432/map"
```

### 3. Base de données
```bash
# Appliquer les migrations
npx prisma migrate dev

# Générer le client Prisma
npx prisma generate
```

### 4. Démarrage
```bash
# Mode développement
pnpm run dev

# Mode production
pnpm run build
pnpm start
```

## 📊 Base de données

### Migrations disponibles
- `20250627080124_init` - Initialisation
- `20250701103155_game_historix` - Historique des jeux
- `20250703072410_multilobbies` - Système de lobbies multijoueur
- `20250717102044_add_game_state_persistence` - Persistance des états de jeu
- `20250723222910_add_authorized_players` - Joueurs autorisés
- `20250723231253_add_presence_status` - Statut de présence
- `20250724100610_absent` - Gestion des absences
- `20250804102900_add_bug_reports_simplified` - Système de signalement de bugs

### Modèles principaux
- `User` - Utilisateurs
- `GameScore` - Scores de jeu
- `GameLobby` - Lobbies multijoueur
- `BugReport` - Rapports de bugs
- `Friend` / `FriendRequest` - Système d'amis

## 🔧 API Endpoints

### Authentification
- `POST /auth/login` - Connexion
- `POST /auth/logout` - Déconnexion

### Jeux
- `POST /scores` - Sauvegarder un score
- `GET /scores` - Récupérer les scores

### Multijoueur
- `POST /lobbies` - Créer un lobby
- `GET /lobbies` - Lister les lobbies
- `POST /lobbies/:id/join` - Rejoindre un lobby

### Bugs
- `POST /bug-reports` - Signaler un bug

### Amis
- `POST /friends/request` - Envoyer une demande d'ami
- `GET /friends` - Lister les amis

## 🧪 Tests

```bash
# Tests unitaires
pnpm test

# Tests d'intégration
pnpm test:integration

# Tests E2E
pnpm test:e2e
```

## 📝 Structure du projet

```
src/
├── controllers/     # Contrôleurs API
├── services/        # Logique métier
├── models/          # Modèles de données
├── routes/          # Routes API
├── middleware/      # Middleware
├── lib/            # Utilitaires
└── types/          # Types TypeScript
```

## 🐛 Signalement de bugs

Le système de signalement de bugs a été simplifié pour une meilleure expérience utilisateur :

### Champs requis
- **Titre** : Description courte du problème
- **Description** : Détails du problème

### Champs optionnels
- **Étapes de reproduction** : Comment reproduire le bug
- **Localisation** : Où le problème a été rencontré

### Informations automatiques
- Navigateur et version
- Système d'exploitation
- Type d'appareil
- Résolution d'écran
- URL de la page

## 📄 Licence

MIT
