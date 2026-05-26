// 拡大グラフの中で「現在価値」と「将来額」の見方を、専門語を使わず説明する折りたたみ。
// 初期は閉じる。気になる人だけ開く（標準のグラフ閲覧体験を邪魔しない）。
export function ChartExplainer() {
  return (
    <details className="collapsible explainer">
      <summary>現在価値と将来額の見方</summary>
      <div className="collapsible__body explainer__body">
        <dl className="explainer__dl">
          <div>
            <dt>現在価値</dt>
            <dd>
              将来のお金を「今のお金の感覚」で見た金額です。物価が上がると、同じ100万円でも将来は今ほど多くのものを買えない可能性があります。
            </dd>
          </div>
          <div>
            <dt>将来額</dt>
            <dd>その年に実際に表示される額面です。将来の通帳残高や支払い額に近い見方です。</dd>
          </div>
        </dl>
        <p className="explainer__guidance">
          生活の実感や安心感を見るときは、<strong>現在価値</strong>を中心に。
          実際に将来表示される金額を確かめたいときは<strong>将来額</strong>を見てください。
        </p>
        <div className="explainer__example">
          <div className="explainer__example-title">たとえば、95歳時点で次のように表示された場合</div>
          <ul className="explainer__example-list">
            <li>
              <span>将来額</span>
              <span>約2,034万円</span>
            </li>
            <li>
              <span>現在価値</span>
              <span>約658万円</span>
            </li>
          </ul>
          <p className="explainer__example-note muted">
            将来の通帳には約2,034万円残っている見込みでも、物価が上がっている前提では、今の感覚では約658万円くらいの購買力として見る、という意味です。
          </p>
        </div>
      </div>
    </details>
  );
}
