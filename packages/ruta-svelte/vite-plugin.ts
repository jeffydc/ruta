import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ruta as _ruta } from '@jeffydc/ruta-core/vite';
import type { VitePluginRutaOptions as _VitePluginRutaOptions } from '@jeffydc/ruta-core/vite';
import type { Plugin } from 'vite';

import pkg from './deno.json' with { type: 'json' };

/**
 * Options of vite-plugin-ruta.
 *
 * @public
 */
export type VitePluginRutaOptions = Omit<_VitePluginRutaOptions, 'framework'>;

const __filename = fileURLToPath(import.meta.url);
fs.writeFile(
	path.resolve(__filename, '../components.ts'),
	`
export { default as MatchedRoutes } from "./MatchedRoutes.svelte";
`.trim(),
);

/**
 * The vite-plugin-ruta.
 * @param rawOptions Options for vite-plugin-ruta
 * @returns A Vite plugin that integrates Ruta with Vite
 *
 * @public
 */
export function ruta(options?: VitePluginRutaOptions): Plugin {
	return _ruta({ ...options, framework: 'svelte', pkg: pkg.name });
}
