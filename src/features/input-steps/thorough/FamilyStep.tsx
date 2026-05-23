import { useInputStore } from '../../../store/inputStore';
import { getFieldByPath } from '../../../schema/fieldPath';
import {
  CHILD_LIVING_OPTIONS,
  CHILD_SCHOOL_OPTIONS,
  CHILD_UNI_OPTIONS,
  type ThoroughQuestion,
} from '../../../schema/thoroughSteps';
import type { SimulationInput } from '../../../schema/types';
import { ThoroughQuestionView } from './ThoroughQuestionView';

// 子ども・教育の専用ステップ。人数を選び、子ごとの詳細は折りたたみカードで圧迫感を抑える。
const COUNTS = [0, 1, 2, 3, 4];

function childQuestions(i: number): ThoroughQuestion[] {
  return [
    { path: `children.${i}.currentAge`, label: '年齢', kind: 'number', unit: '歳', min: 0, max: 30, allowSkip: true },
    {
      path: `children.${i}.middleSchool`,
      label: '中学',
      kind: 'choice',
      options: CHILD_SCHOOL_OPTIONS,
      allowRecommended: true,
      recommendedValue: 'public',
      recommendedLabel: '未定（公立で概算）',
    },
    {
      path: `children.${i}.highSchool`,
      label: '高校',
      kind: 'choice',
      options: CHILD_SCHOOL_OPTIONS,
      allowRecommended: true,
      recommendedValue: 'public',
      recommendedLabel: '未定（公立で概算）',
    },
    { path: `children.${i}.university`, label: '大学', kind: 'choice', options: CHILD_UNI_OPTIONS },
    { path: `children.${i}.uniLiving`, label: '大学時の住まい', kind: 'choice', options: CHILD_LIVING_OPTIONS },
  ];
}

// 年齢が未入力（仮値）のときは確定値のように見せない。
function childAgeLabel(child: SimulationInput['children'][number]): string {
  return child.currentAge.source === 'user_input' ? `${child.currentAge.value}歳` : '年齢未入力';
}

export function FamilyStep({ input }: { input: SimulationInput }) {
  const setCount = useInputStore((s) => s.setThoroughChildrenCount);
  const count = input.children.length;

  return (
    <>
      <div className="question-card">
        <div className="question-card__title">お子さまの人数</div>
        <div className="choice-group">
          {COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              className={`choice${count === n ? ' choice--selected' : ''}`}
              aria-pressed={count === n}
              onClick={() => setCount(n)}
            >
              {n === 0 ? 'いない' : `${n}人`}
            </button>
          ))}
        </div>
        {count > 0 && (
          <p className="field-status muted">
            各お子さまの詳細は下のカードで設定できます（未定はおすすめ値で概算します）。
          </p>
        )}
      </div>

      {input.children.map((child, i) => (
        <details className="collapsible child-card" key={i} open={i === 0}>
          <summary>
            お子さま{i + 1}（{childAgeLabel(child)}）
          </summary>
          <div className="collapsible__body">
            {childQuestions(i).map((q) => (
              <ThoroughQuestionView key={q.path} q={q} field={getFieldByPath(input, q.path)} />
            ))}
          </div>
        </details>
      ))}
    </>
  );
}
