import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// STEP9: WordPress 埋め込み（iframe）/サブディレクトリ配置に耐える構成のガード。
const root = process.cwd();
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

describe('STEP9 deploy/embed config', () => {
  it('vite base is relative ("./") so assets resolve under any subdirectory/iframe', () => {
    const cfg = read('vite.config.ts');
    expect(cfg).toMatch(/base:\s*'\.\/'/);
  });

  it('index.html declares ja lang, viewport and a description (for WordPress/SEO context)', () => {
    const html = read('index.html');
    expect(html).toContain('lang="ja"');
    expect(html).toContain('name="viewport"');
    expect(html).toContain('name="description"');
  });

  it('README documents the iframe embed and base-path note', () => {
    const readme = read('README.md');
    expect(readme).toContain('<iframe');
    expect(readme).toContain('min-height');
    expect(readme).toContain("base: './'");
  });

  it('ships a GitHub Pages workflow and an iframe embed-demo harness', () => {
    const wf = read('.github/workflows/deploy-pages.yml');
    expect(wf).toContain('actions/deploy-pages');
    expect(wf).toContain('workflow_dispatch'); // 手動実行できる
    const demo = read('public/embed-demo.html');
    expect(demo).toContain('<iframe');
    expect(demo).toContain('./index.html'); // 同梱アプリを相対参照
  });
});
