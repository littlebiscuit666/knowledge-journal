// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';

export default defineConfig({
  // 大陆直连域名（vercel.app 被墙，自有域名 CNAME 后可直连）
  site: 'https://journal.fanyihong.work',
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
