import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { pool, checkDatabaseHealth } from "./config/database.js";
import { runMigrations } from "./db/migrator.js";

async function bootstrap() {
  try {
    logger.info("Initializing PMS server...");

    // Verify DB connectivity and run migrations
    const isDbConnected = await checkDatabaseHealth();
    if (isDbConnected) {
      logger.info(
        "Database connected successfully. Running pending migrations...",
      );
      await runMigrations();
    } else {
      logger.warn("Database is not reachable. Migrations deferred.");
    }

    const server = app.listen(env.PORT, () => {
      logger.info(`${env.PORT} PMS server is up!`);
      logger.info(`Environment: ${env.NODE_ENV}`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        logger.info("HTTP server closed.");
        await pool.end();
        logger.info("PostgreSQL pool drained.");
        process.exit(0);
      });

      // Force shutdown if taking too long
      setTimeout(() => {
        logger.error("Forced shutdown due to timeout");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    logger.fatal({ error }, "Failed to start PMS server");
    process.exit(1);
  }
}

bootstrap();
