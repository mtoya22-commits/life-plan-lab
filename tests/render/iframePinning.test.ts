import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// STEP11.26: iframe document を viewport いっぱいに完全固定し、内部の .app だけを
// スクロール container にする構造。親 WordPress ページのスクロールで iframe 中身が
// 画面外に流れる症状を、iframe 内側で自己完結して防ぐ。
// CSS 文字列マッチでガードレールを設けて、回帰を防止する。

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

/** 指定セレクタの宣言ブロックを抽出する（コメントを含む波括弧マッチを許容）。 */
function block(selector: string): string {
  const head = selector.startsWith('^') ? selector.slice(1) : selector;
  // セレクタ位置を行頭で探し、その直後の最初の '{' から対応する '}' までを返す。
  const lines = css.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // ヘッダー行に該当セレクタが含まれていて、その行に '{' があるか、後続行に '{' がある
    const trimmed = line.trim();
    if (trimmed === head + ' {' || trimmed === head + '{') {
      // 後続を '}' まで集める
      let depth = 1;
      const buf: string[] = [trimmed];
      for (let j = i + 1; j < lines.length; j++) {
        const l = lines[j];
        buf.push(l);
        for (const ch of l) {
          if (ch === '{') depth++;
          else if (ch === '}') depth--;
        }
        if (depth === 0) return buf.join('\n');
      }
    }
  }
  return '';
}

describe('STEP11.26 iframe-pinning CSS invariants', () => {
  it('html is height:100% + overflow:hidden (no page-level scrolling)', () => {
    const html = block('html');
    expect(html).toContain('height: 100%');
    expect(html).toContain('overflow: hidden');
  });

  it('body is height:100% + overflow:hidden so it stays at viewport size', () => {
    const body = block('body');
    expect(body).toContain('height: 100%');
    expect(body).toContain('overflow: hidden');
  });

  it('.app is the single scroll container (height:100% + overflow-y:auto)', () => {
    const app = block('.app');
    expect(app).toContain('height: 100%');
    expect(app).toContain('overflow-y: auto');
  });

  it('.step-layout grows to min-height:100% inside .app for short steps', () => {
    const layout = block('.step-layout');
    expect(layout).toContain('min-height: 100%');
    // 旧来の 100dvh ベースは廃止（.app の 100% に置換）
    expect(layout).not.toContain('100dvh');
  });

  it('.bottom-nav remains sticky at the bottom of the .app scroll container', () => {
    const nav = block('.bottom-nav');
    expect(nav).toContain('position: sticky');
    expect(nav).toContain('bottom: 0');
  });
});
