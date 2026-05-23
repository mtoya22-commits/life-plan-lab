import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// STEP6.1: 深緑ベースの Quiet Luxury テーマが適用されていることのガード。
// 計算には無関係。パレットの誤って元（ネイビー）へ戻る事故を防ぐ軽い確認。
const root = process.cwd();
const css = readFileSync(resolve(root, 'src/index.css'), 'utf8');
const chart = readFileSync(resolve(root, 'src/features/results/AssetChart.tsx'), 'utf8');

describe('STEP6.1 deep-green theme tokens', () => {
  it('uses a deep-green accent and warm-ivory background', () => {
    expect(css).toContain('--accent: #2d4a3e');
    expect(css).toContain('--bg: #f4f1ea');
    expect(css).toContain('--brass:'); // 細い差し色のブラス
  });

  it('drops the old navy palette', () => {
    expect(css).not.toContain('#3b5b76'); // 旧ネイビー accent
    expect(css).not.toContain('#5b7a8b'); // 旧 realistic
  });

  it('keeps motion behind prefers-reduced-motion', () => {
    expect(css).toContain('prefers-reduced-motion: no-preference');
  });

  it('charts the present-value line in deep green and the future line as a subtle auxiliary', () => {
    expect(chart).toContain("const COLORS_PV = '#2f5246'");
    expect(chart).not.toContain("'#3b5b76'");
  });
});
