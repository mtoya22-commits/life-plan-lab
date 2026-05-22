import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// テスト用設定。コンポーネントのレンダリング確認のため jsdom 環境を使う。
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
  },
});
