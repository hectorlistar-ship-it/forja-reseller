import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    build: {
        outDir: 'dist',
        sourcemap: true,
    },
    server: {
        port: 5174,
        proxy: {
            '/api': {
                target: 'https://reseller.tudominio.workers.dev',
                changeOrigin: true,
                rewrite: function (path) { return path; },
            },
        },
    },
});
