/**
 * ruta-vue entrypoint.
 * @module
 */

import type { Route, RutaOptions } from '@jeffydc/ruta-core';
import { Ruta, createEmptyRoute, getTypedAPI as _getTypedAPI } from '@jeffydc/ruta-core';
import type { App, DefineComponent, VNode } from 'vue';
import { defineComponent, h, inject, markRaw, readonly, shallowReactive } from 'vue';

export * from '@jeffydc/ruta-core';
export type { GetRoute, GetRouter };
export {
	RutaVue,
	MatchedRoutes,
	getRoute as getPageRoute,
	getRoute as getLayoutRoute,
	getRoute as usePageRoute,
	getRoute as useLayoutRoute,
	getRouter,
	getRouter as useRouter,
};

/**
 * Symbol for providing/injecting the router instance.
 *
 * @internal
 */
const ROUTER_SYMBOL = Symbol();

/**
 * Symbol for providing/injecting the current route.
 *
 * @internal
 */
const ROUTE_SYMBOL = Symbol();

/**
 * Vue integration for Ruta router.
 *
 * Extends the base `Ruta` class to provide Vue-specific functionality
 * including reactive route state and Vue plugin installation.
 *
 * @public
 */
class RutaVue<TRoutes extends Record<string, any> = Record<string, any>> extends Ruta<TRoutes> {
	#route = shallowReactive<Route>(createEmptyRoute());

	constructor(options: RutaOptions<TRoutes>) {
		super(options);

		this.after(({ to }) => {
			for (const key in to) {
				// @ts-expect-error cannot index ShallowReactive.
				this.#route[key] = key === 'comps' ? markRaw(to[key]) : to[key];
			}
		});
	}

	/**
	 * Vue plugin installation method.
	 *
	 * @internal
	 */
	install(app: App) {
		app.provide(ROUTER_SYMBOL, this);
		app.provide(ROUTE_SYMBOL, readonly(this.#route));
	}
}

/**
 * Type signature for the `useRouter` composable function.
 *
 * @internal
 */
type GetRouter<T extends RutaVue = RutaVue> = () => T;

/**
 * Type signature for the `useRoute` composable function.
 *
 * @internal
 */
type GetRoute<T extends Route = Route> = () => T;

/**
 * Composable to access the router instance in Vue components.
 *
 * @internal
 */
const getRouter: GetRouter = () => inject(ROUTER_SYMBOL)!;

/**
 * Composable to access the current route in Vue components.
 *
 * @internal
 */
const getRoute: GetRoute = () => inject(ROUTE_SYMBOL)!;

/**
 * A helper function that re-exports the APIs which require type
 * augmentation during development.
 *
 * In production, `vite-plugin-ruta` simply re-exports all APIs to reduce
 * bundle size.
 *
 * @internal
 */
export function getTypedAPI<
	TRouter extends RutaVue,
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

const RethrowError = defineComponent({
	name: 'RethrowError',
	setup() {
		const route = getRoute();
		return () => {
			throw route.error;
		};
	},
});

/**
 * A Vue component that renders the respective components of the matched route.
 *
 * Think of it like `RouterView`, but it will render all components recursively
 * so only need to use once.
 *
 * ```vue
 * <!-- App.vue -->
 * <template>
 *   <MatchedRoutes />
 * </template>
 * ```
 *
 * @public
 */
const MatchedRoutes: DefineComponent = defineComponent({
	name: 'MatchedRoutes',
	setup() {
		const route = getRoute();

		const render = (index: number): VNode | VNode[] | null => {
			if (index >= route.comps.length) {
				return null;
			}
			if (route.errorIndex != null && route.errorIndex > -1 && route.errorIndex * 2 + 1 === index) {
				return h(RethrowError);
			}
			const current = route.comps[index];
			if (!current) {
				return render(index + 1);
			}
			return h(current, { key: index }, () => render(index + 1));
		};

		return () => render(0);
	},
});
