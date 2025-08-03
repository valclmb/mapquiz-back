# 🧪 Suite de Tests Robuste - MapQuiz Backend

Cette suite de tests garantit la stabilité et la fiabilité du backend optimisé en évitant les régressions lors des modifications de code.

## 📋 Structure des Tests

```
tests/
├── setup.ts                    # Configuration globale
├── unit/                       # Tests unitaires
│   └── services/
│       ├── lobbyService.test.ts
│       └── gameService.test.ts
├── integration/                # Tests d'intégration
│   └── websocket.test.ts
├── e2e/                        # Tests end-to-end
│   └── gameFlow.test.ts
└── performance/                # Tests de performance
    └── loadTest.test.ts
```

## 🚀 Commandes de Test

### Tests Rapides (Développement)

```bash
# Tests unitaires uniquement
npm run test:unit

# Tests en mode watch
npm run test:watch

# Tests avec couverture
npm run test:coverage
```

### Tests Complets (CI/CD)

```bash
# Tous les tests
npm run test

# Tests d'intégration
npm run test:integration

# Tests end-to-end
npm run test:e2e

# Tests de performance
npm run test:performance

# Tests pour CI (sans watch)
npm run test:ci
```

### Debug

```bash
# Tests avec debug
npm run test:debug
```

## 🎯 Types de Tests

### 1. **Tests Unitaires** (`unit/`)

- **Objectif** : Tester les fonctions individuelles
- **Couverture** : Services, contrôleurs, utilitaires
- **Exemples** :
  - Création de lobby
  - Mise à jour de score
  - Validation des données
  - Gestion des erreurs

### 2. **Tests d'Intégration** (`integration/`)

- **Objectif** : Tester les interactions entre composants
- **Couverture** : WebSocket, API, base de données
- **Exemples** :
  - Connexion WebSocket
  - Création/rejoindre lobby
  - Communication multi-joueurs
  - Gestion des erreurs réseau

### 3. **Tests End-to-End** (`e2e/`)

- **Objectif** : Tester les scénarios complets
- **Couverture** : Flux de jeu complet
- **Exemples** :
  - Cycle complet de jeu multi-joueurs
  - Déconnexion/reconnexion
  - Gestion des lobbies inactifs
  - Accès non autorisés

### 4. **Tests de Performance** (`performance/`)

- **Objectif** : Vérifier les performances
- **Couverture** : Charge, mémoire, latence
- **Exemples** :
  - Connexions simultanées
  - Messages par seconde
  - Utilisation mémoire
  - Robustesse aux déconnexions

## 📊 Métriques de Qualité

### Couverture de Code

- **Minimum** : 80% de couverture globale
- **Branches** : 80% des branches testées
- **Fonctions** : 80% des fonctions testées
- **Lignes** : 80% des lignes exécutées

### Performance

- **Latence** : < 100ms en moyenne
- **Charge** : 10+ connexions simultanées
- **Mémoire** : < 50MB d'augmentation
- **Messages** : 50+ msg/s

## 🔧 Configuration

### Variables d'Environnement

```bash
# Base de données de test
TEST_DATABASE_URL=postgresql://test:test@localhost:5432/mapquiz_test

# Configuration des tests
NODE_ENV=test
LOG_LEVEL=0  # Pas de logs pendant les tests
```

### Base de Données de Test

- Base séparée pour éviter les conflits
- Nettoyage automatique entre les tests
- Données de test isolées

## 🐛 Debug des Tests

### Logs Détaillés

```bash
# Activer les logs pendant les tests
LOG_LEVEL=3 npm run test:debug
```

### Tests Spécifiques

```bash
# Tester un fichier spécifique
npm test -- tests/unit/services/lobbyService.test.ts

# Tester une fonction spécifique
npm test -- --testNamePattern="devrait créer un lobby"
```

### Timeout et Retry

```bash
# Augmenter le timeout
npm test -- --timeout=60000

# Retry les tests qui échouent
npm test -- --retry=3
```

## 📈 Intégration Continue

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:ci
      - run: npm run test:coverage
```

### Pré-commit Hooks

```bash
# Installer husky
npm install --save-dev husky

# Configurer les hooks
npx husky add .husky/pre-commit "npm run test:unit"
```

## 🚨 Gestion des Erreurs

### Erreurs Communes

1. **Timeout** : Augmenter le timeout ou optimiser le test
2. **Mémoire** : Nettoyer les ressources après les tests
3. **Connexions** : Fermer les WebSocket après utilisation
4. **Base de données** : Vérifier la connexion de test

### Bonnes Pratiques

- ✅ Tests isolés et indépendants
- ✅ Nettoyage automatique des données
- ✅ Mocks pour les dépendances externes
- ✅ Assertions claires et spécifiques
- ✅ Gestion des timeouts appropriée

## 📝 Ajouter de Nouveaux Tests

### 1. Test Unitaire

```typescript
// tests/unit/services/nouveauService.test.ts
import { NouveauService } from "../../../src/services/nouveauService.js";
import { testUtils } from "../../setup.js";

describe("NouveauService", () => {
  it("devrait faire quelque chose", async () => {
    // Arrange
    const data = testUtils.generateId();

    // Act
    const result = await NouveauService.faireQuelqueChose(data);

    // Assert
    expect(result).toBe(true);
  });
});
```

### 2. Test d'Intégration

```typescript
// tests/integration/nouveauFeature.test.ts
describe("Nouveau Feature", () => {
  it("devrait fonctionner end-to-end", async (done) => {
    // Test complet avec WebSocket
    done();
  });
});
```

### 3. Test de Performance

```typescript
// tests/performance/nouveauFeature.test.ts
describe("Performance Nouveau Feature", () => {
  it("devrait supporter la charge", async (done) => {
    // Test de charge
    done();
  });
});
```

## 🎯 Objectifs de Qualité

### Avant Chaque Commit

- [ ] Tests unitaires passent
- [ ] Couverture > 80%
- [ ] Aucune régression détectée

### Avant Chaque Release

- [ ] Tous les tests passent
- [ ] Tests de performance validés
- [ ] Tests E2E complets
- [ ] Documentation mise à jour

Cette suite de tests robuste garantit que chaque modification de code maintient la qualité et évite les régressions fonctionnelles.
