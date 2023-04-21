import type * as vscode from 'vscode';

import { window, workspace, commands, Range, Position } from 'vscode';
import { importCost, cache, Lang, ImportCostResult } from '@hyrious/import-cost';
import { filesize } from 'filesize';
import { spawnSync } from 'child_process';
import { platform } from 'os';
import { join } from 'path';

let isEnabled = true;
let esbuildPath: string | undefined;

export function activate(context: vscode.ExtensionContext) {
  esbuildPath ||= findEsbuildPath();

  context.subscriptions.push(
    workspace.onDidChangeTextDocument((ev) => update(ev.document)),
    window.onDidChangeActiveTextEditor((ev) => update(ev?.document)),
    commands.registerCommand('import-cost.toggle', () => {
      if ((isEnabled = !isEnabled)) {
        update(window.activeTextEditor?.document);
      } else {
        deactivate();
      }
    }),
    commands.registerCommand('import-cost.clear-cache', () => {
      deactivate();
      if (isEnabled) update(window.activeTextEditor?.document);
    })
  );

  update(window.activeTextEditor?.document);
}

export function deactivate() {
  cache.clear();
  clearDecorations();
}

function findEsbuildPath() {
  return join(
    spawnSync(platform() === 'win32' ? 'npm.cmd' : 'npm', ['root', '-g'], {
      shell: true,
      encoding: 'utf8',
    }).stdout.trim(),
    'esbuild/lib/main.js'
  );
}

function detectLanguage({ fileName, languageId }: vscode.TextDocument): Lang | undefined {
  if (languageId === 'svelte' || fileName.endsWith('.svelte')) return 'svelte';
  if (languageId === 'vue' || fileName.endsWith('.vue')) return 'vue';
  if (languageId === 'typescriptreact' || fileName.endsWith('.tsx')) return 'tsx';
  if (languageId === 'javascriptreact' || fileName.endsWith('.jsx')) return 'jsx';
  if (languageId === 'typescript' || fileName.endsWith('.ts')) return 'ts';
  if (languageId === 'javascript' || fileName.endsWith('.js')) return 'js';
}

function update(document: vscode.TextDocument | undefined) {
  if (isEnabled && document) {
    const lang = detectLanguage(document);
    if (lang) {
      refresh_(document, lang);
    }
  }
}

function noop() {
  return null;
}

// Slightly debounce the refresh to avoid too many esbuild runs.
let refresh_timer = setTimeout(noop);
function refresh_(document: vscode.TextDocument, lang: Lang) {
  clearTimeout(refresh_timer);
  refresh_timer = setTimeout(refresh.bind(null, document, lang), 500);
}

function node_modules_only(path: string) {
  return /^[@a-z]/.test(path);
}

const emitters = new Map<string, Promise<unknown>>();
async function refresh(document: vscode.TextDocument, lang: Lang) {
  const { fileName } = document;
  const code = document.getText();

  const p = importCost(fileName, code, { lang, esbuildPath, filter: node_modules_only });
  emitters.set(fileName, p);

  const result = await p.catch(noop);
  if (emitters.get(fileName) === p) {
    emitters.delete(fileName);
    if (!result) return;
    setDecorations(fileName, result);
  }
}

const decorations = new Map<string, Map<number, { size: number; gzip: number }>>();
const decorationType = window.createTextEditorDecorationType({});

function setDecorations(fileName: string, result: ImportCostResult) {
  let map = new Map<number, { size: number; gzip: number }>();
  for (const pkg of result.packages) {
    map.set(pkg.line, pkg);
  }
  decorations.set(fileName, map);
  debounceFlushDecorations(fileName);
}

function clearDecorations() {
  for (const editor of window.visibleTextEditors) {
    editor.setDecorations(decorationType, []);
  }
}

let flush_timer = setTimeout(noop);
function debounceFlushDecorations(fileName: string) {
  clearTimeout(flush_timer);
  flush_timer = setTimeout(flushDecorations.bind(null, fileName), 20);
}

function flushDecorations(fileName: string) {
  const arr: vscode.DecorationOptions[] = [];
  const map = decorations.get(fileName);
  if (map) {
    for (const line of map.keys()) {
      const data = map.get(line)!;
      if (data.size === 0) continue;
      arr.push({
        range: new Range(new Position(line - 1, 1024), new Position(line - 1, 1024)),
        renderOptions: {
          ...getDecorationColor(data),
          ...getDecorationMessage(data),
        },
      });
    }
  }
  for (const editor of window.visibleTextEditors) {
    if (editor.document.fileName === fileName) {
      editor.setDecorations(decorationType, arr);
    }
  }
}

const bundleSizeDecoration: 'minified' | 'gzipped' | 'both' = 'both';
const bundleSizeColoring: 'minified' | 'compressed' = 'minified';
const smallPackageSize = 50;
const mediumPackageSize = 100;
const smallPackageDarkColor = '#7cc36e';
const mediumPackageDarkColor = '#7cc36e';
const largePackageDarkColor = '#d44e40';
const smallPackageLightColor = '#7cc36e';
const mediumPackageLightColor = '#7cc36e';
const largePackageLightColor = '#d44e40';

type RenderOptions = vscode.DecorationRenderOptions;

function getDecorationColor(info: { size: number; gzip: number }): RenderOptions {
  const sizeInKB = (bundleSizeColoring === 'minified' ? info.size : info.gzip) / 1024;
  if (sizeInKB < smallPackageSize) {
    return {
      dark: { after: { color: smallPackageDarkColor } },
      light: { after: { color: smallPackageLightColor } },
    };
  } else if (sizeInKB < mediumPackageSize) {
    return {
      dark: { after: { color: mediumPackageDarkColor } },
      light: { after: { color: mediumPackageLightColor } },
    };
  } else {
    return {
      dark: { after: { color: largePackageDarkColor } },
      light: { after: { color: largePackageLightColor } },
    };
  }
}

function getDecorationMessage(info: { size: number; gzip: number }): RenderOptions {
  const size = filesize(info.size, { base: 2, standard: 'jedec' }) as string;
  const gzip = filesize(info.gzip, { base: 2, standard: 'jedec' }) as string;
  if (bundleSizeDecoration === 'minified') {
    return { after: { contentText: size, margin: '0 0 0 1rem' } };
  } else if (bundleSizeDecoration === 'gzipped') {
    return { after: { contentText: gzip, margin: '0 0 0 1rem' } };
  } else {
    return { after: { contentText: `${size} (gzipped: ${gzip})`, margin: '0 0 0 1rem' } };
  }
}
