/// <reference types="@types/dom-navigation" />
/// <reference types="urlpattern-polyfill" />

export {
	Ruta,
	createRouteBuilder,
	createEmptyRoute,
	getTypedAPI,
	redirect,
	warn,
} from './internal.ts';
export type { RutaOptions, Route, Register } from './internal.ts';
