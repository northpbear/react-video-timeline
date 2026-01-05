import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  // resolve: {
  //   alias: {
  //     // 直接引用源码，方便调试（pnpm workspace 会链接到 packages/react-video-timeline）
  //     'react-video-timeline': path.resolve(__dirname, '../../packages/react-video-timeline'),
  //   },
  // },
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
