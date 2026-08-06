import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5199, host: true },
  // Pas de sous-dossier "assets/" : tout est à plat à la racine du build, pour qu'un
  // dépôt manuel (glisser-déposer, sélection de fichiers) ne puisse pas oublier un dossier.
  build: { assetsDir: "" },
});
