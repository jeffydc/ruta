/**
 * ruta-svelte entrypoint.
 * @module
 */

import type { Route, RutaOptions } from '@jeffydc/ruta-core';
import { Ruta, createEmptyRoute, getTypedAPI as _getTypedAPI, warn } from '@jeffydc/ruta-core';
import { getContext, setContext } from 'svelte';

export * from '@jeffydc/ruta-core';
export type { GetRoute, GetRouter };
export {
	RutaSvelte,
	getRoute as getPageRoute,
	getRoute as getLayoutRoute,
	getRoute as usePageRoute,
	getRoute as useLayoutRoute,
	getRouter,
	getRouter as useRouter,
};

/**
 * Symbol for setting/getting the router instance from context.
 *
 * @internal
 */
const ROUTER_SYMBOL = Symbol();

/**
 * Symbol for setting/getting the current route from context.
 *
 * @internal
 */
const ROUTE_SYMBOL = Symbol();

/**
 * Svelte integration for Ruta router.
 *
 * Extends the base `Ruta` class to provide Svelte-specific functionality including
 * reactive route state and Svelte context-based installation.
 *
 * @public
 */
class RutaSvelte<TRoutes extends Record<string, any> = Record<string, any>> extends Ruta<TRoutes> {
	#route: Route = $state(createEmptyRoute());

	constructor(options: RutaOptions<TRoutes>) {
		super(options);

		this.after(({ to }) => {
			this.#route = to as Route;
		});
	}

	/**
	 * Install the router into Svelte context.
	 *
	 * Sets the router and route in Svelte context.
	 *
	 * Must be called during component initialization (e.g., in a root layout).
	 */
	install() {
		setContext(ROUTER_SYMBOL, this);
		setContext(ROUTE_SYMBOL, readonly(this.#route));
	}
}

/**
 * Type signature for the `getRouter` function.
 *
 * @internal
 */
type GetRouter<T extends RutaSvelte = RutaSvelte> = () => T;

/**
 * Type signature for the `getRoute` function.
 *
 * @internal
 */
type GetRoute<T extends Route = Route> = () => T;

/**
 * Get the router instance from Svelte context.
 *
 * @internal
 */
const getRouter: GetRouter = () => getContext(ROUTER_SYMBOL);

/**
 * Get the current route from Svelte context.
 *
 * @internal
 */
const getRoute: GetRoute = () => getContext(ROUTE_SYMBOL);

function readonly<T extends object>(target: T): Readonly<T> {
	return new Proxy(target, {
		set() {
			warn('route is readonly.');
			return true;
		},
		deleteProperty() {
			warn('route is readonly.');
			return true;
		},
	});
}

/**
 * A helper function that re-exports the APIs which require type augmentation
 * during development.
 *
 * In production, `vite-plugin-ruta` simply re-exports all APIs to reduce
 * bundle size.
 *
 * @internal
 */
export function getTypedAPI<
	TRouter extends RutaSvelte,
	TLayoutRoute extends Route,
	TPageRoute extends Route,
>(): ReturnType<typeof _getTypedAPI<TRouter, TLayoutRoute, TLayoutRoute>> & {
	useRouter: GetRouter<TRouter>;
	usePageRoute: GetRoute<TPageRoute>;
	useLayoutRoute: GetRoute<TLayoutRoute>;
} {
	return {
		..._getTypedAPI(),
		useRouter: getRouter,
		usePageRoute: getRoute,
		useLayoutRoute: getRoute,
	} as any;
}
