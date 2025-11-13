import {defineConfig} from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'lib',
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  minify: false,
  external: ['@slack/types', 'fast-xml-parser', 'marked'],
});
