/* ============================================================
   components/footer.js  —  공통 푸터 Web Component
   <my-footer></my-footer> 사용. fetch 주입 대신 커스텀 요소로 전환.

   - connectedCallback()에서 마크업 렌더.
   - 마크업/스타일/문구는 기존(footer.html)과 동일.
   ============================================================ */

import { FOOTER_HTML } from "./markup.js";

class MyFooter extends HTMLElement {
  connectedCallback() {
    // 커스텀 요소는 기본 display:inline → 블록으로 보정(레이아웃 안정).
    this.style.display = "block";
    this.innerHTML = FOOTER_HTML;
  }
}

customElements.define("my-footer", MyFooter);
