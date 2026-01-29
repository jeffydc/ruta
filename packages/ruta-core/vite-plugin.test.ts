import type { VitePluginRutaOptions } from './vite-plugin.ts';
import { test, expect } from 'vitest';

import { VPR } from './vite-plugin.ts';

function makeOptions(options?: VitePluginRutaOptions) {
	return {
		framework: 'vue',
		routerModule: './src/router.ts',
		routeDir: './src/routes',
		pkg: '@jeffydc/ruta-core',
		...options,
	} satisfies VitePluginRutaOptions;
}

test('writeRoute should write empty', () => {
	const vpr = new VPR(makeOptions());
	const code = vpr.writeRoute({ dir: '' }, false);

	expect(code).toBe('');
});

test('writeRoute should write root route', () => {
	const vpr = new VPR(makeOptions());
	const code = vpr.writeRoute(
		{
			dir: vpr.routeDir,
			configFile: vpr.routeDir + '/+route.config.ts',
		},
		false,
	);

	expect(code).toMatchInlineSnapshot(`
		"import type * as $ from "@jeffydc/ruta-core";
		import { route as current } from "./../../../src/routes/+route.config.ts";
		export declare const getPageRoute: $.GetRoute<typeof current["~page"]>;
		export declare const usePageRoute: $.GetRoute<typeof current["~page"]>;
		export declare const getLayoutRoute: $.GetRoute<typeof current["~layout"]>;
		export declare const useLayoutRoute: $.GetRoute<typeof current["~layout"]>;
		export declare const getRouter: $.GetRouter<import("./../../../src/router.ts").Router>;
		export declare const useRouter: $.GetRouter<import("./../../../src/router.ts").Router>;
		export { getPageRoute, usePageRoute } from "@jeffydc/ruta-core";
		export { getLayoutRoute, useLayoutRoute } from "@jeffydc/ruta-core";
		export { getRouter, useRouter } from "@jeffydc/ruta-core";
		"
	`);
});

test('writeRoute should write export parent route', () => {
	const vpr = new VPR(makeOptions());
	const code = vpr.writeRoute(
		{
			dir: vpr.routeDir + '/no-layout',
			configFile: vpr.routeDir + '/no-layout/+route.config.ts',
		},
		false,
	);

	expect(code).toMatchInlineSnapshot(`
		"import type * as $ from "@jeffydc/ruta-core";
		import { route as current } from "./../../../../src/routes/no-layout/+route.config.ts";
		export { route as parentRoute } from "./../../../../src/routes/+route.config.ts";
		export declare const getPageRoute: $.GetRoute<typeof current["~page"]>;
		export declare const usePageRoute: $.GetRoute<typeof current["~page"]>;
		export declare const getLayoutRoute: $.GetRoute<typeof current["~layout"]>;
		export declare const useLayoutRoute: $.GetRoute<typeof current["~layout"]>;
		export declare const getRouter: $.GetRouter<import("./../../../../src/router.ts").Router>;
		export declare const useRouter: $.GetRouter<import("./../../../../src/router.ts").Router>;
		export { getPageRoute, usePageRoute } from "@jeffydc/ruta-core";
		export { getLayoutRoute, useLayoutRoute } from "@jeffydc/ruta-core";
		export { getRouter, useRouter } from "@jeffydc/ruta-core";
		"
	`);
});

test('writeRoutes should write empty routes {}', () => {
	const vpr = new VPR(makeOptions());
	const code = vpr.writeRoutes(false);

	expect(code).toMatchInlineSnapshot(`
		"

		export const routes = {};
		"
	`);
});

test('writeRoutes should write happily', () => {
	const vpr = new VPR(makeOptions());
	vpr.routeDirMap.set(vpr.routeDir, {
		dir: vpr.routeDir,
		configFile: vpr.routeDir + '/+route.config.ts',
		layoutFile: vpr.routeDir + '/+layout.ts',
		pageFile: vpr.routeDir + '/+page.ts',
		errorFile: vpr.routeDir + '/+error.ts',
	});
	vpr.routeDirMap.set(vpr.routeDir + '/no-error', {
		dir: vpr.routeDir + '/no-error',
		configFile: vpr.routeDir + '/no-error/+route.config.ts',
		layoutFile: vpr.routeDir + '/no-error/+layout.ts',
		pageFile: vpr.routeDir + '/no-error/+page.ts',
	});
	vpr.routeDirMap.set(vpr.routeDir + '/no-layout', {
		dir: vpr.routeDir + '/no-layout',
		configFile: vpr.routeDir + '/no-layout/+route.config.ts',
		pageFile: vpr.routeDir + '/no-layout/+page.ts',
		errorFile: vpr.routeDir + '/no-layout/+error.ts',
	});
	vpr.routeDirMap.set(vpr.routeDir + '/no-page', {
		dir: vpr.routeDir + '/no-page',
		configFile: vpr.routeDir + '/no-page/+route.config.ts',
		layoutFile: vpr.routeDir + '/no-page/+layout.ts',
		errorFile: vpr.routeDir + '/no-page/+error.ts',
	});
	vpr.routeDirMap.set(vpr.routeDir + '/no-config', {
		dir: vpr.routeDir + '/no-config',
		layoutFile: vpr.routeDir + '/no-config/+layout.ts',
		pageFile: vpr.routeDir + '/no-config/+page.ts',
		errorFile: vpr.routeDir + '/no-config/+error.ts',
	});

	const code = vpr.writeRoutes(false);

	expect(code).toMatchInlineSnapshot(`
		"import { route as route_0 } from "./../../src/routes/+route.config.ts";
		import { default as comp_err_0 } from "./../../src/routes/+error.ts";
		import { route as route_1 } from "./../../src/routes/no-error/+route.config.ts";
		import { route as route_2 } from "./../../src/routes/no-layout/+route.config.ts";
		import { default as comp_err_2 } from "./../../src/routes/no-layout/+error.ts";

		route_0.comps = [comp_err_0, () => import("./../../src/routes/+layout.ts"), comp_err_0, () => import("./../../src/routes/+page.ts")];
		route_1.comps = [null, () => import("./../../src/routes/no-error/+layout.ts"), null, () => import("./../../src/routes/no-error/+page.ts")];
		route_2.comps = [comp_err_2, null, comp_err_2, () => import("./../../src/routes/no-layout/+page.ts")];

		export const routes = {
			[route_0.path]: route_0,
			[route_1.path]: route_1,
			[route_2.path]: route_2,
		};
		"
	`);
});

test('writeRoutes should not write child route due to missing parent route', () => {
	const vpr = new VPR(makeOptions());
	vpr.routeDirMap.set(vpr.routeDir, {
		dir: vpr.routeDir,
		configFile: vpr.routeDir + '/+route.config.ts',
		layoutFile: vpr.routeDir + '/+layout.ts',
		pageFile: vpr.routeDir + '/+page.ts',
		errorFile: vpr.routeDir + '/+error.ts',
	});
	vpr.routeDirMap.set(vpr.routeDir + '/child/grandchild', {
		dir: vpr.routeDir + '/child/grandchild',
		configFile: vpr.routeDir + '/child/grandchild/+route.config.ts',
		layoutFile: vpr.routeDir + '/child/grandchild/+layout.ts',
		pageFile: vpr.routeDir + '/child/grandchild/+page.ts',
		errorFile: vpr.routeDir + '/child/grandchild/+error.ts',
	});

	const code = vpr.writeRoutes(false);

	expect(code).toMatchInlineSnapshot(`
		"import { route as route_0 } from "./../../src/routes/+route.config.ts";
		import { default as comp_err_0 } from "./../../src/routes/+error.ts";
		import { route as route_1 } from "./../../src/routes/child/grandchild/+route.config.ts";
		import { default as comp_err_1 } from "./../../src/routes/child/grandchild/+error.ts";

		route_0.comps = [comp_err_0, () => import("./../../src/routes/+layout.ts"), comp_err_0, () => import("./../../src/routes/+page.ts")];
		route_1.comps = [comp_err_1, () => import("./../../src/routes/child/grandchild/+layout.ts"), comp_err_1, () => import("./../../src/routes/child/grandchild/+page.ts")];

		export const routes = {
			[route_0.path]: route_0,
			[route_1.path]: route_1,
		};
		"
	`);
});
