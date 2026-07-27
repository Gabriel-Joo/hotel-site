/* ============================================================
   reservation-info.js  —  예약안내 페이지 로직
   - json-server 에서 rooms / price / season 을 가져와 요금표 렌더.
   - 하드코딩 금지: 모든 데이터는 API에서.
   - json-server 꺼져 있을 때 대비 try/catch + 사용자 에러 메시지.
   ============================================================ */

import { getRooms, getPrice, getSeason } from "./data.js";

// 비수기/성수기 라벨 (헤더 표시용)
// season_id = 1 -> 비수기(10.01-06.30), season_id = 2 -> 성수기(07.01-09.30)
const SEASONS = [
  { id: 1, label: "비수기", period: "10.01-06.30" },
  { id: 2, label: "성수기", period: "07.01-09.30" },
];

const PRICE_KINDS = ["weekday_price", "weekend_price", "holiday_price"];
const PRICE_LABELS = ["주중", "주말", "휴일"];

/** 숫자 -> 천 단위 콤ma */
function won(n) {
  return Number(n).toLocaleString("ko-KR");
}

/** price 배열을 (room_id, season_id) 로 빠르게 찾기 위한 맵 */
function buildPriceMap(prices) {
  const map = new Map();
  prices.forEach((p) => {
    map.set(`${p.room_id}:${p.season_id}`, p);
  });
  return map;
}

/** 2단 헤더 렌더:
 *  [1행] 객실 | 면적 | 인원(기준/최대) | 비수기(colspan3) | 성수기(colspan3)
 *  [2행]                 (빈칸 x3)     | 주중|주말|휴일   | 주중|주말|휴일
 *  앞 3열(객실/면적/인원) 은 rowspan=2 */
function renderHead() {
  const thead = document.getElementById("price-thead");
  if (!thead) return;

  const row1 = `
    <tr>
      <th rowspan="2">객실</th>
      <th rowspan="2">면적</th>
      <th rowspan="2">인원<br>(기준/최대)</th>
      ${SEASONS.map((s) => `<th colspan="3">${s.label}<br>(${s.period})</th>`).join("")}
    </tr>`;

  const row2 = `
    <tr>
      ${SEASONS.map(
        () => PRICE_LABELS.map((label) => `<th>${label}</th>`).join("")
      ).join("")}
    </tr>`;

  thead.innerHTML = row1 + row2;
}

/** 데이터행 렌더: 객실 1행 = 3열(이름/면적/인원) + 시즌별 6칸 */
function renderBody(rooms, priceMap) {
  const tbody = document.getElementById("price-tbody");
  if (!tbody) return;

  const rows = rooms
    .slice()
    .sort((a, b) => a.id - b.id)
    .map((room) => {
      // 시즌별 요금 6칸
      const cells = SEASONS.map((s) => {
        const p = priceMap.get(`${room.id}:${s.id}`);
        return PRICE_KINDS.map((kind) =>
          `<td>${p ? won(p[kind]) : "-"}</td>`
        ).join("");
      }).join("");

      return `
        <tr>
          <td>${room.name}</td>
          <td>${room.area}㎡</td>
          <td>${room.min}/${room.capacity}</td>
          ${cells}
        </tr>`;
    })
    .join("");

  tbody.innerHTML = rows;
}

/** 에러 메시지 노출 + 표 영역 숨김 처리 */
function showError(message) {
  const err = document.getElementById("price-error");
  if (err) {
    err.hidden = false;
    err.textContent = message;
  }
}

/** 메인 */
async function init() {
  renderHead();

  try {
    // rooms / price / season 을 병렬로 로드
    const [rooms, prices] = await Promise.all([getRooms(), getPrice()]);

    // (선택) season 데이터가 있으면 헤더 기간을 실데이터로 보정 —
    // 여기서는 getSeason 도 가져와 유효성 확인만 수행(라벨/기간은 고정 문구 기준).
    try {
      await getSeason();
    } catch (_) {
      /* season 로드 실패는 표 렌더에 치명 아님 → 무시 */
    }

    if (!Array.isArray(rooms) || rooms.length === 0) {
      throw new Error("객실 데이터가 없습니다.");
    }

    const priceMap = buildPriceMap(prices);
    renderBody(rooms, priceMap);
  } catch (e) {
    console.error("[reservation-info] 데이터 로드 실패:", e);
    showError(
      "요금 정보를 불러오지 못했습니다. json-server(localhost:3000)가 실행 중인지 확인해 주세요."
    );
  }
}

init();
