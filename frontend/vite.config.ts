// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});


// import { defineConfig } from "vite"
// import react from "@vitejs/plugin-react"
// import { NodeGlobalsPolyfillPlugin } from "@esbuild-plugins/node-globals-polyfill"

// // https://vite.dev/config/
// export default defineConfig({
//   plugins: [react()],
//   optimizeDeps: {
//     esbuildOptions: {
//       define: {
//         global: "globalThis", // <-- Polyfill "global"
//       },
//       plugins: [
//         NodeGlobalsPolyfillPlugin({
//           process: true,
//           buffer: true,
//         }),
//       ],
//     },
//   },
// })
