<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue';

const err = ref();

onErrorCaptured((e) => {
	err.value = e;
	console.error(e);
	return false;
});
</script>

<template>
	<template v-if="err">
		{{ err }}
	</template>
	<slot v-else></slot>
</template>
