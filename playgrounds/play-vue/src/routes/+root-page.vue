<script setup lang="ts">
import { usePageRoute } from './+route.gen.ts';

const route = usePageRoute();
</script>

<template>
	<div>
		root page:
		<pre>{{ route }}</pre>
	</div>
	<slot></slot>
</template>
