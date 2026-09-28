import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The extension host loads dist/webview/index.js and index.css by fixed name (see
// packages/extension/src/panel/webview-html.ts), so output names carry no hash.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  build: {
    outDir: fileURLToPath(new URL("../extension/dist/webview", import.meta.url)),
    emptyOutDir: true,
    cssCodeSplit: false,
    modulePreload: false,
    sourcemap: true,
    rollupOptions: {
      input: fileURLToPath(new URL("./src/main.tsx", import.meta.url)),
      output: {
        entryFileNames: "index.js",
        chunkFileNames: "[name].js",
        assetFileNames: (asset) =>
          asset.names?.[0]?.endsWith(".css") ? "index.css" : "[name][extname]",
      },
    },
  },
});
