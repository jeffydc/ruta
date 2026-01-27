import { RutaVue } from '@jeffydc/ruta-vue';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createApp } from 'vue';

import { routes } from './+routes.gen.ts';
import App from './App.vue';

const qc = new QueryClient();

const router = new RutaVue({
	routes,
	context: { qc },
});

export type Router = typeof router;

const app = createApp(App).use(router).use(VueQueryPlugin, { queryClient: qc });

router.navigate().then(() => app.mount('#app'));
