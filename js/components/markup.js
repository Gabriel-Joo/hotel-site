/* ============================================================
   components/markup.js  —  컴포넌트 마크업 상수 모음
   (fetch 주입 방식 제거 → Web Components에서 정적으로 보관)

   기존 components/{header,footer,to-top}.html 조각과 동일한 마크업.
   ※ 시안 그대로. 푸터 문구는 제출 요건상 고정 — 한 글자도 수정 금지.
   ============================================================ */

export const HEADER_HTML = `
<header class="site-header">
  <div class="site-header__inner">
    <!-- 로고: "H" 한 글자, 상단 중앙 -->
    <a href="./index.html" class="site-logo">H</a>

    <!-- gnb: 메뉴는 로고 아래 줄, 중앙 가로 배치 -->
    <nav class="gnb">
      <!-- 1depth 메뉴 줄: 모바일에서도 항상 가로 한 줄(절대 줄바꿈 X) -->
      <ul class="gnb__list">
        <!-- ABOUT -->
        <li class="gnb__item">
          <a href="./about.html" class="gnb__link">ABOUT</a>
          <button type="button" class="gnb__toggle sr-only" aria-expanded="false">열기</button>
          <ul class="gnb__sub">
            <li><a href="./about.html" class="gnb__sub-link">호텔 소개</a></li>
            <li><a href="./about.html#location" class="gnb__sub-link">오시는길</a></li>
          </ul>
        </li>

        <!-- ROOMS (db.json rooms id 1~4 와 일치) -->
        <li class="gnb__item">
          <a href="./rooms.html" class="gnb__link">ROOMS</a>
          <button type="button" class="gnb__toggle sr-only" aria-expanded="false">열기</button>
          <ul class="gnb__sub">
            <li><a href="./rooms.html?room=1" class="gnb__sub-link">스탠다드</a></li>
            <li><a href="./rooms.html?room=2" class="gnb__sub-link">디럭스</a></li>
            <li><a href="./rooms.html?room=3" class="gnb__sub-link">프리미엄</a></li>
            <li><a href="./rooms.html?room=4" class="gnb__sub-link">스위트</a></li>
          </ul>
        </li>

        <!-- RESERVATION -->
        <li class="gnb__item">
          <a href="./reservation.html" class="gnb__link">RESERVATION</a>
          <button type="button" class="gnb__toggle sr-only" aria-expanded="false">열기</button>
          <ul class="gnb__sub">
            <li><a href="./reservation-info.html" class="gnb__sub-link">예약안내</a></li>
            <li><a href="./reservation-select.html" class="gnb__sub-link">실시간예약</a></li>
          </ul>
        </li>

        <!-- COMMUNITY -->
        <li class="gnb__item">
          <a href="./community.html" class="gnb__link">COMMUNITY</a>
          <button type="button" class="gnb__toggle sr-only" aria-expanded="false">열기</button>
          <ul class="gnb__sub">
            <li><a href="./community.html" class="gnb__sub-link">공지사항</a></li>
            <li><a href="./community.html" class="gnb__sub-link">이벤트</a></li>
            <li><a href="./community.html" class="gnb__sub-link">FAQ</a></li>
          </ul>
        </li>
      </ul>

      <!-- 서브메뉴 행(모바일 전용). 메뉴 줄과 별개의 아래 전체 폭 행.
           JS가 활성 서브(.gnb__sub)를 이곳으로 옮겨 렌더. 기본은 빈 행(숨김). -->
      <div class="gnb__sub-row" hidden></div>
    </nav>
  </div>
</header>
`;

export const FOOTER_HTML = `
<footer class="site-footer">
  <div class="site-footer__inner">
    <!-- 1. 로고 "H" (흰색, 크게) -->
    <p class="site-footer__logo">H</p>

    <!-- 2. SNS 아이콘 3개 (Font Awesome) — 간격 15px -->
    <ul class="site-footer__sns">
      <li>
        <a href="#"><i class="fa-brands fa-instagram" aria-label="instagram"></i></a>
      </li>
      <li>
        <a href="#"><i class="fa-brands fa-facebook-f" aria-label="facebook"></i></a>
      </li>
      <li>
        <a href="#"><i class="fa-brands fa-youtube" aria-label="youtube"></i></a>
      </li>
    </ul>

    <!-- 3. 주소 -->
    <p class="site-footer__text">경기 성남시 분당구 황새울로329번길 5 한국폴리텍대학 융합기술교육원</p>

    <!-- 4. 사업자정보 -->
    <p class="site-footer__text">사업자등록번호 000-00-0000&nbsp;&nbsp;&nbsp;&nbsp;전화 012-345-6789&nbsp;&nbsp;&nbsp;&nbsp;팩스 01-234-5678</p>

    <!-- 5. 약관/개인정보 (링크) -->
    <p class="site-footer__links">
      <a href="#" class="site-footer__link">이용약관</a>
      <a href="#" class="site-footer__link">개인정보처리방침</a>
    </p>

    <!-- 6. 카피라이트 -->
    <p class="site-footer__text">Copyright ⓒ 2025 예약연습 All rights reserved.</p>
  </div>
</footer>
`;

export const TO_TOP_HTML = `
<button type="button" class="to-the-top" aria-label="맨 위로 이동">
  <i class="fa-solid fa-angles-up" aria-hidden="true"></i>
</button>
`;
