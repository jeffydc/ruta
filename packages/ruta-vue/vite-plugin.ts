import { ruta as _ruta } from '@jeffydc/ruta-core/vite';
import type { VitePluginRutaOptions as _VitePluginRutaOptions } from '@jeffydc/ruta-core/vite';
import type { Plugin } from 'vite';

export type VitePluginRutaOptions = Omit<_VitePluginRutaOptions, 'framework'>;

export function ruta(options?: VitePluginRutaOptions): Plugin {
	return _ruta({ ...options, framework: 'vue' });
}
