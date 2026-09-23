import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 相対パスで出力し、どこに置いても（サブパス配信でも）画像を読めるようにする
  base: './',
});
