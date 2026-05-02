import path from "node:path";
import { defineConfig } from "vitest/config";

const workspaceRoot = path.resolve(__dirname, "../..");

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
      react: path.resolve(workspaceRoot, "node_modules/react"),
      "react-dom": path.resolve(workspaceRoot, "node_modules/react-dom"),
      "react/jsx-runtime": path.resolve(workspaceRoot, "node_modules/react/jsx-runtime.js"),
      "react/jsx-dev-runtime": path.resolve(workspaceRoot, "node_modules/react/jsx-dev-runtime.js"),
    },
  },
});
