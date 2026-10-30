import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5190,
    host: true,
    proxy: {
      "/api": {
        target: process.env.VITE_DEV_PROXY || "http://localhost:3008",
        changeOrigin: true,
      },
    },
  },
})
