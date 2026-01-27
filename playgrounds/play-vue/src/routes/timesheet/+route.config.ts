import { createRouteBuilder } from '@jeffydc/ruta-vue';

import { parentRoute } from './+route.gen.ts';

export const route = createRouteBuilder(parentRoute, ':timesheetId')
	.layout({
		parseParams(params) {
			return { timesheetId: +params.timesheetId };
		},
		parseSearch(search) {
			return { group: search.get('group') };
		},
	})
	.page({
		parseSearch(search) {
			return { status: search.get('status') };
		},
	});
