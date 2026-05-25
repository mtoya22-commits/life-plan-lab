import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' keeps all asset URLs relative so the built app works no matter which
// subdirectory it is published under (e.g. /lifeplan-v2/ or /app/lifeplan-v2/)
// as an independent page linked from WordPress.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
});
