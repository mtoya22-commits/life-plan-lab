import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// WordPress 等の親ページに iframe で埋め込まれているかを起動時に 1 回だけ判定し、
// <html> に data-embedded="true" と is-embedded クラスを付ける。
// CSS の高い特異性で単独表示時の inner-scroll パターンを上書きし、
// スクロールを親ページ 1 本にまとめる。
function detectEmbedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    // cross-origin で window.top に触れない場合は埋め込みとみなす。
    return true;
  }
}
if (detectEmbedded()) {
  document.documentElement.dataset.embedded = 'true';
  document.documentElement.classList.add('is-embedded');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
