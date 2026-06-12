import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 8080,
    host: true,
  },
  build: {
    rollupOptions: {
      output: {
        // Peel the big EAGER vendors out of the entry chunk into separately
        // cached chunks. We only name specific libs and let Vite default-handle
        // the rest, so dynamically-imported deps (e.g. jszip) keep their own
        // on-demand chunks instead of being pulled back into a catch-all.
        manualChunks(id) {
          if (/[\\/]node_modules[\\/](gsap|framer-motion)[\\/]/.test(id))
            return "motion";
          if (id.includes("node_modules/@supabase")) return "supabase";
          if (id.includes("node_modules/@tanstack")) return "query";
          if (/[\\/]node_modules[\\/](@tiptap|prosemirror|dompurify)[\\/]/.test(id))
            return "editor"; // only reached via the lazy ProjectDetail route
          if (
            /[\\/]node_modules[\\/](react-router-dom|react-router|react-dom|react|scheduler)[\\/]/.test(
              id
            )
          )
            return "react-vendor";
        },
      },
    },
  },
});
