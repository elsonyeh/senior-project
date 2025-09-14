import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';  // ⬅️ 要裝 react plugin

export default defineConfig({
  plugins: [react()],
  esbuild: {
    include: /\.(js|mjs|jsx|ts|tsx)$/,  // 支援這些副檔名
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Cross-Origin-Embedder-Policy': 'unsafe-none'
    }
  }
});
