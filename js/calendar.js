/* ============================================================
   calendar.js  —  예약 달력 공용 렌더 모듈
   reservation.html(선택 가능) / reservation-form.html(읽기 전용) 공유.

   사용 예)
     import { createCalendar } from "./calendar.js";
     const cal = createCalendar({
       elements: { title, prev, next, grid },  // 각각 DOM 요소
       state: { bookedSet, holidayMap, checkIn, checkOut, viewYear, viewMonth },
       readOnly: false,                         // true 면 클릭·이전달이동 비활성
       today: new Date(),
       onCellClick: (ymd) => { ... },           // readOnly=false 일 때만
     });
     cal.render();            // 현재 viewYear/Month 로 렌더
     cal.setView(year, month); // 표시 월 변경 후 렌더
   ============================================================ */

import { toYMD, parseYMD } from "./data.js";

/* ---------- 유틸 ---------- */
function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/* ---------- 단일 셀 HTML 생성 ---------- */
// isLastRow: 날짜 그리드 6행 중 마지막(6번째) 행의 셀이면 true.
//   → .cal__cell--last 클래스 부여(CSS에서 이 행 셀에만 하단 회색 선).
function buildCellHTML(d, st, today, readOnly, isLastRow) {
  const ymd = toYMD(d);
  const inMonth = d.getMonth() === st.viewMonth;
  const isPast = d < today && !isSameDay(d, today); // 오늘 이전 (오늘은 선택 가능)
  const isBooked = st.bookedSet.has(ymd);
  const isSun = d.getDay() === 0;
  const holidayName = (st.holidayMap && st.holidayMap.get(ymd)) || "";
  const isHoliday = Boolean(holidayName);

  // 선택 상태 계산
  const { checkIn, checkOut } = st;
  let stateClass = "";
  let label = "";
  if (checkIn && checkOut) {
    const cIn = parseYMD(checkIn);
    const cOut = parseYMD(checkOut);
    if (isSameDay(d, cIn)) {
      stateClass = "cal__cell--selected";
      label = '<span class="cal__cell-label">입실</span>';
    } else if (isSameDay(d, cOut)) {
      stateClass = "cal__cell--selected";
      label = '<span class="cal__cell-label">퇴실</span>';
    } else if (d > cIn && d < cOut) {
      stateClass = "cal__cell--range";
    }
  } else if (checkIn) {
    if (isSameDay(d, parseYMD(checkIn))) {
      stateClass = "cal__cell--selected";
      label = '<span class="cal__cell-label">입실</span>';
    }
  }

  // 비활성(선택 불가) = 오늘 이전(과거)·예약완료·읽기전용.
  // 다음 달 날짜(inMonth=false)라도 오늘 이후면 선택 가능하다(회색 흐림 아님).
  const disabled = isPast || isBooked || readOnly;
  const classes = ["cal__cell"];
  if (!inMonth) classes.push("cal__cell--other");
  if (isPast) classes.push("cal__cell--past");
  if (isBooked) classes.push("cal__cell--booked");
  if ((isSun || isHoliday) && !stateClass) classes.push("cal__cell--sun");
  if (stateClass) classes.push(stateClass);
  if (readOnly) classes.push("cal__cell--readonly");
  if (isLastRow) classes.push("cal__cell--last");

  // 라벨 우선순위: 예약완료 > 입실/퇴실 > 공휴일 이름
  if (isBooked) {
    label = '<span class="cal__cell-label">예약완료</span>';
  } else if (!label && holidayName) {
    label = `<span class="cal__cell-label cal__cell-label--holiday">${esc(
      holidayName
    )}</span>`;
  }

  return `<div class="${classes.join(" ")}" data-date="${ymd}" data-disabled="${disabled}">
    <span class="cal__cell-num">${d.getDate()}</span>${label}
  </div>`;
}

/* ---------- 달력 팩토리 ---------- */
export function createCalendar({ elements, state, readOnly = false, today, onCellClick }) {
  const t = today || (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  function render() {
    const y = state.viewYear;
    const m = state.viewMonth;
    elements.title.textContent = `${y}년 ${String(m + 1).padStart(2, "0")}월`;

    // ‹ 버튼: 오늘이 속한 달보다 이전으로는 이동 불가 (읽기전용이면 네비 없이 동작 안 함)
    const prevDisabled =
      readOnly ||
      state.viewYear < t.getFullYear() ||
      (state.viewYear === t.getFullYear() && state.viewMonth <= t.getMonth());
    if (elements.prev) elements.prev.disabled = prevDisabled;

    // › 버튼: 읽기전용이면 이동 불가(비활성). 편집 모드는 항상 활성.
    //   (next 클릭 자체는 각 페이지에서 바인딩한다. 여기선 비활성 여부만 결정.)
    if (elements.next) elements.next.disabled = readOnly;

    const first = new Date(y, m, 1);
    const startOffset = first.getDay(); // 0=일
    const gridStart = new Date(y, m, 1 - startOffset);

    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      cells.push(d);
    }

    const grid = elements.grid;
    // 42셀 = 7열×6행. 마지막(6번째) 행 = 인덱스 35~41. 행 단위로 isLastRow 전달.
    grid.innerHTML = cells
      .map((d, i) => buildCellHTML(d, state, t, readOnly, i >= 35))
      .join("");

    // 클릭 바인딩 (읽기전용이면 무시)
    if (!readOnly) {
      grid.querySelectorAll(".cal__cell").forEach((cell) => {
        if (cell.dataset.disabled === "true") return;
        cell.addEventListener("click", () => onCellClick && onCellClick(cell.dataset.date));
      });
    }
  }

  function setView(year, month) {
    state.viewYear = year;
    state.viewMonth = month;
    render();
  }

  return { render, setView };
}
