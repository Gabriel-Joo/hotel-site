/* ============================================================
   reservation-form.js  —  예약등록 페이지 로직 (실제 db.json 저장 ★핵심)
   - URL ?room=&checkIn=&checkOut=&extra= 파싱 (없으면 select 페이지로)
   - 읽기전용 달력(calendar.js) 렌더
   - 예약명/전화번호 유효성 검사
   - 이중 예약 방지(POST 직전 재조회) → createReservation 저장
   - 성공/실패/중복 모달
   - 헤더/푸터 주입 완료(common:ready) 후 동작.
   ============================================================ */

import {
  getRooms,
  getReservations,
  getHoliday,
  getTotalPrice,
  createReservation,
  toYMD,
  parseYMD,
} from "./data.js";
import { createCalendar } from "./calendar.js";

/* ---------- 상태 ---------- */
const state = {
  room: null,
  bookedSet: new Set(),
  holidayMap: new Map(),
  checkIn: null,
  checkOut: null,
  extra: 0,
  total: 0,
  // 달력 표시 월 = 입실일이 속한 달 (확인용)
  viewYear: 0,
  viewMonth: 0,
};

const today = new Date();
today.setHours(0, 0, 0, 0);

/* ---------- 유틸 ---------- */
function $(id) {
  return document.getElementById(id);
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/* ---------- 진입: 파라미터 파싱 + 검증 ---------- */
function parseParams() {
  const p = new URLSearchParams(location.search);
  const room = Number(p.get("room"));
  const checkIn = p.get("checkIn");
  const checkOut = p.get("checkOut");
  const extra = Number(p.get("extra")) || 0;

  // 날짜 형식 검증 (YYYY-MM-DD)
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (
    !Number.isInteger(room) ||
    room < 1 ||
    !dateRe.test(checkIn) ||
    !dateRe.test(checkOut) ||
    isNaN(parseYMD(checkIn)) ||
    isNaN(parseYMD(checkOut))
  ) {
    return null;
  }
  // 체크아웃이 입실 이후여야
  if (!(parseYMD(checkOut) > parseYMD(checkIn))) return null;

  return { room, checkIn, checkOut, extra };
}

/* ---------- 예약완료 집합 (체크아웃 당일 제외) ---------- */
function buildBookedSet(reservations, roomId) {
  const set = new Set();
  reservations
    .filter((r) => Number(r.room_id) === Number(roomId))
    .forEach((r) => {
      const start = parseYMD(r.check_in_date);
      const end = parseYMD(r.check_out_date);
      for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        set.add(toYMD(d));
      }
    });
  return set;
}

/* ---------- 폼 필드 채우기 ---------- */
function fillReadonlyFields() {
  // ROOM: room.name_eng 대문자
  $("f-room").value = String(state.room.name_eng).toUpperCase();
  // 추가인원: URL의 extra
  $("f-extra").value = String(state.extra);
  $("f-checkin").value = state.checkIn;
  $("f-checkout").value = state.checkOut;
}

/* ---------- 총 합계 (URL 금액 신뢰 금지 → 재계산) ---------- */
async function updateTotal() {
  try {
    const total = await getTotalPrice(
      state.room.id,
      state.checkIn,
      state.checkOut,
      state.extra,
    );
    state.total = total;
    $("total-amount").textContent = total.toLocaleString("ko-KR");
  } catch (e) {
    console.error("[reservation-form] 요금 계산 실패:", e);
    state.total = 0;
    $("total-amount").textContent = "0";
  }
}

/* ---------- 읽기전용 달력 ----------
   실시간예약 달력과 동일한 마크업/스타일을 그대로 사용하되 readOnly 로 렌더.
   - 날짜 셀: calendar.js 가 readOnly 면 클릭 핸들러를 바인딩하지 않는다.
   - 화살표(prev/next): 시각적으로 그대로 두되 readOnly 면 disabled(회색 꺾쇠,
     pointer-events:none) 처리. DOM 은 그대로, 동작만 죽인다. */
function initCalendar() {
  createCalendar({
    elements: {
      title: $("cal-title"),
      prev: $("cal-prev"),
      next: $("cal-next"),
      grid: $("cal-grid"),
    },
    state, // bookedSet, holidayMap, checkIn, checkOut, viewYear, viewMonth
    readOnly: true,
    today,
  }).render();
}

/* ---------- 유효성 검사 ---------- */
function validateName() {
  const input = $("f-name");
  const err = $("f-name-error");
  const val = input.value.trim();
  if (!val) {
    input.classList.add("is-invalid");
    err.hidden = false;
    return false;
  }
  input.classList.remove("is-invalid");
  err.hidden = true;
  return true;
}

function validatePhone() {
  const input = $("f-phone");
  const err = $("f-phone-error");
  const val = input.value.trim();
  if (!val) {
    input.classList.add("is-invalid");
    err.hidden = false;
    return false;
  }
  input.classList.remove("is-invalid");
  err.hidden = true;
  return true;
}

function bindInputs() {
  const name = $("f-name");
  const phone = $("f-phone");

  // 예약명: blur 시 검증
  name.addEventListener("blur", validateName);
  name.addEventListener("input", () => {
    if (name.classList.contains("is-invalid")) validateName();
  });

  // 전화번호: 숫자만, 하이픈 자동 제거, blur 시 검증
  phone.addEventListener("input", () => {
    // 하이픈 등 숫자 아닌 문자 제거
    phone.value = phone.value.replace(/[^0-9]/g, "");
    if (phone.classList.contains("is-invalid")) validatePhone();
  });
  phone.addEventListener("blur", validatePhone);

  // Enter 키 차단 (★핵심): 본 페이지엔 <form> 이 없지만, 텍스트 입력 필드에서
  // Enter 를 누르면 브라우저가 암시적 폼 제출로 해석해 페이지를 리로드한다.
  // → 리로드 시 모달 상태가 날아가 "모달이 순식간에 사라지는" 버그의 원인.
  //   기본동작을 막고, 대신 예약하기 버튼 클릭으로 제출을 라우팅한다.
  [name, phone].forEach((el) => {
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        $("btn-submit").click();
      }
    });
  });
}

/* ---------- 모달 ----------
   모달을 띄운 뒤 사용자 액션([확인] 클릭)을 반드시 기다린다.
   자동 닫힘/자동 이동 금지. onOk 는 [확인] 클릭 시에만 실행. */
function showAlert(message, onOk) {
  const modal = $("alert-modal");
  $("alert-text").textContent = message;

  // [확인] 핸들러를 단일로 보장(onclick 프로퍼티 = 이전 핸들러 자동 교체, 누적 방지)
  const ok = $("alert-ok");
  ok.onclick = () => {
    modal.hidden = true; // 모달 닫기
    ok.onclick = null; // 핸들러 해제
    if (onOk) onOk(); // 콜백(페이지 이동 등)은 닫힌 뒤 실행
  };

  // 모달 표시 — 이 시점 이후 자동으로 일어나는 동작은 없다.
  modal.hidden = false;
}

/* ---------- 다음 예약 id 계산 ----------
   기존 reservation id(숫자 문자열 "1"~"24") 중 최댓값 + 1 을 문자열로 반환.
   비숫자 id(nanoid 등)는 무시. 예약이 하나도 없으면 "1". */
function computeNextId(reservations) {
  let max = 0;
  reservations.forEach((r) => {
    const n = Number(r.id);
    if (Number.isInteger(n) && n > max) max = n;
  });
  return String(max + 1);
}

/* ---------- 이중 예약 방지: POST 직전 재조회 ---------- */
function hasConflict(reservations, roomId, checkIn, checkOut) {
  // checkIn ~ checkOut "전날" 범위에 이미 예약이 있는지
  const want = buildBookedSet(reservations, roomId);
  const cIn = parseYMD(checkIn);
  const cOut = parseYMD(checkOut);
  for (let d = new Date(cIn); d < cOut; d.setDate(d.getDate() + 1)) {
    if (want.has(toYMD(d))) return true;
  }
  return false;
}

/* ---------- 예약 저장 ----------
   event 인수는 방어용: 혹시라도 (button type=submit 이나 암시적 제출로 인해)
   기본동작/이벤트 전파가 일어나면 preventDefault 로 리로드를 막는다.
   본 페이지는 type=button + <form> 없음이지만 이중 안전망. */
async function submitReservation(event) {
  if (event && typeof event.preventDefault === "function")
    event.preventDefault();

  // 1) 유효성 검사 (제출 시점)
  const okName = validateName();
  const okPhone = validatePhone();
  if (!okName || !okPhone) return;

  // 2) 이중 예약 방지: 직전 재조회
  let reservations;
  try {
    reservations = await getReservations();
  } catch (e) {
    console.error("[reservation-form] 예약 조회 실패:", e);
    showAlert("예약에 실패했습니다. 다시 시도해 주세요.");
    return;
  }

  if (hasConflict(reservations, state.room.id, state.checkIn, state.checkOut)) {
    showAlert("이미 예약된 날짜입니다.", () => {
      location.href = `./reservation.html?room=${state.room.id}`;
    });
    return;
  }

  // 3) POST — payload 에 id 를 명시적으로 계산해 넣는다.
  //    ※ 주의(json-server 1.x 한계): service.create() 는
  //       `{ ...data, id: randomId() }` 로 클라이언트 id 를 항상 덮어쓴다.
  //       따라서 아래 id 필드는 실제로는 무시되고 nanoid 가 할당된다.
  //       (소스 node_modules/json-server/lib/service.js 참고)
  //    본 과제에서는 위 한계를 인지한 채 요청대로 id 를 포함해 전송한다.
  //    저장 후 서버가 부여한 id(createReservation 반환값)는 무시해도 무방하다.
  const nextId = computeNextId(reservations);

  const payload = {
    id: nextId,
    room_id: Number(state.room.id),
    check_in_date: state.checkIn,
    check_out_date: state.checkOut,
    total_price: state.total,
    number_of_guests: Number(state.room.min) + Number(state.extra),
    customer_name: $("f-name").value.trim(),
    phone_number: $("f-phone").value.trim(),
  };

  try {
    await createReservation(payload);
    showAlert("예약이 완료되었습니다.", () => {
      location.href = "./index.html";
    });
  } catch (e) {
    console.error("[reservation-form] 예약 저장 실패:", e);
    showAlert("예약에 실패했습니다. 다시 시도해 주세요.");
  }
}

/* ---------- 버튼 ---------- */
function bindButtons() {
  // 취소 → 이전 페이지(reservation.html)
  $("btn-cancel").addEventListener("click", () => {
    location.href = `./reservation.html?room=${state.room.id}`;
  });
  // 예약하기 → 저장 (click 이벤트 객체를 submitReservation 에 그대로 전달 →
  // 내부에서 preventDefault 로 만약의 기본동작/리로드를 차단)
  $("btn-submit").addEventListener("click", submitReservation);
}

/* ---------- 메인 ---------- */
async function init() {
  const params = parseParams();
  if (!params) {
    location.replace("./reservation-select.html");
    return;
  }

  try {
    const [rooms, reservations, holidays] = await Promise.all([
      getRooms(),
      getReservations(),
      getHoliday(),
    ]);
    const room = rooms.find((r) => Number(r.id) === params.room);
    if (!room) {
      location.replace("./reservation-select.html");
      return;
    }

    state.room = room;
    state.checkIn = params.checkIn;
    state.checkOut = params.checkOut;
    state.extra = params.extra;
    state.bookedSet = buildBookedSet(reservations, room.id);
    state.holidayMap = new Map(
      holidays.map((h) => [h.holiday_date, h.holiday_name]),
    );

    // 달력 표시 월 = 입실일이 속한 달
    const cIn = parseYMD(params.checkIn);
    state.viewYear = cIn.getFullYear();
    state.viewMonth = cIn.getMonth();

    fillReadonlyFields();
    updateTotal();
    initCalendar();
    bindInputs();
    bindButtons();
  } catch (e) {
    console.error("[reservation-form] 초기화 실패:", e);
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
