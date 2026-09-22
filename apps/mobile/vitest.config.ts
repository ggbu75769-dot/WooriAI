import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Local dependency backups can contain upstream Jest suites, just like node_modules.
    exclude: [...configDefaults.exclude, "**/.node_modules*/**"]
  }
});
