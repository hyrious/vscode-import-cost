import { build } from 'esbuild';
import { external } from '@hyrious/esbuild-plugin-external';

await build({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs', // TODO: change to 'esm' once Cursor uses VS Code 1.100+
  mainFields: ['module', 'main'],
  external: ['vscode', 'esbuild'],
  // plugins: [external()],
  outdir: 'out',
  sourcemap: true,
  sourcesContent: false,
  logLevel: 'info',
}).catch(() => process.exit(1));
