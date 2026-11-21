import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@hotel-pms/types": path.resolve(root, "src/shared/types/index.ts"),
      "@hotel-pms/validations": path.resolve(
        root,
        "src/shared/validations/index.ts",
      ),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["dist/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
});
