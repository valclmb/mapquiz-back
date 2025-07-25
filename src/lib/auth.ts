import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
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
