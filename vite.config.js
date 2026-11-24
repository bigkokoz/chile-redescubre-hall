import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// HTTPS (certificado autofirmado) para que el navegador del Quest deje usar WebXR desde la red local.
// En el PC, `localhost` ya es contexto seguro: con NO_SSL=1 se sirve en http plano (más simple para pruebas).
const useSsl = !process.env.NO_SSL;

export default defineConfig({
  base: './', // rutas relativas: funciona igual en GitHub Pages
  plugins: useSsl ? [basicSsl()] : [],
  server: { host: true, port: 5173 },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
});
