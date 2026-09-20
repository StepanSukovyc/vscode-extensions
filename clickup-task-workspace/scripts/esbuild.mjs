import { rm } from 'node:fs/promises';
import process from 'node:process';
import * as esbuild from 'esbuild';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

if (process.argv.includes('--clean')) {
  await rm('dist', { force: true, recursive: true });
  process.exit(0);
}

const options = {
  bundle: true,
  entryPoints: ['src/extension.ts'],
  external: ['vscode'],
  format: 'cjs',
  logLevel: 'info',
  minify: production,
  outfile: 'dist/extension.js',
  platform: 'node',
  sourcemap: !production,
  target: 'node20',
};

if (watch) {
  const context = await esbuild.context(options);
  await context.watch();
  console.log('Sledování změn bylo spuštěno.');
} else {
  await esbuild.build(options);
}
