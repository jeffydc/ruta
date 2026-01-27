import type { Component } from 'svelte';

declare module '@jeffydc/ruta-core' {
	export interface Register {
		component: Component;
	}
}
