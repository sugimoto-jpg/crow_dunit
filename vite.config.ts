import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 相対パスで出力し、どこに置いても（サブパス配信でも）画像を読めるようにする
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
});
