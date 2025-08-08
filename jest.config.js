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
  ],
  coverageThreshold: {
    global: {
      branches: 70, // 70% des branches testées
      functions: 80, // 80% des fonctions testées
      lines: 80, // 80% des lignes testées
      statements: 80, // 80% des statements testés
    },
  },
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
};
