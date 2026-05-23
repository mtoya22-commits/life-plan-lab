import type { SimulationInput, SimulationResult } from '../../schema/types';
import type { LifeEventEntry } from './lifeEvents';
import { currentLifePhase, educationSettleAge, upcomingMilestones } from './lifePhase';

// 「人生フェーズ・次の節目」カード。結論(Hero)の直後に置き、
// 「今どの段階か」「次に何が来るか」「この先の見通し」を静かに伝える。
// 煽らず、終わりが見える情報（教育費ピークの一段落・住宅ローン完済）を添える。
export function Outlook({
  result,
  input,
  events,
}: {
  result: SimulationResult;
  input: SimulationInput;
  events: LifeEventEntry[];
}) {
  const age = input.basic.age.value;
  const phase = currentLifePhase(input, result);
  const upcoming = upcomingMilestones(events, age, 3);
  const reassurances = buildReassurances(result, input, events);

  return (
    <div className="outlook">
      <div className="outlook__phase">
        <span className="outlook__phase-tag">現在のフェーズ</span>
        <span className="outlook__phase-label">{phase.label}</span>
      </div>
      <p className="outlook__phase-desc">{phase.description}</p>

      {upcoming.length > 0 && (
        <div className="outlook__next">
          <div className="outlook__next-title">次に確認したい節目</div>
          <p className="outlook__next-main">
            次の大きな節目は、<strong>{upcoming[0].age}歳ごろ</strong>の{upcoming[0].title}です。
          </p>
          {upcoming.length > 1 && (
            <p className="outlook__next-rest muted">
              その後、{upcoming.slice(1).map((e) => `${e.age}歳ごろに${e.title}`).join('、')}が見込まれます。
            </p>
          )}
        </div>
      )}

      {reassurances.length > 0 && (
        <div className="outlook__seeahead">
          <div className="outlook__seeahead-title">この先の見通し</div>
          <ul className="outlook__seeahead-list">
            {reassurances.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// 「ずっと苦しいわけではない・山場がどこか分かる」感覚を作る、終わりが見える情報。
function buildReassurances(result: SimulationResult, input: SimulationInput, events: LifeEventEntry[]): string[] {
  const out: string[] = [];
  const fireStartAge =
    input.fire.type.value === 'none' ? input.income.retirementAge.value : input.fire.targetAge.value;

  if (input.children.length > 0) {
    const peak = result.indicators.eduPeakResilience.peakAge;
    const settle = educationSettleAge(input, result);
    if (settle && settle > peak) {
      out.push(`教育費は${peak}歳ごろにピークを迎え、${settle}歳ごろに一段落する見込みです。`);
    } else {
      out.push(`教育費は${peak}歳ごろにピークを迎える見込みです。`);
    }
  }

  const payoff = events.find((e) => e.type === 'mortgage');
  if (payoff) {
    const tail =
      payoff.age > fireStartAge
        ? '完済後は返済負担が下がりますが、持ち家の維持費は残ります。FIRE後もしばらく返済が続く見込みです。'
        : '完済後は返済負担が下がりますが、持ち家の維持費は残ります。';
    out.push(`住宅ローンは${payoff.age}歳ごろに完済予定です。${tail}`);
  }

  return out;
}
