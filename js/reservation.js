/* ============================================================
   reservation.js  —  실시간예약(달력) 페이지 로직 (프로젝트 핵심)
   - URL ?room={id} 로 객실 식별. 없으면/잘못되면 select 페이지로.
   - 달력 렌더 + 날짜 선택(입실/퇴실) + 예약완료/6일제한 검사
   - getTotalPrice() 로 총합계 갱신
   - 헤더/푸터 주입 완료(common:ready) 후 동작.
   ============================================================ */

import {
  getRooms,
  getReservations,
  getHoliday,
  getTotalPrice,
  toYMD,
  parseYMD,
} from "./data.js";
import { createCalendar } from "./calendar.js";

/* ---------- 상태 ---------- */
const state = {
  room: null, // {id, name_eng, capacity, min, images, desc, desc_eng}
  bookedSet: new Set(), // 예약완료 날짜(체크아웃 당일 제외) "YYYY-MM-DD"
  holidayMap: new Map(), // "YYYY-MM-DD" -> 공휴일 이름
  viewYear: 0, // 달력 표시 연도
  viewMonth: 0, // 달력 표시 월(0~11)
  checkIn: null, // "YYYY-MM-DD" | null
  checkOut: null, // "YYYY-MM-DD" | null
  extra: 0, // 추가 인원
};

const today = new Date();
today.setHours(0, 0, 0, 0);

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const MAX_NIGHTS_DAYS = 6; // 6일까지만(최대 5박). 6일 = 입실 포함 6일

/* ---------- 유틸 ---------- */
function $(id) {
  return document.getElementById(id);
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// 같은 날인지 (시간 무시)
function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/* ---------- 진입: room id 파싱 + 검증 ---------- */
function getRoomIdFromURL() {
  const params = new URLSearchParams(location.search);
  const raw = params.get("room");
  const id = Number(raw);
  if (!raw || !Number.isInteger(id) || id < 1) return null;
  return id;
}

/* ---------- 갤러리 렌더 ----------
   - 큰 이미지: 썸네일 클릭 또는 드래그/스와이프(좌우) 로 넘김.
   - 전환: 300ms ease-in-out 페이드(.is-changing). 터치/마우스 공용(pointer events). */
function renderGallery() {
  const room = state.room;
  const images = room.images || [];
  if (images.length === 0) return;

  const mainWrap = document.querySelector("#gallery-main .swiper-wrapper");
  const thumbsWrap = document.querySelector("#gallery-thumbs .swiper-wrapper");

  // 메인 슬라이드: 이미지마다 swiper-slide (배경 이미지)
  mainWrap.innerHTML = images
    .map(
      (img) =>
        `<div class="swiper-slide rsv-gallery__slide" style="background-image: url('./images/${esc(
          img,
        )}')"></div>`,
    )
    .join("");

  // 썸네일 슬라이드: 이미지마다 swiper-slide (클릭 시 메인 이동)
  thumbsWrap.innerHTML = images
    .map(
      (img) =>
        `<div class="swiper-slide rsv-gallery__thumb" style="background-image: url('./images/${esc(
          img,
        )}')"></div>`,
    )
    .join("");

  // 이전 인스턴스 정리(객실 바꿀 때 중복 방지)
  if (state.mainSwiper) state.mainSwiper.destroy(true, true);
  if (state.thumbsSwiper) state.thumbsSwiper.destroy(true, true);

  // 썸네일 Swiper 먼저 (메인이 이걸 참조)
  state.thumbsSwiper = new window.Swiper("#gallery-thumbs", {
    slidesPerView: "auto",
    spaceBetween: 14,
    watchSlidesProgress: true,
  });
  // 메인 Swiper (좌우 슬라이드 + 썸네일 연동)
  state.mainSwiper = new window.Swiper("#gallery-main", {
    spaceBetween: 0,
    grabCursor: true,
    thumbs: { swiper: state.thumbsSwiper },
  });

  // 객실명 + 설명 (유지)
  $("room-name").textContent = String(room.name_eng).toUpperCase();
  $("gallery-desc").textContent = room.desc || "";
  $("gallery-desc-eng").textContent = room.desc_eng || "";
}

/* ---------- 예약완료 날짜 집합 생성 (체크아웃 당일 제외) ---------- */
function buildBookedSet(reservations) {
  const set = new Set();
  reservations
    .filter((r) => Number(r.room_id) === Number(state.room.id))
    .forEach((r) => {
      const start = parseYMD(r.check_in_date);
      const end = parseYMD(r.check_out_date);
      // 체크인 ~ 체크아웃 "전날" 까지 막힘 (퇴실 당일은 비어있음)
      for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        set.add(toYMD(d));
      }
    });
  return set;
}

/* ---------- 달력 (calendar.js 공용 모듈 사용) ---------- */
let calendar = null;

function initCalendar() {
  calendar = createCalendar({
    elements: {
      title: $("cal-title"),
      prev: $("cal-prev"),
      next: $("cal-next"),
      grid: $("cal-grid"),
    },
    state, // { bookedSet, holidayMap, checkIn, checkOut, viewYear, viewMonth }
    readOnly: false,
    today,
    onCellClick: (ymd) => onCellClick(ymd),
  });
}

function renderCalendar() {
  if (calendar) calendar.render();
}

/* ---------- 날짜 선택 로직 ---------- */
function onCellClick(ymd) {
  const clicked = parseYMD(ymd);

  // 0) 이미 입실·퇴실 범위가 모두 선택된 상태에서 다시 클릭 →
  //    기존 선택을 모두 초기화하고, 그 날짜를 새 입실일로 지정(전체 리셋).
  if (state.checkIn && state.checkOut) {
    state.checkIn = ymd;
    state.checkOut = null;
    refresh();
    return;
  }

  // 1) 아직 입실도 없으면 -> 입실 지정
  if (!state.checkIn) {
    state.checkIn = ymd;
    state.checkOut = null;
    refresh();
    return;
  }

  const cIn = parseYMD(state.checkIn);

  // 2) 입실만 있는 상태(퇴실 미선택)
  // 2-a) 선택된 입실일과 "같은 날"을 다시 클릭 → 선택 완전 해제.
  //      (새 입실을 지정하지 않고, 아무것도 선택되지 않은 초기 상태로.)
  if (isSameDay(clicked, cIn)) {
    state.checkIn = null;
    state.checkOut = null;
    refresh();
    return;
  }

  // 2-b) 클릭한 날이 입실일 "이전" -> 기존 입실 버리고 클릭한 날을 새 입실
  if (clicked < cIn) {
    state.checkIn = ymd;
    state.checkOut = null;
    refresh();
    return;
  }

  // 2-c) 클릭한 날이 입실 이후 -> 퇴실 후보. 검사:
  //   - 범위(cIn~clicked 전날)에 예약완료 포함? -> 모달, 초기화
  //   - 일수(입실~퇴실 포함)가 6일 초과? -> 모달, 초기화
  const dayCount = inclusiveDayCount(cIn, clicked); // 입실~퇴실 포함 일수
  if (hasBookedInRange(cIn, clicked)) {
    state.checkIn = null;
    state.checkOut = null;
    refresh();
    showAlert("이미 예약된 날짜가 포함되어 있습니다.");
    return;
  }
  if (dayCount > MAX_NIGHTS_DAYS) {
    state.checkIn = null;
    state.checkOut = null;
    refresh();
    showAlert("6일 이상은 예약할 수 없습니다.");
    return;
  }

  // 통과 -> 퇴실 확정
  state.checkOut = ymd;
  refresh();
}

// 입실~퇴실 "포함" 일수 (6/19~6/20 = 2일)
function inclusiveDayCount(checkInD, checkOutD) {
  const ms = checkOutD - checkInD;
  return Math.round(ms / 86400000) + 1;
}

// checkIn ~ checkOut "전날" 사이에 예약완료가 끼어있는지
function hasBookedInRange(checkInD, checkOutD) {
  for (let d = new Date(checkInD); d < checkOutD; d.setDate(d.getDate() + 1)) {
    if (state.bookedSet.has(toYMD(d))) return true;
  }
  return false;
}

/* ---------- 추가 인원 select ---------- */
function renderExtraOptions() {
  const room = state.room;
  const max = (room.capacity || 0) - (room.min || 0); // 추가 가능 인원 상한
  const sel = $("extra-guests");
  let opts = '<option value="0">없음</option>';
  for (let i = 1; i <= max; i++) {
    opts += `<option value="${i}">${i}명</option>`;
  }
  sel.innerHTML = opts;
  sel.value = String(state.extra);
  sel.addEventListener("change", () => {
    state.extra = Number(sel.value);
    updateTotal();
  });
}

/* ---------- 총 합계 갱신 ---------- */
async function updateTotal() {
  const amountEl = $("total-amount");
  if (!state.checkIn || !state.checkOut) {
    amountEl.textContent = "0";
    setSubmitActive(false);
    return;
  }
  try {
    const total = await getTotalPrice(
      state.room.id,
      state.checkIn,
      state.checkOut,
      state.extra,
    );
    amountEl.textContent = total.toLocaleString("ko-KR");
    setSubmitActive(true);
  } catch (e) {
    console.error("[reservation] 요금 계산 실패:", e);
    amountEl.textContent = "0";
    setSubmitActive(false);
  }
}

function setSubmitActive(active) {
  const btn = $("btn-submit");
  btn.classList.toggle("is-active", active);
  btn.disabled = !active;
}

/* ---------- 전체 갱신 ---------- */
function refresh() {
  renderCalendar();
  updateTotal();
}

/* ---------- 모달 ---------- */
function showAlert(message) {
  $("alert-text").textContent = message;
  $("alert-modal").hidden = false;
}

/* ---------- 버튼 ---------- */
function bindButtons() {
  // 달력 네비
  $("cal-prev").addEventListener("click", () => {
    if ($("cal-prev").disabled) return;
    let m = state.viewMonth - 1;
    let y = state.viewYear;
    if (m < 0) {
      m = 11;
      y--;
    }
    calendar.setView(y, m);
  });
  $("cal-next").addEventListener("click", () => {
    let m = state.viewMonth + 1;
    let y = state.viewYear;
    if (m > 11) {
      m = 0;
      y++;
    }
    calendar.setView(y, m);
  });

  // 모달 확인
  $("alert-ok").addEventListener("click", () => {
    $("alert-modal").hidden = true;
  });

  // 취소 -> 이전 페이지로 (history back)
  $("btn-cancel").addEventListener("click", () => {
    history.back();
  });

  // 예약하기 -> form 페이지 (날짜/인원 전달)
  $("btn-submit").addEventListener("click", () => {
    if ($("btn-submit").disabled) return;
    const q = new URLSearchParams({
      room: state.room.id,
      checkIn: state.checkIn,
      checkOut: state.checkOut,
      extra: state.extra,
    });
    location.href = `./reservation-form.html?${q.toString()}`;
  });
}

/* ---------- 메인 ---------- */
async function init() {
  const roomId = getRoomIdFromURL();
  // 잘못된 진입 -> select 페이지로
  if (!roomId) {
    location.replace("./reservation-select.html");
    return;
  }

  try {
    const [rooms, reservations, holidays] = await Promise.all([
      getRooms(),
      getReservations(),
      getHoliday(),
    ]);
    // id 는 json-server에서 문자열로 올 수 있어 문자/숫자 모두 비교
    const room = rooms.find((r) => Number(r.id) === roomId);
    if (!room) {
      location.replace("./reservation-select.html");
      return;
    }

    state.room = room;
    state.bookedSet = buildBookedSet(reservations);
    state.holidayMap = new Map(
      holidays.map((h) => [h.holiday_date, h.holiday_name]),
    );
    // 초기 표시 월 = 오늘이 속한 달
    state.viewYear = today.getFullYear();
    state.viewMonth = today.getMonth();

    renderGallery();
    renderExtraOptions();
    initCalendar();
    refresh();
    bindButtons();
  } catch (e) {
    console.error("[reservation] 초기화 실패:", e);
    showAlert(
      "예약 정보를 불러오지 못했습니다. json-server(localhost:3000)가 실행 중인지 확인해 주세요.",
    );
  }
}

// 헤더/푸터 주입 완료(common:ready) 후 실행 (Web Components 전환 후 fallback 갱신)
if (document.querySelector("my-header .site-header") || window.__commonReady) {
  init();
} else {
  document.addEventListener("common:ready", init, { once: true });
}
