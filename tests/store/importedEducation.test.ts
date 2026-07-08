import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  educationImportStatus,
  useInputStore,
} from '../../src/store/inputStore';
import { EDUCATION_STORAGE_KEY, educationImportFingerprint } from '../../src/lib/importedEducation';

// 教育費取り込みの店内挙動（Stage 2・B案）。
// fingerprint 方式の pending 判定・原子的適用・手動編集保護・両モード反映・
// 「金額を注入しない」ことを固定する。

const FIXTURE_PATH = resolve(process.cwd(), 'tests/fixtures/contracts/educationPayload.v1.json');
const fixtureText = readFileSync(FIXTURE_PATH, 'utf8');

const store = () => useInputStore.getState();

function setUrl(search: string): void {
  window.history.replaceState({}, '', search ? `/?${search}` : '/');
}
function clearImports(): void {
  useInputStore.setState({
    importedLivingCost: null,
    livingCostManuallyEdited: false,
    importedMortgage: null,
    mortgageManuallyEdited: false,
    importedEducation: null,
    educationManuallyEdited: false,
    appliedEducationImportFingerprint: null,
  });
}
function status() {
  return educationImportStatus(store());
}
function saveFixtureVariant(mutate: (p: Record<string, unknown>) => void): void {
  const p = JSON.parse(fixtureText);
  mutate(p);
  localStorage.setItem(EDUCATION_STORAGE_KEY, JSON.stringify(p));
}

describe('imported education integration', () => {
  beforeEach(() => {
    setUrl('');
    localStorage.clear();
    store().reset();
    clearImports();
  });
  afterEach(() => {
    setUrl('');
    localStorage.clear();
    clearImports();
  });

  // 必須1: 初回取り込み・手動編集なし → 自動適用・manual=false・applied 記録・pending なし
  it('auto-applies on first import and records the applied fingerprint', () => {
    localStorage.setItem(EDUCATION_STORAGE_KEY, fixtureText);
    store().initializeImportedEducation();

    expect(store().importedEducation).not.toBeNull();
    expect(store().educationManuallyEdited).toBe(false);
    expect(store().appliedEducationImportFingerprint).toBe(
      educationImportFingerprint(store().importedEducation!),
    );
    expect(status()).toBe('active');

    // ざっくり側は childrenCount と childAge1〜4 のみ（educationPolicy は触らない）
    const d = store().roughDraft;
    expect(d.childrenCount).toEqual({ value: '2', source: 'user_input' });
    expect(d.childAge1).toEqual({ value: 8, source: 'user_input' });
    expect(d.childAge2).toEqual({ value: 5, source: 'user_input' });
    expect(d.childAge3).toEqual({ value: null, source: 'default_value' });
    expect(d.educationPolicy.source).toBe('default_value');
  });

  // 必須2: 同一 payload 適用後に手動編集 → 再初期化しても自動上書きせず pending も出さない
  it('does not re-apply nor show pending when the same payload is re-read after a manual edit', () => {
    localStorage.setItem(EDUCATION_STORAGE_KEY, fixtureText);
    store().initializeImportedEducation();
    store().setMode('thorough');
    store().setThoroughValue('children.0.currentAge', 9); // 手動編集
    expect(store().educationManuallyEdited).toBe(true);

    store().initializeImportedEducation(); // 同一 payload を再読込
    expect(store().thoroughInput!.children[0].currentAge.value).toBe(9); // 上書きされない
    expect(status()).toBe('edited'); // fingerprint 一致のため pending にならない
  });

  // 必須3: 条件を変えた新 payload → manual=true なら pending・自動上書きしない
  it('holds a changed payload as pending when education was manually edited', () => {
    localStorage.setItem(EDUCATION_STORAGE_KEY, fixtureText);
    store().initializeImportedEducation();
    store().setMode('thorough');
    store().setThoroughValue('children.0.currentAge', 9);
    const appliedBefore = store().appliedEducationImportFingerprint;

    saveFixtureVariant((p) => {
      (p.children as Record<string, unknown>[])[1].universityPlan = 'private';
    });
    store().initializeImportedEducation();

    expect(status()).toBe('pending');
    expect(store().thoroughInput!.children[0].currentAge.value).toBe(9); // 非上書き
    expect(store().appliedEducationImportFingerprint).toBe(appliedBefore);
  });

  // 必須4: savedAt だけ変更された同条件 payload → pending なし
  it('treats a savedAt-only change as the same conditions (no pending)', () => {
    localStorage.setItem(EDUCATION_STORAGE_KEY, fixtureText);
    store().initializeImportedEducation();
    store().setMode('thorough');
    store().setThoroughValue('children.0.currentAge', 9); // 手動編集して自動適用を止める

    saveFixtureVariant((p) => {
      p.savedAt = '2027-03-01T00:00:00.000Z';
      p.totalFutureCostYen = 99999999; // 表示メタが変わっても条件は同一
      p.peakYear = 2040;
    });
    store().initializeImportedEducation();

    expect(status()).toBe('edited'); // pending にならない
    expect(store().importedEducation!.savedAt).toBe('2027-03-01T00:00:00.000Z'); // メタは最新化
  });

  // 必須5: pending の「反映する」→ 原子的上書き・manual=false・applied 更新・pending 消滅
  it('applyImportedEducationNow applies pending payload atomically', () => {
    localStorage.setItem(EDUCATION_STORAGE_KEY, fixtureText);
    store().initializeImportedEducation();
    store().setMode('thorough');
    store().setThoroughValue('children.0.currentAge', 9);
    saveFixtureVariant((p) => {
      (p.children as Record<string, unknown>[])[1].universityPlan = 'private';
    });
    store().initializeImportedEducation();
    expect(status()).toBe('pending');

    store().applyImportedEducationNow();

    expect(store().educationManuallyEdited).toBe(false);
    expect(status()).toBe('active');
    expect(store().appliedEducationImportFingerprint).toBe(
      educationImportFingerprint(store().importedEducation!),
    );
    const children = store().thoroughInput!.children;
    expect(children[0].currentAge.value).toBe(8); // 手動値が明示操作で上書きされた
    expect(children[1].university.value).toBe('private_humanities'); // 新条件（文系仮定）
  });

  // 必須6: reset で 3 値クリア → 再初期化で自動適用
  it('reset clears import state; re-initialization auto-applies again', () => {
    localStorage.setItem(EDUCATION_STORAGE_KEY, fixtureText);
    store().initializeImportedEducation();
    store().setMode('thorough');
    store().setThoroughValue('children.0.currentAge', 9);

    store().reset();
    expect(store().importedEducation).toBeNull();
    expect(store().educationManuallyEdited).toBe(false);
    expect(store().appliedEducationImportFingerprint).toBeNull();

    store().initializeImportedEducation();
    expect(status()).toBe('active');
    expect(store().roughDraft.childAge1).toEqual({ value: 8, source: 'user_input' });
  });

  // 必須7: rough で取り込み → thorough へ切替で詳細条件が失われない
  it('keeps detailed conditions when switching rough → thorough', () => {
    localStorage.setItem(EDUCATION_STORAGE_KEY, fixtureText);
    store().initializeImportedEducation();
    store().setMode('rough');
    expect(store().roughDraft.childrenCount.value).toBe('2');

    store().setMode('thorough');
    const children = store().thoroughInput!.children;
    expect(children).toHaveLength(2);
    expect(children[0].currentAge.value).toBe(8);
    expect(children[0].middleSchool.value).toBe('private'); // privateIntegrated 由来
    expect(children[0].highSchool.value).toBe('private');
    expect(children[0].university.value).toBe('private_humanities');
    expect(children[0].uniLiving.value).toBe('away');
    expect(children[1].currentAge.value).toBe(5);
    expect(children[1].university.value).toBe('public_humanities');
  });

  // 必須8: thorough で取り込み → rough へ切替で人数・年齢が維持され、詳細も計算でデフォルトへ戻らない
  it('keeps counts/ages and computed detail when switching thorough → rough', () => {
    localStorage.setItem(EDUCATION_STORAGE_KEY, fixtureText);
    store().setMode('thorough');
    store().initializeImportedEducation();
    expect(store().thoroughInput!.children[0].uniLiving.value).toBe('away');

    store().setMode('rough');
    expect(store().roughDraft.childrenCount).toEqual({ value: '2', source: 'user_input' });
    expect(store().roughDraft.childAge1).toEqual({ value: 8, source: 'user_input' });
    expect(store().roughDraft.childAge2).toEqual({ value: 5, source: 'user_input' });

    store().submitRough();
    const children = store().input!.children;
    expect(children).toHaveLength(2);
    // POLICY_PATHS 近似ではなく取り込み条件（私立中高一貫・私大文系・自宅外）が計算に使われる
    expect(children[0].middleSchool.value).toBe('private');
    expect(children[0].university.value).toBe('private_humanities');
    expect(children[0].uniLiving.value).toBe('away');
  });

  // 必須9: rough の educationPolicy は取り込みで書き換えない
  it('never rewrites rough educationPolicy from the import', () => {
    localStorage.setItem(EDUCATION_STORAGE_KEY, fixtureText);
    store().initializeImportedEducation();
    expect(store().roughDraft.educationPolicy).toEqual({ value: null, source: 'default_value' });
    store().setMode('rough');
    expect(store().roughDraft.educationPolicy).toEqual({ value: null, source: 'default_value' });
  });

  // 必須10: 取り込みで lifeEvents が増えない・Sim 金額が支出へ注入されない
  it('creates no life events and injects no Sim amounts into expenses', () => {
    localStorage.setItem(EDUCATION_STORAGE_KEY, fixtureText);
    store().initializeImportedEducation();
    store().setMode('rough');
    store().submitRough();

    const input = store().input!;
    expect(input.lifeEvents).toHaveLength(0); // 下宿差額イベント等を作らない
    // Sim のピーク額・総額（円）はどの万円フィールドにも現れない
    const peakMan = 2860501 / 10000;
    const totalMan = 25681366 / 10000;
    expect(input.expense.annualSpecial.value).not.toBe(peakMan);
    expect(input.expense.annualSpecial.value).not.toBe(totalMan);
    expect(input.expense.monthlyLiving.value).not.toBe(peakMan);
  });

  // 必須11: releaseImportedEducation → 手動入力が計算に使われ、同一 payload では pending なし
  it('release lets rough edits drive the calculation; same payload does not re-pend', () => {
    localStorage.setItem(EDUCATION_STORAGE_KEY, fixtureText);
    store().initializeImportedEducation();
    store().setMode('rough');

    store().releaseImportedEducation();
    expect(store().educationManuallyEdited).toBe(true);
    expect(status()).toBe('edited');

    store().setRoughValue('childrenCount', '1');
    store().setRoughValue('childAge1', 10);
    store().submitRough();
    const children = store().input!.children;
    expect(children).toHaveLength(1);
    expect(children[0].currentAge.value).toBe(10);

    store().initializeImportedEducation(); // 同一 payload の再読込
    expect(status()).toBe('edited'); // pending を出さない
    expect(store().input!.children).toHaveLength(1); // 計算も上書きされない
  });

  // 必須12（P1-2 改訂・最重要回帰）: 初回取り込み前の既存ローカル手入力は、
  // educationSource=currentPlan があっても自動上書きしない。
  // 旧セッション相当 = educationManuallyEdited=false・applied=null・教育 Field に user_input あり。
  it('protects pre-import user_input even with educationSource=currentPlan (explicit apply only)', () => {
    useInputStore.setState({
      roughDraft: {
        ...store().roughDraft,
        childAge1: { value: 6, source: 'user_input' },
      },
      educationManuallyEdited: false,
      appliedEducationImportFingerprint: null,
    });
    localStorage.setItem(EDUCATION_STORAGE_KEY, fixtureText);
    setUrl('educationSource=currentPlan');

    store().initializeImportedEducation();

    // URL があっても自動上書きしない: pending・既存手入力そのまま・applied は null のまま
    expect(status()).toBe('pending');
    expect(store().roughDraft.childAge1).toEqual({ value: 6, source: 'user_input' });
    expect(store().appliedEducationImportFingerprint).toBeNull();
    expect(store().educationManuallyEdited).toBe(false);

    // 「反映する」の明示操作でのみ上書きされる
    store().applyImportedEducationNow();
    expect(status()).toBe('active');
    expect(store().roughDraft.childAge1).toEqual({ value: 8, source: 'user_input' });
  });

  // 必須12b: 同条件で URL なし → 同じく自動上書きせず pending
  it('protects pre-import user_input without the URL flag the same way', () => {
    useInputStore.setState({
      roughDraft: {
        ...store().roughDraft,
        childAge1: { value: 6, source: 'user_input' },
      },
      educationManuallyEdited: false,
      appliedEducationImportFingerprint: null,
    });
    localStorage.setItem(EDUCATION_STORAGE_KEY, fixtureText);

    store().initializeImportedEducation();

    expect(status()).toBe('pending');
    expect(store().roughDraft.childAge1).toEqual({ value: 6, source: 'user_input' });
    expect(store().appliedEducationImportFingerprint).toBeNull();
  });

  // 必須12c: 既存手入力なし・educationSource=currentPlan あり → 初回自動適用
  it('auto-applies on first import with educationSource=currentPlan when nothing was hand-entered', () => {
    localStorage.setItem(EDUCATION_STORAGE_KEY, fixtureText);
    setUrl('educationSource=currentPlan');

    store().initializeImportedEducation();

    expect(status()).toBe('active');
    expect(store().roughDraft.childAge1).toEqual({ value: 8, source: 'user_input' });
    expect(store().educationManuallyEdited).toBe(false);
  });

  // 必須13: 初回取り込み後、未編集のまま Sim 側で条件を変えた新 payload → pending ではなく自動適用
  it('auto-applies a changed payload when the user has not edited (import-origin user_input does not block)', () => {
    localStorage.setItem(EDUCATION_STORAGE_KEY, fixtureText);
    store().initializeImportedEducation();
    expect(status()).toBe('active');

    saveFixtureVariant((p) => {
      (p.children as Record<string, unknown>[])[0].currentAge = 12;
    });
    store().initializeImportedEducation();

    expect(status()).toBe('active'); // pending ではない
    expect(store().roughDraft.childAge1).toEqual({ value: 12, source: 'user_input' });
    expect(store().appliedEducationImportFingerprint).toBe(
      educationImportFingerprint(store().importedEducation!),
    );
  });

  // URL フラグの値にかかわらず、既存 user_input 保護は変わらない（P1-2 以降、
  // educationSource は保護を外す判定に一切使われない。=other でも =currentPlan でも同じ）。
  it('keeps the pre-import protection regardless of the educationSource value', () => {
    useInputStore.setState({
      roughDraft: {
        ...store().roughDraft,
        childAge1: { value: 6, source: 'user_input' },
      },
      educationManuallyEdited: false,
      appliedEducationImportFingerprint: null,
    });
    localStorage.setItem(EDUCATION_STORAGE_KEY, fixtureText);
    setUrl('educationSource=other');
    store().initializeImportedEducation();
    expect(status()).toBe('pending');
    expect(store().roughDraft.childAge1).toEqual({ value: 6, source: 'user_input' });
  });
});
