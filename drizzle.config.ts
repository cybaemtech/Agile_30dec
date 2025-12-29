import { defineConfig } from "drizzle-kit";

const DATABASE_URL = process.env.DATABASE_URL;

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  ...(DATABASE_URL ? {
    dbCredentials: {
      url: DATABASE_URL,
    },
  } : {}),
});
