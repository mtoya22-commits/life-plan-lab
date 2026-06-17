import { useInputStore } from '../../store/inputStore';
import { ja } from '../../strings/ja';
import { ImportedLivingCostBanner } from '../imported-living-cost/ImportedLivingCostBanner';

// モード選択画面（入口）。ざっくり/しっかりを選んで入力フローへ進む。
// 世界観: 結果・入力画面と同じ深緑ベースの Quiet Luxury。単なる計算フォームに見せない。
export function ModeSelect() {
  const setMode = useInputStore((s) => s.setMode);
  const loadSample = useInputStore((s) => s.loadSample);
  const loadThoroughSample = useInputStore((s) => s.loadThoroughSample);
  const loadHighIncomeSample = useInputStore((s) => s.loadHighIncomeSample);

  const m = ja.modeSelect;

  return (
    <section className="screen mode-select">
      <header className="top-hero">
        <span className="top-hero__eyebrow">{m.eyebrow}</span>
        <h1 className="top-hero__title">{ja.app.title}</h1>
        <p className="top-hero__lead">{ja.app.subtitle}</p>
      </header>

      <ImportedLivingCostBanner variant="modeSelect" />

      <h2 className="section-heading mode-select__heading">{m.heading}</h2>
      <div className="mode-cards">
        <button className="mode-card mode-card--rough" onClick={() => setMode('rough')}>
          <span className="mode-card__head">
            <span className="mode-card__title">{m.rough.title}</span>
            <span className="mode-card__meta">{m.rough.meta}</span>
          </span>
          {m.rough.badge && <span className="mode-card__badge">{m.rough.badge}</span>}
          <span className="mode-card__desc">{m.rough.desc}</span>
          <ul className="mode-card__points">
            {m.rough.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <span className="mode-card__cta">{m.cta} ›</span>
        </button>

        <button className="mode-card mode-card--thorough" onClick={() => setMode('thorough')}>
          <span className="mode-card__head">
            <span className="mode-card__title">{m.thorough.title}</span>
            <span className="mode-card__meta">{m.thorough.meta}</span>
          </span>
          <span className="mode-card__desc">{m.thorough.desc}</span>
          <ul className="mode-card__points">
            {m.thorough.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <span className="mode-card__cta">{m.cta} ›</span>
        </button>
      </div>

      <p className="top-note muted">{m.note}</p>

      {/* 開始前トップ画面にのみ出す説明・注意点・関連記事。
          ざっくり/しっかり 診断を始めると ModeSelect 自体がアンマウントされるため、
          質問画面・結果画面では自動的に表示されない。 */}
      <details className="collapsible top-details">
        <summary>{ja.top.detailsToggle}</summary>
        <div className="collapsible__body top-details__body">
          <h3 className="top-details__heading">{ja.top.whatYouLearnHeading}</h3>
          <ul className="top-details__list">
            {ja.top.whatYouLearnItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h3 className="top-details__heading">{ja.top.pvFutureHeading}</h3>
          <p className="top-details__body-text">{ja.top.pvFutureBody}</p>
        </div>
      </details>

      <section className="top-section top-cautions" aria-labelledby="top-cautions-heading">
        <h3 id="top-cautions-heading" className="top-section__heading">{ja.top.cautionsHeading}</h3>
        <p className="top-section__body muted">{ja.common.disclaimer}</p>
      </section>

      <section className="top-section top-related" aria-labelledby="top-related-heading">
        <h3 id="top-related-heading" className="top-section__heading">{ja.top.relatedHeading}</h3>
        <p className="top-section__body muted">{ja.top.relatedBody}</p>
      </section>

      {/* 開発用: 手入力せずに画面遷移・結果反映を確認する導線（本番では非表示・控えめに格納）。 */}
      {import.meta.env.DEV && (
        <details className="collapsible dev-menu">
          <summary>{m.devMenu}</summary>
          <div className="collapsible__body dev-menu__body">
            <button className="link-btn dev-sample" onClick={loadSample}>
              サンプルで結果を見る
            </button>
            <button className="link-btn dev-sample" onClick={() => loadThoroughSample(false)}>
              しっかり診断をサンプル入力で開始
            </button>
            <button className="link-btn dev-sample" onClick={() => loadThoroughSample(true)}>
              しっかり診断サンプルで結果を見る
            </button>
            <button className="link-btn dev-sample" onClick={() => loadHighIncomeSample(0)}>
              高収入ケース（年金未入力・検証用）
            </button>
            <button className="link-btn dev-sample" onClick={() => loadHighIncomeSample(330)}>
              高収入ケース（年金あり・現実寄り）
            </button>
          </div>
        </details>
      )}
    </section>
  );
}
