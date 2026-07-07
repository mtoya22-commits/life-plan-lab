import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  EDUCATION_STORAGE_KEY,
  educationImportFingerprint,
  hasEducationSourceCurrentPlan,
  mapToChildInputs,
  readImportedEducation,
} from '../../src/lib/importedEducation';

// 教育費ピークシミュレーター（別アプリ）からの取り込みパーサーの単体テスト。
// 契約フィクスチャ（Sim リポの tests/fixtures/educationPayload.v1.json とバイト同一）を正とし、
// 実際に Sim が保存する JSON をそのまま読めることを保証する。

const FIXTURE_PATH = resolve(process.cwd(), 'tests/fixtures/contracts/educationPayload.v1.json');
const fixtureText = readFileSync(FIXTURE_PATH, 'utf8');

function setUrl(search: string): void {
  window.history.replaceState({}, '', search ? `/?${search}` : '/');
}

beforeEach(() => {
  setUrl('');
  localStorage.clear();
});
afterEach(() => {
  setUrl('');
  localStorage.clear();
});

describe('contract fixture (lifePlanLab:education)', () => {
  it('parses the exact JSON the simulator saves', () => {
    localStorage.setItem(EDUCATION_STORAGE_KEY, fixtureText);
    const imported = readImportedEducation();
    expect(imported).not.toBeNull();
    expect(imported!.source).toBe('currentPlan');
    expect(imported!.version).toBe(1);
    expect(imported!.savedAt).toBe('2026-07-07T00:00:00.000Z');
    expect(imported!.baselineYear).toBe(2026);
    expect(imported!.peakYear).toBe(2036);
    expect(imported!.peakAnnualCostYen).toBe(2860501);
    expect(imported!.totalFutureCostYen).toBe(25681366);
    expect(imported!.assumptionVersion).toBe('2026.06.1');
    // 子どもは入力順（Sim の id は使わない）。
    expect(imported!.children).toEqual([
      {
        currentAge: 8,
        juniorHighHighSchoolPlan: 'privateIntegrated',
        universityPlan: 'private',
        livingArrangement: 'away',
      },
      {
        currentAge: 5,
        juniorHighHighSchoolPlan: 'public',
        universityPlan: 'nationalPublic',
        livingArrangement: 'home',
      },
    ]);
  });

  it('maps the fixture to 総合版 ChildInput[] in input order', () => {
    localStorage.setItem(EDUCATION_STORAGE_KEY, fixtureText);
    const children = mapToChildInputs(readImportedEducation()!);
    expect(children).toHaveLength(2);

    // 子1: 私立中高一貫 + 私立大（文系仮定）+ 自宅外
    expect(children[0].currentAge.value).toBe(8);
    expect(children[0].currentAge.source).toBe('user_input');
    expect(children[0].ageAssumed).toBe(false);
    expect(children[0].elementarySchool.value).toBe('public');
    expect(children[0].elementarySchool.source).toBe('recommended_value');
    expect(children[0].middleSchool.value).toBe('private');
    expect(children[0].highSchool.value).toBe('private');
    expect(children[0].university.value).toBe('private_humanities');
    expect(children[0].university.source).toBe('recommended_value'); // 文理は仮定
    expect(children[0].university.assumptionText).toContain('文系と仮定');
    expect(children[0].uniLiving.value).toBe('away');

    // 子2: 公立中高 + 国公立（文系仮定）+ 自宅
    expect(children[1].currentAge.value).toBe(5);
    expect(children[1].middleSchool.value).toBe('public');
    expect(children[1].highSchool.value).toBe('public');
    expect(children[1].university.value).toBe('public_humanities');
    expect(children[1].uniLiving.value).toBe('home');
  });
});

describe('readImportedEducation (defensive normalization)', () => {
  it('returns null when key is absent / malformed JSON / children missing', () => {
    expect(readImportedEducation()).toBeNull();
    localStorage.setItem(EDUCATION_STORAGE_KEY, 'not json');
    expect(readImportedEducation()).toBeNull();
    localStorage.setItem(EDUCATION_STORAGE_KEY, JSON.stringify({ source: 'currentPlan' }));
    expect(readImportedEducation()).toBeNull();
  });

  it('returns null when no child has a valid age', () => {
    localStorage.setItem(
      EDUCATION_STORAGE_KEY,
      JSON.stringify({ children: [{ currentAge: 'abc' }, { currentAge: null }] }),
    );
    expect(readImportedEducation()).toBeNull();
  });

  it('drops non-numeric-age children, clamps ages to 0..22, caps at 4 children', () => {
    localStorage.setItem(
      EDUCATION_STORAGE_KEY,
      JSON.stringify({
        children: [
          { currentAge: -3 },
          { currentAge: 30 },
          { currentAge: 'x' },
          { currentAge: 7.6 },
          { currentAge: 1 },
          { currentAge: 2 },
        ],
        version: 1,
      }),
    );
    const imported = readImportedEducation()!;
    expect(imported.children.map((c) => c.currentAge)).toEqual([0, 22, 8, 1]);
  });

  it('falls back unknown enums to safe defaults without throwing', () => {
    localStorage.setItem(
      EDUCATION_STORAGE_KEY,
      JSON.stringify({
        children: [
          {
            currentAge: 10,
            juniorHighHighSchoolPlan: 'mystery',
            universityPlan: 'mars',
            livingArrangement: 'dorm',
          },
        ],
        source: 'somethingElse',
        version: 2,
      }),
    );
    const imported = readImportedEducation()!;
    expect(imported.children[0]).toEqual({
      currentAge: 10,
      juniorHighHighSchoolPlan: 'public',
      universityPlan: 'none',
      livingArrangement: 'home',
    });
    expect(imported.source).toBe('unknown');
    expect(imported.version).toBe(2);
  });

  it('omits invalid display meta (savedAt / peak / total) instead of failing', () => {
    localStorage.setItem(
      EDUCATION_STORAGE_KEY,
      JSON.stringify({
        children: [{ currentAge: 6 }],
        savedAt: 'not-a-date',
        peakYear: 99999,
        peakAnnualCostYen: -5,
        totalFutureCostYen: 'lots',
      }),
    );
    const imported = readImportedEducation()!;
    expect(imported.savedAt).toBeUndefined();
    expect(imported.peakYear).toBeUndefined();
    expect(imported.peakAnnualCostYen).toBeUndefined();
    expect(imported.totalFutureCostYen).toBeUndefined();
  });

  it('treats missing livingArrangement as home (Sim omits it when university is none)', () => {
    localStorage.setItem(
      EDUCATION_STORAGE_KEY,
      JSON.stringify({
        children: [{ currentAge: 12, juniorHighHighSchoolPlan: 'public', universityPlan: 'none' }],
      }),
    );
    expect(readImportedEducation()!.children[0].livingArrangement).toBe('home');
  });
});

describe('educationImportFingerprint', () => {
  const base = () => {
    localStorage.setItem(EDUCATION_STORAGE_KEY, fixtureText);
    return readImportedEducation()!;
  };

  it('is stable across savedAt / peak / total / baselineYear changes', () => {
    const a = educationImportFingerprint(base());
    const changed = JSON.parse(fixtureText);
    changed.savedAt = '2027-01-01T00:00:00.000Z';
    changed.baselineYear = 2027;
    changed.peakYear = 2040;
    changed.peakAnnualCostYen = 1;
    changed.totalFutureCostYen = 2;
    changed.parentAge = 55;
    localStorage.setItem(EDUCATION_STORAGE_KEY, JSON.stringify(changed));
    const b = educationImportFingerprint(readImportedEducation()!);
    expect(b).toBe(a);
  });

  it('changes when an education condition changes', () => {
    const a = educationImportFingerprint(base());
    const changed = JSON.parse(fixtureText);
    changed.children[1].universityPlan = 'private';
    localStorage.setItem(EDUCATION_STORAGE_KEY, JSON.stringify(changed));
    const b = educationImportFingerprint(readImportedEducation()!);
    expect(b).not.toBe(a);
  });

  it('changes when child order changes (input-order mapping)', () => {
    const a = educationImportFingerprint(base());
    const changed = JSON.parse(fixtureText);
    changed.children.reverse();
    localStorage.setItem(EDUCATION_STORAGE_KEY, JSON.stringify(changed));
    expect(educationImportFingerprint(readImportedEducation()!)).not.toBe(a);
  });
});

describe('hasEducationSourceCurrentPlan (strict match)', () => {
  it('is true only for educationSource=currentPlan', () => {
    setUrl('educationSource=currentPlan');
    expect(hasEducationSourceCurrentPlan()).toBe(true);
    setUrl('educationSource=somethingElse');
    expect(hasEducationSourceCurrentPlan()).toBe(false);
    setUrl('educationSource=');
    expect(hasEducationSourceCurrentPlan()).toBe(false);
    setUrl('');
    expect(hasEducationSourceCurrentPlan()).toBe(false);
  });
});
