export default {
  preset: "ts-jest",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        useESM: true,
      },
    ],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  testMatch: ["<rootDir>/tests/**/*.test.ts", "<rootDir>/tests/**/*.spec.ts"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/server.ts",
    "!src/types/**",
    "!src/lib/auth.ts", // Configuration Better-auth - testée via les tests d'intégration
    "!src/lib/database.ts", // Configuration Prisma - testée via les mocks
    "!src/lib/config.ts", // Configuration simple - pas de logique
    "!src/lib/validation.ts", // Schemas Zod statiques - pas de logique
    "!src/lib/errorHandler.ts", // Middleware Fastify - testé via l'intégration
    "!src/services/userService.ts", // Service simple non utilisé actuellement
    "!src/controllers/authController.ts", // Simple délégation Better-auth - testé en intégration
  ],
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,

  // Seuils de couverture intelligents basés sur la réalité du code
  coverageThreshold: {
    global: {
      statements: 60,
      branches: 40,
      functions: 50,
      lines: 55,
    },

    // Seuils ÉLEVÉS pour la logique métier critique
    "src/services/**": {
      statements: 70,
      branches: 80,
      functions: 70,
      lines: 75,
    },

    // Seuils MODÉRÉS pour les communications temps réel
    "src/websocket/**": {
      statements: 55,
      branches: 35,
      functions: 40,
      lines: 50,
    },

    // Seuils BAS pour les wrappers (éviter les faux positifs)
    "src/controllers/**": {
      statements: 35,
      branches: 15,
      // Pas de seuil functions/lines - trop de wrappers simples
    },

    "src/models/**": {
      statements: 50,
      // Pas de seuil branches - queries simples
      functions: 20,
      lines: 40,
    },

    // Seuils ÉLEVÉS pour le middleware critique (sécurité)
    "src/middleware/**": {
      statements: 70,
      branches: 50,
      functions: 75,
      lines: 70,
    },
  },
};
