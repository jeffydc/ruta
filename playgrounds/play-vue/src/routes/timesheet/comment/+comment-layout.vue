<script setup lang="ts">
import { RouteTyped } from './+route.gen.ts';

const route = RouteTyped.useLayoutRoute();
</script>

<template>
	<div>
		comment layout:
		<pre>{{ route }}</pre>
	</div>
	<slot></slot>
</template>
