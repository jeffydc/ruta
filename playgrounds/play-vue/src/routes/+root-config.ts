import { createRouteBuilder } from '@jeffydc/ruta-vue';
import { QueryClient } from '@tanstack/vue-query';

export const route = createRouteBuilder(null, '/', () => ({
	qc: new QueryClient(),
}))
	.layout({
		parseSearch(search) {
			return { page: +search.get('page')! };
		},
		async load({ context }) {
			await context.qc.ensureQueryData({
				queryKey: ['posts'],
				queryFn: async () => {
					return await fetch('https://jsonplaceholder.typicode.com/posts').then((response) =>
						response.json(),
					);
				},
			});
		},
	})
	.page({
		parseSearch(search) {
			return { q: search.get('q') };
		},
	});
