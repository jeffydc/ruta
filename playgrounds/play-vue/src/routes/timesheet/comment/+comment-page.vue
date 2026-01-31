<script setup lang="ts">
import { RouteTyped } from './+route.gen.ts';

const route = RouteTyped.usePageRoute();
route.search.private;
route.comps;
</script>

<template>
	<div>
		comment page:
		<pre>{{ route }}</pre>
	</div>
</template>
