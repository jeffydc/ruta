import { RutaVue } from '@jeffydc/ruta-vue';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { createApp } from 'vue';

import { routes } from './+routes.gen.ts';
import App from './App.vue';

const router = new RutaVue({
	routes,
});

export type Router = typeof router;

const app = createApp(App).use(router).use(VueQueryPlugin, { queryClient: router.context.qc });

router.navigate().then(() => app.mount('#app'));
