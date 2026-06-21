# 総合版 生活設計シミュレーター を WordPress 等に iframe 埋め込みする

このドキュメントは、ビルド済みの総合版「生活設計シミュレーター」を WordPress 固定ページ・Note 記事・LP などへ iframe で埋め込む際の最小・推奨実装をまとめたものです。

姉妹アプリ（生活費見直しシミュレーター・住宅ローンシミュレーター）と同じ思想で、**スクロールは親ページ 1 本** にまとめる前提です。アプリ側は `<html>` に `data-embedded="true"` / `class="is-embedded"` が付いた時点で内側スクロールと sticky bottom-nav を自動解除し、コンテンツ高さに合わせて伸びるレイアウトに切り替わります。

## アプリ → 親ページ への通知

アプリは以下 2 種のメッセージを `window.parent.postMessage(..., '*')` で送ります。受信は任意（仕掛けなくてもアプリは動きます）。

| type | 送信タイミング | payload |
|---|---|---|
| `lifeplanlab:resize` | 起動直後・コンテンツ高さの変化時 | `{ type, source: 'life-plan-simulator', height: number }` |
| `lifeplanlab:scrollTop` | 画面遷移（モード選択→入力→結果）・結果再計算時 | `{ type, source: 'life-plan-simulator' }` |

`source: 'life-plan-simulator'` を必ずチェックして、他アプリの同名メッセージと衝突しないようにしてください。

> 注: ResumePrompt 開閉時の `lifeplan-lab:modal` メッセージ（既存）も並行して送られます。必要なければ無視して構いません。

## 親ページ → iframe への URL パススルー（重要）

姉妹アプリ（生活費見直しシミュレーター・住宅ローンシミュレーター）から、親 WordPress ページの URL に `?livingCostMonthly=...` などのパラメータが付与された状態で着地することがあります。総合版アプリは iframe 内で動いているため、**親ページの URL params は iframe の `window.location.search` には自動では渡りません**（iframe は別 URL を見ている）。

そのため、埋め込みコード側で **親の `location.search` から許可済みパラメータだけを抜き取り、iframe `src` に append** する必要があります。許可外のパラメータは黙って無視し、通常アクセス時（params 無し）は base src と完全に同じ動作になります。

### 受け渡し対象パラメータ（許可リスト）

```
livingCostMonthly, livingCostSource,
mortgageMonthlyPaymentYen, mortgageAnnualPaymentYen, mortgageBalanceYen,
mortgageInterestRate, mortgageRemainingYears, mortgageSource,
mortgageBonusAnnualYen, mortgageRepaymentMethod, mortgageRateType
```

アルゴリズムは TypeScript 版 (`src/lib/embedParentParams.ts`) と完全同一。jsdom テスト (`tests/lib/embedParentParams.test.ts`) で挙動を担保しています。

## 最小実装（コピペで動く）

WordPress カスタム HTML ブロックや、カスタムテーマの固定ページテンプレートに貼り付けます。

iframe は **`src` を空のまま `data-base-src` に base URL を置く** 形にし、スクリプトでマウント直後に `frame.src = base + 許可済み params` をセットします。これで親ページの URL params が iframe に持ち越されます。

```html
<div class="lifeplanlab-embed" style="max-width: 760px; margin: 0 auto;">
  <iframe
    id="lifeplanlab-frame"
    data-base-src="https://example.com/life-plan-lab/"
    title="生活設計シミュレーター"
    style="width: 100%; min-height: 600px; border: 0; display: block;"
    loading="lazy"
    scrolling="no"
  ></iframe>
</div>

<script>
(function () {
  // 親ページの URL params のうち、iframe 内アプリに渡してよいキーだけを抜き出す。
  // 許可外パラメータは黙って捨てる。通常アクセス時は base URL と完全に同じ動作になる。
  var ALLOW = [
    'livingCostMonthly', 'livingCostSource',
    'mortgageMonthlyPaymentYen', 'mortgageAnnualPaymentYen', 'mortgageBalanceYen',
    'mortgageInterestRate', 'mortgageRemainingYears', 'mortgageSource',
    'mortgageBonusAnnualYen', 'mortgageRepaymentMethod', 'mortgageRateType'
  ];
  var frame = document.getElementById('lifeplanlab-frame');
  if (!frame) return;

  // 1) 親 location.search から許可済み params だけを抜き、iframe src に付与する。
  var base = frame.getAttribute('data-base-src') || frame.getAttribute('src') || '';
  var parent = new URLSearchParams(location.search);
  var allowed = new URLSearchParams();
  for (var i = 0; i < ALLOW.length; i++) {
    var v = parent.get(ALLOW[i]);
    if (v !== null && v !== '') allowed.set(ALLOW[i], v);
  }
  var qs = allowed.toString();
  frame.src = qs ? base + (base.indexOf('?') >= 0 ? '&' : '?') + qs : base;

  // 2) アプリからの高さ追従・先頭スクロール依頼。
  window.addEventListener('message', function (e) {
    var data = e && e.data;
    if (!data || data.source !== 'life-plan-simulator') return;

    if (data.type === 'lifeplanlab:resize' && typeof data.height === 'number') {
      // 1px や負値・極端な大きさをガードしつつ iframe 高さを追従させる。
      var h = Math.max(400, Math.min(20000, Math.round(data.height)));
      frame.style.height = h + 'px';
    }

    if (data.type === 'lifeplanlab:scrollTop') {
      // 親 WordPress ページを iframe 先頭にスムーススクロールする。
      var top = frame.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({ top: top - 8, behavior: 'smooth' });
    }
  });
})();
</script>
```

## 推奨実装（URL パススルー + モーダル通知）

最小実装に「ResumePrompt 開閉中は親スクロールを止める」処理を足したフル版。
URL パススルーも同様に行います（最小実装と同じアルゴリズム）。

```html
<script>
(function () {
  var ALLOW = [
    'livingCostMonthly', 'livingCostSource',
    'mortgageMonthlyPaymentYen', 'mortgageAnnualPaymentYen', 'mortgageBalanceYen',
    'mortgageInterestRate', 'mortgageRemainingYears', 'mortgageSource',
    'mortgageBonusAnnualYen', 'mortgageRepaymentMethod', 'mortgageRateType'
  ];
  var frame = document.getElementById('lifeplanlab-frame');
  if (!frame) return;
  var saved = '';

  // 親ページ → iframe の URL パススルー。
  var base = frame.getAttribute('data-base-src') || frame.getAttribute('src') || '';
  var parent = new URLSearchParams(location.search);
  var allowed = new URLSearchParams();
  for (var i = 0; i < ALLOW.length; i++) {
    var v = parent.get(ALLOW[i]);
    if (v !== null && v !== '') allowed.set(ALLOW[i], v);
  }
  var qs = allowed.toString();
  frame.src = qs ? base + (base.indexOf('?') >= 0 ? '&' : '?') + qs : base;

  window.addEventListener('message', function (e) {
    var data = e && e.data;
    if (!data) return;

    // 高さ追従・先頭スクロールは life-plan-simulator から。
    if (data.source === 'life-plan-simulator') {
      if (data.type === 'lifeplanlab:resize' && typeof data.height === 'number') {
        var h = Math.max(400, Math.min(20000, Math.round(data.height)));
        frame.style.height = h + 'px';
      } else if (data.type === 'lifeplanlab:scrollTop') {
        var top = frame.getBoundingClientRect().top + window.pageYOffset;
        window.scrollTo({ top: top - 8, behavior: 'smooth' });
      }
    }

    // ResumePrompt 開閉中だけ親スクロールを止める（任意）。
    if (data.type === 'lifeplan-lab:modal') {
      if (data.open) {
        saved = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = saved;
      }
    }
  });
})();
</script>
```

## チェックリスト

- [ ] iframe の `data-base-src` に総合版のデプロイ URL を入れている（GitHub Pages の `/life-plan-lab/` など）
- [ ] スクリプトで親 `location.search` から **許可済みパラメータ** だけを抜き、`frame.src` に append している
- [ ] iframe に `scrolling="no"` を付け、内側スクロールが出ないようにしている
- [ ] `lifeplanlab:resize` リスナで `iframe.style.height` を追従させている
- [ ] `lifeplanlab:scrollTop` リスナで親ページを iframe 先頭へスクロールしている
- [ ] `data.source === 'life-plan-simulator'` で他アプリと混線しないようにしている
- [ ] 高さは `Math.max(min, Math.min(max, ...))` で clamp して空白増殖を防いでいる

## 単独表示（GitHub Pages 直リンク）でのフォールバック

`<html>` に `is-embedded` が付かないため、アプリは従来どおり `100svh` + `overflow: hidden` + `overflow-y: auto` + sticky bottom-nav の inner-scroll パターンで描画されます。スマホ単独利用時の操作性はこの構成が最も安定するため、埋め込みと単独の双方を 1 つのビルド成果物で両立します。

## 検証ポイント

1. PC ブラウザで親ページを開く → 入力フォームをスクロール → 親ページ 1 本のスクロールだけが動く（iframe 内スクロールバーが出ない）
2. 「次へ」「結果を見る」で phase が変わる → 親ページが iframe 先頭にスムーススクロールする
3. 折りたたみ展開、グラフロードなどで iframe 高さが増えると親 iframe も追従する
4. iframe 高さが空白で勝手に増殖しない（送信側で 2px 振動を無視している）
5. ResumePrompt（再開ダイアログ）を開いてもダイアログが画面外に切れない
6. 親ページに `?livingCostMonthly=297000&livingCostSource=categoryScenario` を付けて開くと、iframe 内の総合版「毎月の生活費」が **29.7** プリフィルされる（URL パススルー動作確認）
7. 親ページに `?foo=bar&livingCostMonthly=297000` を付けて開くと、許可外 `foo` は iframe に渡らず、`livingCostMonthly` だけが渡る
