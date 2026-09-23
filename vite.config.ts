import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // スプライトをJSに埋め込み、単一HTMLでも配布できるようにする
  build: { assetsInlineLimit: 100_000_000 },
});
