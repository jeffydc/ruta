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
 *
 * @public
 */
export class Ruta<TRoutes extends Record<string, AnyRouteConfig> = Record<string, any>> {
	#ok = false;
	#base: string;
	#context: TRoutes['/']['~context'];
	#rootNode: Node = { seg: '/' };

	/** Only used in SSR. */
	#ctrller!: AbortController;
	/**
	 * - On browser: `NavigateEvent.signal`
	 * - On server: `this.#ctrller.signal`
	 */
	#signal!: AbortSignal;

	#from = createEmptyRoute();
	#to = createEmptyRoute();

	#hooksBefore: Array<NavigationHook<TRoutes>> = [];
	#hooksAfter: Array<NavigationHook<TRoutes>> = [];

	#onError;

	/**
	 * **TYPE ONLY.**
	 *
	 * @internal
	 */
	'~routes': TRoutes;

	constructor(options: RutaOptions<TRoutes>) {
		this.#base = normalizeBase(options.base || '/');
		this.#context = options.context || {};
		this.#onError = options.onError || ((e) => console.error(e));

		for (const [absPath, route] of Object.entries(options.routes)) {
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
		// Two separate ifs are needed here, otherwise bundlers fail to treeshake.
		if (BROWSER) {
			if (window.navigation) {
				const { finished } = window.navigation.navigate(href);
				await finished.catch((e) => this.#onError(e));
			}
		} //
		else {
			await this.#handleNavigate(href);
		}

		if (!this.#ok) {
			this.#ok = true;
		}
	};

	/**
	 * Build a href link string. Bind the result directly to the `href`
	 * of `<a>` tags. It already handles base path.
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
					// Try replacing with modifiers first.
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

			if (!canIntercept || downloadRequest || hashChange) return;

			this.#signal = e.signal;
			e.intercept({
				// @ts-expect-error upstream type package is not updated yet
				precommitHandler: async (controller) => {
					const to = await this.#handleNavigate(destination.url);
					controller.redirect(to);
				},
			});
		});

		const events = ['pointerover', 'touchstart', 'pointerdown'] as const;
		let handle: number;
		for (const event of events) {
			addEventListener(event, (e) => {
				const anchor = (e.target as HTMLElement).closest('a');
				if (
					!anchor ||
					anchor.hasAttribute('download') ||
					anchor.getAttribute('rel')?.includes('external') ||
					anchor.getAttribute('target')?.includes('_blank')
				) {
					return;
				}

				cancelIdleCallback(handle);
				handle = requestIdleCallback(() => this.#handleNavigate(anchor.href, true), {
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
			if (idx > -1) hooks.splice(idx, 1);
		};
	}

	/**
	 * Run navigation hooks or load functions (a variant of hook).
	 *
	 * @param hooks Before hooks or after hooks or load functions.
	 * @param isHook Whether it is to run navigation hooks.
	 * @throws It throws on Ruta specific known errors.
	 */
	async #runHooks(hooks: Array<NavigationHook<TRoutes>> | AnyMatchedRoute['loads'], isHook = true) {
		if (!hooks.length) return;
		// Navigation hooks always run regardless of existing errors, but other hooks
		// (i.e. load hook) do not need to.
		if (!isHook && this.#to.error) return;
		assert(this.#signal, `AbortSignal should be defined, please file an issue.`);

		const hookArgs = {
			to: this.#to,
			from: this.#from,
			context: this.#context,
			signal: this.#signal,
		};
		await Promise.all(
			hooks.map((hook, i) => {
				return hook
					? Promise.try(hook, hookArgs).catch((err) => {
							throw [err, i];
						})
					: null;
			}),
		).catch(([err, i]) => {
			this.#to.error = throwIfKnownError(err);
			this.#to.errorIndex = isHook ? 0 : i;
			this.#onError(this.#to.error);
		});
	}

	/**
	 * Universal navigation entrypoint. It also handles redirects.
	 */
	async #handleNavigate(href: string, preload?: boolean): Promise<string> {
		if (!BROWSER) {
			this.#ctrller = new AbortController();
			this.#signal = this.#ctrller.signal;
		}
		href = this.href(href);
		try {
			await this.#matchRoute(href, preload);
			return href;
		} catch (err) {
			if (err instanceof Redirect) {
				return await this.#handleNavigate(err.to, preload);
			}
			// Below should be unexpected unhandled error.
			this.#onError(err as any);
			throw err;
		}
	}

	/**
	 * Do route matching. This does
	 * - lookup route
	 * - call navigation hooks
	 * - resolve components & run loads
	 * - run params & search functions
	 *
	 * @param href Return value of `this.href`.
	 * @param preload Whether to preload route.
	 * @throws It throws on Ruta specific known errors.
	 */
	async #matchRoute(href: string, preload = false) {
		// Exit early if navigating to the same URL.
		if (this.#from.href === href) {
			return;
		}

		const hrefWithoutBase = resolvePath(trimBase(href, this.#base));
		const url = new URL(hrefWithoutBase, FAKE_ORIGIN);

		this.#to = createEmptyRoute();

		const route = this.#lookup(url.pathname);
		if (!route) {
			DEV && warn(`unmatched url ${href}.`);
			return;
		}

		const { params, path, search, comps, loads } = route;
		this.#to.href = href;
		this.#to.path = path;
		this.#to.params = params;

		for (const [i, fn] of search.entries()) {
			try {
				Object.assign(this.#to.search, fn?.(url.searchParams));
			} catch (err) {
				this.#to.error = throwIfKnownError(err);
				this.#to.errorIndex = i;
				this.#onError(this.#to.error);
				break;
			}
		}

		await this.#runHooks(this.#hooksBefore);

		await Promise.all([this.#resolveComps(comps), this.#runHooks(loads, false)]);

		if (!preload) {
			// TODO: If there is error in after hooks, UI won't be updated since
			// framework UI update is registered in after hooks, but URL is updated.
			await this.#runHooks(this.#hooksAfter);
			this.#from = {
				...this.#to,
				comps: [...this.#to.comps],
				params: { ...this.#to.params },
				search: { ...this.#to.search },
			};

			if (this.#to.error || this.#to.errorIndex != null)
				assert(
					this.#to.error && this.#to.errorIndex != null && this.#to.errorIndex > -1,
					`to.error should be defined, to.errorIndex should be > -1, please file an issue.`,
				);
		}
	}

	async #resolveComps(comps: AnyMatchedRoute['comps']) {
		assert(comps.length, `comps should not be empty, please file an issue.`);
		assert(this.#to.comps.length === 0, `to.comps should be empty, please file an issue.`);

		const results = await Promise.allSettled(comps);
		for (const [i, result] of results.entries()) {
			if (result.status === 'fulfilled') {
				this.#to.comps.push(result.value);
			} //
			else if (result.status === 'rejected') {
				// Push an empty component slot to render error.
				this.#to.comps.push(null);
				this.#to.error = throwIfKnownError(result.reason);
				this.#to.errorIndex = Math.floor(i / 2);
				this.#onError(this.#to.error);
				break;
			}
		}
	}

	/**
	 * Insert a node to a Trie.
	 * @param absPath Full pathname.
	 * @param route Route data to insert.
	 */
	#insert(absPath: string, route: AnyRouteConfig) {
		assert(absPath === route.path, `${absPath} should be ${route.path}, please file an issue.`);
		assert(route.comps.length === 4, `route.comps should have 4 entries, please file an issue.`);
		assert(route.loads.length === 2, `route.loads should have 2 entries, please file an issue.`);
		assert(route.search.length === 2, `route.search should have 2 entries, please file an issue.`);
		assert(route.comps[3], `${absPath} at least should have +page component.`);

		let node = this.#rootNode;
		const segments = absPath.split('/');
		for (const segment of segments) {
			if (!segment) continue;
			const isDynamic = segment.includes(':');

			if (isDynamic) {
				node.dyn ??= { seg: segment };
				node = node.dyn;
			} //
			else {
				node.static ??= new Map();
				if (!node.static.has(segment)) {
					node.static.set(segment, { seg: segment });
				}
				node = node.static.get(segment)!;
			}
		}

		const [, layout, , page] = route.comps;
		// @ts-expect-error adding private property to +layout component.
		layout && (layout.__ruta = 1);
		// @ts-expect-error adding private property to +page component.
		page.__ruta = 1;
		node.data = route;
	}

	/**
	 * Lookup a node data in a Trie.
	 * @param absPath Absolute pathname.
	 * @returns Node if found, null otherwise.
	 */
	#lookup(absPath: string): AnyMatchedRoute | null {
		let node = this.#rootNode;

		const segments = absPath.split('/');
		const params = {};
		const comps: AnyMatchedRoute['comps'] = [];
		const loads = [];
		const search = [];

		let index = 0;
		// True first to add root node data
		let found = true;
		while (true) {
			// Root route is always matched, so need to add its data first,
			// and continue the lookup.
			if (found) {
				found = false;
				assert(node.data, `node.data should be defined, please file an issue.`);
				// Load function of +layout component of this route.
				loads.push(node.data.loads[0]);
				// Search function of +layout component of this route.
				search.push(node.data.search[0]);
				// +error, +layout components of this route.
				this.#queueComps(node.data, comps, 0, 2);
			}
			if (index >= segments.length) break;

			const segment = segments[index++];
			if (!segment) continue;

			const staticNode = node.static?.get(segment);
			if (staticNode) {
				node = staticNode;
				found = true;
				continue;
			}

			const dynNode = this.#lookupDynamic(node, segment, params, index - 1);
			if (dynNode) {
				node = dynNode;
				found = true;
				continue;
			}

			return null;
		}

		assert(node.data, `node.data should be defined, please file an issue.`);
		// Load function of +page component of this route.
		loads.push(node.data.loads[1]);
		// ParseSearch function of +page component of this route.
		search.push(node.data.search[1]);
		// +error, +page components of this route.
		this.#queueComps(node.data, comps, 2, 4);
		assert(comps.length, `comps should not be empty, please file an issue.`);

		return {
			path: node.data.path,
			comps,
			loads,
			params,
			search,
		};
	}

	#lookupDynamic(node: Node, segment: string, params: AnyRecord, index: number) {
		const dynNode = node.dyn;
		if (!dynNode) return null;

		assert(dynNode.data, `dynNode.data should be defined, please file an issue.`);
		const { pattern, parseParams } = dynNode.data;
		assert(pattern, `dynNode.data.pattern should be defined, please file an issue.`);

		const match = pattern.exec({ pathname: '/' + segment });
		if (!match) return null;

		// prettier-ignore
		const { pathname: { groups } } = match;

		const filtered = Object.fromEntries(
			Object.entries(groups).filter((v): v is [string, string] => !!v[1]),
		);
		try {
			Object.assign(params, parseParams?.(filtered) || filtered);
		} catch (err) {
			Object.assign(params, filtered);
			this.#to.error = throwIfKnownError(err);
			this.#to.errorIndex = index;
			this.#onError(this.#to.error);
		}

		return dynNode;
	}

	#queueComps(route: AnyRouteConfig, comps: AnyMatchedRoute['comps'], from: number, to: number) {
		assert(
			from < route.comps.length && to <= route.comps.length,
			`from and to should be within route.comps.length, please file an issue.`,
		);
		const oldCompCount = comps.length;

		for (let i = from; i < to; i++) {
			const comp = route.comps[i];
			// To note a function like () => import(comp) since Svelte
			// components are simply functions.
			// @ts-expect-error __ruta is added in node insertion to Trie
			if (comp && comp.__ruta && typeof comp === 'function') {
				// Without typecasting here, typechecking in
				// ruta-vue, ruta-svelte fails.
				const promise = (comp as RouteComponentLazy)()
					.then((c) => {
						// Replace with the resolved component.
						return (route.comps[i] = c.default);
					})
					.catch((e: any) => {
						warn(`failed to load component: ${e}`);
						throw e;
					});
				// Push promise to load the resolved component later.
				comps.push(promise);
			} //
			else {
				// Component is already resolved or null placeholder.
				comps.push(comp as RouteComponent);
			}
		}

		assert(
			comps.length - oldCompCount === to - from,
			`comps should queue ${to - from} components, please file an issue.`,
		);
	}
}

/**
 * A helper function that re-exports the APIs which require type
 * augmentation during development.
 *
 * In production, `vite-plugin-ruta` simply re-exports all APIs to reduce
 * bundle size.
 *
 * @internal
 */
export function getTypedAPI<TRouter extends Ruta, _TLayout, _TPage>(): {
	redirect: RedirectFn<TRouter['~routes']>;
} {
	if (!DEV) {
		assert(false, `getTypedAPI should not be in production build, please file an issue.`);
	}
	return { redirect };
}

/**
 * Do route redirect.
 *
 * @internal
 */
export const redirect: RedirectFn<any> = (to) => {
	throw new Redirect(to);
};

class Redirect<TPath extends string, TRoutes extends Record<string, AnyRouteConfig>> {
	constructor(public to: StaticPaths<TPath> | ToOptions<TPath, TRoutes>) {}
}

/**
 * A route builder to build the layout view and page view of the route.
 *
 * @param parent Parent route or null if creating root route.
 * @param path Path segment of this route.
 * @returns An object with `layout`, `page` functions to create layout
 * route or page route respectively.
 *
 * @public
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
	if (parent == null) {
		assert(path === '/', `path should be "/" if parent route is null.`);
	}
	if (path !== '/') {
		assert(!path.includes('/'), `path should not include "/".`);
	}

	const route: Omit<AnyRouteConfig, 'comps' | '~layout' | '~page'> = {
		path: resolvePath(parent?.path ?? '', path) as any,
		loads: [null, null], // [layout load, page load]
		search: [null, null], // [layout search, page search]
		pattern: path.includes(':') ? new URLPattern({ pathname: '/' + path }) : null,
	};

	let hasLayout = false;
	const layout: LayoutBuilder<TParentRouteConfig, TPath> = (r) => {
		hasLayout = true;
		route.loads[0] = r?.load;
		route.search[0] = r?.parseSearch;
		route.parseParams = r?.parseParams;
		return { page } as any;
	};

	const page: PageBuilder<TParentRouteConfig, TPath> = (r) => {
		if (!hasLayout) {
			route.parseParams = r?.parseParams;
		}
		route.loads[1] = r?.load;
		route.search[1] = r?.parseSearch;
		return route as any;
	};

	return { layout, page };
}

/**
 * Create an empty route, useful for framework integration.
 *
 * @internal
 */
export function createEmptyRoute(): RouteMut<string, {}, {}> {
	return {
		href: '',
		comps: [] as Array<RouteComponent>,
		params: {},
		path: '',
		search: {},
		error: null,
		errorIndex: null,
	};
}

/**
 * Rethrow `err` if `err` is known errors to handle known errors at outer code
 * paths. Otherwise, return the given `err`.
 */
function throwIfKnownError(err: unknown) {
	if (err instanceof Redirect) throw err;
	return Error.isError(err) ? err : new Error(`${err}`);
}

/**
 * - Join all the paths with `/`.
 * - Ensure a leading `/` and no trailing `/`.
 *
 * @__NO_SIDE_EFFECTS__
 *
 * @internal
 */
export function resolvePath<T extends Array<string>>(...paths: T): ResolvePath<T> {
	let joined = ('/' + paths.join('/')).replace(MULTI_SLASH_RE, '/');
	if (joined.length > 1 && joined.endsWith('/')) joined = joined.slice(0, -1);
	return joined as ResolvePath<T>;
}

/**
 * Trim the `base` from the `path` prefix.
 *
 * @__NO_SIDE_EFFECTS__
 *
 * @internal
 */
export function trimBase(path: string, base: string) {
	path = path.replace(HTTP_RE, '');
	if (path.startsWith(base)) path = path.slice(base.length);
	return resolvePath(path);
}

/**
 * Use the provided `base` or get from the `href` attribute of `<base>` tag.
 *
 * @__NO_SIDE_EFFECTS__
 *
 * @internal
 */
function normalizeBase(base: string) {
	if (BROWSER && base !== '' && !base) {
		const href = document.querySelector('base')?.getAttribute('href');
		base = href ? new URL(href).pathname : base;
	}
	return base.trim();
}

/**
 * @__NO_SIDE_EFFECTS__
 *
 * @internal
 */
export function warn(msg: string) {
	console.warn(`[ruta warn]: ${msg}`);
}

/**
 * @__NO_SIDE_EFFECTS__
 *
 * @internal
 */
function assert(condition: any, msg: string = ''): asserts condition {
	if (condition) return;
	if (!DEV) {
		throw new Error(`ruta assertion failed`);
	}
	throw new Error(`ruta assertion failed: ${msg}`);
}

///////////////////////////////////////////// TYPES ////////////////////////////////////////////////

/**
 * Ruta class options.
 *
 * @public
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

	/**
	 * The function that is called when an error occurs during navigation.
	 */
	onError?: (err: Error) => void;
};

/**
 * Return type of `getRoute`, `useRoute`.
 *
 * @public
 */
export type Route<
	TPath extends string = string,
	TParams extends AnyRecord = {},
	TSearch extends AnyRecord = {},
> = Readonly<RouteMut<TPath, TParams, TSearch>>;

/**
 * Mutable version of `Route` type, used internally to assign values.
 *
 * @internal
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
	error?: Error | null;

	/**
	 * The index of the route level that the error occurred.
	 */
	errorIndex?: number | null;
};

type MakeRouteMut<TParentRouteConfig, TPath extends string, TParams, TSearch> = RouteMut<
	MergePath<TParentRouteConfig, TPath>,
	MergeParams<TParentRouteConfig, TParams>,
	MergeSearch<TParentRouteConfig, TSearch>
>;

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

type RouteOptions<TParentRouteConfig, TPath extends string, TParams, TSearch> = {
	load?: LoadFn<
		InferContext<TParentRouteConfig>,
		MakeRouteMut<TParentRouteConfig, TPath, TParams, TSearch>
	>;
	parseParams?: ParseParamsFn<TPath, TParams>;
	parseSearch?: ParseSearchFn<TSearch>;
};

type MergePath<TParentRouteConfig, TPath extends string> = ResolvePath<
	[TParentRouteConfig extends { path: infer ParentPath extends string } ? ParentPath : '/', TPath]
>;

type MergeParams<TParentRouteConfig, TParams> = Prettify<
	(TParentRouteConfig extends { '~layout': { params: infer ParentParams } } ? ParentParams : {}) &
		TParams
>;

type MergeSearch<TParentRouteConfig, TSearch> = Prettify<
	(TParentRouteConfig extends { '~layout': { search: infer ParentSearch } }
		? Omit<ParentSearch, keyof TSearch>
		: {}) &
		TSearch
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
 * Route config returned by the route builder.
 *
 * @internal
 */
type RouteConfig<TParentRouteConfig, TPath extends string, TLayoutRoute, TPageRoute> = {
	/**
	 * Resolved absolute pathname.
	 *
	 * @internal
	 */
	path: MergePath<TParentRouteConfig, TPath>;

	/**
	 * URLPattern of this route.
	 *
	 * @internal
	 */
	pattern?: URLPattern | null | undefined;

	/**
	 * All the components (errors + layouts + pages) to this route.
	 *
	 * @internal
	 */
	comps: Array<RouteComponent | RouteComponentLazy>;

	/**
	 * All the load functions to this route.
	 *
	 * @internal
	 */
	loads: Array<LoadFn<any, any> | undefined | null>;

	/**
	 * The parseParams function of this route.
	 *
	 * @internal
	 */
	parseParams?: RouteOptions<TParentRouteConfig, TPath, any, any>['parseParams'] | undefined | null;

	/**
	 * The parseSearch functions (layout + page) of this route.
	 *
	 * @internal
	 */
	search: Array<ParseSearchFn<any> | undefined | null>;

	/**
	 * **TYPE ONLY**. The context of this route.
	 *
	 * @internal
	 */
	'~context'?: InferContext<TParentRouteConfig>;

	/**
	 * **TYPE ONLY**. The layout route of this route.
	 *
	 * @internal
	 */
	'~layout': TLayoutRoute;

	/**
	 * **TYPE ONLY**. The page route of this route.
	 *
	 * @internal
	 */
	'~page': TPageRoute;
};

type ParseParamsFn<TPath extends string, TParams> = (
	params: Readonly<ParseParams<TPath>>,
) => TParams extends ParseParams<TPath, any> ? TParams : ParseParams<TPath, any>;

type ParseSearchFn<TSearch> = (search: URLSearchParams) => TSearch;

type NavigationHook<TRoutes extends Record<string, AnyRouteConfig>> = (
	args: NavigationHookArgs<TRoutes>,
) => MaybePromise<void>;

export type NavigationHookArgs<
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
	signal: AbortSignal;
};

type LoadFn<TContext, TTo extends Route> = (args: LoadFnArgs<TContext, TTo>) => MaybePromise<void>;

type LoadFnArgs<TContext, TTo extends Route> = Omit<NavigationHookArgs<{}, TContext, TTo>, 'from'>;

type RedirectFn<TRoutes extends Record<string, AnyRouteConfig>> = (
	to: Parameters<Ruta<TRoutes>['href']>[0],
) => void;

/**
 * Register a framework specific component type.
 *
 * @public
 */
export interface Register {}

type StaticPaths<T> = T extends `${string}:${string}` ? never : T;

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

export type AnyRecord = Record<string, any>;

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
