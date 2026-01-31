<script setup lang="ts">
import { RouteTyped } from './+route.gen.ts';

const route = RouteTyped.usePageRoute();

route.search.status;
</script>

<template>
	<div>
		timesheet page:
		<pre>{{ route }}</pre>
	</div>
	<slot></slot>
</template>
