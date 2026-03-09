import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (id.includes("/node_modules/three/examples/")) {
            return "three-examples";
          }
          if (id.includes("/node_modules/three/")) {
            return "three-core";
          }
          if (id.includes("@react-three/fiber")) {
            return "three-fiber";
          }
          if (id.includes("@react-three/drei")) {
            return "three-drei";
          }
          if (id.includes("leaflet") || id.includes("react-leaflet")) {
            return "maps-vendor";
          }
          if (id.includes("recharts")) {
            return "charts-vendor";
          }
          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/") ||
            id.includes("/node_modules/scheduler/")
          ) {
            return "react-vendor";
          }

          return "vendor";
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
