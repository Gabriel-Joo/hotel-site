/* ============================================================
   components/to-top.js  —  "맨 위로" 플로팅 버튼 Web Component
   <to-the-top></to-the-top> 사용. fetch 주입 대신 커스텀 요소로 전환.

   - connectedCallback()에서 마크업 렌더 + 클릭 바인딩.
   - 항상 표시(스크롤 위치 무관). 클릭 시 최상단 부드럽게 이동.
   ============================================================ */

import { TO_TOP_HTML } from "./markup.js";

class ToTheTop extends HTMLElement {
  connectedCallback() {
    // 커스텀 요소는 기본 display:inline → 블록으로 보정(레이아웃 안정).
    this.style.display = "block";
    this.innerHTML = TO_TOP_HTML;

    const btn = this.querySelector(".to-the-top");
    if (btn) {
      btn.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  }
}

customElements.define("to-the-top", ToTheTop);
