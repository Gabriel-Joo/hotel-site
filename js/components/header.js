/* ============================================================
   components/header.js  —  공통 헤더 Web Component
   <my-header></my-header> 사용. fetch 주입 대신 커스텀 요소로 전환.

   - connectedCallback()에서 마크업 렌더 + 헤더 인터랙션 바인딩.
   - 모바일(<=1000px): 1depth 클릭 → 서브를 메뉴 줄 아래 "전체 폭 행"
     (.gnb__sub-row)으로 옮겨 펼침. 한 번에 하나, 재탭 시 접힘.
   - 데스크톱(>1000px): hover 전용. 1depth 클릭은 페이지 이동 차단만(열기/닫기 X).
       · mouseenter → 열기(다른 열린 것은 즉시 닫고 새 것만, 한 번에 하나).
       · mouseleave → 닫힘(완전히 벗어나면 무조건).
   - 모바일(<=1000px): 탭(클릭) 전용. hover 동작 없음.
       · 탭 → 서브 펼침/접힘(토글). 다른 메뉴 탭 시 이전 것 닫히고 새 것만.
   - 공통: 1depth 클릭/탭은 항상 preventDefault. 페이지 이동은 2depth 클릭 시에만.
     pinned(클릭 고정) 개념은 없다.
   - 브레드포인트 전환 대응: 클릭/호버 핸들러는 한 번만 바인딩하고,
     매 이벤트마다 isMobile() 을 평가해 동작을 분기한다(리스너 재바인딩 불필요).
   (CSS :hover 표시 규칙은 사용하지 않음 — JS 가 단일 진실 원본이 되어
    두 서브가 동시에 열리는 버그를 원천 차단.)
   ============================================================ */

import { HEADER_HTML } from "./markup.js";

const MOBILE_BREAKPOINT = 1000;

class MyHeader extends HTMLElement {
  connectedCallback() {
    // 커스텀 요소는 기본 display:inline → 블록으로 보정(레이아웃 안정).
    this.style.display = "block";
    this.innerHTML = HEADER_HTML;

    this.#bindHeader();
  }

  /* 헤더 인터랙션 바인딩 (구 common.js bindHeader 이관). 상단 파일 주석 참조. */
  #bindHeader() {
    const items = this.querySelectorAll(".gnb__item");
    const isMobile = () => window.innerWidth <= MOBILE_BREAKPOINT;

    // 서브 행 컨테이너(메뉴 줄 바로 아래 전체 폭 행).
    const subRow = this.querySelector(".gnb__sub-row");
    // 현재 행에 펼쳐진 서브를 소유한 메뉴(item). 한 번에 하나만. (모바일)
    let activeItem = null;

    /* 서브(sub)를 행(.gnb__sub-row)으로 옮겨 펼친다.
       마크업에서 sub는 <li> 안 [toggle 버튼 바로 뒤]에 있으므로,
       복원 시 sub를 다시 그 toggle 뒤로 돌려놓기 위해 자리(anchor)를 저장. */
    const moveToRow = (item) => {
      const sub = item.querySelector(".gnb__sub");
      const toggle = item.querySelector(".gnb__toggle");
      if (!sub || !subRow) return;

      // 다른 메뉴가 열려 있으면 먼저 접기(원래 <li>로 복원).
      if (activeItem && activeItem !== item) {
        restoreItem(activeItem);
      }

      // sub의 원래 자리(바로 앞 형제)를 기억 → 나중에 복원.
      sub.dataset.prevSibling = "toggle"; // toggle 바로 뒤가 원래 자리
      subRow.appendChild(sub); // 행으로 이동 → 전체 폭 행이 됨
      subRow.hidden = false; // 빈 행 숨김 해제
      item.classList.add("is-open");
      activeItem = item;
      if (toggle) toggle.setAttribute("aria-expanded", "true");
    };

    /* sub를 원래 <li>(toggle 바로 뒤)로 되돌리고 접는다. */
    const restoreItem = (item) => {
      const sub = subRow ? subRow.querySelector(".gnb__sub") : null;
      const toggle = item.querySelector(".gnb__toggle");
      // 행에 있는 서브가 이 item 것이면 원래 자리로 복원.
      if (sub && item === activeItem) {
        if (toggle) toggle.after(sub); // toggle 바로 뒤(원래 자리)로
        else item.appendChild(sub);
        delete sub.dataset.prevSibling;
      }
      item.classList.remove("is-open");
      if (toggle) toggle.setAttribute("aria-expanded", "false");
      if (item === activeItem) activeItem = null;
      if (subRow && !subRow.children.length) subRow.hidden = true;
    };

    /* ---- 데스크톱용 헬퍼: .is-open 단일 클래스로 표시 제어 (hover 전용) ----
       데스크톱은 클릭 열기 로직이 없다 — 오직 mouseenter/leave 로만 열고 닫는다.
       어떤 잔여 상태가 남든 hover 진입 시 무조건 청소되도록 closeAllDesktop 를
       조건 없이(keep 무관 전체) 호출해 초기화한다. */
    const closeDesktop = (item) => {
      item.classList.remove("is-open");
      const t = item.querySelector(".gnb__toggle");
      if (t) t.setAttribute("aria-expanded", "false");
    };
    // 모든 메뉴의 열림 상태를 무조건 초기화(잔여 is-open/aria-expanded 전부).
    const closeAllDesktop = () => {
      items.forEach((it) => closeDesktop(it));
    };
    // 데스크톱 서브 열기(hover 진입). 진입 시 무조건 전체 초기화 후 이 메뉴만.
    const openDesktop = (item) => {
      closeAllDesktop(); // 안전장치: 이전 잔여 상태 완전 청소(한 번에 하나 보장)
      item.classList.add("is-open");
      const t = item.querySelector(".gnb__toggle");
      if (t) t.setAttribute("aria-expanded", "true");
    };

    items.forEach((item) => {
      const link = item.querySelector(".gnb__link");
      const toggle = item.querySelector(".gnb__toggle");
      const hasSub = !!item.querySelector(".gnb__sub");

      /* 1depth 클릭/탭 — 브레드포인트 전환에도 한 번 바인딩으로 동작하도록,
         호출 시점(매 이벤트)에 isMobile() 을 평가해 동작을 분기한다.
         - 모바일: 탭 → 서브 펼침/접힘(토글). hover 없음.
         - 데스크톱: 클릭 → "페이지 이동 차단"만. 열기/닫기 로직 없음(hover 전용). */
      const onClick = (e) => {
        if (!hasSub) return; // 서브 없는 메뉴는 그냥 이동
        e.preventDefault(); // 1depth 클릭/탭 이동 차단 (공통)

        if (isMobile()) {
          // 모바일 탭 토글: 자기 자신이 열려 있으면 접고, 아니면 핀다.
          if (item === activeItem) {
            restoreItem(item);
            return;
          }
          moveToRow(item); // 기존 활성은 moveToRow 안에서 자동 접힘
        } else {
          // 데스크톱: 열기/닫기 상태를 전혀 바꾸지 않는다(hover 전용).
          // 다만 클릭으로 <a> 에 포커스가 남으면 :focus-within(CSS) 과 충돌할 수 있으니
          // 포커스를 즉시 제거한다(:focus-within 규칙은 이미 제거했지만 이중 방어).
          const a = e.currentTarget;
          if (a && typeof a.blur === "function") a.blur();
        }
      };
      if (link) link.addEventListener("click", onClick);
      if (toggle) toggle.addEventListener("click", onClick);

      /* 데스크톱 hover — 항상 바인딩하되, 모바일에선 mouse 이벤트가 거의
         발생하지 않고 발생해도 CSS 가 .gnb__sub(display:none)로 막아 표시에
         영향이 없다. resize 시 is-open 도 정리되므로 안전. */
      item.addEventListener("mouseenter", () => {
        if (isMobile()) return; // 모바일은 hover 동작 없음
        openDesktop(item); // 다른 열린 것은 즉시 닫고 새 것만
      });
      item.addEventListener("mouseleave", () => {
        if (isMobile()) return;
        closeDesktop(item); // 완전히 벗어나면 무조건 닫힘
      });
    });

    // 데스크톱: 헤더(메뉴 영역) 전체에서 마우스가 벗어나면 열림 상태 전부 초기화.
    // 개별 item mouseleave 만으로는 메뉴들 사이 빈 공간 경계를 완전히 커버 못하는
    // 엣지를 잡는 안전장치. (모바일은 무시)
    const gnb = this.querySelector(".gnb");
    if (gnb) {
      gnb.addEventListener("mouseleave", () => {
        if (isMobile()) return;
        closeAllDesktop();
      });
    }

    // 본문(my-header 다음 형제)의 margin-top 을 헤더 실측 높이에 동기화.
    // 모바일은 헤더 높이 90px 고정 + 서브는 absolute 오버레이라 본문이 안 밀림.
    // (offsetHeight=90 → margin-top=90 으로 CSS 폴백(responsive.css)과 정합.)
    const header = this.querySelector(".site-header");
    const syncBodyOffset = () => {
      const next = this.nextElementSibling; // my-header + *
      if (!next || !header) return;
      if (!isMobile()) {
        // 데스크탑은 common.css 기본값(var(--header-height))으로 복귀.
        next.style.removeProperty("margin-top");
        return;
      }
      next.style.marginTop = header.offsetHeight + "px";
    };

    // 헤더 높이 변화(서브 펼침/접힘, 폰트 로드 등)를 관찰해 자동 동기화.
    // 헤더 자신(아닌 형제)에 margin 을 주므로 옵저버 루프 없음.
    if (header && "ResizeObserver" in window) {
      const ro = new ResizeObserver(syncBodyOffset);
      ro.observe(header);
    }

    // 헤더 바깥 클릭/터치 시 데스크탑에서 열린 서브 모두 닫기.
    document.addEventListener("click", (e) => {
      if (isMobile()) return; // 모바일은 자체 행 토글이 담당
      if (e.target.closest(".site-header")) return; // 헤더 내 클릭은 무시
      items.forEach((item) => item.classList.remove("is-open"));
    });

    // 화면 크기 전환 시: 모바일에서 열려있던 서브메뉴 복원(원래 <li>로) +
    // 데스크탑 진입 시 본문 margin-top 인라인 제거(기본값 복귀).
    window.addEventListener("resize", () => {
      if (!isMobile()) {
        // 행으로 옮겨둔 서브가 있으면 원래 <li>로 되돌림(데스크탑 hover용).
        if (activeItem) restoreItem(activeItem);
      }
      // 양방향 전환 모두: 데스크탑 열림 상태 초기화(잔여 상태 방지).
      items.forEach((item) => item.classList.remove("is-open"));
      syncBodyOffset();
    });

    // 초기 동기화(혹시 ResizeObserver 첫 콜백보다 빠른 경우) +
    // 웹폰트(KOROAD) 로드 완료 후 높이 보정.
    syncBodyOffset();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(syncBodyOffset);
    }
  }
}

customElements.define("my-header", MyHeader);
