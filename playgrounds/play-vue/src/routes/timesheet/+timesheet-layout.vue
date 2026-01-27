<script setup lang="ts">
import { useLayoutRoute } from './+route.gen.ts';

const route = useLayoutRoute();
</script>

<template>
	<div>
		timesheet layout:
		<pre>{{ route }}</pre>
	</div>
	<slot></slot>
</template>
