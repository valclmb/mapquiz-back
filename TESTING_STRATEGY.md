# Stratégie de Tests - MapQuiz Backend

## 📊 **Couverture de Tests Complète**

### ✅ **Tests Unitaires (Services)**

- **LobbyService** - Gestion des lobbies, invitations, paramètres
- **GameService** - Logique de jeu, progression, résultats
- **UserService** - Gestion des utilisateurs, tags, profils
- **FriendService** - Système d'amis, demandes, relations
- **ScoreService** - Sauvegarde, historique, statistiques
- **PlayerService** - Gestion des joueurs, états de jeu

### ✅ **Tests d'Intégration**

- **WebSocket Core** - Communication temps réel, authentification
- **Controllers REST** - API endpoints, validation, autorisations
- **WebSocket Handlers** - Handlers spécifiques, gestion d'erreurs
- **Sécurité** - Intégration better-auth, protection des routes

### ✅ **Tests End-to-End**

- **Flux de jeu complet** - Cycle multi-joueur, déconnexions
- **Gestion des erreurs** - Scénarios d'échec, récupération

### ✅ **Tests de Performance**

- **Charge** - Connexions simultanées, lobbies multiples
- **Mémoire** - Gestion des ressources, nettoyage
- **Latence** - Temps de réponse, optimisation

## 🎯 **Types de Tests**

### 1. **Tests Unitaires** (`tests/unit/`)

**Objectif** : Tester la logique métier isolée

- **Services** : Toutes les méthodes des services
- **Validation** : Données d'entrée, cas limites
- **Erreurs** : Gestion des exceptions, cas d'échec

**Exemples** :

```typescript
// Test de création de lobby
it("devrait créer un lobby avec les paramètres fournis", async () => {
  const result = await LobbyService.createLobby(userId, settings);
  expect(result.success).toBe(true);
  expect(result.lobby.hostId).toBe(userId);
});
```

### 2. **Tests d'Intégration** (`tests/integration/`)

**Objectif** : Tester l'interaction entre composants

- **WebSocket** : Communication temps réel
- **REST API** : Endpoints avec authentification
- **Base de données** : Opérations CRUD complètes

**Exemples** :

```typescript
// Test d'authentification WebSocket
it("devrait authentifier un utilisateur via WebSocket", async () => {
  const ws = await connectWebSocket(userId);
  expect(ws.readyState).toBe(WebSocket.OPEN);
});
```

### 3. **Tests End-to-End** (`tests/e2e/`)

**Objectif** : Tester les scénarios complets

- **Flux de jeu** : Création → Jeu → Résultats
- **Multi-joueur** : Interactions entre joueurs
- **Résilience** : Déconnexions, reconnexions

### 4. **Tests de Performance** (`tests/performance/`)

**Objectif** : Vérifier les performances

- **Charge** : 100+ connexions simultanées
- **Mémoire** : Pas de fuites mémoire
- **Latence** : < 100ms pour les opérations critiques

## 🔐 **Tests de Sécurité**

### **Intégration Better-Auth**

- ✅ Validation des sessions
- ✅ Rejet des sessions invalides
- ✅ Gestion des erreurs d'authentification

### **Protection des Routes**

- ✅ Routes protégées (401 si non authentifié)
- ✅ Routes publiques accessibles
- ✅ Autorisations par utilisateur

### **Validation des Données**

- ✅ Validation des scores, demandes d'amis, lobbies
- ✅ Protection contre les injections
- ✅ Validation des types de données

### **Rate Limiting**

- ✅ Limitation du nombre de requêtes
- ✅ Headers de sécurité appropriés

## 📈 **Métriques de Qualité**

### **Couverture de Code**

- **Objectif** : > 90% de couverture
- **Services** : 100% des méthodes testées
- **Controllers** : 100% des endpoints testés
- **WebSocket** : 100% des handlers testés

### **Seuils de Qualité**

```javascript
coverageThreshold: {
  global: {
    branches: 90,
    functions: 90,
    lines: 90,
    statements: 90,
  },
}
```

### **Performance**

- **Temps de réponse** : < 100ms pour les opérations critiques
- **Mémoire** : Pas de fuites détectées
- **Connexions** : Support de 100+ utilisateurs simultanés

## 🚀 **Commandes de Test**

### **Exécution des Tests**

```bash
# Tous les tests
pnpm run test

# Tests unitaires uniquement
pnpm run test:unit

# Tests d'intégration
pnpm run test:integration

# Tests E2E
pnpm run test:e2e

# Tests de performance
pnpm run test:performance

# Avec couverture
pnpm run test:coverage

# Mode watch (développement)
pnpm run test:watch
```

### **Tests Spécifiques**

```bash
# Test d'un service spécifique
pnpm run test:unit -- --testNamePattern="UserService"

# Test d'un fichier spécifique
pnpm run test:unit -- tests/unit/services/userService.test.ts

# Tests avec debug
pnpm run test:debug
```

## 🛠 **Configuration**

### **Jest Configuration** (`jest.config.js`)

- **Preset** : `ts-jest` pour TypeScript
- **Environment** : Node.js
- **Coverage** : Seuils élevés (90%)
- **Timeout** : 30 secondes par test
- **Setup** : Nettoyage automatique de la base de données

### **Base de Données de Test**

- **Base séparée** : `mapquiz_test`
- **Nettoyage** : Avant/après chaque test
- **Isolation** : Chaque test est indépendant

### **Variables d'Environnement**

```bash
NODE_ENV=test
DATABASE_URL=postgresql://test:test@localhost:5432/mapquiz_test
BETTER_AUTH_URL=http://localhost:3000
```

## 📋 **Checklist de Qualité**

### **Avant chaque commit**

- [ ] Tous les tests passent (`pnpm run test`)
- [ ] Couverture > 90% (`pnpm run test:coverage`)
- [ ] Tests de performance OK (`pnpm run test:performance`)
- [ ] Pas de fuites mémoire détectées

### **Avant chaque déploiement**

- [ ] Tests E2E complets (`pnpm run test:e2e`)
- [ ] Tests de sécurité (`pnpm run test:integration -- --testNamePattern="security"`)
- [ ] Validation des performances
- [ ] Vérification des logs d'erreur

## 🔄 **Maintenance des Tests**

### **Ajout de Nouveaux Tests**

1. **Identifier le type** : Unit, Integration, E2E, Performance
2. **Créer le fichier** dans le bon dossier
3. **Suivre les conventions** : Nommage, structure
4. **Ajouter les mocks** nécessaires
5. **Vérifier la couverture**

### **Mise à Jour des Tests**

1. **Identifier les changements** dans le code
2. **Mettre à jour les tests** correspondants
3. **Vérifier la régression** : anciens tests toujours valides
4. **Ajouter des tests** pour les nouvelles fonctionnalités

### **Debug des Tests**

```bash
# Mode debug détaillé
pnpm run test:debug -- --verbose

# Test spécifique avec debug
pnpm run test:unit -- --testNamePattern="UserService" --verbose

# Avec logs de base de données
DEBUG=prisma:* pnpm run test:unit
```

## 🎯 **Cas d'Usage Prioritaires**

### **Scénarios Critiques Testés**

1. **Création et gestion de lobby** - Fonctionnalité principale
2. **Système d'amis** - Social features
3. **Sauvegarde des scores** - Persistance des données
4. **Authentification** - Sécurité
5. **Communication temps réel** - WebSocket
6. **Gestion des erreurs** - Robustesse
7. **Performance multi-joueur** - Scalabilité

### **Protection contre les Régressions**

- **Tests automatisés** sur chaque commit
- **CI/CD** avec validation complète
- **Alertes** en cas d'échec de tests
- **Rollback** automatique si nécessaire

## 📊 **Rapports et Monitoring**

### **Rapports de Couverture**

- **HTML** : `coverage/lcov-report/index.html`
- **Console** : Résumé dans le terminal
- **CI** : Intégration avec les outils CI/CD

### **Métriques de Performance**

- **Temps d'exécution** des tests
- **Utilisation mémoire** pendant les tests
- **Latence** des opérations critiques
- **Taux de succès** des tests

Cette stratégie garantit une **couverture complète** et une **protection robuste** contre les régressions, avec une approche **pragmatique** adaptée à l'utilisation de **better-auth** pour l'authentification.
