import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';  // ⬅️ 要裝 react plugin

export default defineConfig({
  plugins: [react()],
  esbuild: {
    include: /\.(js|mjs|jsx|ts|tsx)$/,  // 支援這些副檔名
  }
});
