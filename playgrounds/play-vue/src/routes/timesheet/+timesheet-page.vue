<script setup lang="ts">
import { usePageRoute } from './+route.gen.ts';

const route = usePageRoute();

route.search.status;
</script>

<template>
	<div>
		timesheet page:
		<pre>{{ route }}</pre>
	</div>
	<slot></slot>
</template>
