import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import { buildXDC } from "@webxdc/vite-plugins";
import wasm from "vite-plugin-wasm";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), svgr(), buildXDC(), wasm()],
  server: {
    fs: {
      // Allow serving files from one level up to the project root
      allow: ["../../../"],
    },
  },
});
