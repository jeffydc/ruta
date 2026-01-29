import { ruta as _ruta } from '@jeffydc/ruta-core/vite';
import type { VitePluginRutaOptions as _VitePluginRutaOptions } from '@jeffydc/ruta-core/vite';
import type { Plugin } from 'vite';

import pkg from './deno.json' with { type: 'json' };

/**
 * Options of vite-plugin-ruta.
 */
export type VitePluginRutaOptions = Omit<_VitePluginRutaOptions, 'framework'>;

/**
 * The vite-plugin-ruta.
 * @param rawOptions Options for vite-plugin-ruta
 * @returns A Vite plugin that integrates Ruta with Vite
 */
export function ruta(options?: VitePluginRutaOptions): Plugin {
	return _ruta({ ...options, framework: 'vue', pkg: pkg.name });
}
