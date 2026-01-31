<script setup lang="ts">
import { RouteTyped } from './+route.gen.ts';

const router = RouteTyped.useRouter();
const route = RouteTyped.useLayoutRoute();

route.path === '/';

route.search.page;

const links = [
	router.href('/'),
	router.href({
		path: '/:timesheetId',
		params: { timesheetId: 123 },
		search: { page: 1, group: 'all', q: 'vue' },
	}),
	router.href({
		path: '/:timesheetId/:commentId',
		params: { commentId: 456, timesheetId: 123 },
		search: { page: 1, group: 'all', q: 'vue', private: 'yes', who: 'me' },
	}),
];
</script>

<template>
	<a v-for="link in links" :href="link">{{ link }}</a>
	<div>
		root layout:
		<pre>{{ route }}</pre>
	</div>
	<slot></slot>
</template>

<style scoped>
a {
	display: block;
}
</style>
