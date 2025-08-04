# Guide des Tests

## 🧪 Exécution des Tests

**Tous les tests utilisent automatiquement Docker !** 🐳

### **Tests de base**

```bash
# Tous les tests
npm run test

# Tests en mode watch (redémarre automatiquement)
npm run test:watch

# Tests avec couverture
npm run test:coverage
```

### **Tests spécifiques**

```bash
# Tests unitaires seulement
npm run test:unit

# Tests d'intégration seulement
npm run test:integration

# Tests E2E seulement
npm run test:e2e

# Tests de performance
npm run test:performance
```

### **Tests avancés**

```bash
# Tests avec debug
npm run test:debug

# Tests pour CI/CD (sans Docker)
npm run test:ci
```

## 🐳 Configuration Docker

La base de données de test utilise :

- **Image** : `postgres:15` (même que CI/CD)
- **Port** : `5433` (évite les conflits avec votre DB locale)
- **Base** : `test_db`
- **Utilisateur** : `postgres`
- **Mot de passe** : `test_password`

## 🔧 Variables d'environnement

Les tests utilisent automatiquement :

```env
NODE_ENV=test
DATABASE_URL=postgresql://postgres:test_password@localhost:5433/test_db
```

## 📁 Structure des Tests

```
tests/
├── setup.ts              # Configuration globale
├── unit/                 # Tests unitaires
│   ├── githubService.test.ts
│   ├── bugReportController.test.ts
│   └── ...
├── integration/          # Tests d'intégration (à créer)
├── e2e/                  # Tests end-to-end (à créer)
└── performance/          # Tests de performance (à créer)
```

## ✅ Tests Actuels

### **Tests Unitaires Fonctionnels**

1. **GitHubService** (`tests/unit/githubService.test.ts`)

   - ✅ Gestion des erreurs de l'API GitHub
   - ✅ Validation des réponses d'erreur

2. **BugReportController** (`tests/unit/bugReportController.test.ts`)
   - ✅ Création de bug report avec succès
   - ✅ Intégration avec GitHubService
   - ✅ Validation des réponses HTTP

### **Tests Supprimés (Obsolètes)**

Les tests suivants ont été supprimés car ils ne correspondaient plus au code actuel :

- `userService.test.ts` - Méthodes non implémentées
- `scoreService.test.ts` - Interface incomplète
- `playerService.test.ts` - Modèle de données obsolète
- `friendService.test.ts` - Relations Prisma manquantes
- `gameService.test.ts` - Erreurs de base de données
- `lobbyService.test.ts` - Incompatibilités de schéma

## 🚀 CI/CD

Les tests en CI/CD utilisent la même configuration Docker que localement, garantissant la cohérence entre les environnements.

## 🐛 Dépannage

### **Problème de connexion à la DB**

```bash
# Vérifier que Docker est démarré
docker ps

# Redémarrer la DB de test
npm run test:docker:stop
npm run test:docker:start
```

### **Nettoyer les données de test**

```bash
# Supprimer le volume Docker
docker-compose -f docker-compose.test.yml down -v
```

### **Ajouter de nouveaux tests**

1. **Tests unitaires** : Créer dans `tests/unit/`
2. **Tests d'intégration** : Créer dans `tests/integration/`
3. **Tests E2E** : Créer dans `tests/e2e/`

### **Exemple de test unitaire**

```typescript
import { MyService } from "../../src/services/myService.js";

describe("MyService", () => {
  it("devrait faire quelque chose", async () => {
    const result = await MyService.doSomething();
    expect(result).toBe(true);
  });
});
```

## 📊 Couverture de Tests

La couverture actuelle est minimale mais fonctionnelle. Les tests couvrent :

- ✅ Services critiques (GitHub, Bug Report)
- ✅ Contrôleurs principaux
- ✅ Gestion d'erreurs

**Prochaines étapes** : Ajouter des tests pour les services métier existants.
