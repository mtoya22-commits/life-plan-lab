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

  it('README points iframe embedding to the canonical embed docs and base-path note', () => {
    const readme = read('README.md');
    // 埋め込み実装の正典は docs/EMBED.md（README には実装例を置かない）
    expect(readme).toContain('docs/EMBED.md');
    expect(readme).toContain('docs/DESIGN_HANDOFF.md');
    expect(readme).toContain("base: './'");
    // 旧方式（親側 sticky 固定・min-height 固定）のコピー可能なコード例を復活させない
    expect(readme).not.toContain('<iframe');
    expect(readme).not.toMatch(/position:\s*sticky;\s*top:\s*0/);
    expect(readme).not.toMatch(/min-height:\s*1000px\s*;/);
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
