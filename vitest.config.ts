import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    reporters: ["default", "junit"],
    outputFile: {
      junit: "junit.xml"
    },
    coverage: {
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.bench.ts"],
      reportsDirectory: "coverage",
      reporter: ["text", "cobertura", "html"]
    }
  }
});
