import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { customSession } from "better-auth/plugins";
import { UserService } from "src/services/userService.js";
import { prisma } from "./database.js";

// Log temporaire pour debug
console.log("BETTER_AUTH_URL =", process.env.BETTER_AUTH_URL);

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      redirectURI: `${process.env.SERVER_URL}/api/auth/callback/google`,
    },
  },
  user: {
    additionalFields: {
      tag: {
        type: "string",
        required: false,
        defaultValue: null,
        input: false, // Pas d'input utilisateur, généré automatiquement
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await UserService.getUserOrCreateTag(user.id);
        },
      },
    },
  },
  plugins: [
    customSession(async ({ user, session }) => {
      // Récupérer le tag de l'utilisateur (déjà créé lors de l'inscription)
      const userWithTag = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { tag: true },
      });

      return {
        user: {
          ...user,
          tag: userWithTag?.tag || null,
        },
        session,
      };
    }),
  ],
  advanced: {
    useSecureCookies: true,
    defaultCookieAttributes: {
      httpOnly: true,
      secure: true,
      sameSite: "none", // Crucial pour le cross-domain
    },
    trustedOrigins: ["http://localhost:5173"],
  },
});
