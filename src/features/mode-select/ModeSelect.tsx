import { useInputStore } from '../../store/inputStore';
import { ja } from '../../strings/ja';

// モード選択画面（入口）。ざっくり/しっかりを選んで入力フローへ進む。
export function ModeSelect() {
  const setMode = useInputStore((s) => s.setMode);
  const loadSample = useInputStore((s) => s.loadSample);

  return (
    <section className="screen mode-select">
      <h1 className="app-title">{ja.app.title}</h1>
      <p className="app-subtitle">{ja.app.subtitle}</p>

      <h2 className="section-heading">{ja.modeSelect.heading}</h2>
      <div className="mode-cards">
        <button className="mode-card" onClick={() => setMode('rough')}>
          <span className="mode-card__title">{ja.modeSelect.rough.title}</span>
          <span className="mode-card__desc">{ja.modeSelect.rough.desc}</span>
        </button>
        <button className="mode-card" onClick={() => setMode('thorough')}>
          <span className="mode-card__title">{ja.modeSelect.thorough.title}</span>
          <span className="mode-card__desc">{ja.modeSelect.thorough.desc}</span>
        </button>
      </div>

      {/* 開発用: 9問を手入力せずに結果画面/Bottom Sheetを確認する導線（本番では非表示）。 */}
      {import.meta.env.DEV && (
        <button className="link-btn dev-sample" onClick={loadSample}>
          サンプルで結果を見る（開発用）
        </button>
      )}
    </section>
  );
}
