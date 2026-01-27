import { expect, expectTypeOf, test, vi } from 'vitest';

import { Ruta, trimBase, resolvePath, createRouteBuilder } from './internal.ts';

test(`${createRouteBuilder.name} root page`, () => {
	const root = createRouteBuilder(null, '/').page({
		parseParams: () => ({}),
		parseSearch: () => ({}),
	});

	expect(root.path).toBe('/');
	expectTypeOf(root.path).toEqualTypeOf<'/'>();
	expect(root.loads).toHaveLength(1);
	expect(root.search).toHaveLength(1);
	expect(root.parseParams).toBeDefined();
	expect(root.pattern).toBeNullable();
	expectTypeOf(root['~layout']).toEqualTypeOf<never>();
});

test(`${createRouteBuilder.name} root page, sibling page`, () => {
	const root = createRouteBuilder(null, '/').page({
		parseParams: () => ({}),
		parseSearch: () => ({}),
	});
	const sibling = createRouteBuilder(root, 'sibling').page({
		parseParams: () => ({}),
		parseSearch: () => ({}),
	});

	expect(sibling.path).toBe('/sibling');
	expectTypeOf(sibling.path).toEqualTypeOf<'/sibling'>();
	expect(sibling.loads).toHaveLength(1);
	expect(sibling.search).toHaveLength(1);
	expect(sibling.parseParams).toBeDefined();
	expect(sibling.pattern).toBeNullable();
});

test(`${createRouteBuilder.name} root layout + page`, () => {
	const root = createRouteBuilder(null, '/')
		.layout({
			parseParams: () => ({}),
			parseSearch: () => ({}),
		})
		.page({
			parseSearch: () => ({}),
		});

	expect(root.path).toBe('/');
	expectTypeOf(root.path).toEqualTypeOf<'/'>();
	expect(root.loads).toHaveLength(2);
	expect(root.search).toHaveLength(2);
	expect(root.parseParams).toBeDefined();
	expect(root.pattern).toBeNullable();
});

test(`${createRouteBuilder.name} root layout + page, child page`, () => {
	const root = createRouteBuilder(null, '/')
		.layout({
			parseParams: () => ({}),
			parseSearch: () => ({}),
		})
		.page({
			parseSearch: () => ({}),
		});
	const child = createRouteBuilder(root, 'child').page({
		parseParams: () => ({}),
		parseSearch: () => ({}),
	});

	expect(child.path).toBe('/child');
	expectTypeOf(child.path).toEqualTypeOf<'/child'>();
	expect(child.loads).toHaveLength(1);
	expect(child.search).toHaveLength(1);
	expect(child.parseParams).toBeDefined();
	expect(child.pattern).toBeNullable();
});

test(`${createRouteBuilder.name} root layout + page, child layout + page`, () => {
	const root = createRouteBuilder(null, '/')
		.layout({
			parseParams: () => ({}),
			parseSearch: () => ({}),
		})
		.page({
			parseSearch: () => ({}),
		});
	const child = createRouteBuilder(root, ':child')
		.layout({
			parseParams: () => ({ child: 'child' }),
			parseSearch: () => ({}),
		})
		.page({
			parseSearch: () => ({}),
		});

	expect(child.path).toBe('/:child');
	expectTypeOf(child.path).toEqualTypeOf<'/:child'>();
	expect(child.loads).toHaveLength(2);
	expect(child.search).toHaveLength(2);
	expect(child.parseParams).toBeDefined();
	expect(child.pattern).not.toBeNullable();
});

test(resolvePath.name, () => {
	{
		// Array joined has trailing slash, but we don't want it.
		const resolved = resolvePath('', '/', 'abc', '', 'def', 'ghi', '');
		expect(resolved).toBe('/abc/def/ghi');
		expectTypeOf(resolved).toEqualTypeOf<'/abc/def/ghi'>();
	}

	{
		// No trailing slash in the first place
		const resolved = resolvePath('', '/', 'abc', '', 'def', 'ghi');
		expect(resolved).toBe('/abc/def/ghi');
		expectTypeOf(resolved).toEqualTypeOf<'/abc/def/ghi'>();
	}

	{
		// Ensure leading slash
		const resolved = resolvePath('');
		expect(resolved).toBe('/');
		expectTypeOf(resolved).toEqualTypeOf<'/'>();
	}
});

test(trimBase.name, () => {
	{
		const trimmed = trimBase('/abc/def/ghi', '/abc');
		expect(trimmed).toBe('/def/ghi');
	}

	{
		const trimmed = trimBase('/abc/def/ghi/abc', '/abc');
		expect(trimmed).toBe('/def/ghi/abc');
	}

	{
		const trimmed = trimBase('https://abc.xyz/abc/mno', '/abc');
		expect(trimmed).toBe('/mno');
	}
});

const rootLayout = async () => ({ default: 'root layout' });
const rootPage = async () => ({ default: 'root page' });
const staticLayout = async () => ({ default: 'static layout' });
const staticPage = async () => ({ default: 'static page' });
const nestedLayout = async () => ({ default: 'nested layout' });
const nestedPage = async () => ({ default: 'nested page' });
const dynamicLayout = async () => ({ default: 'dynamic layout' });
const dynamicPage = async () => ({ default: 'dynamic page' });

test(`${Ruta.name} should run hooks`, async () => {
	const root = createRouteBuilder(null, '/').layout().page();
	root.comps = [null, rootLayout, null, rootPage];
	const routes = {
		[root.path]: root,
	};
	const ruta = new Ruta({ routes });

	let status = 'before';
	ruta.after(() => {
		expect(status).toBe('after');
	});
	ruta.before(() => {
		expect(status).toBe('before');
		status = 'after';
	});

	await ruta.navigate('/');
});

test(`${Ruta.name} should remove hooks`, async () => {
	const root = createRouteBuilder(null, '/').layout().page();
	root.comps = [null, rootLayout, null, rootPage];
	const routes = {
		[root.path]: root,
	};
	const ruta = new Ruta({ routes });

	const before1 = vi.fn();
	const before2 = vi.fn();
	const after1 = vi.fn();
	const after2 = vi.fn();
	const b1 = ruta.before(before1);
	const b2 = ruta.after(after1);
	const a1 = ruta.before(before2);
	const a2 = ruta.after(after2);

	b1();
	a2();
	await ruta.navigate('/');

	expect(before1).not.toHaveBeenCalled();
	expect(before2).toHaveBeenCalledOnce();
	expect(after1).toHaveBeenCalledOnce();
	expect(after2).not.toHaveBeenCalled();
});

test(`${Ruta.name} should warn adding hooks after navigation`, async () => {
	const root = createRouteBuilder(null, '/').layout().page();
	root.comps = [null, rootLayout, null, rootPage];
	const routes = {
		[root.path]: root,
	};
	const ruta = new Ruta({ routes });

	const warnSpy = vi.spyOn(console, 'warn');
	await ruta.navigate('/');
	ruta.after(() => {});

	expect(warnSpy).toHaveBeenCalledOnce();
	expect(warnSpy).toHaveBeenCalledWith(
		`[ruta warn]: navigation hook should be registered before visiting a route.`,
	);
	warnSpy.mockClear();
});

test(`${Ruta.name} should return original context`, () => {
	const root = createRouteBuilder(null, '/').layout().page();
	root.comps = [null, rootLayout, null, rootPage];
	const routes = {
		[root.path]: root,
	};
	const ruta = new Ruta({ routes, context: { satisfies: true } });

	expect(ruta.context).toStrictEqual({ satisfies: true });
});

test(`${Ruta.name} should match root route`, async () => {
	const root = createRouteBuilder(null, '/').layout().page();
	root.comps = [null, rootLayout, null, rootPage];
	const routes = {
		[root.path]: root,
	};
	const ruta = new Ruta({ routes });

	ruta.after(({ to }) => {
		expect(to.comps).toStrictEqual([null, 'root layout', null, 'root page']);
		expect(to.error).toBeNullable();
		expect(to.href).toBe('/');
		expect(to.path).toBe('/');
		expect(to.params).toStrictEqual({});
		expect(to.search).toStrictEqual({});
	});
	await ruta.navigate('/');
});

test(`${Ruta.name} should match static route`, async () => {
	const root = createRouteBuilder(null, '/').layout().page();
	const staticRoute = createRouteBuilder(root, 'static').layout().page();
	root.comps = [null, rootLayout, null, rootPage];
	staticRoute.comps = [null, staticLayout, null, staticPage];
	const routes = {
		[root.path]: root,
		[staticRoute.path]: staticRoute,
	};
	const ruta = new Ruta({ routes });

	ruta.after(({ to }) => {
		expect(to.comps).toStrictEqual([
			null,
			'root layout',
			null,
			'static layout',
			null,
			'static page',
		]);
		expect(to.error).toBeNullable();
		expect(to.href).toBe('/static');
		expect(to.path).toBe('/static');
		expect(to.params).toStrictEqual({});
		expect(to.search).toStrictEqual({});
	});
	await ruta.navigate('/static');
});

test(`${Ruta.name} should match static nested route`, async () => {
	const root = createRouteBuilder(null, '/').layout().page();
	const staticRoute = createRouteBuilder(root, 'static').layout().page();
	const nestedRoute = createRouteBuilder(staticRoute, 'nested').layout().page();
	root.comps = [null, rootLayout, null, rootPage];
	staticRoute.comps = [null, staticLayout, null, staticPage];
	nestedRoute.comps = [null, nestedLayout, null, nestedPage];
	const routes = {
		[root.path]: root,
		[staticRoute.path]: staticRoute,
		[nestedRoute.path]: nestedRoute,
	};
	const ruta = new Ruta({ routes });

	ruta.after(({ to }) => {
		expect(to.comps).toStrictEqual([
			null,
			'root layout',
			null,
			'static layout',
			null,
			'nested layout',
			null,
			'nested page',
		]);
		expect(to.error).toBeNullable();
		expect(to.href).toBe('/static/nested');
		expect(to.path).toBe('/static/nested');
		expect(to.params).toStrictEqual({});
		expect(to.search).toStrictEqual({});
	});
	await ruta.navigate('/static/nested');
});

test(`${Ruta.name} should match static nested route (unmatched)`, async () => {
	const root = createRouteBuilder(null, '/').layout().page();
	const staticRoute = createRouteBuilder(root, 'static').layout().page();
	const nestedRoute = createRouteBuilder(staticRoute, 'nested').layout().page();
	root.comps = [null, rootLayout, null, rootPage];
	staticRoute.comps = [null, staticLayout, null, staticPage];
	nestedRoute.comps = [null, nestedLayout, null, nestedPage];
	const routes = {
		[root.path]: root,
		[staticRoute.path]: staticRoute,
		[nestedRoute.path]: nestedRoute,
	};
	const ruta = new Ruta({ routes });

	const warnSpy = vi.spyOn(console, 'warn');
	// @ts-expect-error non-existent route so type error
	await ruta.navigate('/static/nesteddd');

	expect(warnSpy).toHaveBeenCalledOnce();
	expect(warnSpy).toHaveBeenCalledWith(`[ruta warn]: unmatched url /static/nesteddd.`);
	warnSpy.mockClear();
});

test(`${Ruta.name} should match dynamic route`, async () => {
	const root = createRouteBuilder(null, '/').layout().page();
	const dynamicRoute = createRouteBuilder(root, ':dynamic').layout().page();
	root.comps = [null, rootLayout, null, rootPage];
	dynamicRoute.comps = [null, dynamicLayout, null, dynamicPage];
	const routes = {
		[root.path]: root,
		[dynamicRoute.path]: dynamicRoute,
	};
	const ruta = new Ruta({ routes });

	ruta.after(({ to }) => {
		expect(to.comps).toStrictEqual([
			null,
			'root layout',
			null,
			'dynamic layout',
			null,
			'dynamic page',
		]);
		expect(to.error).toBeNullable();
		expect(to.href).toBe('/dyn');
		expect(to.path).toBe('/:dynamic');
		expect(to.params).toStrictEqual({ dynamic: 'dyn' });
		expect(to.search).toStrictEqual({});
	});
	await ruta.navigate({ path: '/:dynamic', params: { dynamic: 'dyn' } });
});

test(`${Ruta.name} should match dynamic route (parsed params + search)`, async () => {
	const root = createRouteBuilder(null, '/')
		.layout({
			parseSearch: (search) => ({ rootLayout: search.get('rl') }),
		})
		.page({
			parseSearch: (search) => ({ rootPage: search.get('rp') }),
		});
	const dynamicRoute = createRouteBuilder(root, ':dynamic')
		.layout({
			parseParams: (params) => ({ dynamic: +params.dynamic }),
			parseSearch: (search) => ({ dynLayout: search.get('dl') }),
		})
		.page({
			parseSearch: (search) => ({ dynPage: search.get('dp') }),
		});
	root.comps = [null, rootLayout, null, rootPage];
	dynamicRoute.comps = [null, dynamicLayout, null, dynamicPage];
	const routes = {
		[root.path]: root,
		[dynamicRoute.path]: dynamicRoute,
	};
	const ruta = new Ruta({ routes });

	ruta.after(({ to }) => {
		expect(to.comps).toStrictEqual([
			null,
			'root layout',
			null,
			'dynamic layout',
			null,
			'dynamic page',
		]);
		expect(to.error).toBeNullable();
		expect(to.href).toBe('/42?rootLayout=rl&dynLayout=dynl&dynPage=dynp');
		expect(to.path).toBe('/:dynamic');
		expect(to.params).toStrictEqual({ dynamic: 42 });
		expect(to.search).toStrictEqual({
			rootLayout: null,
			dynLayout: null,
			dynPage: null,
		});
	});
	await ruta.navigate({
		path: '/:dynamic',
		params: { dynamic: 42 },
		search: { rootLayout: 'rl', dynLayout: 'dynl', dynPage: 'dynp' },
	});
});
