/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json';

const version = pkg.version;
const build = new Date().toISOString();

// base './' keeps asset paths relative so the build works on GitHub Pages
// (any repo name) and when opened from any static host.
export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(version), __APP_BUILD__: JSON.stringify(build) },
  plugins: [
    react(),
    {
      // lets the app ask "is there a newer version?" without guessing
      name: 'version-file',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version, build }) });
      },
    },
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
