
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// DŮLEŽITÉ: 'base' musí odpovídat názvu tvého repozitáře na GitHubu.
// Pokud se repozitář jmenuje jinak než 'novy-start-app', změň to zde (např. base: '/muj-planovac/').
export default defineConfig({
  plugins: [react()],
  base: '/novy-start-app/', 
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});
