import type { Route, RutaOptions } from '@jeffydc/ruta-core';
import { Ruta, createEmptyRoute, warn } from '@jeffydc/ruta-core';
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

/** @internal Symbol for setting/getting the router instance from context. */
const ROUTER_SYMBOL = Symbol();
/** @internal Symbol for setting/getting the current route from context. */
const ROUTE_SYMBOL = Symbol();

/**
 * Svelte integration for Ruta router.
 *
 * Extends the base `Ruta` class to provide Svelte-specific functionality including
 * reactive route state and Svelte context-based installation.
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
 * @internal
 * Type signature for the `getRouter` function.
 */
type GetRouter<T extends RutaSvelte = RutaSvelte> = () => T;

/**
 * @internal
 * Type signature for the `getRoute` function.
 */
type GetRoute<T extends Route = Route> = () => T;

/**
 * @internal
 * Get the router instance from Svelte context.
 */
const getRouter: GetRouter = () => getContext(ROUTER_SYMBOL);

/**
 * @internal
 * Get the current route from Svelte context.
 */
const getRoute: GetRoute = () => getContext(ROUTE_SYMBOL);

function readonly<T extends object>(target: T): Readonly<T> {
	return new Proxy(target, {
		set() {
			warn('Route is readonly');
			return true;
		},
		deleteProperty() {
			warn('Route is readonly');
			return true;
		},
	});
}
