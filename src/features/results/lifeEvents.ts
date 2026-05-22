import type { SimulationInput, SimulationResult, StepId } from '../../schema/types';
import { formatMan } from '../../lib/format';

// =============================================================================
// 人生イベントの単一ソース。
// タイムライン（要約/詳細）とグラフの節目マーカーは、必ずここを参照する。
// 別々にハードコードしないこと（修正導線 relatedStepId への接続も一元化する）。
// =============================================================================

export type LifeEventType =
  | 'now'
  | 'education'
  | 'fire'
  | 'mortgage'
  | 'pension'
  | 'fixed_rate_end'
  | 'depletion'
  | 'horizon'
  | 'custom';

export interface LifeEventEntry {
  age: number;
  year: number;
  type: LifeEventType;
  title: string;
  description: string;
  /** 結果画面「この条件を修正する」への接続先。 */
  relatedStepId?: StepId;
  /** 通常表示（要約/コンパクト）に出すか。false は詳細表示のみ。 */
  major: boolean;
}

export function buildLifeEvents(result: SimulationResult, input: SimulationInput): LifeEventEntry[] {
  const rows = result.rows;
  if (rows.length === 0) return [];

  const startAge = input.basic.age.value;
  const yearAt = (age: number) => rows.find((r) => r.age === age)?.year ?? rows[0].year + (age - startAge);
  const events: LifeEventEntry[] = [];

  events.push({
    age: startAge,
    year: rows[0].year,
    type: 'now',
    title: '現在',
    description: '今の状況です。',
    relatedStepId: 'basic',
    major: true,
  });

  if (input.children.length > 0) {
    const peak = result.indicators.eduPeakResilience.peakAge;
    events.push({
      age: peak,
      year: yearAt(peak),
      type: 'education',
      title: '教育費ピーク',
      description: '大学進学の時期に支出が増える見込みです。',
      relatedStepId: 'family',
      major: true,
    });
  }

  // 年次エンジンが付与したイベントを拾う（同一データソース）。
  for (const r of rows) {
    for (const e of r.events) {
      switch (e.kind) {
        case 'fire_start':
        case 'side_fire_start':
          events.push({
            age: e.age,
            year: r.year,
            type: 'fire',
            title: e.label,
            description: 'ここから働き方が変わります。',
            relatedStepId: 'fire',
            major: true,
          });
          break;
        case 'mortgage_payoff':
          events.push({
            age: e.age,
            year: r.year,
            type: 'mortgage',
            title: e.label,
            description: '住宅ローンの返済が終わります。',
            relatedStepId: 'housing',
            major: true,
          });
          break;
        case 'fixed_rate_end':
          events.push({
            age: e.age,
            year: r.year,
            type: 'fixed_rate_end',
            title: e.label,
            description: '金利が変わる可能性があります。',
            relatedStepId: 'housing',
            major: false,
          });
          break;
        case 'pension_start':
          events.push({
            age: e.age,
            year: r.year,
            type: 'pension',
            title: e.label,
            description: '年金の受給が始まります。',
            major: true,
          });
          break;
        case 'full_retire':
          events.push({
            age: e.age,
            year: r.year,
            type: 'fire',
            title: e.label,
            description: '仕事を完全に離れる時期です。',
            relatedStepId: 'fire',
            major: false,
          });
          break;
        default:
          break;
      }
    }
  }

  const depletionAge = result.indicators.assetLongevityAge;
  if (depletionAge !== null && depletionAge <= 95) {
    events.push({
      age: depletionAge,
      year: yearAt(depletionAge),
      type: 'depletion',
      title: '資産が尽きる試算',
      description: '条件調整で改善できる可能性があります。',
      major: true,
    });
  }

  // 95歳時点。枯渇がなければ主役、あれば詳細扱い。
  events.push({
    age: 95,
    year: yearAt(95),
    type: 'horizon',
    title: '95歳時点',
    description: `残資産 ${formatMan(result.indicators.assetsAt95)} の見込みです。`,
    major: depletionAge === null,
  });

  return events.sort((a, b) => a.age - b.age);
}

/** 通常表示用の要約イベント（major のみ・年齢重複を除き最大5件）。 */
export function summaryEvents(events: LifeEventEntry[]): LifeEventEntry[] {
  const seen = new Set<number>();
  return events
    .filter((e) => e.major)
    .filter((e) => (seen.has(e.age) ? false : (seen.add(e.age), true)))
    .slice(0, 5);
}
