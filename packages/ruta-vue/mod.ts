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

/** @internal Symbol for providing/injecting the router instance. */
const ROUTER_SYMBOL = Symbol();
/** @internal Symbol for providing/injecting the current route. */
const ROUTE_SYMBOL = Symbol();

/**
 * Vue integration for Ruta router.
 *
 * Extends the base `Ruta` class to provide Vue-specific functionality
 * including reactive route state and Vue plugin installation.
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
	 * @internal
	 * Vue plugin installation method.
	 */
	install(app: App) {
		app.provide(ROUTER_SYMBOL, this);
		app.provide(ROUTE_SYMBOL, readonly(this.#route));
	}
}

/**
 * @internal
 * Type signature for the `useRouter` composable function.
 */
type GetRouter<T extends RutaVue = RutaVue> = () => T;

/**
 * @internal
 * Type signature for the `useRoute` composable function.
 */
type GetRoute<T extends Route = Route> = () => T;

/**
 * @internal
 * Composable to access the router instance in Vue components.
 */
const getRouter: GetRouter = () => inject(ROUTER_SYMBOL)!;

/**
 * @internal
 * Composable to access the current route in Vue components.
 */
const getRoute: GetRoute = () => inject(ROUTE_SYMBOL)!;

/**
 * @internal
 * A helper function that re-exports the APIs which require type
 * augmentation during development.
 *
 * In production, vite-plugin-ruta simply re-exports all APIs to reduce
 * bundle size.
 */
export function getTypedAPI<
	TRouter extends RutaVue,
	TLayoutRoute extends Route,
	TPageRoute extends Route,
>() {
	return {
		..._getTypedAPI<TRouter, TLayoutRoute, TPageRoute>(),
		useRouter: getRouter as GetRouter<TRouter>,
		usePageRoute: getRoute as GetRoute<TPageRoute>,
		useLayoutRoute: getRoute as GetRoute<TLayoutRoute>,
	};
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

const MatchedRoutes: DefineComponent = defineComponent({
	name: 'MatchedRoutes',
	setup(_, { slots }) {
		const route = getRoute();

		const render = (index: number): VNode | VNode[] | null => {
			if (index >= route.comps.length) {
				return slots.default?.() ?? null;
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
