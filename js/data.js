/* ============================================================
   data.js  —  json-server API 접근 레이어 (시그니처 + TODO)
   (본 단계: 구현 X. 다음 단계에서 채운다.)

   규칙:
   - 데이터는 json-server(3000)로 서빙. db.json을 직접 fetch 하지 말 것.
   - base URL은 아래 API 상수로만 사용한다.
   ============================================================ */

// json-server 기본 주소 (Live Server 5500 / json-server 3000 동시 구동)
const API = "api";
/** 공통 fetch 헬퍼: 실패 시 에러를 throw(호출측에서 try/catch 처리) */
async function fetchJSON(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) {
    throw new Error(`API ${path} 요청 실패 (${res.status})`);
  }
  return res.json();
}

/**
 * 객실 목록 조회
 * GET /rooms
 * @returns {Promise<Array>} rooms
 */
export async function getRooms() {
  return fetchJSON("/rooms");
}

/**
 * 이벤트 목록 조회
 * GET /events
 * @returns {Promise<Array>} events
 */
export async function getEvents() {
  return fetchJSON("/events");
}

/**
 * 시즌 정보 조회
 * GET /season
 * @returns {Promise<Array>} season
 */
export async function getSeason() {
  return fetchJSON("/season");
}

/**
 * 휴일 정보 조회
 * GET /holiday
 * @returns {Promise<Array>} holiday
 */
export async function getHoliday() {
  return fetchJSON("/holiday");
}

/**
 * 가격 정보 조회
 * GET /price
 * @returns {Promise<Array>} price
 */
export async function getPrice() {
  return fetchJSON("/price");
}

/**
 * 예약 목록 조회
 * GET /reservation
 * @returns {Promise<Array>} reservation
 */
export async function getReservations() {
  return fetchJSON("/reservation");
}

/**
 * 예약 등록
 * POST /reservation (json-server가 db.json에 자동 반영)
 * @param {Object} reservation - 등록할 예약 데이터
 * @returns {Promise<Object>} 생성된 reservation
 */
export async function createReservation(reservation) {
  const res = await fetch(`${API}/reservation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reservation),
  });
  if (!res.ok) {
    throw new Error(`예약 등록 실패 (${res.status})`);
  }
  return res.json();
}

/* ============================================================
   가격 계산 헬퍼들 (getTotalPrice 전용)
   ============================================================ */

/** Date -> "YYYY-MM-DD" (로컬 날짜 기준. toISOString 절대 금지: UTC 변환으로 하루 밀림) */
export function toYMD(date) {
  return date.toLocaleDateString("sv-SE"); // sv-SE = "YYYY-MM-DD"
}

/** "YYYY-MM-DD" -> 새 Date(자정, 로컬) */
export function parseYMD(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** 한 날짜가 어느 시즌에 속하는지. season: {id, start_date, end_date}.
 *  비수기(id1)는 10.01 ~ (다음해) 06.30 처럼 연도를 넘는 구간일 수 있어
 *  월/일 기준으로 판별한다. */
function matchSeason(date, seasons) {
  const m = date.getMonth() + 1; // 1~12
  const d = date.getDate();
  for (const s of seasons) {
    const [, sm, sd] = s.start_date.split("-").map(Number);
    const [em, ed] = s.end_date.split("-").map(Number);
    // 월/일 (MM-DD) 정수 비교용
    const cur = m * 100 + d;
    const start = sm * 100 + sd;
    const end = em * 100 + ed;
    if (start <= end) {
      if (cur >= start && cur <= end) return s;
    } else {
      // 연도를 넘는 구간 (예: 10.01 ~ 06.30)
      if (cur >= start || cur <= end) return s;
    }
  }
  return null;
}

/** 해당 객실/시즌의 price 레코드 반환 */
function findPrice(prices, roomId, seasonId) {
  return prices.find(
    (p) =>
      Number(p.room_id) === Number(roomId) &&
      Number(p.season_id) === Number(seasonId),
  );
}

/**
 * 총 예약 요금 계산 (기준 인원 + 추가 인원 요금)
 *
 * 시안 요건: "기준 인원 2명, 추가 시 한 명당 객실 가격의 20%"
 *
 * 계산식:
 *   (숙박일 요금 합계) × (1 + 0.2 × extraGuests)
 *   - 숙박일 요금 합계 = 체크인 ~ 체크아웃 "전날" 까지 각 박의 요금 합
 *     (체크아웃 당일은 숙박일에서 제외. 6/19입실~6/20퇴실 = 1박)
 *   - 1박 요금 = 해당 날짜의 가격:
 *       · 공휴일(holiday) 우선  → holiday_price
 *       · 주말(토·일)           → weekend_price
 *       · 그 외 평일             → weekday_price
 *     (시즌별 price 레코드에서 위 3가지 단가 중 하나 선택)
 *
 * @param {number} roomId
 * @param {string} checkIn   - "YYYY-MM-DD"
 * @param {string} checkOut  - "YYYY-MM-DD"
 * @param {number} extraGuests=0
 * @returns {Promise<number>} 총 요금(원). 날짜 역전/동일(0박)이면 0.
 */
export async function getTotalPrice(
  roomId,
  checkIn,
  checkOut,
  extraGuests = 0,
) {
  const [seasons, holidays, prices] = await Promise.all([
    getSeason(),
    getHoliday(),
    getPrice(),
  ]);
  const holidaySet = new Set(holidays.map((h) => h.holiday_date));

  const start = parseYMD(checkIn);
  const end = parseYMD(checkOut);

  // 체크아웃 전날까지 순회 (체크아웃 당일 제외)
  let sum = 0;
  for (let cur = new Date(start); cur < end; cur.setDate(cur.getDate() + 1)) {
    const ymd = toYMD(cur);
    const season = matchSeason(cur, seasons);
    const price = findPrice(prices, roomId, season ? season.id : 1);
    if (!price) continue; // 해당 시즌 가격 정보 없으면 스킵(0)

    const dow = cur.getDay(); // 0=일, 6=토
    let unit;
    if (holidaySet.has(ymd)) {
      unit = price.holiday_price; // 공휴일 우선
    } else if (dow === 0 || dow === 6) {
      unit = price.weekend_price; // 토·일
    } else {
      unit = price.weekday_price; // 평일
    }
    sum += Number(unit) || 0;
  }

  // 추가 인원 요금 가산
  const factor = 1 + 0.2 * Math.max(0, extraGuests);
  return Math.round(sum * factor);
}
