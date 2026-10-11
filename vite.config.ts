import { stripUnusedRouterFramework } from "./scripts/strip-framework-loader.ts";
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';
export default defineConfig({ plugins: [stripUnusedRouterFramework(), react(), tailwindcss()], base: './', resolve: { dedupe: ['react-router', 'react-router-dom'], alias: { '@': path.resolve(import.meta.dirname, './src') } }, build: { sourcemap: false, rollupOptions: { output: { inlineDynamicImports: true } } } });
