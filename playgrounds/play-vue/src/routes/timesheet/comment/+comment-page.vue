<script setup lang="ts">
import { usePageRoute } from './+route.gen.ts';

const route = usePageRoute();
route.search.private;
route.comps;
</script>

<template>
	<div>
		comment page:
		<pre>{{ route }}</pre>
	</div>
</template>
