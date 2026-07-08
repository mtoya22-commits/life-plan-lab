// 別アプリ「教育費ピークシミュレーター」からの取り込み値を読むユーティリティ。
// データ本体は localStorage `lifePlanLab:education` のみ（URL パラメータにはデータを載せない契約）。
// URL の `educationSource=currentPlan` は「教育費Simから遷移してきた」ことを示す補助フラグ。
// 手動編集保護・既存 user_input の rescue 保護のどちらも無効化しない
//（保護の判定は inputStore 側。フラグは現状、判定に使用していない情報提供のみ）。
//
// 方針（Stage 2・B案）: 引き継ぐのは「条件」のみ。Sim の金額結果（ピーク・総額）は
// 総合版の資産推移へ注入せず、結果画面の参考表示にだけ使う。
// 下宿（away）は総合版の uniLiving='away'（大学年額に自宅外生活費を内包）で表現し、
// 追加イベントは作らない（二重計上禁止）。

import { field } from '../schema/field';
import type { ChildInput, SchoolPath, UniversityPath, UniversityLiving } from '../schema/types';

export const EDUCATION_STORAGE_KEY = 'lifePlanLab:education';

export type ImportedJhhsPlan = 'public' | 'publicToPrivateHigh' | 'privateIntegrated';
export type ImportedUniversityPlan = 'none' | 'nationalPublic' | 'private';
export type ImportedLivingArrangement = 'home' | 'away';
export type EducationImportSource = 'currentPlan' | 'unknown';

/** 正規化済みの子ども 1 人分。対応付けは Sim の id ではなく入力順（配列順）を使う。 */
export interface ImportedEducationChild {
  currentAge: number; // 0〜22 に clamp 済み（整数）
  juniorHighHighSchoolPlan: ImportedJhhsPlan;
  universityPlan: ImportedUniversityPlan;
  livingArrangement: ImportedLivingArrangement;
}

export interface ImportedEducation {
  children: ImportedEducationChild[]; // 入力順・最大 4 人
  source: EducationImportSource;
  version: number;
  /** 表示専用メタ。不正値・欠損は undefined（表示側で安全に省略する）。 */
  savedAt?: string;
  baselineYear?: number;
  peakYear?: number;
  peakAnnualCostYen?: number;
  totalFutureCostYen?: number;
  assumptionVersion?: string;
  origin: 'localStorage';
}

const MAX_CHILDREN = 4;
const CHILD_AGE_MIN = 0;
const CHILD_AGE_MAX = 22;

function normalizeJhhs(raw: unknown): ImportedJhhsPlan {
  if (raw === 'public' || raw === 'publicToPrivateHigh' || raw === 'privateIntegrated') return raw;
  return 'public';
}

function normalizeUniversity(raw: unknown): ImportedUniversityPlan {
  if (raw === 'none' || raw === 'nationalPublic' || raw === 'private') return raw;
  return 'none';
}

function normalizeLiving(raw: unknown): ImportedLivingArrangement {
  return raw === 'away' ? 'away' : 'home';
}

function normalizeSource(raw: unknown): EducationImportSource {
  return raw === 'currentPlan' ? 'currentPlan' : 'unknown';
}

/** 有限数なら整数化して 0〜22 に clamp。null / 空 / 非数の子は取り込み対象から外す（0 歳に捏造しない）。 */
function clampAge(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.min(CHILD_AGE_MAX, Math.max(CHILD_AGE_MIN, Math.round(n)));
}

function positiveFinite(raw: unknown): number | undefined {
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : undefined;
}

/** ISO らしき妥当な日時文字列だけ通す（鮮度表示の防御）。 */
function validSavedAt(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || raw === '') return undefined;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? raw : undefined;
}

function validYear(raw: unknown): number | undefined {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return undefined;
  const y = Math.round(n);
  return y >= 1900 && y <= 3000 ? y : undefined;
}

/** URL の educationSource が 'currentPlan' と厳密一致するときだけ true（存在確認ではない）。
 *  既存手入力・手動編集の保護を外す用途には使わないこと（Codex P1-2）。 */
export function hasEducationSourceCurrentPlan(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('educationSource') === 'currentPlan';
}

/** localStorage `lifePlanLab:education` を防御的に読む。
 *  valid な年齢を持つ子が 1 人もいなければ null（取り込み対象外）。 */
export function readImportedEducation(): ImportedEducation | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(EDUCATION_STORAGE_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw) as Record<string, unknown>;
    if (!payload || typeof payload !== 'object') return null;
    if (!Array.isArray(payload.children)) return null;

    const children: ImportedEducationChild[] = [];
    for (const c of payload.children as Record<string, unknown>[]) {
      if (children.length >= MAX_CHILDREN) break;
      if (!c || typeof c !== 'object') continue;
      const age = clampAge(c.currentAge);
      if (age === null) continue;
      const universityPlan = normalizeUniversity(c.universityPlan);
      children.push({
        currentAge: age,
        juniorHighHighSchoolPlan: normalizeJhhs(c.juniorHighHighSchoolPlan),
        universityPlan,
        // 大学進学なしのとき Sim は livingArrangement を省く仕様。欠落は home に倒す。
        livingArrangement: universityPlan === 'none' ? 'home' : normalizeLiving(c.livingArrangement),
      });
    }
    if (children.length === 0) return null;

    const version =
      typeof payload.version === 'number' && Number.isFinite(payload.version) ? payload.version : 1;

    return {
      children,
      source: normalizeSource(payload.source),
      version,
      savedAt: validSavedAt(payload.savedAt),
      baselineYear: validYear(payload.baselineYear),
      peakYear: validYear(payload.peakYear),
      peakAnnualCostYen: positiveFinite(payload.peakAnnualCostYen),
      totalFutureCostYen: positiveFinite(payload.totalFutureCostYen),
      assumptionVersion:
        typeof payload.assumptionVersion === 'string' ? payload.assumptionVersion : undefined,
      origin: 'localStorage',
    };
  } catch {
    return null;
  }
}

/** 取り込み内容の「教育条件」だけから作る安定 fingerprint。
 *  同一条件の再保存（savedAt・peak・総額・baselineYear だけの変化）では変わらない。
 *  pending 判定（新しい条件が来たか）に使う。 */
export function educationImportFingerprint(imported: ImportedEducation): string {
  return JSON.stringify({
    v: imported.version,
    c: imported.children.map((c) => [
      c.currentAge,
      c.juniorHighHighSchoolPlan,
      c.universityPlan,
      c.livingArrangement,
    ]),
  });
}

// ---- 総合版フィールドへのマッピング ----------------------------------------
// 中高方針 → middleSchool + highSchool の分解。
//   public              → 公立中 / 公立高
//   publicToPrivateHigh → 公立中 / 私立高
//   privateIntegrated   → 私立中 / 私立高
// 大学は Sim に文理の区分がないため「文系」と仮定し、recommended_value + 明示文言で扱う。
// 小学校は Sim に選択肢がない（公立前提）ため public を補完する。
// Sim のピーク・総額はここでは使わない（フィールドへ注入しない）。

function jhhsToSchoolPaths(plan: ImportedJhhsPlan): { middle: SchoolPath; high: SchoolPath } {
  switch (plan) {
    case 'privateIntegrated':
      return { middle: 'private', high: 'private' };
    case 'publicToPrivateHigh':
      return { middle: 'public', high: 'private' };
    case 'public':
    default:
      return { middle: 'public', high: 'public' };
  }
}

function universityToPath(plan: ImportedUniversityPlan): UniversityPath {
  switch (plan) {
    case 'nationalPublic':
      return 'public_humanities';
    case 'private':
      return 'private_humanities';
    case 'none':
    default:
      return 'none';
  }
}

const FROM_SIM = '教育費ピークシミュレーターから反映しています。';
const HUMANITIES_ASSUMED =
  '教育費ピークシミュレーターの進学方針を文系と仮定して反映しています（シミュレーターに文理の区分がないため）。';
const ELEMENTARY_ASSUMED =
  '教育費ピークシミュレーターは公立小学校前提のため、公立で概算しています。';

/** 取り込んだ教育条件を総合版の ChildInput[] へ入力順で変換する（純粋関数）。 */
export function mapToChildInputs(imported: ImportedEducation): ChildInput[] {
  return imported.children.map((c) => {
    const { middle, high } = jhhsToSchoolPaths(c.juniorHighHighSchoolPlan);
    const uniPath = universityToPath(c.universityPlan);
    const living: UniversityLiving = c.universityPlan === 'none' ? 'home' : c.livingArrangement;
    return {
      currentAge: field(
        c.currentAge,
        'user_input',
        '子の年齢',
        `教育費ピークシミュレーターから${c.currentAge}歳を反映しています。`,
        '歳',
      ),
      ageAssumed: false,
      elementarySchool: field('public', 'recommended_value', '小学校', ELEMENTARY_ASSUMED),
      middleSchool: field(middle, 'user_input', '中学', FROM_SIM),
      highSchool: field(high, 'user_input', '高校', FROM_SIM),
      university: field(
        uniPath,
        c.universityPlan === 'none' ? 'user_input' : 'recommended_value',
        '大学',
        c.universityPlan === 'none' ? FROM_SIM : HUMANITIES_ASSUMED,
      ),
      uniLiving: field(
        living,
        c.universityPlan === 'none' ? 'recommended_value' : 'user_input',
        '大学時の住まい',
        c.universityPlan === 'none' ? '大学進学なしのため自宅扱いで概算しています。' : FROM_SIM,
      ),
    };
  });
}
