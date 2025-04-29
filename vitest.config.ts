import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    reporters: ["default", "junit"],
    outputFile: {
      junit: "junit.xml"
    },
    coverage: {
      all: true,
      include: ["src/**"],
      reportsDirectory: "coverage",
      reporter: ["text", "cobertura", "html"]
    }
  }
});
