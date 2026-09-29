import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const path = id.replace(/\\/g, '/');
          if (path.includes('/node_modules/@supabase/')) return 'supabase-vendor';
          if (path.includes('/node_modules/react-dom/') || path.includes('/node_modules/react/') || path.includes('/node_modules/scheduler/')) return 'react-vendor';
          if (path.includes('/node_modules/iso-3166/')) return 'geo-data';
        },
      },
    },
  },
});
