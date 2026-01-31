<script setup lang="ts">
import { RouteTyped } from './+route.gen.ts';

const route = RouteTyped.usePageRoute();
</script>

<template>
	<div>
		root page:
		<pre>{{ route }}</pre>
	</div>
	<slot></slot>
</template>
