import type { AnyRecord, NavigationHookArgs } from './internal.ts';
import { assert, expect, expectTypeOf, suite, test, vi } from 'vitest';

import {
	Ruta,
	trimBase,
	resolvePath,
	createRouteBuilder,
	getTypedAPI,
	redirect,
} from './internal.ts';

suite(createRouteBuilder, () => {
	test(`path should be "/" for null parent route`, () => {
		// @ts-expect-error testing assertion error.
		expect(() => createRouteBuilder(null, '/child').page()).toThrowErrorMatchingInlineSnapshot(
			`[Error: ruta assertion failed: path should be "/" if parent route is null.]`,
		);
	});

	test(`path cannot include "/"`, () => {
		const root = createRouteBuilder(null, '/').page();
		expect(() => createRouteBuilder(root, '/child').page).toThrowErrorMatchingInlineSnapshot(
			`[Error: ruta assertion failed: path should not include "/".]`,
		);
	});

	test(`root page`, () => {
		const root = createRouteBuilder(null, '/').page({
			parseParams: () => ({}),
			parseSearch: () => ({}),
		});

		expect(root.path).toBe('/');
		expectTypeOf(root.path).toEqualTypeOf<'/'>();
		expect(root.loads).toHaveLength(2);
		expect(root.search).toHaveLength(2);
		expect(root.parseParams).toBeDefined();
		expect(root.pattern).toBeNullable();
		expectTypeOf(root['~layout']).toEqualTypeOf<never>();
	});

	test(`root page, sibling page`, () => {
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
		expect(sibling.loads).toHaveLength(2);
		expect(sibling.search).toHaveLength(2);
		expect(sibling.parseParams).toBeDefined();
		expect(sibling.pattern).toBeNullable();
	});

	test(`root layout + page`, () => {
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

	test(`root layout + page, child page`, () => {
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
		expect(child.loads).toHaveLength(2);
		expect(child.search).toHaveLength(2);
		expect(child.parseParams).toBeDefined();
		expect(child.pattern).toBeNullable();
	});

	test(`root layout + page, child layout + page`, () => {
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
const deepLayout = async () => ({ default: 'deep layout' });
const deepPage = async () => ({ default: 'deep page' });
const childLayout = async () => ({ default: 'child layout' });
const childPage = async () => ({ default: 'child page' });
const idLayout = async () => ({ default: 'id layout' });
const idPage = async () => ({ default: 'id page' });
const subIdLayout = async () => ({ default: 'subId layout' });
const subIdPage = async () => ({ default: 'subId page' });
const deepIdLayout = async () => ({ default: 'deepId layout' });
const deepIdPage = async () => ({ default: 'deepId page' });
const optionalLayout = async () => ({ default: 'optional layout' });
const optionalPage = async () => ({ default: 'optional page' });
const catchallLayout = async () => ({ default: 'catchall layout' });
const catchallPage = async () => ({ default: 'catchall page' });
const usersLayout = async () => ({ default: 'users layout' });
const usersPage = async () => ({ default: 'users page' });
const userLayout = async () => ({ default: 'user layout' });
const userPage = async () => ({ default: 'user page' });
const filesLayout = async () => ({ default: 'files layout' });
const filesPage = async () => ({ default: 'files page' });
const filePathLayout = async () => ({ default: 'filePath layout' });
const filePathPage = async () => ({ default: 'filePath page' });

class RutaTest<TRoutes extends AnyRecord> extends Ruta<TRoutes> {
	currentRoute!: NavigationHookArgs<TRoutes>['to'];

	constructor(options: ConstructorParameters<typeof Ruta<TRoutes>>[0]) {
		super(options);
		this.after(({ to }) => {
			this.currentRoute = to;
		});
	}
}

suite(Ruta, () => {
	test(`should return original context`, () => {
		const root = createRouteBuilder(null, '/').layout().page();
		root.comps = [null, rootLayout, null, rootPage];
		const routes = {
			[root.path]: root,
		};
		const ruta = new RutaTest({ routes, context: { satisfies: true } });

		expect(ruta.context).toStrictEqual({ satisfies: true });
	});
});

suite(`${Ruta.name} params`, () => {
	test(`root route params`, async () => {
		const root = createRouteBuilder(null, '/').layout().page();
		root.comps = [null, rootLayout, null, rootPage];
		const routes = { [root.path]: root };
		const ruta = new RutaTest({ routes });

		await ruta.navigate('/');

		expect(ruta.currentRoute.comps).toStrictEqual([null, 'root layout', null, 'root page']);
		expect(ruta.currentRoute.error).toBeNullable();
		expect(ruta.currentRoute.href).toBe('/');
		expect(ruta.currentRoute.path).toBe('/');
		expect(ruta.currentRoute.params).toStrictEqual({});
		expect(ruta.currentRoute.search).toStrictEqual({});
	});

	test(`static child params`, async () => {
		const root = createRouteBuilder(null, '/').layout().page();
		const child = createRouteBuilder(root, 'child').layout().page();
		root.comps = [null, rootLayout, null, rootPage];
		child.comps = [null, childLayout, null, childPage];
		const routes = { [root.path]: root, [child.path]: child };
		const ruta = new RutaTest({ routes });

		await ruta.navigate('/child');

		expect(ruta.currentRoute.comps).toStrictEqual([
			null,
			'root layout',
			null,
			'child layout',
			null,
			'child page',
		]);
		expect(ruta.currentRoute.error).toBeNullable();
		expect(ruta.currentRoute.href).toBe('/child');
		expect(ruta.currentRoute.path).toBe('/child');
		expect(ruta.currentRoute.params).toStrictEqual({});
		expect(ruta.currentRoute.search).toStrictEqual({});
	});

	test(`nested static children (2 levels)`, async () => {
		const root = createRouteBuilder(null, '/').layout().page();
		const child = createRouteBuilder(root, 'child').layout().page();
		const nested = createRouteBuilder(child, 'nested').layout().page();
		root.comps = [null, rootLayout, null, rootPage];
		child.comps = [null, childLayout, null, childPage];
		nested.comps = [null, nestedLayout, null, nestedPage];
		const routes = { [root.path]: root, [child.path]: child, [nested.path]: nested };
		const ruta = new RutaTest({ routes });

		await ruta.navigate('/child/nested');

		expect(ruta.currentRoute.comps).toStrictEqual([
			null,
			'root layout',
			null,
			'child layout',
			null,
			'nested layout',
			null,
			'nested page',
		]);
		expect(ruta.currentRoute.error).toBeNullable();
		expect(ruta.currentRoute.href).toBe('/child/nested');
		expect(ruta.currentRoute.path).toBe('/child/nested');
		expect(ruta.currentRoute.params).toStrictEqual({});
		expect(ruta.currentRoute.search).toStrictEqual({});
	});

	test(`nested static children (3 levels)`, async () => {
		const root = createRouteBuilder(null, '/').layout().page();
		const child = createRouteBuilder(root, 'child').layout().page();
		const nested = createRouteBuilder(child, 'nested').layout().page();
		const deep = createRouteBuilder(nested, 'deep').layout().page();
		root.comps = [null, rootLayout, null, rootPage];
		child.comps = [null, childLayout, null, childPage];
		nested.comps = [null, nestedLayout, null, nestedPage];
		deep.comps = [null, deepLayout, null, deepPage];
		const routes = {
			[root.path]: root,
			[child.path]: child,
			[nested.path]: nested,
			[deep.path]: deep,
		};
		const ruta = new RutaTest({ routes });

		await ruta.navigate('/child/nested/deep');

		expect(ruta.currentRoute.comps).toStrictEqual([
			null,
			'root layout',
			null,
			'child layout',
			null,
			'nested layout',
			null,
			'deep layout',
			null,
			'deep page',
		]);
		expect(ruta.currentRoute.error).toBeNullable();
		expect(ruta.currentRoute.href).toBe('/child/nested/deep');
		expect(ruta.currentRoute.path).toBe('/child/nested/deep');
		expect(ruta.currentRoute.params).toStrictEqual({});
		expect(ruta.currentRoute.search).toStrictEqual({});
	});

	test(`dynamic child params`, async () => {
		const root = createRouteBuilder(null, '/').layout().page();
		const id = createRouteBuilder(root, ':id')
			.layout({ parseParams: (p) => ({ id: p.id }) })
			.page();
		root.comps = [null, rootLayout, null, rootPage];
		id.comps = [null, idLayout, null, idPage];
		const routes = { [root.path]: root, [id.path]: id };
		const ruta = new RutaTest({ routes });

		await ruta.navigate({ path: '/:id', params: { id: '123' } });

		expect(ruta.currentRoute.comps).toStrictEqual([
			null,
			'root layout',
			null,
			'id layout',
			null,
			'id page',
		]);
		expect(ruta.currentRoute.error).toBeNullable();
		expect(ruta.currentRoute.href).toBe('/123');
		expect(ruta.currentRoute.path).toBe('/:id');
		expect(ruta.currentRoute.params).toStrictEqual({ id: '123' });
		expect(ruta.currentRoute.search).toStrictEqual({});
	});

	test(`nested dynamic children (2 levels)`, async () => {
		const root = createRouteBuilder(null, '/').layout().page();
		const id = createRouteBuilder(root, ':id')
			.layout({ parseParams: (p) => ({ id: p.id }) })
			.page();
		const subId = createRouteBuilder(id, ':subId')
			.layout({ parseParams: (p) => ({ subId: p.subId }) })
			.page();
		root.comps = [null, rootLayout, null, rootPage];
		id.comps = [null, idLayout, null, idPage];
		subId.comps = [null, subIdLayout, null, subIdPage];
		const routes = { [root.path]: root, [id.path]: id, [subId.path]: subId };
		const ruta = new RutaTest({ routes });

		await ruta.navigate({ path: '/:id/:subId', params: { id: 'abc', subId: 'xyz' } });

		expect(ruta.currentRoute.comps).toStrictEqual([
			null,
			'root layout',
			null,
			'id layout',
			null,
			'subId layout',
			null,
			'subId page',
		]);
		expect(ruta.currentRoute.error).toBeNullable();
		expect(ruta.currentRoute.href).toBe('/abc/xyz');
		expect(ruta.currentRoute.path).toBe('/:id/:subId');
		expect(ruta.currentRoute.params).toStrictEqual({ id: 'abc', subId: 'xyz' });
		expect(ruta.currentRoute.search).toStrictEqual({});
	});

	test(`nested dynamic children (3 levels)`, async () => {
		const root = createRouteBuilder(null, '/').layout().page();
		const id = createRouteBuilder(root, ':id')
			.layout({ parseParams: (p) => ({ id: p.id }) })
			.page();
		const subId = createRouteBuilder(id, ':subId')
			.layout({ parseParams: (p) => ({ subId: p.subId }) })
			.page();
		const deepId = createRouteBuilder(subId, ':deepId')
			.layout({ parseParams: (p) => ({ deepId: p.deepId }) })
			.page();
		root.comps = [null, rootLayout, null, rootPage];
		id.comps = [null, idLayout, null, idPage];
		subId.comps = [null, subIdLayout, null, subIdPage];
		deepId.comps = [null, deepIdLayout, null, deepIdPage];
		const routes = {
			[root.path]: root,
			[id.path]: id,
			[subId.path]: subId,
			[deepId.path]: deepId,
		};
		const ruta = new RutaTest({ routes });

		await ruta.navigate({
			path: '/:id/:subId/:deepId',
			params: { id: 'a', subId: 'b', deepId: 'c' },
		});

		expect(ruta.currentRoute.comps).toStrictEqual([
			null,
			'root layout',
			null,
			'id layout',
			null,
			'subId layout',
			null,
			'deepId layout',
			null,
			'deepId page',
		]);
		expect(ruta.currentRoute.error).toBeNullable();
		expect(ruta.currentRoute.href).toBe('/a/b/c');
		expect(ruta.currentRoute.path).toBe('/:id/:subId/:deepId');
		expect(ruta.currentRoute.params).toStrictEqual({ id: 'a', subId: 'b', deepId: 'c' });
		expect(ruta.currentRoute.search).toStrictEqual({});
	});

	test(`nested static + dynamic children (unmatched route)`, async () => {
		const root = createRouteBuilder(null, '/').layout().page();
		const staticChild = createRouteBuilder(root, 'static').layout().page();
		const id = createRouteBuilder(staticChild, ':id')
			.layout({ parseParams: (p) => ({ id: p.id }) })
			.page();
		root.comps = [null, rootLayout, null, rootPage];
		staticChild.comps = [null, staticLayout, null, staticPage];
		id.comps = [null, idLayout, null, idPage];
		const routes = { [root.path]: root, [staticChild.path]: staticChild, [id.path]: id };
		const ruta = new RutaTest({ routes });

		const warnSpy = vi.spyOn(console, 'warn');
		// @ts-expect-error non-existent route so type error
		await ruta.navigate('/nonexistent/path');

		expect(warnSpy).toHaveBeenCalledOnce();
		expect(warnSpy).toHaveBeenCalledWith(`[ruta warn]: unmatched url /nonexistent/path.`);
		warnSpy.mockClear();
	});

	test.todo(`optional param modifier (:id?)`, async () => {
		const root = createRouteBuilder(null, '/').layout().page();
		const optional = createRouteBuilder(root, ':id?')
			.layout({ parseParams: (p) => ({ id: p.id }) })
			.page();
		root.comps = [null, rootLayout, null, rootPage];
		optional.comps = [null, optionalLayout, null, optionalPage];
		const routes = { [root.path]: root, [optional.path]: optional };
		const ruta = new RutaTest({ routes });

		await ruta.navigate({ path: '/:id?', params: { id: 'value' } });

		expect(ruta.currentRoute.comps).toStrictEqual([
			null,
			'root layout',
			null,
			'optional layout',
			null,
			'optional page',
		]);
		expect(ruta.currentRoute.error).toBeNullable();
		expect(ruta.currentRoute.href).toBe('/value');
		expect(ruta.currentRoute.path).toBe('/:id?');
		expect(ruta.currentRoute.params).toStrictEqual({ id: 'value' });
		expect(ruta.currentRoute.search).toStrictEqual({});
	});

	test.todo(`optional param modifier (:id?) w/o value`, async () => {
		const root = createRouteBuilder(null, '/').layout().page();
		const optional = createRouteBuilder(root, ':id?')
			.layout({ parseParams: (p) => ({ id: p.id }) })
			.page();
		root.comps = [null, rootLayout, null, rootPage];
		optional.comps = [null, optionalLayout, null, optionalPage];
		const routes = { [root.path]: root, [optional.path]: optional };
		const ruta = new RutaTest({ routes });

		await ruta.navigate({ path: '/:id?' });

		expect(ruta.currentRoute.comps).toStrictEqual([
			null,
			'root layout',
			null,
			'optional layout',
			null,
			'optional page',
		]);
		expect(ruta.currentRoute.error).toBeNullable();
		expect(ruta.currentRoute.href).toBe('/');
		expect(ruta.currentRoute.path).toBe('/:id?');
		expect(ruta.currentRoute.params).toStrictEqual({ id: undefined });
		expect(ruta.currentRoute.search).toStrictEqual({});
	});

	test.todo(`catchall param modifier (:rest*)`, async () => {
		const root = createRouteBuilder(null, '/').layout().page();
		const catchall = createRouteBuilder(root, ':rest*')
			.layout({ parseParams: (p) => ({ rest: p.rest }) })
			.page();
		root.comps = [null, rootLayout, null, rootPage];
		catchall.comps = [null, catchallLayout, null, catchallPage];
		const routes = { [root.path]: root, [catchall.path]: catchall };
		const ruta = new RutaTest({ routes });

		await ruta.navigate({ path: '/:rest*', params: { rest: 'a/b/c' } });

		expect(ruta.currentRoute.comps).toStrictEqual([
			null,
			'root layout',
			null,
			'catchall layout',
			null,
			'catchall page',
		]);
		expect(ruta.currentRoute.error).toBeNullable();
		expect(ruta.currentRoute.href).toBe('/a/b/c');
		expect(ruta.currentRoute.path).toBe('/:rest*');
		expect(ruta.currentRoute.params).toStrictEqual({ rest: 'a/b/c' });
		expect(ruta.currentRoute.search).toStrictEqual({});
	});

	test.todo(`required catchall param modifier (:rest+)`, async () => {
		const root = createRouteBuilder(null, '/').layout().page();
		const catchall = createRouteBuilder(root, ':rest+')
			.layout({ parseParams: (p) => ({ rest: p.rest }) })
			.page();
		root.comps = [null, rootLayout, null, rootPage];
		catchall.comps = [null, catchallLayout, null, catchallPage];
		const routes = { [root.path]: root, [catchall.path]: catchall };
		const ruta = new RutaTest({ routes });

		await ruta.navigate({ path: '/:rest+', params: { rest: 'x/y/z' } });

		expect(ruta.currentRoute.comps).toStrictEqual([
			null,
			'root layout',
			null,
			'catchall layout',
			null,
			'catchall page',
		]);
		expect(ruta.currentRoute.error).toBeNullable();
		expect(ruta.currentRoute.href).toBe('/x/y/z');
		expect(ruta.currentRoute.path).toBe('/:rest+');
		expect(ruta.currentRoute.params).toStrictEqual({ rest: 'x/y/z' });
		expect(ruta.currentRoute.search).toStrictEqual({});
	});

	test.todo(`nested param modifiers`, async () => {
		const root = createRouteBuilder(null, '/').layout().page();
		const files = createRouteBuilder(root, 'files').layout().page();
		const filePath = createRouteBuilder(files, ':path*')
			.layout({ parseParams: (p) => ({ path: p.path }) })
			.page();
		root.comps = [null, rootLayout, null, rootPage];
		files.comps = [null, filesLayout, null, filesPage];
		filePath.comps = [null, filePathLayout, null, filePathPage];
		const routes = {
			[root.path]: root,
			[files.path]: files,
			[filePath.path]: filePath,
		};
		const ruta = new RutaTest({ routes });

		await ruta.navigate({ path: '/files/:path*', params: { path: 'dir/subdir/file.txt' } });

		expect(ruta.currentRoute.comps).toStrictEqual([
			null,
			'root layout',
			null,
			'files layout',
			null,
			'filePath layout',
			null,
			'filePath page',
		]);
		expect(ruta.currentRoute.error).toBeNullable();
		expect(ruta.currentRoute.href).toBe('/files/dir/subdir/file.txt');
		expect(ruta.currentRoute.path).toBe('/files/:path*');
		expect(ruta.currentRoute.params).toStrictEqual({ path: 'dir/subdir/file.txt' });
		expect(ruta.currentRoute.search).toStrictEqual({});
	});

	test.todo(`mixed static, dynamic, and modifier params`, async () => {
		const root = createRouteBuilder(null, '/').layout().page();
		const users = createRouteBuilder(root, 'users').layout().page();
		const user = createRouteBuilder(users, ':userId')
			.layout({ parseParams: (p) => ({ userId: p.userId }) })
			.page();
		const files = createRouteBuilder(user, 'files').layout().page();
		const filePath = createRouteBuilder(files, ':filePath*')
			.layout({ parseParams: (p) => ({ filePath: p.filePath }) })
			.page();
		root.comps = [null, rootLayout, null, rootPage];
		users.comps = [null, usersLayout, null, usersPage];
		user.comps = [null, userLayout, null, userPage];
		files.comps = [null, filesLayout, null, filesPage];
		filePath.comps = [null, filePathLayout, null, filePathPage];
		const routes = {
			[root.path]: root,
			[users.path]: users,
			[user.path]: user,
			[files.path]: files,
			[filePath.path]: filePath,
		};
		const ruta = new RutaTest({ routes });

		await ruta.navigate({
			path: '/users/:userId/files/:filePath*',
			params: { userId: '42', filePath: 'docs/readme.md' },
		});

		expect(ruta.currentRoute.comps).toStrictEqual([
			null,
			'root layout',
			null,
			'users layout',
			null,
			'user layout',
			null,
			'files layout',
			null,
			'filePath layout',
			null,
			'filePath page',
		]);
		expect(ruta.currentRoute.error).toBeNullable();
		expect(ruta.currentRoute.href).toBe('/users/42/files/docs/readme.md');
		expect(ruta.currentRoute.path).toBe('/users/:userId/files/:filePath*');
		expect(ruta.currentRoute.params).toStrictEqual({ userId: '42', filePath: 'docs/readme.md' });
		expect(ruta.currentRoute.search).toStrictEqual({});
	});
});

suite(`${Ruta.name} search`, () => {
	test(`root route search params (layout + page)`, async () => {
		const root = createRouteBuilder(null, '/')
			.layout({
				parseSearch: (search) => ({ layoutParam: search.get('layoutParam') }),
			})
			.page({
				parseSearch: (search) => ({ pageParam: search.get('pageParam') }),
			});
		root.comps = [null, rootLayout, null, rootPage];
		const routes = { [root.path]: root };
		const ruta = new RutaTest({ routes });

		await ruta.navigate({
			path: '/',
			search: { layoutParam: 'lv', pageParam: 'pv' },
		});

		expect(ruta.currentRoute.comps).toStrictEqual([null, 'root layout', null, 'root page']);
		expect(ruta.currentRoute.error).toBeNullable();
		expect(ruta.currentRoute.href).toBe('/?layoutParam=lv&pageParam=pv');
		expect(ruta.currentRoute.path).toBe('/');
		expect(ruta.currentRoute.params).toStrictEqual({});
		expect(ruta.currentRoute.search).toStrictEqual({ layoutParam: 'lv', pageParam: 'pv' });
	});

	test(`child layout inherits parent layout search params`, async () => {
		const root = createRouteBuilder(null, '/')
			.layout({
				parseSearch: (search) => ({ parentLayout: search.get('parentLayout') }),
			})
			.page({
				parseSearch: (search) => ({ parentPage: search.get('parentPage') }),
			});
		const child = createRouteBuilder(root, 'child')
			.layout({
				parseSearch: (search) => ({ childLayout: search.get('childLayout') }),
			})
			.page({
				parseSearch: (search) => ({ childPage: search.get('childPage') }),
			});
		root.comps = [null, rootLayout, null, rootPage];
		child.comps = [null, childLayout, null, childPage];
		const routes = { [root.path]: root, [child.path]: child };
		const ruta = new RutaTest({ routes });

		await ruta.navigate({
			path: '/child',
			search: { parentLayout: 'pl', childLayout: 'cl', childPage: 'cp' },
		});

		expect(ruta.currentRoute.comps).toStrictEqual([
			null,
			'root layout',
			null,
			'child layout',
			null,
			'child page',
		]);
		expect(ruta.currentRoute.error).toBeNullable();
		expect(ruta.currentRoute.href).toBe('/child?parentLayout=pl&childLayout=cl&childPage=cp');
		expect(ruta.currentRoute.path).toBe('/child');
		expect(ruta.currentRoute.params).toStrictEqual({});
		expect(ruta.currentRoute.search).toStrictEqual({
			parentLayout: 'pl',
			childLayout: 'cl',
			childPage: 'cp',
		});
	});

	test(`child search params overwrite parent search params on same keys`, async () => {
		const root = createRouteBuilder(null, '/')
			.layout({
				parseSearch: (search) => ({
					shared: search.get('shared'),
					parentOnly: search.get('parentOnly'),
				}),
			})
			.page({
				parseSearch: () => ({}),
			});
		const child = createRouteBuilder(root, 'child')
			.layout({
				parseSearch: (search) => ({ shared: search.get('shared') + '-child' }),
			})
			.page({
				parseSearch: () => ({}),
			});
		root.comps = [null, rootLayout, null, rootPage];
		child.comps = [null, childLayout, null, childPage];
		const routes = { [root.path]: root, [child.path]: child };
		const ruta = new RutaTest({ routes });

		await ruta.navigate({
			path: '/child',
			search: { shared: 'value', parentOnly: 'parent' },
		});

		expect(ruta.currentRoute.comps).toStrictEqual([
			null,
			'root layout',
			null,
			'child layout',
			null,
			'child page',
		]);
		expect(ruta.currentRoute.error).toBeNullable();
		expect(ruta.currentRoute.href).toBe('/child?shared=value&parentOnly=parent');
		expect(ruta.currentRoute.path).toBe('/child');
		expect(ruta.currentRoute.params).toStrictEqual({});
		expect(ruta.currentRoute.search).toStrictEqual({
			shared: 'value-child',
			parentOnly: 'parent',
		});
	});

	test(`deeply nested search params inheritance`, async () => {
		const root = createRouteBuilder(null, '/')
			.layout({
				parseSearch: (search) => ({ rootLayout: search.get('rootLayout') }),
			})
			.page({
				parseSearch: (search) => ({ rootPage: search.get('rootPage') }),
			});
		const child = createRouteBuilder(root, 'child')
			.layout({
				parseSearch: (search) => ({ childLayout: search.get('childLayout') }),
			})
			.page({
				parseSearch: (search) => ({ childPage: search.get('childPage') }),
			});
		const nested = createRouteBuilder(child, 'nested')
			.layout({
				parseSearch: (search) => ({ nestedLayout: search.get('nestedLayout') }),
			})
			.page({
				parseSearch: (search) => ({ nestedPage: search.get('nestedPage') }),
			});
		root.comps = [null, rootLayout, null, rootPage];
		child.comps = [null, childLayout, null, childPage];
		nested.comps = [null, nestedLayout, null, nestedPage];
		const routes = { [root.path]: root, [child.path]: child, [nested.path]: nested };
		const ruta = new RutaTest({ routes });

		await ruta.navigate({
			path: '/child/nested',
			search: { rootLayout: 'rl', childLayout: 'cl', nestedLayout: 'nl', nestedPage: 'np' },
		});

		expect(ruta.currentRoute.comps).toStrictEqual([
			null,
			'root layout',
			null,
			'child layout',
			null,
			'nested layout',
			null,
			'nested page',
		]);
		expect(ruta.currentRoute.error).toBeNullable();
		expect(ruta.currentRoute.href).toBe(
			'/child/nested?rootLayout=rl&childLayout=cl&nestedLayout=nl&nestedPage=np',
		);
		expect(ruta.currentRoute.path).toBe('/child/nested');
		expect(ruta.currentRoute.params).toStrictEqual({});
		expect(ruta.currentRoute.search).toStrictEqual({
			rootLayout: 'rl',
			childLayout: 'cl',
			nestedLayout: 'nl',
			nestedPage: 'np',
		});
	});
});

suite(`${Ruta.name} hooks`, () => {
	test(`should run hooks`, async () => {
		const root = createRouteBuilder(null, '/').layout().page();
		root.comps = [null, rootLayout, null, rootPage];
		const routes = {
			[root.path]: root,
		};
		const ruta = new RutaTest({ routes });

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

	test(`should remove hooks`, async () => {
		const root = createRouteBuilder(null, '/').layout().page();
		root.comps = [null, rootLayout, null, rootPage];
		const routes = {
			[root.path]: root,
		};
		const ruta = new RutaTest({ routes });

		const before1 = vi.fn();
		const before2 = vi.fn();
		const after1 = vi.fn();
		const after2 = vi.fn();
		const b1 = ruta.before(before1);
		ruta.after(after1);
		ruta.before(before2);
		const a2 = ruta.after(after2);

		b1();
		a2();
		await ruta.navigate('/');

		expect(before1).not.toHaveBeenCalled();
		expect(before2).toHaveBeenCalledOnce();
		expect(after1).toHaveBeenCalledOnce();
		expect(after2).not.toHaveBeenCalled();
	});

	test(`should warn adding hooks after navigation`, async () => {
		const root = createRouteBuilder(null, '/').layout().page();
		root.comps = [null, rootLayout, null, rootPage];
		const routes = {
			[root.path]: root,
		};
		const ruta = new RutaTest({ routes });

		const warnSpy = vi.spyOn(console, 'warn');
		await ruta.navigate('/');
		ruta.after(() => {});

		expect(warnSpy).toHaveBeenCalledOnce();
		expect(warnSpy).toHaveBeenCalledWith(
			`[ruta warn]: navigation hook should be registered before visiting a route.`,
		);
		warnSpy.mockClear();
	});
});

suite(`${Ruta.name} error handling`, () => {
	test(`error thrown in root route before hook`, async () => {
		const root = createRouteBuilder(null, '/').layout().page();
		root.comps = [null, rootLayout, null, rootPage];
		const routes = { [root.path]: root };
		const testError = new Error('before hook error');
		const onError = vi.fn();
		const ruta = new RutaTest({ routes, onError });

		ruta.before(() => {
			throw testError;
		});

		await ruta.navigate('/');

		expect(ruta.currentRoute.comps).toStrictEqual([null, 'root layout', null, 'root page']);
		expect(ruta.currentRoute.comps.length - 1).toBeGreaterThanOrEqual(
			ruta.currentRoute.errorIndex! * 2 + 1,
		);
		expect(ruta.currentRoute.error).toBe(testError);
		expect(ruta.currentRoute.errorIndex).toBe(0);
		expect(ruta.currentRoute.href).toBe('/');
		expect(ruta.currentRoute.path).toBe('/');
		expect(ruta.currentRoute.params).toStrictEqual({});
		expect(ruta.currentRoute.search).toStrictEqual({});
		expect(onError).toHaveBeenCalledWith(testError);
	});

	test(`error thrown in later before hook (2nd hook)`, async () => {
		const root = createRouteBuilder(null, '/').layout().page();
		root.comps = [null, rootLayout, null, rootPage];
		const routes = { [root.path]: root };
		const testError = new Error('second before hook error');
		const onError = vi.fn();
		const firstHook = vi.fn();
		const ruta = new RutaTest({ routes, onError });

		ruta.before(firstHook);
		ruta.before(() => {
			throw testError;
		});

		await ruta.navigate('/');

		expect(ruta.currentRoute.comps).toStrictEqual([null, 'root layout', null, 'root page']);
		expect(ruta.currentRoute.comps.length - 1).toBeGreaterThanOrEqual(
			ruta.currentRoute.errorIndex! * 2 + 1,
		);
		expect(ruta.currentRoute.error).toBe(testError);
		expect(ruta.currentRoute.errorIndex).toBe(0);
		expect(ruta.currentRoute.href).toBe('/');
		expect(ruta.currentRoute.path).toBe('/');
		expect(ruta.currentRoute.params).toStrictEqual({});
		expect(ruta.currentRoute.search).toStrictEqual({});
		expect(firstHook).toHaveBeenCalledOnce();
		expect(onError).toHaveBeenCalledWith(testError);
	});

	test(`async error thrown in root route before hook`, async () => {
		const root = createRouteBuilder(null, '/').layout().page();
		root.comps = [null, rootLayout, null, rootPage];
		const routes = { [root.path]: root };
		const testError = new Error('async before hook error');
		const onError = vi.fn();
		const ruta = new RutaTest({ routes, onError });

		ruta.before(async () => {
			await Promise.resolve();
			throw testError;
		});

		await ruta.navigate('/');

		expect(ruta.currentRoute.comps).toStrictEqual([null, 'root layout', null, 'root page']);
		expect(ruta.currentRoute.comps.length - 1).toBeGreaterThanOrEqual(
			ruta.currentRoute.errorIndex! * 2 + 1,
		);
		expect(ruta.currentRoute.error).toBe(testError);
		expect(ruta.currentRoute.errorIndex).toBe(0);
		expect(ruta.currentRoute.href).toBe('/');
		expect(ruta.currentRoute.path).toBe('/');
		expect(ruta.currentRoute.params).toStrictEqual({});
		expect(ruta.currentRoute.search).toStrictEqual({});
		expect(onError).toHaveBeenCalledWith(testError);
	});

	test(`async error thrown in later before hook (2nd hook)`, async () => {
		const root = createRouteBuilder(null, '/').layout().page();
		root.comps = [null, rootLayout, null, rootPage];
		const routes = { [root.path]: root };
		const testError = new Error('async second before hook error');
		const onError = vi.fn();
		const firstHook = vi.fn();
		const ruta = new RutaTest({ routes, onError });

		ruta.before(firstHook);
		ruta.before(async () => {
			await Promise.resolve();
			throw testError;
		});

		await ruta.navigate('/');

		expect(ruta.currentRoute.comps).toStrictEqual([null, 'root layout', null, 'root page']);
		expect(ruta.currentRoute.comps.length - 1).toBeGreaterThanOrEqual(
			ruta.currentRoute.errorIndex! * 2 + 1,
		);
		expect(ruta.currentRoute.error).toBe(testError);
		expect(ruta.currentRoute.errorIndex).toBe(0);
		expect(ruta.currentRoute.href).toBe('/');
		expect(ruta.currentRoute.path).toBe('/');
		expect(ruta.currentRoute.params).toStrictEqual({});
		expect(ruta.currentRoute.search).toStrictEqual({});
		expect(firstHook).toHaveBeenCalledOnce();
		expect(onError).toHaveBeenCalledWith(testError);
	});

	test(`error thrown in root route after hook`, async () => {
		const root = createRouteBuilder(null, '/').layout().page();
		root.comps = [null, rootLayout, null, rootPage];
		const routes = { [root.path]: root };
		const testError = new Error('after hook error');
		const onError = vi.fn();
		const ruta = new RutaTest({ routes, onError });

		ruta.after(() => {
			throw testError;
		});

		await ruta.navigate('/');

		expect(ruta.currentRoute.comps).toStrictEqual([null, 'root layout', null, 'root page']);
		expect(ruta.currentRoute.comps.length - 1).toBeGreaterThanOrEqual(
			ruta.currentRoute.errorIndex! * 2 + 1,
		);
		expect(ruta.currentRoute.error).toBe(testError);
		expect(ruta.currentRoute.errorIndex).toBe(0);
		expect(ruta.currentRoute.href).toBe('/');
		expect(ruta.currentRoute.path).toBe('/');
		expect(ruta.currentRoute.params).toStrictEqual({});
		expect(ruta.currentRoute.search).toStrictEqual({});
		expect(onError).toHaveBeenCalledWith(testError);
	});

	test(`error thrown in later after hook (2nd hook)`, async () => {
		const root = createRouteBuilder(null, '/').layout().page();
		root.comps = [null, rootLayout, null, rootPage];
		const routes = { [root.path]: root };
		const testError = new Error('second after hook error');
		const onError = vi.fn();
		const firstHook = vi.fn();
		const ruta = new RutaTest({ routes, onError });

		ruta.after(firstHook);
		ruta.after(() => {
			throw testError;
		});

		await ruta.navigate('/');

		expect(ruta.currentRoute.comps).toStrictEqual([null, 'root layout', null, 'root page']);
		expect(ruta.currentRoute.comps.length - 1).toBeGreaterThanOrEqual(
			ruta.currentRoute.errorIndex! * 2 + 1,
		);
		expect(ruta.currentRoute.error).toBe(testError);
		expect(ruta.currentRoute.errorIndex).toBe(0);
		expect(ruta.currentRoute.href).toBe('/');
		expect(ruta.currentRoute.path).toBe('/');
		expect(ruta.currentRoute.params).toStrictEqual({});
		expect(ruta.currentRoute.search).toStrictEqual({});
		expect(firstHook).toHaveBeenCalledOnce();
		expect(onError).toHaveBeenCalledWith(testError);
	});

	test(`async error thrown in root route after hook`, async () => {
		const root = createRouteBuilder(null, '/').layout().page();
		root.comps = [null, rootLayout, null, rootPage];
		const routes = { [root.path]: root };
		const testError = new Error('async after hook error');
		const onError = vi.fn();
		const ruta = new RutaTest({ routes, onError });

		ruta.after(async () => {
			await Promise.resolve();
			throw testError;
		});

		await ruta.navigate('/');

		expect(ruta.currentRoute.comps).toStrictEqual([null, 'root layout', null, 'root page']);
		expect(ruta.currentRoute.comps.length - 1).toBeGreaterThanOrEqual(
			ruta.currentRoute.errorIndex! * 2 + 1,
		);
		expect(ruta.currentRoute.error).toBe(testError);
		expect(ruta.currentRoute.errorIndex).toBe(0);
		expect(ruta.currentRoute.href).toBe('/');
		expect(ruta.currentRoute.path).toBe('/');
		expect(ruta.currentRoute.params).toStrictEqual({});
		expect(ruta.currentRoute.search).toStrictEqual({});
		expect(onError).toHaveBeenCalledWith(testError);
	});

	test(`async error thrown in later after hook (2nd hook)`, async () => {
		const root = createRouteBuilder(null, '/').layout().page();
		root.comps = [null, rootLayout, null, rootPage];
		const routes = { [root.path]: root };
		const testError = new Error('async second after hook error');
		const onError = vi.fn();
		const firstHook = vi.fn();
		const ruta = new RutaTest({ routes, onError });

		ruta.after(firstHook);
		ruta.after(async () => {
			await Promise.resolve();
			throw testError;
		});

		await ruta.navigate('/');

		expect(ruta.currentRoute.comps).toStrictEqual([null, 'root layout', null, 'root page']);
		expect(ruta.currentRoute.comps.length - 1).toBeGreaterThanOrEqual(
			ruta.currentRoute.errorIndex! * 2 + 1,
		);
		expect(ruta.currentRoute.error).toBe(testError);
		expect(ruta.currentRoute.errorIndex).toBe(0);
		expect(ruta.currentRoute.href).toBe('/');
		expect(ruta.currentRoute.path).toBe('/');
		expect(ruta.currentRoute.params).toStrictEqual({});
		expect(ruta.currentRoute.search).toStrictEqual({});
		expect(firstHook).toHaveBeenCalledOnce();
		expect(onError).toHaveBeenCalledWith(testError);
	});

	test(`error thrown in root route layout load hook`, async () => {
		const testError = new Error('root layout load error');
		const root = createRouteBuilder(null, '/')
			.layout({
				load: () => {
					throw testError;
				},
			})
			.page();
		root.comps = [null, rootLayout, null, rootPage];
		const routes = { [root.path]: root };
		const onError = vi.fn();
		const ruta = new RutaTest({ routes, onError });

		await ruta.navigate('/');

		expect(ruta.currentRoute.comps).toStrictEqual([null, 'root layout', null, 'root page']);
		expect(ruta.currentRoute.comps.length - 1).toBeGreaterThanOrEqual(
			ruta.currentRoute.errorIndex! * 2 + 1,
		);
		expect(ruta.currentRoute.error).toBe(testError);
		expect(ruta.currentRoute.errorIndex).toBe(0);
		expect(ruta.currentRoute.href).toBe('/');
		expect(ruta.currentRoute.path).toBe('/');
		expect(ruta.currentRoute.params).toStrictEqual({});
		expect(ruta.currentRoute.search).toStrictEqual({});
		expect(onError).toHaveBeenCalledWith(testError);
	});

	test(`error thrown in root route page load hook`, async () => {
		const testError = new Error('root page load error');
		const root = createRouteBuilder(null, '/')
			.layout()
			.page({
				load: () => {
					throw testError;
				},
			});
		root.comps = [null, rootLayout, null, rootPage];
		const routes = { [root.path]: root };
		const onError = vi.fn();
		const ruta = new RutaTest({ routes, onError });

		await ruta.navigate('/');

		expect(ruta.currentRoute.comps).toStrictEqual([null, 'root layout', null, 'root page']);
		expect(ruta.currentRoute.comps.length - 1).toBeGreaterThanOrEqual(
			ruta.currentRoute.errorIndex! * 2 + 1,
		);
		expect(ruta.currentRoute.error).toBe(testError);
		expect(ruta.currentRoute.errorIndex).toBe(1);
		expect(ruta.currentRoute.href).toBe('/');
		expect(ruta.currentRoute.path).toBe('/');
		expect(ruta.currentRoute.params).toStrictEqual({});
		expect(ruta.currentRoute.search).toStrictEqual({});
		expect(onError).toHaveBeenCalledWith(testError);
	});

	test(`error thrown in deep nested layout load hook`, async () => {
		const testError = new Error('nested layout load error');
		const root = createRouteBuilder(null, '/').layout().page();
		const child = createRouteBuilder(root, 'child').layout().page();
		const nested = createRouteBuilder(child, 'nested')
			.layout({
				load: () => {
					throw testError;
				},
			})
			.page();
		root.comps = [null, rootLayout, null, rootPage];
		child.comps = [null, childLayout, null, childPage];
		nested.comps = [null, nestedLayout, null, nestedPage];
		const routes = { [root.path]: root, [child.path]: child, [nested.path]: nested };
		const onError = vi.fn();
		const ruta = new RutaTest({ routes, onError });

		await ruta.navigate('/child/nested');

		expect(ruta.currentRoute.comps).toStrictEqual([
			null,
			'root layout',
			null,
			'child layout',
			null,
			'nested layout',
			null,
			'nested page',
		]);
		expect(ruta.currentRoute.comps.length - 1).toBeGreaterThanOrEqual(
			ruta.currentRoute.errorIndex! * 2 + 1,
		);
		expect(ruta.currentRoute.error).toBe(testError);
		expect(ruta.currentRoute.errorIndex).toBe(2);
		expect(ruta.currentRoute.href).toBe('/child/nested');
		expect(ruta.currentRoute.path).toBe('/child/nested');
		expect(ruta.currentRoute.params).toStrictEqual({});
		expect(ruta.currentRoute.search).toStrictEqual({});
		expect(onError).toHaveBeenCalledWith(testError);
	});

	test(`error thrown in deep nested page load hook`, async () => {
		const testError = new Error('nested page load error');
		const root = createRouteBuilder(null, '/').layout().page();
		const child = createRouteBuilder(root, 'child').layout().page();
		const nested = createRouteBuilder(child, 'nested')
			.layout()
			.page({
				load: () => {
					throw testError;
				},
			});
		root.comps = [null, rootLayout, null, rootPage];
		child.comps = [null, childLayout, null, childPage];
		nested.comps = [null, nestedLayout, null, nestedPage];
		const routes = { [root.path]: root, [child.path]: child, [nested.path]: nested };
		const onError = vi.fn();
		const ruta = new RutaTest({ routes, onError });

		await ruta.navigate('/child/nested');

		expect(ruta.currentRoute.comps).toStrictEqual([
			null,
			'root layout',
			null,
			'child layout',
			null,
			'nested layout',
			null,
			'nested page',
		]);
		expect(ruta.currentRoute.comps.length - 1).toBeGreaterThanOrEqual(
			ruta.currentRoute.errorIndex! * 2 + 1,
		);
		expect(ruta.currentRoute.error).toBe(testError);
		expect(ruta.currentRoute.errorIndex).toBe(3);
		expect(ruta.currentRoute.href).toBe('/child/nested');
		expect(ruta.currentRoute.path).toBe('/child/nested');
		expect(ruta.currentRoute.params).toStrictEqual({});
		expect(ruta.currentRoute.search).toStrictEqual({});
		expect(onError).toHaveBeenCalledWith(testError);
	});

	test(`error thrown in deep nested layout component`, async () => {
		const testError = new Error('nested layout component error');
		const root = createRouteBuilder(null, '/').layout().page();
		const child = createRouteBuilder(root, 'child').layout().page();
		const nested = createRouteBuilder(child, 'nested').layout().page();
		root.comps = [null, rootLayout, null, rootPage];
		child.comps = [null, childLayout, null, childPage];
		nested.comps = [
			null,
			async () => {
				throw testError;
			},
			null,
			nestedPage,
		];
		const routes = { [root.path]: root, [child.path]: child, [nested.path]: nested };
		const onError = vi.fn();
		const ruta = new RutaTest({ routes, onError });

		await ruta.navigate('/child/nested');

		expect(ruta.currentRoute.comps).toStrictEqual([
			null,
			'root layout',
			null,
			'child layout',
			null,
			null,
		]);
		expect(ruta.currentRoute.comps.length - 1).toBeGreaterThanOrEqual(
			ruta.currentRoute.errorIndex! * 2 + 1,
		);
		expect(ruta.currentRoute.error).toBe(testError);
		expect(ruta.currentRoute.errorIndex).toBe(2);
		expect(ruta.currentRoute.href).toBe('/child/nested');
		expect(ruta.currentRoute.path).toBe('/child/nested');
		expect(ruta.currentRoute.params).toStrictEqual({});
		expect(ruta.currentRoute.search).toStrictEqual({});
		expect(onError).toHaveBeenCalledWith(testError);
	});

	test(`error thrown in deep nested page component`, async () => {
		const testError = new Error('nested page component error');
		const root = createRouteBuilder(null, '/').layout().page();
		const child = createRouteBuilder(root, 'child').layout().page();
		const nested = createRouteBuilder(child, 'nested').layout().page();
		root.comps = [null, rootLayout, null, rootPage];
		child.comps = [null, childLayout, null, childPage];
		nested.comps = [
			null,
			nestedLayout,
			null,
			async () => {
				throw testError;
			},
		];
		const routes = { [root.path]: root, [child.path]: child, [nested.path]: nested };
		const onError = vi.fn();
		const ruta = new RutaTest({ routes, onError });

		await ruta.navigate('/child/nested');

		expect(ruta.currentRoute.comps).toStrictEqual([
			null,
			'root layout',
			null,
			'child layout',
			null,
			'nested layout',
			null,
			null,
		]);
		expect(ruta.currentRoute.comps.length - 1).toBeGreaterThanOrEqual(
			ruta.currentRoute.errorIndex! * 2 + 1,
		);
		expect(ruta.currentRoute.error).toBe(testError);
		expect(ruta.currentRoute.errorIndex).toBe(3);
		expect(ruta.currentRoute.href).toBe('/child/nested');
		expect(ruta.currentRoute.path).toBe('/child/nested');
		expect(ruta.currentRoute.params).toStrictEqual({});
		expect(ruta.currentRoute.search).toStrictEqual({});
		expect(onError).toHaveBeenCalledWith(testError);
	});

	test(`parse params`, async () => {
		const testError = new Error('parse params');
		const root = createRouteBuilder(null, '/').layout().page();
		const user = createRouteBuilder(root, ':userId').page({
			parseParams: (params) => {
				if (params.userId === 'a') {
					return { userId: params.userId };
				}
				throw testError;
			},
		});
		root.comps = [null, rootLayout, null, rootPage];
		user.comps = [null, null, null, userPage];
		const routes = { [root.path]: root, [user.path]: user };
		const onError = vi.fn();
		const ruta = new RutaTest({ routes, onError });

		await ruta.navigate({ path: '/:userId', params: { userId: 'xyz' } });

		expect(ruta.currentRoute.comps).toStrictEqual([
			null,
			'root layout',
			null,
			null,
			null,
			'user page',
		]);
		expect(ruta.currentRoute.comps.length - 1).toBeGreaterThanOrEqual(
			ruta.currentRoute.errorIndex! * 2 + 1,
		);
		expect(ruta.currentRoute.error).toBe(testError);
		expect(ruta.currentRoute.errorIndex).toBe(1);
		expect(ruta.currentRoute.href).toBe('/xyz');
		expect(ruta.currentRoute.path).toBe('/:userId');
		expect(ruta.currentRoute.params).toStrictEqual({ userId: 'xyz' });
		expect(ruta.currentRoute.search).toStrictEqual({});
		expect(onError).toHaveBeenCalledWith(testError);
	});

	test(`parse search`, async () => {
		const testError = new Error('parse search');
		const root = createRouteBuilder(null, '/').layout().page();
		const user = createRouteBuilder(root, ':userId').page({
			parseSearch: () => {
				throw testError;
			},
		});
		root.comps = [null, rootLayout, null, rootPage];
		user.comps = [null, null, null, userPage];
		const routes = { [root.path]: root, [user.path]: user };
		const onError = vi.fn();
		const ruta = new RutaTest({ routes, onError });

		await ruta.navigate({ path: '/:userId', params: { userId: 'xyz' } });

		expect(ruta.currentRoute.comps).toStrictEqual([
			null,
			'root layout',
			null,
			null,
			null,
			'user page',
		]);
		expect(ruta.currentRoute.comps.length - 1).toBeGreaterThanOrEqual(
			ruta.currentRoute.errorIndex! * 2 + 1,
		);
		expect(ruta.currentRoute.error).toBe(testError);
		expect(ruta.currentRoute.errorIndex).toBe(2);
		expect(ruta.currentRoute.href).toBe('/xyz');
		expect(ruta.currentRoute.path).toBe('/:userId');
		expect(ruta.currentRoute.params).toStrictEqual({ userId: 'xyz' });
		expect(ruta.currentRoute.search).toStrictEqual({});
		expect(onError).toHaveBeenCalledWith(testError);
	});

	test(`redirect before hook`, async () => {
		const testError = new Error('redirect before hook');
		const root = createRouteBuilder(null, '/').layout().page();
		const child = createRouteBuilder(root, 'child').page();
		root.comps = [null, rootLayout, null, rootPage];
		child.comps = [null, childLayout, null, childPage];
		const routes = { [root.path]: root, [child.path]: child };
		const onError = vi.fn();
		const ruta = new RutaTest({ routes, onError });
		ruta.before(({ to }) => {
			if (to.path === '/') {
				getTypedAPI<any, any, any>().redirect('/child');
			}
		});

		await ruta.navigate('/');

		expect(ruta.currentRoute.comps).toStrictEqual([
			null,
			'root layout',
			null,
			'child layout',
			null,
			'child page',
		]);
		expect(ruta.currentRoute.error).toBeNullable();
		expect(ruta.currentRoute.errorIndex).toBeNullable();
		expect(ruta.currentRoute.href).toBe('/child');
		expect(ruta.currentRoute.path).toBe('/child');
		expect(ruta.currentRoute.params).toStrictEqual({});
		expect(ruta.currentRoute.search).toStrictEqual({});
		expect(onError).not.toHaveBeenCalledWith(testError);
	});

	test(`redirect layout load hook`, async () => {
		const root = createRouteBuilder(null, '/').layout().page();
		const child = createRouteBuilder(root, 'child')
			.layout({
				load: ({ to }) => {
					if (to.path === '/child') {
						redirect('/');
					}
				},
			})
			.page();
		root.comps = [null, rootLayout, null, rootPage];
		child.comps = [null, childLayout, null, childPage];
		const routes = { [root.path]: root, [child.path]: child };
		const onError = vi.fn();
		const ruta = new RutaTest({ routes, onError });

		await ruta.navigate('/child');

		expect(ruta.currentRoute.comps).toStrictEqual([null, 'root layout', null, 'root page']);
		expect(ruta.currentRoute.error).toBeNullable();
		expect(ruta.currentRoute.errorIndex).toBeNullable();
		expect(ruta.currentRoute.href).toBe('/');
		expect(ruta.currentRoute.path).toBe('/');
		expect(ruta.currentRoute.params).toStrictEqual({});
		expect(ruta.currentRoute.search).toStrictEqual({});
		expect(onError).not.toHaveBeenCalled();
	});

	test(`redirect page load hook`, async () => {
		const root = createRouteBuilder(null, '/').layout().page();
		const child = createRouteBuilder(root, 'child')
			.layout()
			.page({
				load: ({ to }) => {
					if (to.path === '/child') {
						redirect('/');
					}
				},
			});
		root.comps = [null, rootLayout, null, rootPage];
		child.comps = [null, childLayout, null, childPage];
		const routes = { [root.path]: root, [child.path]: child };
		const onError = vi.fn();
		const ruta = new RutaTest({ routes, onError });

		await ruta.navigate('/child');

		expect(ruta.currentRoute.comps).toStrictEqual([null, 'root layout', null, 'root page']);
		expect(ruta.currentRoute.error).toBeNullable();
		expect(ruta.currentRoute.errorIndex).toBeNullable();
		expect(ruta.currentRoute.href).toBe('/');
		expect(ruta.currentRoute.path).toBe('/');
		expect(ruta.currentRoute.params).toStrictEqual({});
		expect(ruta.currentRoute.search).toStrictEqual({});
		expect(onError).not.toHaveBeenCalled();
	});

	test(`triple redirect chain: before hook → layout load → page load`, async () => {
		const route1Layout = async () => ({ default: 'route1 layout' });
		const route1Page = async () => ({ default: 'route1 page' });
		const route2Layout = async () => ({ default: 'route2 layout' });
		const route2Page = async () => ({ default: 'route2 page' });
		const route3Layout = async () => ({ default: 'route3 layout' });
		const route3Page = async () => ({ default: 'route3 page' });

		const root = createRouteBuilder(null, '/').layout().page();
		const route1 = createRouteBuilder(root, 'route1')
			.layout({
				load: ({ to }) => {
					if (to.path === '/route1') {
						redirect('/route2');
					}
				},
			})
			.page();
		const route2 = createRouteBuilder(root, 'route2')
			.layout()
			.page({
				load: ({ to }) => {
					if (to.path === '/route2') {
						redirect('/route3');
					}
				},
			});
		const route3 = createRouteBuilder(root, 'route3').layout().page();

		root.comps = [null, rootLayout, null, rootPage];
		route1.comps = [null, route1Layout, null, route1Page];
		route2.comps = [null, route2Layout, null, route2Page];
		route3.comps = [null, route3Layout, null, route3Page];

		const routes = {
			[root.path]: root,
			[route1.path]: route1,
			[route2.path]: route2,
			[route3.path]: route3,
		};
		const onError = vi.fn();
		const ruta = new RutaTest({ routes, onError });

		ruta.before(({ to }) => {
			if (to.path === '/') {
				redirect('/route1');
			}
		});

		await ruta.navigate('/');

		expect(ruta.currentRoute.comps).toStrictEqual([
			null,
			'root layout',
			null,
			'route3 layout',
			null,
			'route3 page',
		]);
		expect(ruta.currentRoute.error).toBeNullable();
		expect(ruta.currentRoute.errorIndex).toBeNullable();
		expect(ruta.currentRoute.href).toBe('/route3');
		expect(ruta.currentRoute.path).toBe('/route3');
		expect(ruta.currentRoute.params).toStrictEqual({});
		expect(ruta.currentRoute.search).toStrictEqual({});
		expect(onError).not.toHaveBeenCalled();
	});
});

// suite(`${Ruta.name} integration`, () => {});

suite(getTypedAPI, () => {
	test('dev', () => {
		assert.hasAllKeys(getTypedAPI(), ['redirect']);
	});
});
