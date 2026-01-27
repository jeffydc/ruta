import { VitePluginRuta } from '@jeffydc/ruta-vue/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
	plugins: [vue(), VitePluginRuta({ routerModule: './src/main.ts' })],
});
