// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // 部署后如实际域名不同，回来改成真实 URL（RSS 必需）
  site: 'https://knowledge-journal.vercel.app',
  vite: {
    plugins: [tailwindcss()],
  },
});
