import { copyFileSync } from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const repoName = process.env.VITE_BASE_NAME;
const base = repoName ? `/${repoName}/` : "/";

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "spa-fallback-404",
      closeBundle() {
        const outDir = path.resolve(__dirname, "dist");
        copyFileSync(
          path.join(outDir, "index.html"),
          path.join(outDir, "404.html"),
        );
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
