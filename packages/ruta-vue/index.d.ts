import type { Component, DefineComponent } from 'vue';

declare module '@jeffydc/ruta-core' {
	export interface Register {
		component: Component | DefineComponent;
	}
}
