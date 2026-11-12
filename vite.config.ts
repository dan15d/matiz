import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// En GitHub Pages la app vive en /<repositorio>/: el workflow pasa BASE_PATH al compilar.
export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  plugins: [react()],
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
