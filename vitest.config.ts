import path from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],resolve:{alias:{'@':path.resolve(import.meta.dirname,'./src')}},test:{environment:'happy-dom',environmentOptions:{happyDOM:{settings:{disableJavaScriptFileLoading:true,disableCSSFileLoading:true,navigation:{disableMainFrameNavigation:true,disableChildFrameNavigation:true,disableChildPageNavigation:true}}}},globals:true,include:['tests/**/*.test.{ts,tsx}','src/**/*.test.{ts,tsx}'],setupFiles:['./tests/setup.ts']}});
