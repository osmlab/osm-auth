
await Promise.all([
   Bun.build({
    entrypoints: ['./src/index.ts'],
    outdir: './dist',
    target: 'browser',
    format: 'iife',
    sourcemap: 'linked',
    naming: 'osm-auth.iife.[ext]'  // .iife.js
  }),

  Bun.build({
    entrypoints: ['./src/osm-auth.mjs'],
    outdir: './dist',
    target: 'node',
    format: 'cjs',
    sourcemap: 'linked',
    naming: 'osm-auth.c[ext]'  // .cjs
  }),

  Bun.build({
    entrypoints: ['./src/osm-auth.mjs'],
    outdir: './dist',
    target: 'node',
    format: 'esm',
    sourcemap: 'linked',
    naming: 'osm-auth.m[ext]'  // .mjs
  })
]);
