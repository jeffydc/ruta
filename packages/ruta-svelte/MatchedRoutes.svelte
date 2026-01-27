<script lang="ts" module>
	import { createContext } from 'svelte';
	const [getDepth, setDepth] = createContext<number>();
</script>

<script lang="ts">
	import { usePageRoute } from './mod.svelte.ts';
	import MatchedRoutes from './MatchedRoutes.svelte';

	const route = usePageRoute();
	const index = getDepth() ?? 0;

	const Component = $derived(route.comps[index]);
	const hasChildren = $derived(route.comps.length > index + 1);

	setDepth(index + 1);
</script>

{#if Component}
	<Component>
		{#if hasChildren}
			<MatchedRoutes />
		{/if}
	</Component>
{/if}
