/* ============================================================
   reservation-select.js  —  객실선택 페이지 로직
   - getRooms() 로 객실 띠 4개 렌더 (json-server)
   - images[0] 대표 이미지, name_eng 대문자, 클릭 시 reservation.html?room={id}
   - 주의: 헤더/푸터 주입 완료(common:ready) 후 렌더.
   - json-server 장애 시 try/catch + 에러 메시지.
   ============================================================ */

import { getRooms } from "./data.js";

/** HTML 이스케이프 (name_eng 등 외부 데이터 안전 출력) */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 객실 띠 4개 렌더 */
function renderRoomBanners(rooms) {
  const ul = document.getElementById("room-banners");
  if (!ul) return;

  const items = rooms
    .slice()
    .sort((a, b) => a.id - b.id)
    .map((room) => {
      const imgFile = room.images && room.images[0];
      const img = imgFile ? `./images/${imgFile}` : "";
      const bg = img ? `background-image: url('${img}');` : "";
      const name = escapeHtml(String(room.name_eng).toUpperCase());
      return `
        <li>
          <a class="room-banner" href="./reservation.html?room=${room.id}" style="${bg}">
            <span class="room-banner__overlay"></span>
            <span class="room-banner__inner">
              <span class="room-banner__name">${name}</span>
              <span class="room-banner__arrow" aria-hidden="true"></span>
            </span>
          </a>
        </li>`;
    })
    .join("");

  ul.innerHTML = items;
}

/** 에러 메시지 노출 */
function showError(message) {
  const err = document.getElementById("room-banners-error");
  if (err) {
    err.hidden = false;
    err.textContent = message;
  }
}

/** 데이터 로드 + 렌더 */
async function loadRoomBanners() {
  try {
    const rooms = await getRooms();
    if (!Array.isArray(rooms) || rooms.length === 0) {
      throw new Error("객실 데이터가 없습니다.");
    }
    renderRoomBanners(rooms);
  } catch (e) {
    console.error("[reservation-select] 객실 로드 실패:", e);
    showError(
      "객실 정보를 불러오지 못했습니다. json-server(localhost:3000)가 실행 중인지 확인해 주세요."
    );
  }
}

/** 초기화 — common:ready(주입 완료) 후 실행 */
async function init() {
  await loadRoomBanners();
}

// 헤더/푸터 렌더 후에만 동작 (Web Components 전환 후 fallback 갱신).
// my-header 가 렌더되었거나 common.js 가 이미 common:ready 를 디스패치했으면 즉시 init.
if (document.querySelector("my-header .site-header") || window.__commonReady) {
  init();
} else {
  document.addEventListener("common:ready", init, { once: true });
}
