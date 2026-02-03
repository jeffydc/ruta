<script lang="ts">
	import { usePageRoute } from './mod.svelte.ts';

	const route = usePageRoute();
	const error = $derived(route.error);

	$effect(() => {
		if (error) {
			throw error;
		}
	});
</script>
