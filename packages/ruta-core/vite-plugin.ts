/**
 * The `vite-plugin-ruta`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as tty from 'node:tty';

import * as clack from '@clack/prompts';
import { normalizePath } from 'vite';
import type { Plugin } from 'vite';

const PLUGIN_NAME = 'vite-plugin-ruta';

/**
 * Options of vite-plugin-ruta.
 *
 * @public
 */
export type VitePluginRutaOptions = {
	/**
	 * Framework integration.
	 */
	framework: 'vue' | 'svelte';

	/**
	 * Framework integration package.
	 */
	pkg: string;

	/**
	 * The path to the router module.
	 * Resolved relative to the Vite `root` config.
	 * @default './src/router.ts'
	 */
	routerModule?: string;

	/**
	 * The directory where the routes are located.
	 * Resolved relative to the Vite `root` config.
	 * @default './src/routes'
	 */
	routeDir?: string;
};

type RouteDirData = {
	dir: string;
	configFile?: string;
	errorFile?: string;
	layoutFile?: string;
	pageFile?: string;
};

const routePrefix = '+';
const routeGenFile = `+route.gen.ts`;

/**
 * The vite-plugin-ruta.
 * @param rawOptions Options for vite-plugin-ruta
 * @returns A Vite plugin that integrates Ruta with Vite
 *
 * @public
 */
export function ruta(rawOptions: VitePluginRutaOptions): Plugin {
	const vpr = new VPR({
		routeDir: './src/routes',
		routerModule: './src/router.ts',
		...rawOptions,
	});

	return {
		name: PLUGIN_NAME,
		enforce: 'pre',

		config(config, { command }) {
			vpr.root = config.root || process.cwd();
			vpr.isBuild = command === 'build';

			return {
				resolve: {
					alias: [
						{
							find: /(\.\/\+route\.gen.*)/,
							replacement: '$1',
							customResolver(source, importer) {
								if (!importer) return;
								if (source.endsWith('.js')) source = source.slice(0, -3);
								if (!source.endsWith('.ts')) source += '.ts';
								return path.resolve(vpr.normalizeGenDir(path.dirname(importer)), source);
							},
						},
						{ find: /^\.\/\+routes\.gen.*/, replacement: vpr.routesGenFile },
					],
				},
			};
		},

		buildStart() {
			vpr.init();
		},

		configureServer(server) {
			const debounceWriteAll = debounce(vpr.writeAll);
			server.watcher.on('add', (file) => {
				if (!file.startsWith(vpr.routeDir)) return;

				const dir = path.dirname(file);
				const routeDirData = vpr.routeDirMap.get(dir) || {
					dir: dir,
				};
				if (vpr.isRouteConfigFile(file)) {
					routeDirData.configFile = file;
				} //
				else if (vpr.isRouteErrorFile(file)) {
					routeDirData.errorFile = file;
				} //
				else if (vpr.isRouteLayoutFile(file)) {
					routeDirData.layoutFile = file;
				} //
				else if (vpr.isRoutePageFile(file)) {
					routeDirData.pageFile = file;
				}
				vpr.routeDirMap.set(dir, routeDirData);
				debounceWriteAll();
			});

			server.watcher.on('unlink', (file) => {
				if (!file.startsWith(vpr.routeDir)) return;

				const routeDirData = vpr.routeDirMap.get(path.dirname(file));
				if (routeDirData) {
					if (vpr.isRouteConfigFile(file)) {
						routeDirData.configFile = undefined;
					} //
					else if (vpr.isRouteErrorFile(file)) {
						routeDirData.errorFile = undefined;
					} //
					else if (vpr.isRouteLayoutFile(file)) {
						routeDirData.layoutFile = undefined;
					} //
					else if (vpr.isRoutePageFile(file)) {
						routeDirData.pageFile = undefined;
					}
					debounceWriteAll();
				}
			});

			const dirs: string[] = [];
			const rmDirs = debounce(() => {
				dirs.forEach((dir) => {
					fs.rmSync(vpr.normalizeGenDir(dir), {
						force: true,
						recursive: true,
					});
				});
				debounceWriteAll();
			});
			server.watcher.on('unlinkDir', (dir) => {
				if (vpr.routeDirMap.delete(dir)) {
					dirs.push(dir);
					rmDirs();
				}
			});

			// ruta shortcuts
			server.bindCLIShortcuts({
				customShortcuts: [
					{
						key: 'ruta+',
						description: `generate route(s) (${PLUGIN_NAME})`,
						async action() {
							await shortcutAddAction(vpr);
						},
					},
					{
						key: 'ruta',
						description: `list all routes (${PLUGIN_NAME})`,
						action() {
							clack.note(Array.from(vpr.routeDirMap.keys()).join('\n'), 'All routes:');
						},
					},
					{
						key: 'ruta-',
						description: `remove route(s) (${PLUGIN_NAME})`,
						async action() {
							await shortcutRemoveAction(vpr);
						},
					},
				],
			});
		},
	};
}

/** @private */
export class VPR {
	#contents = new Map<string, string>();
	readonly routeDirMap: Map<string, RouteDirData> = new Map<string, RouteDirData>();

	framework: VitePluginRutaOptions['framework'];
	routerModule: string;
	routeDir: string;
	dotRuta = '.ruta';
	pkg = 'ruta-core';
	#root = process.cwd();
	srcDir = '';
	routesGenFile: string = `+routes.gen.ts`;
	routeErrorFile = '+error.js';
	routeLayoutFile = '+layout.js';
	routePageFile = '+page.js';
	isBuild = false;

	/** @private */
	constructor(options: Required<VitePluginRutaOptions>) {
		this.framework = options.framework;
		this.routerModule = options.routerModule;
		this.routeDir = options.routeDir;
		this.pkg = options.pkg;
		this.routeErrorFile = `error.${options.framework}`;
		this.routeLayoutFile = `layout.${options.framework}`;
		this.routePageFile = `page.${options.framework}`;
		this.root = process.cwd();
	}

	/** @private */
	get root(): string {
		return this.#root;
	}

	/** @private */
	set root(root: string) {
		this.#root = root;
		this.dotRuta = path.resolve(root, this.dotRuta);
		this.routeDir = path.resolve(root, this.routeDir);
		this.routerModule = path.resolve(root, this.routerModule);
		this.srcDir = this.normalizeGenDir(`${this.routerModule}/../`);
		this.routesGenFile = path.resolve(this.srcDir, this.routesGenFile);
	}

	/** @private */
	init() {
		mkdirp(this.routeDir);
		fs.rmSync(this.dotRuta, { force: true, recursive: true });
		this.writeDefaults();
		this.visitRouteDir(this.routeDir);
		this.writeRoutes(true);
	}

	/** @private */
	visitRouteDir(dir: string) {
		const entries = fs.readdirSync(dir, {
			encoding: 'utf8',
			withFileTypes: true,
		});

		const subDirs: Array<fs.Dirent<string>> = [];
		const routeDirData: RouteDirData = { dir: '' };
		for (const entry of entries) {
			if (entry.isFile()) {
				if (!entry.name.startsWith(routePrefix)) continue;

				if (this.isRouteConfigFile(entry.name)) {
					routeDirData.configFile = path.resolve(entry.parentPath, entry.name);
				} //
				else if (this.isRouteErrorFile(entry.name)) {
					routeDirData.errorFile = path.resolve(entry.parentPath, entry.name);
				} //
				else if (this.isRouteLayoutFile(entry.name)) {
					routeDirData.layoutFile = path.resolve(entry.parentPath, entry.name);
				} //
				else if (this.isRoutePageFile(entry.name)) {
					routeDirData.pageFile = path.resolve(entry.parentPath, entry.name);
				}
			} //
			else if (entry.isDirectory()) {
				subDirs.push(entry);
			}
		}

		routeDirData.dir = dir;
		this.routeDirMap.set(dir, routeDirData);
		this.writeRoute(routeDirData, true);

		for (const subDir of subDirs) {
			this.visitRouteDir(path.join(dir, subDir.name));
		}
	}

	/** @private */
	normalizeGenDir(dir: string): string {
		return path.resolve(this.dotRuta, path.relative(this.#root, dir));
	}

	/** @private */
	writeDefaults() {
		const tsconfig = {
			compilerOptions: {
				allowImportingTsExtensions: true,
				module: 'esnext',
				moduleResolution: 'bundler',
				noEmit: true,
				rootDirs: ['../', './'],
			},
			include: ['./**/*.ts'],
		};
		this.writeIfChanged(`${this.dotRuta}/.gitignore`, '*\n');
		this.writeIfChanged(`${this.dotRuta}/tsconfig.json`, JSON.stringify(tsconfig, null, '\t'));
	}

	/** @private */
	writeAll = (): void => {
		for (const routeDirData of this.routeDirMap.values()) {
			this.writeRoute(routeDirData, true);
		}
		this.writeRoutes(true);
	};

	/** @private */
	writeRoute(routeDirData: RouteDirData, write: boolean): string {
		const { configFile } = routeDirData;
		if (!configFile) return '';

		const routeDir = path.dirname(configFile);
		const isRoot = routeDir === this.routeDir;
		const genDir = this.normalizeGenDir(routeDir);

		const current = relImportPath(genDir, configFile);
		const parent = relImportPath(
			genDir,
			path.resolve(configFile, '../..', path.basename(configFile)),
		);
		const routerModule = relImportPath(genDir, this.routerModule);

		const codes = [
			`import * as $ from "${this.pkg}";`,
			`import { route as current } from "${current}";`,
		];

		if (!isRoot) {
			codes.push(`export { route as parentRoute } from "${parent}";`);
		}

		if (this.isBuild) {
			codes.push(`export { $ as RouteTyped };`);
		} //
		else {
			codes.push(
				`type Router = import("${routerModule}").Router;`,
				`type Layout = typeof current["~layout"];`,
				`type Page = typeof current["~page"];`,
				`export const RouteTyped = $.getTypedAPI<Router, Layout, Page>();`,
			);
		}

		const codeStr = codes.join('\n') + '\n';
		if (write) {
			this.writeIfChanged(`${genDir}/${routeGenFile}`, codeStr);
		}
		return codeStr;
	}

	/** @private */
	writeRoutes(write: boolean): string {
		const codes = [];

		const importDecls = [];
		const routeMapping = [];
		const compAssignments = [''];

		let importIndex = 0;
		for (const [_, routeDirData] of this.routeDirMap) {
			const { configFile, errorFile, layoutFile, pageFile } = routeDirData;
			if (!configFile || !pageFile) continue;

			const routeId = `route_${importIndex}`;
			const compErrId = `comp_err_${importIndex}`;

			const layoutFileImportStr = layoutFile
				? `() => import("${relImportPath(this.srcDir, layoutFile)}")`
				: 'null';
			const pageFileImportStr = `() => import("${relImportPath(this.srcDir, pageFile)}")`;

			importDecls.push(
				`import { route as ${routeId} } from "${relImportPath(this.srcDir, configFile)}";`,
			);

			let compStr;
			if (errorFile) {
				importDecls.push(
					`import { default as ${compErrId} } from "${relImportPath(this.srcDir, errorFile)}";`,
				);
				compStr = `[${compErrId}, ${layoutFileImportStr}, ${compErrId}, ${pageFileImportStr}]`;
			} else {
				compStr = `[null, ${layoutFileImportStr}, null, ${pageFileImportStr}]`;
			}

			compAssignments.push(`${routeId}.comps = ${compStr};`);
			routeMapping.push(`[${routeId}.path]: ${routeId}`);
			importIndex++;
		}

		let routeStr = routeMapping.join(',\n\t');
		if (routeStr) {
			routeStr = '\n\t' + routeStr + ',\n';
		}
		codes.push(...importDecls, ...compAssignments, '', `export const routes = {${routeStr}};`);

		const codeStr = codes.join('\n') + '\n';
		if (write) {
			this.writeIfChanged(this.routesGenFile, codeStr);
		}
		return codeStr;
	}

	/** @private */
	writeIfChanged(file: string, code: string) {
		if (code !== this.#contents.get(file)) {
			this.write(file, code);
		}
	}

	/** @private */
	write(file: string, code: string) {
		file = path.resolve(file);
		this.#contents.set(file, code);
		mkdirp(path.dirname(file));
		fs.writeFileSync(file, code);
	}

	/** @private */
	isRouteConfigFile(file: string): boolean {
		file = path.basename(file);
		return (
			file.startsWith(routePrefix) && (file.endsWith('config.ts') || file.endsWith('config.js'))
		);
	}

	/** @private */
	isRouteErrorFile(file: string): boolean {
		file = path.basename(file);
		return file.startsWith(routePrefix) && file.endsWith(this.routeErrorFile);
	}

	/** @private */
	isRouteLayoutFile(file: string): boolean {
		file = path.basename(file);
		return file.startsWith(routePrefix) && file.endsWith(this.routeLayoutFile);
	}

	/** @private */
	isRoutePageFile(file: string): boolean {
		file = path.basename(file);
		return file.startsWith(routePrefix) && file.endsWith(this.routePageFile);
	}
}

function mkdirp(dir: string) {
	if (fs.existsSync(dir)) {
		if (fs.statSync(dir).isDirectory()) return;
		throw new Error(`cannot create directory ${dir}, it already exists.`);
	}
	fs.mkdirSync(dir, { recursive: true });
}

function debounce(fn: (...args: any[]) => void) {
	let timeout: NodeJS.Timeout | null = null;
	return (...args: any[]) => {
		timeout && clearTimeout(timeout);
		timeout = setTimeout(() => {
			timeout = null;
			fn(...args);
		}, 100);
	};
}

function relImportPath(from: string, to: string) {
	return './' + normalizePath(path.relative(from, to));
}

async function shortcutAddAction(vpr: VPR) {
	const { input, output, cleanup } = createClackIO();

	let parentDir = await clack.autocomplete({
		input,
		output,
		message: 'Select the directory to create a route inside:',
		options: Array.from(vpr.routeDirMap.keys()).map((dir) => ({
			label: path.relative(vpr.root, dir),
			value: dir,
		})),
	});

	if (clack.isCancel(parentDir)) {
		clack.cancel('Operation cancelled');
		cleanup();
		return;
	}

	let routeDirs = await clack.text({
		input,
		output,
		message: 'Enter the path of the route directory:',
		placeholder: './user/repo/settings',
	});

	if (clack.isCancel(routeDirs)) {
		clack.cancel('Operation cancelled');
		cleanup();
		return;
	}

	for (const routeDir of routeDirs.split(path.sep)) {
		parentDir = path.resolve(parentDir, routeDir);
		if (fs.existsSync(parentDir)) {
			clack.log.warn(`Directory ${parentDir} already exists`);
			continue;
		}
		const routeName = path.basename(parentDir);
		const files = [
			`${parentDir}/${routePrefix}${routeName}-config.ts`,
			`${parentDir}/${routePrefix}${routeName}-error.${vpr.framework}`,
			`${parentDir}/${routePrefix}${routeName}-layout.${vpr.framework}`,
			`${parentDir}/${routePrefix}${routeName}-page.${vpr.framework}`,
		] as const;

		vpr.write(files[0], `export const route = createRouteBuilder().layout().page();`);
		vpr.write(files[1], '');
		vpr.write(files[2], '');
		vpr.write(files[3], '');

		clack.log.success(`Created ${path.relative(vpr.root, parentDir)} with:`);
		clack.box(files.join('\n'));
	}

	cleanup();
}

async function shortcutRemoveAction(vpr: VPR) {
	const { input, output, cleanup } = createClackIO();

	const dirs = await clack.autocompleteMultiselect({
		input,
		output,
		message: 'Select the routes to remove:',
		options: Array.from(vpr.routeDirMap.keys()).map((dir) => ({
			label: path.relative(vpr.root, dir),
			value: dir,
		})),
	});

	if (clack.isCancel(dirs)) {
		clack.cancel('Operation cancelled');
		cleanup();
		return;
	}

	clack.log.warn('Route directories to be removed:');
	clack.box(dirs.join('\n'));

	const shouldProceed = await clack.confirm({
		input,
		output,
		message: 'Are you sure you want to remove these routes?',
	});

	if (clack.isCancel(shouldProceed) || !shouldProceed) {
		clack.cancel('Operation cancelled');
		cleanup();
		return;
	}

	dirs.forEach((dir) => {
		fs.rmSync(dir, { force: true, recursive: true });
	});
	clack.log.success('Removed below route directories:');
	clack.box(dirs.join('\n'));

	cleanup();
}

function createClackIO() {
	const inputFd = fs.openSync('/dev/tty', 'r');
	const outputFd = fs.openSync('/dev/tty', 'w');
	const input = new tty.ReadStream(inputFd);
	const output = new tty.WriteStream(outputFd);

	const cleanup = () => {
		input.destroy();
		output.destroy();
	};

	return { input, output, cleanup };
}
