// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // 大陆直连域名（vercel.app 被墙，自有域名 CNAME 后可直连）
  site: 'https://journal.fanyihong.work',
  vite: {
    plugins: [tailwindcss()],
  },
});
