import { osmAuth } from './osm-auth.ts';

declare global {
  var osmAuth: typeof import('./osm-auth.ts').osmAuth;
}

globalThis.osmAuth = osmAuth;
