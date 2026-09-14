import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import { buildXDC, mockWebxdc } from "@webxdc/vite-plugins";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    svgr(),
    buildXDC({ outFileName: "calc.xdc" }),
    mockWebxdc(),
  ],
  build: {
    // Vite 8 defaults to `baseline-widely-available`, which resolved to
    // chrome111/safari16.4/ios16.4 here. Messenger WebViews lag well behind
    // that, and syntax they cannot parse takes down the whole bundle - a
    // blank app, with nothing rendered at all. Vite 6, which built the last
    // known-good .xdc, defaulted to this set instead.
    target: ["chrome87", "edge88", "firefox78", "safari14", "ios14"],
  },
  optimizeDeps: {
    // `@ironcalc/workbook` is a linked package we actively rebuild. We
    // do not want vite to put it in a stale cache during its optimization.
    //
    // Once we can rely on a released version of IronCalc again, this can
    // be removed.
    exclude: ["@ironcalc/workbook"],
  },
  resolve: {
    // We end up with multiple copies of these dependencies due to the
    // vendored `@ironcalc/workbook`, and React doesn't like that, so we dedupe them.
    //
    // Once we can rely on a released version of IronCalc again, this can be removed.
    dedupe: ["react", "react-dom"],
  },
});
