import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    plugins: [react()],

    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },

    // Pre-bundle heavy deps so the dev server starts faster
    optimizeDeps: {
        include: [
            'react',
            'react-dom',
            'framer-motion',
            'lucide-react',
            'axios',
            'sonner',
            'clsx',
            'tailwind-merge',
            'class-variance-authority',
        ],
    },

    build: {
        // Split vendor chunks so the browser can cache them separately
        rollupOptions: {
            output: {
                manualChunks: {
                    'react-vendor': ['react', 'react-dom'],
                    'motion-vendor': ['framer-motion'],
                    'icons-vendor': ['lucide-react'],
                    'radix-vendor': [
                        '@radix-ui/react-slot',
                        '@radix-ui/react-dialog',
                        '@radix-ui/react-tabs',
                        '@radix-ui/react-avatar',
                        '@radix-ui/react-tooltip',
                        '@radix-ui/react-dropdown-menu',
                        '@radix-ui/react-select',
                        '@radix-ui/react-switch',
                        '@radix-ui/react-separator',
                    ],
                    'ui-vendor': ['class-variance-authority', 'clsx', 'tailwind-merge', 'sonner'],
                },
            },
        },
        // Warn threshold for individual chunks
        chunkSizeWarningLimit: 600,
    },
});
