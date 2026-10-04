import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * The dev server binds to loopback by default. The previous `host: "0.0.0.0"`
 * exposed the dev bundle to the whole local network, which is not something a
 * development machine should do by default.
 *
 * /api is proxied to the main backend, which is what the browser app now calls.
 * Food Scanner is no longer reachable from the browser at all: it is internal
 * only and authenticates every /v1 request with a shared secret.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_DEV_API_TARGET || "http://127.0.0.1:8080",
        changeOrigin: true,
      },
    },
  },
});
