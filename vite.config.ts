import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => ({
  root: "desktop",
  base: "./",
  publicDir: "../public",
  plugins: [react()],
  resolve: {
    alias: [
      { find: "~", replacement: path.resolve(__dirname, "app") },
      {
        find: /^remix$/,
        replacement: path.resolve(__dirname, "app/desktop/remix-shim.tsx"),
      },
    ],
    dedupe: ["react", "react-dom"],
  },
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
  },
  build: {
    outDir: "../dist-desktop",
    emptyOutDir: true,
    target: "es2019",
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(
      mode === "production" ? "production" : "development"
    ),
  },
}));
