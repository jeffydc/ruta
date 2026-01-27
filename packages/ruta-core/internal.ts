import { BROWSER, DEV } from 'esm-env';

const HTTP_RE = /^https?:\/\/[^/]*/;
const MULTI_SLASH_RE = /\/{2,}/g;
const FAKE_ORIGIN = 'http://a.b';
const noop = () => {};

type Node<T = AnyRouteConfig> = {
	seg: string;
	static?: Map<string, Node<T>>;
	dyn?: Node<T>;
	data?: T;
};

/**
 * The base router class. Users are advised to use framework-specific
 * integration instead of this.
 *
 * - RutaVue for Vue.
 * - RutaSvelte for Svelte.
 */
export class Ruta<TRoutes extends Record<string, AnyRouteConfig> = Record<string, any>> {
	#ok = false;
	#base: string;
	#context: TRoutes['/']['~context'];
	#ctrller = new AbortController();
	#capturedError: any | null = null;
	#capturedIndex = -1;
	#rootNode: Node = { seg: '/' };

	#from = createEmptyRoute();
	#to = createEmptyRoute();

	#hooksBefore: Array<NavigationHook<TRoutes>> = [];
	#hooksAfter: Array<NavigationHook<TRoutes>> = [];

	constructor(options: RutaOptions<TRoutes>) {
		this.#base = normalizeBase(options.base || '/');
		this.#context = options.context || {};

		for (const [absPath, route] of Object.entries(options.routes)) {
			assert(absPath === route.path, `${absPath} should be ${route.path}, please file an issue.`);
			assert(route.comps.length === 4, `route.comps should have 4 entries, please file an issue.`);
			this.#insert(absPath, route);
		}

		this.#initBrowserListeners();
	}

	/**
	 * Get router context. Useful for injecting dependencies.
	 */
	get context(): TRoutes['/']['~context'] {
		return this.#context;
	}

	/**
	 * Navigate to a route. This is the starting point of a full navigation.
	 */
	navigate = async <TPath extends keyof TRoutes & string>(
		to?: StaticPaths<TPath> | ToOptions<TPath, TRoutes>,
	): Promise<void> => {
		if (BROWSER) {
			to = to || (location.href as StaticPaths<TPath> | ToOptions<TPath, TRoutes>);
		} //
		else {
			assert(to, `"to" argument is required in non-browser environment.`);
		}

		const href = this.href(to);
		if (BROWSER && window.navigation) {
			await window.navigation.navigate(href).finished;
		} //
		else {
			await this.#matchRoute(href);
		}

		if (!this.#ok) {
			this.#ok = true;
		}
	};

	/**
	 * Build a link string. Useful for building links.
	 */
	href = <TPath extends keyof TRoutes & string>(
		to: StaticPaths<TPath> | ToOptions<TPath, TRoutes>,
	): string => {
		const base = this.#base;
		if (typeof to === 'string') {
			return resolvePath(base, trimBase(to, base));
		}

		let { path, params, search } = to;
		if (params && Object.keys(params).length) {
			for (const [key, paramValue] of Object.entries(params)) {
				// @ts-expect-error Type 'string' is not assignable to type 'TPath'.
				path = path
					// try replacing with modifiers first
					.replace(`:${key}*`, paramValue as string)
					.replace(`:${key}+`, paramValue as string)
					.replace(`:${key}?`, paramValue as string)
					.replace(`:${key}`, paramValue as string);
			}
		}
		const hasSearch = search && Object.keys(search).length;
		return resolvePath(base, `${path}${hasSearch ? `?${new URLSearchParams(search)}` : ''}`);
	};

	/**
	 * Register a router before hook. Returns a function that removes
	 * the registered hook.
	 */
	before = (hook: NavigationHook<TRoutes>): (() => void) => {
		return this.#addHook(this.#hooksBefore, hook);
	};

	/**
	 * Register a router after hook. Returns a function that removes
	 * the registered hook.
	 */
	after = (hook: NavigationHook<TRoutes>): (() => void) => {
		return this.#addHook(this.#hooksAfter, hook);
	};

	#initBrowserListeners() {
		if (!BROWSER) return;

		window.navigation.addEventListener('navigate', (e) => {
			const { canIntercept, downloadRequest, hashChange, destination } = e;

			if (!canIntercept || downloadRequest !== null || hashChange) return;

			e.intercept({
				handler: async () => await this.#matchRoute(this.href(destination.url)),
			});
		});

		const events = ['pointerover', 'touchstart', 'pointerdown'] as const;
		let timeout: number;
		for (const event of events) {
			addEventListener(event, (e) => {
				const anchor = (e.target as HTMLElement).closest('a');
				const rutaPreload =
					anchor?.dataset.rutaPreload || document.documentElement.dataset.rutaPreload;
				if (
					!anchor ||
					anchor.hasAttribute('download') ||
					anchor.getAttribute('rel')?.includes('external') ||
					anchor.getAttribute('target')?.includes('_blank') ||
					((event === events[1] || event === events[2]) && rutaPreload !== 'tap') ||
					(event === events[0] && rutaPreload !== 'hover')
				) {
					return;
				}

				cancelIdleCallback(timeout);
				timeout = requestIdleCallback(() => this.#matchRoute(this.href(anchor.href), true), {
					timeout: 100,
				});
			});
		}
	}

	#addHook(hooks: Array<NavigationHook<TRoutes>>, hook: NavigationHook<TRoutes>) {
		if (this.#ok) {
			DEV && warn(`navigation hook should be registered before visiting a route.`);
			return noop;
		}
		hooks.push(hook);
		return () => {
			const idx = hooks.indexOf(hook);
			if (idx !== -1) hooks.splice(idx, 1);
		};
	}

	async #runHooks(hooks: Array<NavigationHook<TRoutes>>) {
		// call navigate hooks if available
		if (hooks.length) {
			const hookArgs = this.#makeHookArgs();
			const results = await Promise.all(
				hooks.map((hook) =>
					// wrap in async IIFE to catch all sync/async errors
					(async () => hook(hookArgs))(),
				),
			);
		}
	}

	#makeHookArgs() {
		return {
			to: this.#to,
			from: this.#from,
			context: this.#context,
			controller: this.#ctrller,
		};
	}

	/**
	 * Do route matching. This also calls the respective navigation hooks.
	 *
	 * @param href `/base/pathname?search#hash`
	 */
	async #matchRoute(href: string, preload = false) {
		// exit if navigating to the same URL
		if (this.#from.href === href) {
			return;
		}

		const hrefWithoutBase = resolvePath(trimBase(href, this.#base));
		const url = new URL(hrefWithoutBase, FAKE_ORIGIN);

		this.#ctrller = new AbortController();
		this.#to = createEmptyRoute();
		this.#capturedError = null;
		this.#capturedIndex = -1;

		this.#to.href = href;
		// call before navigation hooks
		await this.#runHooks(this.#hooksBefore);

		// do route matching
		const route = this.#lookup(url.pathname);
		if (!route) {
			DEV && warn(`unmatched url ${href}.`);
			return;
		}

		const { params, path, search } = route;
		this.#to.path = path;
		this.#to.params = params;
		for (const [i, fn] of search.entries()) {
			try {
				Object.assign(this.#to.search, fn?.(url.searchParams));
			} catch (error) {
				this.#capturedError = error;
				this.#capturedIndex = i;
				break;
			}
		}

		// resolve components and run load functions parallel
		await Promise.all([this.#resolveComps(route), this.#runLoads(route)]);

		this.#to.error = this.#capturedError;
		this.#to.errorIndex = this.#capturedIndex;
		// only update `from` route if not preload since it is not navigation
		if (!preload) {
			// call after navigation hooks
			await this.#runHooks(this.#hooksAfter);
			// store old route
			this.#from = {
				...this.#to,
				comps: [...this.#to.comps],
				params: { ...this.#to.params },
				search: { ...this.#to.search },
			};
		}
	}

	async #resolveComps(route: AnyMatchedRoute) {
		this.#to.comps = route.comps = await Promise.all(route.comps);
	}

	async #runLoads(route: AnyMatchedRoute) {
		const { loads } = route;
		if (!loads.length) return;
		if (this.#capturedError) return;

		const hookArgs = this.#makeHookArgs();
		// run load functions parallel
		// Promise.allSettled is used to capture the error
		const loadResults = await Promise.allSettled(
			// wrap in async IIFE to catch all sync/async errors
			loads.map((load) => (async () => load?.(hookArgs))()) || [],
		);

		for (const [i, result] of loadResults.entries()) {
			// Capture the first error and index to render an error page.
			if (result.status === 'rejected') {
				this.#capturedIndex = i;
				this.#capturedError = result.reason;
				break;
			}
		}
	}

	/**
	 * Insert a node to a Trie.
	 * @param absPath full pathname.
	 * @param data metadata to insert.
	 */
	#insert(absPath: string, data: AnyRouteConfig) {
		let node = this.#rootNode;
		const segments = absPath.split('/');
		for (const segment of segments) {
			// ignore empty string
			if (!segment) continue;
			const isDynamic = segment.includes(':');

			if (isDynamic) {
				node.dyn ??= { seg: segment };
				node = node.dyn;
			} else {
				node.static ??= new Map();
				if (!node.static.has(segment)) {
					node.static.set(segment, { seg: segment });
				}
				node = node.static.get(segment)!;
			}
		}
		// @ts-expect-error adding private property to +layout
		data.comps[1].__ruta = 1;
		// @ts-expect-error adding private property to +page
		data.comps[3].__ruta = 1;
		node.data = data;
	}

	/**
	 * Lookup a node data in a Trie.
	 * @param absPath absolute pathname
	 * @returns node if found, null otherwise.
	 */
	#lookup(absPath: string): AnyMatchedRoute | null {
		let node = this.#rootNode;
		assert(node.data, `node.data should be defined, please file an issue.`);

		const segments = absPath.split('/');
		const params = {};
		const comps: AnyMatchedRoute['comps'] = [];
		const loads = [node.data.loads[0]];
		const search = [node.data.search[0]];
		this.#queueComps(node.data, comps, 0, 2);

		for (const segment of segments) {
			// ignore empty string
			if (!segment) continue;

			const staticNode = node.static?.get(segment);
			if (staticNode) {
				node = staticNode;
				assert(node.data, `node.data should be defined, please file an issue.`);
				loads.push(node.data.loads[0]);
				search.push(node.data.search[0]);
				this.#queueComps(node.data, comps, 0, 2);
				continue;
			}

			const dynNode = this.#lookupDynamic(node, segment, params);
			if (dynNode) {
				node = dynNode;
				assert(node.data, `node.data should be defined, please file an issue.`);
				loads.push(node.data.loads[0]);
				search.push(node.data.search[0]);
				this.#queueComps(node.data, comps, 0, 2);
				continue;
			}

			return null;
		}

		// load function of +page component of this route
		loads.push(node.data.loads[1]);
		// parseSearch function of +page component of this route
		search.push(node.data.search[1]);
		// push the +error, +page components of this route
		this.#queueComps(node.data, comps, 2, 4);
		return {
			path: node.data.path,
			comps,
			loads,
			params,
			search,
		};
	}

	#lookupDynamic(node: Node, segment: string, params: AnyRecord) {
		const dynNode = node.dyn;
		if (!dynNode) return null;

		assert(dynNode.data, `dynamicNode.data should be defined, please file an issue.`);
		assert(
			dynNode.data.pattern,
			`dynamicNode.data.pattern should be defined, please file an issue.`,
		);

		const match = dynNode.data.pattern.exec({ pathname: '/' + segment });
		if (!match) return null;

		// prettier-ignore
		const { pathname: { groups } } = match;

		try {
			const filtered = Object.fromEntries(
				Object.entries(groups).filter((v): v is [string, string] => !!v[1]),
			);
			Object.assign(
				params,
				dynNode.data.parseParams ? dynNode.data.parseParams(filtered) : filtered,
			);
		} catch (e) {
			// `parseParams` function can throw error to not match the params
			return null;
		}

		return dynNode;
	}

	#queueComps(route: AnyRouteConfig, comps: AnyMatchedRoute['comps'], from: number, to: number) {
		for (let i = from; i < to; i++) {
			const comp = route.comps[i];
			// to note a function like () => import(comp) since Svelte
			// components are simply functions
			// @ts-expect-error __ruta is added in node insertion to Trie
			if (comp && comp.__ruta && typeof comp === 'function') {
				const promise = comp()
					.then((c) => {
						// replace with the resolved component
						return (route.comps[i] = c.default);
					})
					.catch((e: any) => {
						warn(`failed to load component: ${e}`);
						throw e;
					});
				// push promise to load the resolved component later
				comps.push(promise);
			} //
			else {
				// component is already resolved or null placeholder
				comps.push(comp as RouteComponent);
			}
		}
	}
}

/**
 * A route builder to build the layout view and page view of the route.
 *
 * @param parent parent route or null if creating root route
 * @param path path segment of this route
 * @returns an object with `layout`, `page` functions to create layout
 * route or page route respectively.
 */
export function createRouteBuilder<
	TParentRouteConfig extends AnyRouteConfig | null,
	TPath extends TParentRouteConfig extends AnyRouteConfig ? string : '/' = '/',
>(
	parent: TParentRouteConfig,
	path: TPath,
): {
	layout: LayoutBuilder<TParentRouteConfig, TPath>;
	page: PageBuilder<TParentRouteConfig, TPath>;
} {
	const route: Omit<AnyRouteConfig, 'comps' | '~layout' | '~page'> = {
		path: resolvePath(parent?.path ?? '', path) as any,
		loads: [], // [layout load, page load]
		search: [], // [layout search, page search]
		pattern: path.includes(':') ? new URLPattern({ pathname: '/' + path }) : null,
	};

	let hasLayout = false;
	const layout: LayoutBuilder<TParentRouteConfig, TPath> = (r) => {
		hasLayout = true;
		route.loads.push(r?.load);
		route.search.push(r?.parseSearch);
		route.parseParams = r?.parseParams;
		return { page } as any;
	};

	const page: PageBuilder<TParentRouteConfig, TPath> = (r) => {
		if (!hasLayout) {
			route.parseParams = r?.parseParams;
		}
		route.loads.push(r?.load);
		route.search.push(r?.parseSearch);
		return route as any;
	};

	return { layout, page };
}

/**
 * Create an empty route, useful for framework integration.
 */
export function createEmptyRoute(): RouteMut<string, {}, {}> {
	return {
		href: '',
		comps: [] as Array<RouteComponent>,
		params: {},
		path: '',
		search: {},
		error: null,
	};
}

/**
 * @__NO_SIDE_EFFECTS__
 * @internal
 * - Join all the paths with `/`.
 * - Ensure a leading `/` and no trailing `/`.
 */
export function resolvePath<T extends Array<string>>(...paths: T): ResolvePath<T> {
	let joined = ('/' + paths.join('/')).replace(MULTI_SLASH_RE, '/');
	if (joined.length > 1 && joined.endsWith('/')) joined = joined.slice(0, -1);
	return joined as ResolvePath<T>;
}

/**
 * @__NO_SIDE_EFFECTS__
 * @internal
 * Trim the `base` from the `path` prefix.
 */
export function trimBase(path: string, base: string) {
	path = path.replace(HTTP_RE, '');
	if (path.startsWith(base)) path = path.slice(base.length);
	return resolvePath(path);
}

/**
 * @__NO_SIDE_EFFECTS__
 * @internal
 * Use the provided `base` or get from the `href` attribute of `<base>` tag.
 */
export function normalizeBase(base: string) {
	if (BROWSER && base !== '' && !base) {
		const href = document.querySelector('base')?.getAttribute('href');
		base = href ? new URL(href).pathname : base;
	}
	return base.trim();
}

/**
 * @__NO_SIDE_EFFECTS__
 * @internal
 */
export function warn(msg: string) {
	console.warn(`[ruta warn]: ${msg}`);
}

/**
 * @__NO_SIDE_EFFECTS__
 * @internal
 */
function assert(condition: any, msg?: string | (() => string)): asserts condition {
	if (condition) return;

	if (!DEV) {
		throw new Error(`[ruta error]: assertion failed`);
	}
	throw new Error(`[ruta error]: ${typeof msg === 'function' ? msg() : msg || 'assertion failed'}`);
}

///////////////////////////////////////////// TYPES ////////////////////////////////////////////////

/**
 * @public
 * Ruta class options.
 */
export type RutaOptions<
	TRoutes extends Record<string, AnyRouteConfig> = Record<string, AnyRouteConfig>,
	_Context extends TRoutes['/']['~context'] = TRoutes['/']['~context'],
> = keyof _Context extends never
	? RutaOptionsShared<TRoutes> & {
			/**
			 * The context object that will be passed to all routes.
			 */
			context?: _Context;
		}
	: RutaOptionsShared<TRoutes> & {
			/**
			 * The context object that will be passed to all routes.
			 */
			context: _Context;
		};

type RutaOptionsShared<TRoutes> = {
	/**
	 * The base path of the application. Like <base> tag.
	 */
	base?: string;

	/**
	 * The (code generated) routes of the application.
	 */
	routes: TRoutes;
};

/**
 * @public
 * Return type of getRoute, useRoute.
 */
export type Route<
	TPath extends string = string,
	TParams extends AnyRecord = {},
	TSearch extends AnyRecord = {},
> = Readonly<RouteMut<TPath, TParams, TSearch>>;

/**
 * @internal
 * Mutable version of `Route` type, used internally to assign values.
 */
type RouteMut<TPath extends string, TParams, TSearch> = {
	/**
	 * The href URL of the route. For e.g., `/jsr/pkgs/ruta-core?q=Ruta`.
	 */
	href: string;

	/**
	 * The pathname of the route. For e.g., `/:registry/pkgs/:pkg`.
	 */
	path: TPath;

	/**
	 * The components (layout + page) of the route.
	 */
	comps: Array<RouteComponent>;

	/**
	 * The parameters of the route.
	 * For e.g., `{ registry: "jsr", pkg: "ruta-core" }`.
	 */
	params: TParams;

	/**
	 * The search parameters of the route. For e.g., `{ q: "Ruta" }`.
	 */
	search: TSearch;

	/**
	 * The errors of the route.
	 */
	error?: unknown;

	/**
	 * The index of the route level that the error occurred.
	 */
	errorIndex?: number;
};

/**
 * @internal
 * A short hand to create mutable `Route` type.
 */
type MakeRouteMut<TParentRouteConfig, TPath extends string, TParams, TSearch> = RouteMut<
	MergePath<TParentRouteConfig, TPath>,
	MergeParams<TParentRouteConfig, TParams>,
	MergeSearch<TParentRouteConfig, TSearch>
>;

/**
 * @internal
 * A builder that builds the layout of a route.
 */
type LayoutBuilder<TParentRouteConfig, TPath extends string> = <
	TParams = ParseParams<TPath>,
	TSearch = {},
	TLayoutRouteConfig = RouteConfig<
		TParentRouteConfig,
		TPath,
		MakeRouteMut<TParentRouteConfig, TPath, TParams, TSearch>,
		never
	>,
>(
	r?: RouteOptions<TParentRouteConfig, TPath, TParams, TSearch>,
) => {
	page: <TPageSearch extends AnyRecord = {}>(
		r?: Omit<RouteOptions<TLayoutRouteConfig, '', {}, TPageSearch>, 'parseParams'>,
	) => Prettify<
		RouteConfig<
			TLayoutRouteConfig,
			'',
			InferLayoutRoute<TLayoutRouteConfig>,
			MakeRouteMut<TLayoutRouteConfig, '', {}, TPageSearch>
		>
	>;
};

/**
 * @internal
 * A builder that builds the page of a route.
 */
type PageBuilder<TParentRouteConfig, TPath extends string> = <
	TParams = ParseParams<TPath>,
	TSearch = {},
>(
	r?: RouteOptions<TParentRouteConfig, TPath, TParams, TSearch>,
) => Prettify<
	RouteConfig<
		TParentRouteConfig,
		TPath,
		InferLayoutRoute<TParentRouteConfig>,
		MakeRouteMut<TParentRouteConfig, TPath, TParams, TSearch>
	>
>;

/**
 * @public
 * Options of `createRoute`'s `layout`, `page` functions.
 */
type RouteOptions<TParentRouteConfig, TPath extends string, TParams, TSearch> = {
	load?: LoadFn<
		InferContext<TParentRouteConfig>,
		MakeRouteMut<TParentRouteConfig, TPath, TParams, TSearch>
	>;
	parseParams?: ParseParamsFn<TPath, TParams>;
	parseSearch?: ParseSearchFn<TSearch>;
};

type MergePath<TParentRouteConfig, TPath extends string> = ResolvePath<
	[TParentRouteConfig extends { path: infer TPath extends string } ? TPath : '/', TPath]
>;

type MergeParams<TParentRouteConfig, TParams> = Prettify<
	(TParentRouteConfig extends { '~layout': { params: infer TParams } } ? TParams : {}) & TParams
>;

type MergeSearch<TParentRouteConfig, TSearch> = Prettify<
	(TParentRouteConfig extends { '~layout': { search: infer TSearch } } ? TSearch : {}) & TSearch
>;

type InferContext<TRouteConfig> = TRouteConfig extends {
	'~context': infer TContext extends AnyRecord;
}
	? TContext
	: {};

type InferLayoutRoute<TRouteConfig> = TRouteConfig extends {
	'~layout': infer TLayoutRoute extends Route;
}
	? TLayoutRoute
	: never;

type AnyRouteConfig = RouteConfig<any, any, any, any>;

type AnyMatchedRoute = Pick<AnyRouteConfig, 'path' | 'loads' | 'search'> & {
	params: AnyRecord;
	comps: Array<MaybePromise<RouteComponent>>;
};

/**
 * @internal
 * Flatten route type returned by route builder.
 */
type RouteConfig<TParentRouteConfig, TPath extends string, TLayoutRoute, TPageRoute> = {
	/**
	 * @internal
	 * Resolved absolute pathname.
	 */
	path: MergePath<TParentRouteConfig, TPath>;

	/**
	 * @internal
	 * URLPattern of this route.
	 */
	pattern?: URLPattern | null | undefined;

	/**
	 * @internal
	 * All the components (errors + layouts + pages) to this route.
	 */
	comps: Array<RouteComponent | RouteComponentLazy>;

	/**
	 * @internal
	 * All the load functions to this route.
	 */
	loads: Array<LoadFn<any, any> | undefined | null>;

	/**
	 * @internal
	 * The parseParams function of this route.
	 */
	parseParams?: RouteOptions<TParentRouteConfig, TPath, any, any>['parseParams'] | undefined | null;

	/**
	 * @internal
	 * The parseSearch functions (layout + page) of this route.
	 */
	search: Array<ParseSearchFn<any> | undefined | null>;

	/**
	 * @internal
	 * **TYPE ONLY**. The context of this route.
	 */
	'~context'?: InferContext<TParentRouteConfig>;

	/**
	 * @internal
	 * **TYPE ONLY**. The layout route of this route.
	 */
	'~layout': TLayoutRoute;

	/**
	 * @internal
	 * **TYPE ONLY**. The page route of this route.
	 */
	'~page': TPageRoute;
};

/**
 * @internal
 * Type signature of `parseParams` function.
 */
type ParseParamsFn<
	TPath extends string,
	TParams,
	// _ParsedParams = ParseParams<TPath>,
> = (
	params: Readonly<ParseParams<TPath>>,
) => TParams extends ParseParams<TPath, any> ? TParams : ParseParams<TPath, any>;

/**
 * @internal
 * Type signature of `parseSearch` function.
 */
type ParseSearchFn<TSearch> = (search: URLSearchParams) => TSearch;

/**
 * @internal
 * Type signature of navigation hook function.
 */
type NavigationHook<TRoutes extends Record<string, AnyRouteConfig>> = (
	args: NavigationHookArgs<TRoutes>,
) => MaybePromise<void>;

/**
 * @internal
 * Arguments for navigation hook function.
 */
type NavigationHookArgs<
	TRoutes extends Record<string, AnyRouteConfig>,
	TContext extends TRoutes['/']['~context'] = TRoutes['/']['~context'],
	TTo extends Route = TRoutes[keyof TRoutes] extends never
		? Route
		: TRoutes[keyof TRoutes]['~page'],
	TFrom extends Route = TRoutes[keyof TRoutes] extends never
		? Route
		: TRoutes[keyof TRoutes]['~page'],
> = {
	to: TTo;
	from: TFrom;
	context: TContext;
	controller: AbortController;
};

/**
 * @internal
 * Type signature of load function.
 */
type LoadFn<TContext, TTo extends Route> = (args: LoadFnArgs<TContext, TTo>) => MaybePromise<void>;

type LoadFnArgs<TContext, TTo extends Route> = Omit<NavigationHookArgs<{}, TContext, TTo>, 'from'>;

/**
 * @public
 * Register a framework specific component type.
 */
export interface Register {}

/**
 * @internal
 * The argument signature of `navigate` function.
 */
type StaticPaths<T> = T extends `${string}:${string}` ? never : T;

/**
 * @internal
 * The argument signature of `navigate` function.
 */
type ToOptions<
	TPath extends string,
	TRoutes extends Record<string, AnyRouteConfig>,
	_AllParams extends AnyRecord = TRoutes[TPath]['~page']['params'],
	_AllSearch extends AnyRecord = TRoutes[TPath]['~page']['search'],
> = {
	path: TPath;
} & (keyof _AllParams extends never
	? { params?: never }
	: HasRequiredKeys<_AllParams> extends false
		? { params?: _AllParams }
		: { params: _AllParams }) &
	(keyof _AllSearch extends never
		? { search?: never }
		: HasRequiredKeys<_AllSearch> extends false
			? { search?: _AllSearch }
			: { search: _AllSearch });

type DummyComponent = string | ('dummy' & { dummy: 'component' });

type InferComponent = Register extends { component: infer C } ? C : DummyComponent;

type RouteComponent = InferComponent | null | undefined;

type RouteComponentLazy = () => Promise<{ default: InferComponent }>;

type Prettify<T> = { [K in keyof T]: T[K] } & {};

type AnyRecord = Record<string, any>;

type MaybePromise<T> = Promise<T> | T;

type TrimTrailingSlash<T extends string> = T extends '/' ? T : T extends `${infer V}/` ? V : T;

type CleanPath<T extends string> = TrimTrailingSlash<
	T extends `${infer L}//${infer R}`
		? CleanPath<`${CleanPath<L>}/${CleanPath<R>}`>
		: T extends `${infer L}//`
			? `${CleanPath<L>}/`
			: T extends `//${infer L}`
				? `/${CleanPath<L>}`
				: T
>;

type ResolvePath<T extends string[]> = T extends [infer Head, ...infer Tail]
	? Head extends string
		? Tail extends string[]
			? Tail['length'] extends 0 // If Tail is not empty, join Head + '/' + Recurse(Tail)
				? CleanPath<`${Head}/`>
				: CleanPath<`${Head}/${ResolvePath<Tail>}`>
			: CleanPath<`${Head}/`>
		: '/'
	: '/';

type ParamSeparators = ' ' | '~' | '@' | '-' | '.' | ',' | '/';

type ParseParamKeys<T extends string> =
	T extends `${string}:${infer Param}${ParamSeparators}${infer Rest}`
		? ParseParamKeys<`:${Param}`> | ParseParamKeys<Rest>
		: T extends `${string}:${infer Param}`
			? Param
			: never;

type ParseParams<
	TPath extends string,
	T = string,
	_ParsedParamKeys extends string = ParseParamKeys<TPath>,
	_OptionalParams extends string = Extract<_ParsedParamKeys, `${string}${'*' | '?'}`>,
	_RequiredParams extends string = Exclude<_ParsedParamKeys, _OptionalParams>,
> = Prettify<
	{
		[K in _RequiredParams as K extends `${infer Param}+` ? Param : K]: T;
	} & {
		[K in _OptionalParams as K extends `${infer Param}${'*' | '?'}` ? Param : never]?:
			| T
			| undefined;
	}
>;

type HasRequiredKeys<T extends AnyRecord> = Required<{
	[K in keyof T]: undefined extends T[K] ? false : true;
}>[keyof T];
