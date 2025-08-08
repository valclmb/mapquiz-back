import { prisma } from "../src/lib/database";

// Configuration globale pour les tests
beforeAll(async () => {
  // Nettoyer la base de données avant tous les tests
  await cleanDatabase();
});

afterAll(async () => {
  // Nettoyer et fermer la connexion après tous les tests
  await cleanDatabase();
  await prisma.$disconnect();
});

afterEach(async () => {
  // Nettoyer après chaque test
  await cleanDatabase();
});

// Fonction utilitaire pour nettoyer la base de données
async function cleanDatabase() {
  const tablenames = await prisma.$queryRaw<
    Array<{ tablename: string }>
  >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

  const tables = tablenames
    .map(({ tablename }) => tablename)
    .filter((name) => name !== "_prisma_migrations")
    .map((name) => `"public"."${name}"`)
    .join(", ");

  try {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
  } catch (error) {
    console.log({ error });
  }
}

// Configuration de la base de données de test
process.env.NODE_ENV = "test";

// En CI/CD, utiliser la DB GitHub Actions (port 5432)
// En local, utiliser Docker (port 5433)
if (process.env.CI) {
  // CI/CD environment - use GitHub Actions PostgreSQL service
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ||
    "postgresql://postgres:test_password@localhost:5432/test_db";
} else {
  // Local environment - use Docker PostgreSQL
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ||
    "postgresql://postgres:test_password@localhost:5433/test_db";
}
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.SERVER_URL = "http://localhost:3000";
process.env.GOOGLE_CLIENT_ID = "test-client-id";
process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";

// Configuration des timeouts pour les tests
jest.setTimeout(30000); // 30 secondes par test

// Suppression des logs console pendant les tests (sauf erreurs)
const originalConsoleLog = console.log;
const originalConsoleInfo = console.info;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeEach(() => {
  // Supprimer les mocks pour permettre les logs de débogage
  // console.log = jest.fn();
  // console.info = jest.fn();
  // console.warn = jest.fn();
  // Mock console.error pour éviter la pollution des tests
  console.error = jest.fn();
});

afterEach(() => {
  // Temporairement commenté pour voir les logs de débogage
  // console.log = originalConsoleLog;
  // console.info = originalConsoleInfo;
  // console.warn = originalConsoleWarn;
  // Restaurer console.error
  console.error = originalConsoleError;
});

// Utilitaires pour les tests
export const testUtils = {
  // Créer un utilisateur de test
  async createTestUser(
    id: string = "test-user-id",
    name: string = "Test User"
  ) {
    const uniqueTag = `TAG${id.slice(-4)}${Date.now()}${Math.random()
      .toString(36)
      .substr(2, 3)}`;
    return await prisma.user.upsert({
      where: { id },
      update: { name, tag: uniqueTag },
      create: {
        id,
        name,
        email: `${id}@test.com`,
        tag: uniqueTag,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  },

  // Créer un lobby de test
  async createTestLobby(
    lobbyId: string = "test-lobby-id",
    hostId: string = "test-host-id",
    settings: any = { selectedRegions: ["Europe"], gameMode: "quiz" }
  ) {
    return await prisma.gameLobby.create({
      data: {
        id: lobbyId,
        hostId,
        gameSettings: settings,
        authorizedPlayers: [hostId],
        status: "waiting",
      },
    });
  },

  // Créer un score de test
  async createTestScore(
    userId: string = "test-user-id",
    score: number = 10,
    totalQuestions: number = 20
  ) {
    return await prisma.gameScore.create({
      data: {
        userId,
        score,
        totalQuestions,
        selectedRegions: ["Europe"],
        gameMode: "quiz",
        duration: 120,
      },
    });
  },

  // Attendre un délai
  async wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  // Générer un ID unique
  generateId() {
    return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  // Nettoyer la base de données
  async cleanDatabase() {
    const tablenames = await prisma.$queryRaw<
      Array<{ tablename: string }>
    >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

    const tables = tablenames
      .map(({ tablename }) => tablename)
      .filter((name) => name !== "_prisma_migrations")
      .map((name) => `"public"."${name}"`)
      .join(", ");

    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
    } catch (error) {
      console.log({ error });
    }
  },
};
