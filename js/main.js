/* ============================================================
   main.js  —  메인(HOME) 페이지 로직
   - ROOMS 섹션: getRooms() 로 객실 카드 렌더 (json-server)
   - swiper 2개 인스턴스: 히어로(자동재생) / ROOMS(slidesPerView auto)
   - 주의: 헤더/푸터 주입이 끝난 뒤(common:ready) 에 swiper 초기화.
     DOM 없는 상태에서 붙이면 조용히 실패한다.
   ============================================================ */

import { getRooms, getEvents } from "./data.js";

/** ROOMS 카드 렌더.
 *  객실별 images 전체를 펼쳐 모든 사진을 슬라이드 카드로 렌더.
 *  (객실 4개 × 4장 = 16장)
 *  카드 클릭 시 페이지 이동 없음 — 라이트박스로 확대(initLightbox). */
function renderRooms(rooms) {
  const wrap = document.getElementById("rooms-wrapper");
  if (!wrap) return;

  const slides = rooms
    .slice()
    .sort((a, b) => a.id - b.id)
    .flatMap((room) => {
      const imgs = room.images && room.images.length ? room.images : [""];
      // 같은 객실의 모든 이미지 -> 같은 room={id} 링크의 카드들
      return imgs.map((imgFile) => {
        const img = imgFile ? `./images/${imgFile}` : "";
        const bg = img ? `background-image: url('${img}');` : "";
        return `
        <div class="swiper-slide">
          <div class="room-card" style="${bg}"></div>
        </div>`;
      });
    })
    .join("");

  wrap.innerHTML = slides;
}

/** 에러 메시지 노출 */
function showRoomsError(message) {
  const err = document.getElementById("rooms-error");
  if (err) {
    err.hidden = false;
    err.textContent = message;
  }
}

/** EVENT 카드 렌더.
 *  각 이벤트를 이미지(배경) + 캡션 구조의 슬라이드로 렌더.
 *  (ROOMS 와 동일한 JS 렌더 패턴으로 통일) */
function renderEvent(events) {
  const wrap = document.getElementById("event-wrapper");
  if (!wrap) return;

  const slides = events
    .slice()
    .sort((a, b) => a.id - b.id)
    .map((ev) => {
      const imgFile = ev.image || "";
      const img = imgFile ? `./images/${imgFile}` : "";
      const bg = img ? `background-image: url('${img}');` : "";
      const caption = ev.caption || "";
      return `
        <div class="swiper-slide event__card">
          <div class="event__img" style="${bg}"></div>
          <p class="event__caption">${caption}</p>
        </div>`;
    })
    .join("");

  wrap.innerHTML = slides;
}

/** swiper 두 인스턴스 초기화 (히어로 / ROOMS) */
function initSwipers() {
  if (typeof window.Swiper === "undefined") {
    console.error("[main] Swiper 전역 객체가 없습니다. CDN 로드를 확인하세요.");
    return;
  }

  // 히어로 슬라이드: 자동재생(5초), 무한루프, 페이지네이션
  new window.Swiper(".hero__swiper", {
    loop: true,
    autoplay: { delay: 4000, disableOnInteraction: false },
    pagination: { el: ".hero__pagination", clickable: true },
  });

  // ROOMS 슬라이드: 카드 400×300, 간격 40px (시안 실측)
  new window.Swiper(".rooms__swiper", {
    slidesPerView: "auto",
    spaceBetween: 40,
    grabCursor: true,
  });

  // EVENT 슬라이드: ROOMS 와 동일 설정으로 좌우 정렬·잘림 위치 일치.
  // (카드 4개라도 슬라이드 흐름 유지 → 오른쪽 끝이 살짝 잘려 보임)
  new window.Swiper(".event__swiper", {
    slidesPerView: "auto",
    spaceBetween: 40,
    grabCursor: true,
  });
}

/** ROOMS 데이터 로드 (json-server 장애 대비 try/catch) */
async function loadRooms() {
  try {
    const rooms = await getRooms();
    if (!Array.isArray(rooms) || rooms.length === 0) {
      throw new Error("객실 데이터가 없습니다.");
    }
    renderRooms(rooms);
  } catch (e) {
    console.error("[main] ROOMS 로드 실패:", e);
    showRoomsError(
      "객실 정보를 불러오지 못했습니다. json-server(localhost:3000)가 실행 중인지 확인해 주세요."
    );
  }
}

/** EVENT 데이터 로드 (json-server 장애 대비 try/catch) */
async function loadEvents() {
  try {
    const events = await getEvents();
    if (!Array.isArray(events) || events.length === 0) {
      throw new Error("이벤트 데이터가 없습니다.");
    }
    renderEvent(events);
  } catch (e) {
    console.error("[main] EVENT 로드 실패:", e);
  }
}

/* ============================================================
   이미지 확대 라이트박스
   - .room-card / .event__img 클릭 → 클릭한 것과 "동일 파일"의 확대판 표시.
   - 경로는 background-image url() 에서 추출(인라인 style 우선, 없으면 computedStyle).
   - 딤드 오버레이 클릭 시 닫힘. 이미지 자체 클릭으로는 닫지 않음(이벤트 전파 차단).
   - 한 번에 하나만. swiper 스와이프/스크롤 위치에 영향 X(fixed 오버레이).
   ============================================================ */

const LIGHTBOX_SELECTOR = ".room-card, .event__img";
let lightboxEl = null;

/** background-image 값("url('...')")에서 순수 경로만 추출. 없으면 null. */
function extractBgUrl(el) {
  const raw =
    el.style.backgroundImage || getComputedStyle(el).backgroundImage || "";
  // url('...') 또는 url("...") 또는 url(...) 대응
  const m = raw.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/i);
  return m ? m[1] : null;
}

/** 라이트박스 열기. 같은 이미지 경로로 확대판 생성. */
function openLightbox(url) {
  if (!url || lightboxEl) return; // URL 없거나 이미 열려있으면 무시(한 번에 하나)

  lightboxEl = document.createElement("div");
  lightboxEl.className = "lightbox";
  lightboxEl.setAttribute("role", "dialog");
  lightboxEl.setAttribute("aria-modal", "true");
  lightboxEl.innerHTML = `<div class="lightbox__img" style="background-image: url('${url}');"></div>`;

  // 배경(딤드) 클릭 시 닫힘. 이미지 자체 클릭은 전파 차단(닫지 않음).
  lightboxEl.addEventListener("click", (e) => {
    if (e.target === lightboxEl) closeLightbox();
  });
  // 이미지 영역 클릭이 배경까지 번지지 않게.
  lightboxEl.querySelector(".lightbox__img").addEventListener("click", (e) => {
    e.stopPropagation();
  });

  document.body.appendChild(lightboxEl);
  document.addEventListener("keydown", onLightboxKeydown);
}

function closeLightbox() {
  if (!lightboxEl) return;
  lightboxEl.remove();
  lightboxEl = null;
  document.removeEventListener("keydown", onLightboxKeydown);
}

function onLightboxKeydown(e) {
  if (e.key === "Escape") closeLightbox();
}

/** 라이트박스 초기화: ROOMS/EVENT 이미지에 클릭 위임.
 *  swiper 가 슬라이드를 복제(loop)/재배치 할 수 있으므로 document 위임으로 처리.
 *  라이트박스 자체 클릭과 구분하기 위해 .lightbox 내부 클릭은 무시. */
function initLightbox() {
  document.addEventListener("click", (e) => {
    // 이미 열린 라이트박스 내부 클릭은 여기서 처리하지 않음(자체 핸들러가 담당)
    if (e.target.closest(".lightbox")) return;

    const target = e.target.closest(LIGHTBOX_SELECTOR);
    if (!target) return;

    const url = extractBgUrl(target);
    if (!url) return;

    e.preventDefault(); // 부모 링크/스와이프 동작 방해 차단
    openLightbox(url);
  });
}

/** 메인 초기화 — 컴포넌트 주입 완료(common:ready) 후 실행 */
async function init() {
  // ROOMS/EVENT 데이터를 병렬로 렌더(슬라이드 DOM 생성)한 뒤 swiper/lightbox 부착.
  await Promise.all([loadRooms(), loadEvents()]);
  initSwipers(); // 슬라이드 DOM이 다 만들어진 뒤 swiper 부착
  initLightbox(); // 렌더된 이미지(.room-card/.event__img) 클릭 → 확대
}

// 초기화 시점 제어 (Web Components 전환 후):
// <my-header> 가 렌더되었거나, common.js 가 common:ready 를 이미 디스패치한 경우
// 바로 init. 그 외엔 이벤트를 기다린다. (ES module 평가 순서에 무관하게 동작)
if (document.querySelector("my-header .site-header") || window.__commonReady) {
  init();
} else {
  document.addEventListener("common:ready", init, { once: true });
}
