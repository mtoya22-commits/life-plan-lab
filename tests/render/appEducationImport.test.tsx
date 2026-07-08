import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import App from '../../src/App';
import { educationImportStatus, useInputStore } from '../../src/store/inputStore';
import { EDUCATION_STORAGE_KEY } from '../../src/lib/importedEducation';

// App 起動経路の回帰テスト（Codex P1-1）。
// store の initializer を直接呼ぶのではなく、実際に <App /> を描画したときに
// src/App.tsx の起動 useEffect 経由で教育費取り込みが走ることを検証する。
// 表示文言だけに依存せず、store 状態（importedEducation / status / roughDraft）も必ず確認する。

const FIXTURE_PATH = resolve(process.cwd(), 'tests/fixtures/contracts/educationPayload.v1.json');
const fixtureText = readFileSync(FIXTURE_PATH, 'utf8');

const store = () => useInputStore.getState();

function setUrl(search: string): void {
  window.history.replaceState({}, '', search ? `/?${search}` : '/');
}

// テスト間で store / localStorage / URL を完全に初期化する
// （educationSource の有無や前テストのセッション状態を漏らさない）。
function resetAll(): void {
  setUrl('');
  localStorage.clear();
  store().reset(); // phase/mode/draft と取り込み state をクリア（セッションキーも削除）
  useInputStore.setState({
    importedLivingCost: null,
    livingCostManuallyEdited: false,
    importedMortgage: null,
    mortgageManuallyEdited: false,
    importedEducation: null,
    educationManuallyEdited: false,
    appliedEducationImportFingerprint: null,
    resumePrompt: false,
  });
}

describe('App 起動時の教育費取り込み初期化', () => {
  beforeEach(resetAll);
  afterEach(() => {
    cleanup();
    resetAll();
  });

  it('有効な payload あり・既存手入力なし → App 起動だけで取り込みが反映される', () => {
    localStorage.setItem(EDUCATION_STORAGE_KEY, fixtureText);

    const { container } = render(<App />);

    // store 状態: 取り込み済み・active・rough プリフィル
    expect(store().importedEducation).not.toBeNull();
    expect(store().importedEducation!.children).toHaveLength(2);
    expect(store().educationManuallyEdited).toBe(false);
    expect(educationImportStatus(store())).toBe('active');
    expect(store().roughDraft.childrenCount).toEqual({ value: '2', source: 'user_input' });
    expect(store().roughDraft.childAge1).toEqual({ value: 8, source: 'user_input' });
    expect(store().roughDraft.childAge2).toEqual({ value: 5, source: 'user_input' });

    // 表示: モード選択のバナー（文言は補助確認）
    expect(container.textContent).toContain('教育費ピークシミュレーター');
  });

  it('educationSource=currentPlan 付き遷移でも同じ起動経路で初期化される（既存手入力なし → 自動適用）', () => {
    localStorage.setItem(EDUCATION_STORAGE_KEY, fixtureText);
    setUrl('educationSource=currentPlan');

    render(<App />);

    expect(educationImportStatus(store())).toBe('active');
    expect(store().roughDraft.childAge1).toEqual({ value: 8, source: 'user_input' });
  });

  it('StrictMode の二重実行＋明示的な再初期化でも状態が安定する（再適用なし・pending なし・manual 不変）', () => {
    localStorage.setItem(EDUCATION_STORAGE_KEY, fixtureText);

    // React dev ビルドの StrictMode は effect を二重実行する → 初期化が最低 2 回走る。
    const { container } = render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    const appliedAfterMount = store().appliedEducationImportFingerprint;
    expect(educationImportStatus(store())).toBe('active');

    // さらに追加で複数回初期化しても、同一 fingerprint なので何も変わらない。
    store().initializeImportedEducation();
    store().initializeImportedEducation();

    expect(educationImportStatus(store())).toBe('active'); // pending 誤表示なし
    expect(store().educationManuallyEdited).toBe(false); // manual フラグ不変
    expect(store().appliedEducationImportFingerprint).toBe(appliedAfterMount); // 再適用なし
    expect(container.textContent).not.toContain('新しい条件があります'); // pending バナーが出ない
  });

  it('payload なしなら App 起動しても何も取り込まれない（既存挙動の保険）', () => {
    render(<App />);
    expect(store().importedEducation).toBeNull();
    expect(educationImportStatus(store())).toBe('none');
  });
});
