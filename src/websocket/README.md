# Architecture WebSocket Refactorisée

## Vue d'ensemble

Le code WebSocket a été refactorisé pour améliorer la lisibilité, la maintenabilité et réduire la complexité. L'architecture suit maintenant le principe de responsabilité unique avec des services spécialisés.

## Structure des fichiers

### Services principaux

- **`handlers.ts`** - Configuration et routage des connexions WebSocket
- **`messageHandler.ts`** - Traitement des messages WebSocket avec routage par type
- **`connectionHandler.ts`** - Gestion du cycle de vie des connexions
- **`lobbyManager.ts`** - Orchestration des lobbies (simplifié)

### Services spécialisés

- **`gameStateManager.ts`** - Gestion de l'état du jeu et logique métier
- **`playerManager.ts`** - Gestion des joueurs et leurs données
- **`broadcastManager.ts`** - Diffusion des messages aux clients

### Utilitaires

- **`connectionManager.ts`** - Gestion des connexions actives
- **`authentication.ts`** - Authentification des utilisateurs WebSocket
- **`index.ts`** - Point d'entrée unifié pour tous les exports

## Améliorations apportées

### 1. Constantes pour les types de messages

```typescript
// Avant
case "create_lobby":
case "join_lobby":

// Après
case WS_MESSAGE_TYPES.CREATE_LOBBY:
case WS_MESSAGE_TYPES.JOIN_LOBBY:
```

### 2. Extraction de la logique répétitive

```typescript
// Méthode utilitaire pour l'authentification
private static requireAuth(userId: string | null, socket: WebSocket): boolean {
  if (!userId) {
    sendErrorResponse(socket, "Authentification requise");
    return false;
  }
  return true;
}
```

### 3. Séparation des responsabilités

- **GameStateManager** : Logique de jeu, génération de pays, calculs de classement
- **PlayerManager** : Création et mise à jour des joueurs
- **BroadcastManager** : Diffusion des messages aux clients

### 4. Réduction de la complexité

- `lobbyManager.ts` : Réduit de 590 à ~300 lignes
- Code plus lisible et maintenable
- Tests plus faciles à écrire

## Utilisation

### Import des services

```typescript
import {
  GameStateManager,
  PlayerManager,
  BroadcastManager,
} from "./websocket/index.js";
```

### Création d'un joueur

```typescript
const player = PlayerManager.createPlayer("John Doe");
```

### Mise à jour d'un score

```typescript
const updatedPlayer = PlayerManager.updatePlayerScore(
  player,
  score,
  progress,
  answerTime,
  isConsecutiveCorrect
);
```

### Diffusion d'un message

```typescript
BroadcastManager.broadcastLobbyUpdate(lobbyId, lobbyData);
```

## Avantages

1. **Lisibilité** : Code plus clair et facile à comprendre
2. **Maintenabilité** : Modifications isolées dans des services spécialisés
3. **Testabilité** : Services indépendants plus faciles à tester
4. **Réutilisabilité** : Services réutilisables dans d'autres contextes
5. **Performance** : Moins de répétition de code

## Migration

Le code existant continue de fonctionner grâce aux exports maintenus dans `lobbyManager.ts`. Les nouvelles fonctionnalités peuvent utiliser les services spécialisés pour une meilleure organisation.
