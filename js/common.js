/* ============================================================
   common.js  —  공통 Web Components 정의 + 준비 신호(common:ready)
   (모든 페이지에서 <script type="module" src="./js/common.js"> 로 로드)

   ※ Web Components 전환: 이전에는 components/*.html 조각을 fetch로
      주입했지만, 이제는 브라우저 표준 커스텀 요소로 대체.
      - <my-header>, <my-footer>, <to-the-top> 태그가 각 페이지에 직접 기재.
      - 커스텀 요소는 connectedCallback()에서 자신의 마크업을 렌더.

   common.js 역할(전환 후):
   1) 3개 커스텀 요소 정의(import만으로 define 실행됨)
   2) 컴포넌트 렌더 완료 후 main.js 등에 "common:ready" 신호 dispatch
      → swiper 등 DOM 의존 초기화가 조용히 실패하지 않도록 순서 보장.
   ============================================================ */

// 1) 커스텀 요소 정의 (import 즉시 customElements.define 실행)
import "./components/header.js";
import "./components/footer.js";
import "./components/to-top.js";

/* ---------- DOM 준비 대기 ---------- */
function ready() {
  return new Promise((resolve) => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", resolve, { once: true });
    } else {
      resolve();
    }
  });
}

/* ---------- 메인: 준비 신호 dispatch ----------
   - 커스텀 요소는 connectedCallback(동기)에서 즉시 렌더되므로,
     DOMContentLoaded 시점에는 이미 <my-header>/<my-footer>/<to-the-top>
     내부 마크업이 갖춰져 있다.
   - main.js 등 다른 페이지 스크립트는 이 "common:ready" 이벤트를
     기다렸다가 DOM 의존 초기화(swiper 등)를 수행한다.

   ※ 경쟁 주의: ES module 은 common.js 와 main.js 가 병렬로 fetch/평가되므로
      dispatch 시점에 main.js 의 리스너가 아직 등록 안 되었을 수 있다.
      → dispatch 후 window.__commonReady 플래그를 남겨, 리스너를 놓친
        스크립트가 폴링/재확인으로 init 할 수 있게 한다(순서 무관 보장). */
async function init() {
  await ready();
  window.__commonReady = true; // 늦게 로드된 스크립트용 마커
  document.dispatchEvent(new CustomEvent("common:ready"));
}

init();
