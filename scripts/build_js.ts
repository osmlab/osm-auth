
await Promise.all([
   Bun.build({
    entrypoints: ['./src/index.ts'],
    outdir: './dist/js',
    target: 'browser',
    format: 'iife',
    sourcemap: 'linked',
    naming: 'osm-auth.iife.[ext]'  // .iife.js
  }),

  Bun.build({
    entrypoints: ['./src/osm-auth.ts'],
    outdir: './dist/js',
    target: 'node',
    format: 'esm',
    packages: 'external',
    sourcemap: 'linked',
    naming: 'osm-auth.m[ext]'  // .mjs
  })
]);
