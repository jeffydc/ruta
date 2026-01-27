import { createRouteBuilder } from '@jeffydc/ruta-vue';

import { parentRoute } from './+route.gen.ts';

export const route = createRouteBuilder(parentRoute, ':commentId')
	.layout({
		parseParams(params) {
			return { commentId: +params.commentId };
		},
		parseSearch(search) {
			return { who: search.get('who') };
		},
		async load({ context }) {
			await context.qc.ensureQueryData({
				queryKey: ['comments'],
				queryFn: async () => {
					return await fetch('https://jsonplaceholder.typicode.com/comments').then((response) =>
						response.json(),
					);
				},
			});
			await context.qc.ensureQueryData({
				queryKey: ['posts'],
				queryFn: async () => {
					return await fetch('https://jsonplaceholder.typicode.com/posts').then((response) =>
						response.json(),
					);
				},
			});
			// throw new Error('comment layout')
		},
	})
	.page({
		parseSearch(search) {
			return { private: search.get('p') };
		},
		load() {
			// throw new Error('comment page');
		},
	});
