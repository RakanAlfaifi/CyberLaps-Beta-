import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },

  server: {
    port: 5173,
    open: true,
  },

  build: {
    // Phaser is large by design. Keep it in its own chunk and silence the warning.
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ["phaser"],
          xterm: ["@xterm/xterm", "@xterm/addon-fit", "@xterm/addon-web-links"],
          audio: ["howler"],
          react: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },

  // Vitest (used for the command parser and simulation engine tests)
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
