import { z } from "zod";
import dotenv from "dotenv";

// Load environment variables if available
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z
    .string()
    .default("postgresql://pms_user:pms_password@localhost:5432/hotel_pms"),
  DB_POOL_MIN: z.coerce.number().default(2),
  DB_POOL_MAX: z.coerce.number().default(10),
  JWT_SECRET:
    process.env.NODE_ENV === "production"
      ? z.string().min(32)
      : z.string().min(32).default("jwt_secret_chars"),
  JWT_ISSUER: z.string().default("hotel-pms"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", z.treeifyError(parsed.error));
  throw new Error("Invalid environment configuration");
}

export const env = parsed.data;
