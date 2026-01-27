import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ruta as _ruta } from '@jeffydc/ruta-core/vite';
import type { VitePluginRutaOptions as _VitePluginRutaOptions } from '@jeffydc/ruta-core/vite';
import type { Plugin } from 'vite';

export type VitePluginRutaOptions = Omit<_VitePluginRutaOptions, 'framework'>;

const __filename = fileURLToPath(import.meta.url);
fs.writeFile(
	path.resolve(__filename, '../components.ts'),
	`
export { default as MatchedRoutes } from "./MatchedRoutes.svelte";
`.trim(),
);

export function ruta(options?: VitePluginRutaOptions): Plugin {
	return _ruta({ ...options, framework: 'svelte' });
}
