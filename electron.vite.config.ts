import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { applyCsp, CSP_DEV, CSP_PROD } from './src/shared/csp';

/**
 * Write the Content-Security-Policy into the page.
 *
 * The source HTML already carries the strict production policy, so serving the
 * raw file is always safe. This plugin rewrites it to the development policy
 * while the dev server runs, and re-writes the production policy on build so
 * the shipped file always comes from one place.
 */
function cspPlugin(): Plugin {
  let dev = false;

  return {
    name: 'mochi-csp',
    configResolved(config) {
      dev = config.command === 'serve';
    },
    transformIndexHtml(html) {
      return applyCsp(html, dev ? CSP_DEV : CSP_PROD);
    },
  };
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [react(), cspPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') },
      },
    },
  },
});
