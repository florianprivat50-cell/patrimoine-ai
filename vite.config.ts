import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins:[react()],
  server:{port:5199,host:true},
  // Keep the existing application and add an independent, bundled mobile entry.
  build:{assetsDir:"",rollupOptions:{input:{app:"index.html",mobile:"mobile/index.html"}}},
});
