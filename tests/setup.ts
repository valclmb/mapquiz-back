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

// Mock des variables d'environnement pour les tests
process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://test:test@localhost:5432/mapquiz_test";
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

beforeEach(() => {
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
});

afterEach(() => {
  console.log = originalConsoleLog;
  console.info = originalConsoleInfo;
  console.warn = originalConsoleWarn;
});

// Utilitaires pour les tests
export const testUtils = {
  // Créer un utilisateur de test
  async createTestUser(
    id: string = "test-user-id",
    name: string = "Test User"
  ) {
    return await prisma.user.upsert({
      where: { id },
      update: { name },
      create: {
        id,
        name,
        email: `${id}@test.com`,
        tag: `TAG${id.slice(-4)}`,
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
};
