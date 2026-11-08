/**
 * GNFLHS 스마트 좌석배치도 - A4 가로(Landscape) 풀페이지 반응형 스케일링 & 정밀 타이포그래피 인쇄 엔진 (printEngine.js)
 * - A4 가로 용지(297×210mm) 내 인쇄 안전 영역(287×202mm)을 분단·줄·책상 수에 맞춰 상하좌우 꽉 차게 자동 계산
 * - 한 분단 내 인접 책상끼리는 단일 경계선으로 매끄럽게 결합하고, 빈자리도 짝꿍 책상과 기하학적으로 정합 유지
 * - 4글자 이상 긴 이름 축소 시에도 행 전체의 번호·이름 수평 기준선(Y축)이 1px 오차 없이 일직선 정렬
 */
import { SEATING_CONFIG } from './config.js';

const PX_PER_MM = 96 / 25.4; // 3.779527559 px/mm

const FORMAT_SELECTOR_MAP = {
  'name-num-bracket': '.dp-format-bracket',
  'num-name': '.dp-format-num-name',
  'top-num-bot-name': '.dp-format-top-num-bot-name',
  'top-name-bot-num': '.dp-format-top-name-bot-num'
};

function rememberStyle(list, el, props) {
  if (!el) return;
  const saved = {};
  for (const p of props) {
    saved[p] = el.style.getPropertyValue(p);
  }
  list.push({ el, saved });
}

export function executeSeatingPrint({
  selectedFormat = 'name-num-bracket',
  fitMode = 'font-size',
  withRoster = true,
  tab,
  rosterListContainer,
  onBeforePrintDialog
}) {
  const restoredStyles = [];

  // 1. 선택된 표기 양식 바인딩
  document.body.dataset.printFormat = selectedFormat;

  const hasRoster = Boolean(
    withRoster && tab && Array.isArray(tab.roster) && tab.roster.length > 0 && rosterListContainer
  );

  // 2. 명렬표 포함 여부 및 우측 초슬림 1열 균등 분할 행 계산 (다인원 학급/자습실까지 자동 대응)
  const rosterSidebar = document.getElementById('rosterSidebar');
  if (hasRoster) {
    document.body.classList.remove('print-hide-roster');
    const totalStudents = Math.max(1, tab.roster.length);
    rememberStyle(restoredStyles, rosterListContainer, [
      '--print-roster-rows',
      'grid-template-rows'
    ]);
    rosterListContainer.style.setProperty('--print-roster-rows', String(totalStudents));
    rosterListContainer.style.setProperty(
      'grid-template-rows',
      `repeat(${totalStudents}, minmax(0, 1fr))`,
      'important'
    );
    if (rosterSidebar) {
      rememberStyle(restoredStyles, rosterSidebar, ['width', 'min-width', 'max-width']);
      const rw = `${SEATING_CONFIG.printRosterWidthPx}px`;
      rosterSidebar.style.setProperty('width', rw, 'important');
      rosterSidebar.style.setProperty('min-width', rw, 'important');
      rosterSidebar.style.setProperty('max-width', rw, 'important');
    }

    // 36명 초과 대인원 시 명렬표 내부 폰트/뱃지 높이 자동 슬림화
    if (totalStudents > 36) {
      rosterListContainer.querySelectorAll('.student-no-box').forEach((box) => {
        rememberStyle(restoredStyles, box, ['height', 'font-size']);
        box.style.setProperty('height', '12px', 'important');
        box.style.setProperty('font-size', '8.5px', 'important');
      });
      rosterListContainer.querySelectorAll('.student-name-input').forEach((inp) => {
        rememberStyle(restoredStyles, inp, ['font-size']);
        inp.style.setProperty('font-size', '9.5px', 'important');
      });
    }
  } else {
    document.body.classList.add('print-hide-roster');
    if (rosterListContainer) {
      rosterListContainer.style.gridTemplateRows = '';
    }
  }

  // 3. A4 가로 인쇄 영역(287×202mm -> ~1084×763px) 기반 풀페이지 동적 책상/통로 치수 산출
  const pageWidthPx = Math.floor(SEATING_CONFIG.printPageWidthMm * PX_PER_MM);
  const pageHeightPx = Math.floor(SEATING_CONFIG.printPageHeightMm * PX_PER_MM);

  const workspaceGapPx = hasRoster ? 14 : 0;
  const rosterWidthPx = hasRoster ? SEATING_CONFIG.printRosterWidthPx : 0;
  const availCanvasW = pageWidthPx - rosterWidthPx - workspaceGapPx - 6;

  const podiumBlockH = 58; // 교탁 높이(44px) + 상단 여백(14px)
  const availZonesH = pageHeightPx - podiumBlockH - 4;

  const zones = tab?.zones || [];
  const numZones = Math.max(1, zones.length);
  const totalDeskSlots = Math.max(
    1,
    zones.reduce((sum, z) => sum + (z.maxDesks || SEATING_CONFIG.defaultMaxDesks), 0)
  );
  const maxRows = Math.max(
    1,
    ...zones.map((z) => (Array.isArray(z.rows) ? z.rows.length : 1))
  );

  // 분단 사이 세로 통로 폭 (최소 20px 보장, 분단 수에 맞춰 시각적으로 뚜렷한 통로 배분)
  const aisleGapPx =
    numZones > 1
      ? Math.max(
          SEATING_CONFIG.printMinAisleGapPx,
          Math.min(44, Math.round((availCanvasW * 0.095) / (numZones - 1)))
        )
      : 0;

  // 책상 1개 가로 폭: 가용 가로 영역을 빈틈없이 채우도록 산출
  const printDeskW = Math.max(
    72,
    Math.floor((availCanvasW - aisleGapPx * (numZones - 1)) / totalDeskSlots)
  );

  // 줄(행) 사이 가로 통로 간격 및 책상 1개 세로 높이 산출 (A4 상단부터 교탁 위까지 꽉 차게 확장)
  let rowGapPx =
    maxRows > 1
      ? Math.max(10, Math.min(22, Math.round((availZonesH * 0.085) / (maxRows - 1))))
      : 0;

  const rawDeskH = Math.floor((availZonesH - rowGapPx * (maxRows - 1)) / maxRows);
  const printDeskH = Math.max(52, Math.min(rawDeskH, Math.round(printDeskW * 1.32)));

  if (maxRows > 1 && printDeskH < rawDeskH) {
    const leftoverH = availZonesH - printDeskH * maxRows;
    rowGapPx = Math.min(38, Math.floor(leftoverH / (maxRows - 1)));
  }

  const totalGridH = printDeskH * maxRows + rowGapPx * Math.max(0, maxRows - 1);

  const zonesContainer = document.getElementById('zonesContainer');
  if (zonesContainer) {
    rememberStyle(restoredStyles, zonesContainer, ['gap']);
    zonesContainer.style.setProperty('gap', `${aisleGapPx}px`, 'important');
  }

  // 각 분단·줄·책상의 인쇄용 치수 및 인접 책상 테두리 일체화 적용
  const span = SEATING_CONFIG.minDeskSlotSpan;
  const zoneColumns = document.querySelectorAll('#zonesContainer .zone-column');

  zones.forEach((zone, zIdx) => {
    const zoneEl = zoneColumns[zIdx];
    if (!zoneEl) return;
    const zMaxDesks = zone.maxDesks || SEATING_CONFIG.defaultMaxDesks;
    const printTrackW = zMaxDesks * printDeskW;

    rememberStyle(restoredStyles, zoneEl, ['width', 'min-width', 'height', 'gap', 'justify-content']);
    zoneEl.style.setProperty('width', `${printTrackW}px`, 'important');
    zoneEl.style.setProperty('min-width', `${printTrackW}px`, 'important');
    zoneEl.style.setProperty('height', `${totalGridH}px`, 'important');
    zoneEl.style.setProperty('gap', `${rowGapPx}px`, 'important');
    zoneEl.style.setProperty('justify-content', 'flex-end', 'important');

    const rowEls = zoneEl.querySelectorAll('.zone-row');
    (zone.rows || []).forEach((row, rIdx) => {
      const rowEl = rowEls[rIdx];
      if (!rowEl) return;

      rememberStyle(restoredStyles, rowEl, ['height', 'min-height', 'margin-bottom', 'padding']);
      rowEl.style.setProperty('height', `${printDeskH}px`, 'important');
      rowEl.style.setProperty('min-height', `${printDeskH}px`, 'important');
      rowEl.style.setProperty('margin-bottom', '0px', 'important');
      rowEl.style.setProperty('padding', '0px', 'important');

      const trackEl = rowEl.querySelector('.desks-track');
      if (trackEl) {
        rememberStyle(restoredStyles, trackEl, ['width', 'height']);
        trackEl.style.setProperty('width', `${printTrackW}px`, 'important');
        trackEl.style.setProperty('height', `${printDeskH}px`, 'important');
      }

      const desks = row.desks || [];
      desks.forEach((desk) => {
        const cardEl = rowEl.querySelector(`.desk-card[data-desk-id="${desk.id}"]`);
        if (!cardEl) return;

        const isAssigned = Boolean(desk.studentName && desk.studentName.trim());
        const pos = desk.pos || 0;
        const leftPx = Math.round(pos * printDeskW);

        const leftNeighbor = desks.find(
          (other) => other.id !== desk.id && Math.abs((other.pos || 0) + span - pos) < 0.05
        );
        const rightNeighbor = desks.find(
          (other) => other.id !== desk.id && Math.abs(pos + span - (other.pos || 0)) < 0.05
        );
        const leftNeighborAssigned = Boolean(
          leftNeighbor && leftNeighbor.studentName && leftNeighbor.studentName.trim()
        );
        const rightNeighborAssigned = Boolean(
          rightNeighbor && rightNeighbor.studentName && rightNeighbor.studentName.trim()
        );

        rememberStyle(restoredStyles, cardEl, [
          'left',
          'width',
          'height',
          'border-top-left-radius',
          'border-bottom-left-radius',
          'border-top-right-radius',
          'border-bottom-right-radius',
          'border-left-width',
          'border-right-width'
        ]);

        cardEl.style.setProperty('left', `${leftPx}px`, 'important');
        cardEl.style.setProperty('width', `${printDeskW}px`, 'important');
        cardEl.style.setProperty('height', `${printDeskH}px`, 'important');

        cardEl.style.setProperty(
          'border-top-left-radius',
          leftNeighbor ? '0px' : '8px',
          'important'
        );
        cardEl.style.setProperty(
          'border-bottom-left-radius',
          leftNeighbor ? '0px' : '8px',
          'important'
        );
        cardEl.style.setProperty(
          'border-top-right-radius',
          rightNeighbor ? '0px' : '8px',
          'important'
        );
        cardEl.style.setProperty(
          'border-bottom-right-radius',
          rightNeighbor ? '0px' : '8px',
          'important'
        );

        if (isAssigned) {
          cardEl.style.setProperty(
            'border-left-width',
            leftNeighborAssigned ? '1px' : '2px',
            'important'
          );
          cardEl.style.setProperty(
            'border-right-width',
            rightNeighborAssigned ? '1px' : '2px',
            'important'
          );
        } else {
          if (leftNeighborAssigned) {
            cardEl.style.setProperty('border-left-width', '0px', 'important');
          }
          if (rightNeighborAssigned) {
            cardEl.style.setProperty('border-right-width', '0px', 'important');
          }
        }
      });
    });
  });

  // 4. 커진 책상 크기에 비례한 초대형 학생 이름 타이포그래피 & 수평 기준선 정밀 정렬
  const activeSelector = FORMAT_SELECTOR_MAP[selectedFormat] || '.dp-format-bracket';
  const isTwoLine = selectedFormat.startsWith('top-');

  const idealNameSize = isTwoLine
    ? Math.min(
        SEATING_CONFIG.printTwoLineFontPx,
        Math.round(Math.min(printDeskW * 0.295, printDeskH * 0.36))
      )
    : Math.min(
        SEATING_CONFIG.printOneLineFontPx,
        Math.round(Math.min(printDeskW * 0.25, printDeskH * 0.34))
      );

  const baseNameFontPx = Math.max(18, idealNameSize);
  const fixedNameBoxHeightPx = Math.round(baseNameFontPx * 1.14);
  // 두 줄 표기 시 번호 크기는 이름의 정확히 절반(50%) 크기로 전 좌석 통일
  const baseSubFontPx = isTwoLine
    ? Math.max(10, Math.round(baseNameFontPx * 0.5))
    : Math.max(12, Math.round(baseNameFontPx * 0.54));

  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  const fontStack = '-apple-system, BlinkMacSystemFont, "Pretendard", "Malgun Gothic", sans-serif';

  const cardInnerPadPx = 14;
  const innerCardWidth = Math.max(50, printDeskW - cardInnerPadPx);

  document.querySelectorAll('.desk-card.assigned').forEach((card) => {
    const item = card.querySelector(activeSelector);
    if (!item) return;
    const nameEl = item.querySelector('.dp-main');
    const subEl = item.querySelector('.dp-sub');
    if (!nameEl) return;

    const studentName = nameEl.textContent.trim();
    if (!studentName) return;

    rememberStyle(restoredStyles, nameEl, [
      'font-size',
      'height',
      'transform',
      'transform-origin',
      'display',
      'align-items',
      'justify-content',
      'margin-left',
      'margin-right'
    ]);
    if (subEl) {
      rememberStyle(restoredStyles, subEl, ['font-size']);
      subEl.style.setProperty('font-size', `${baseSubFontPx}px`, 'important');
    }

    // 두 줄 포맷에서 긴 이름(4글자 등)의 폰트가 축소되어도 옆 좌석과 번호/이름 Y축이 일직선으로 맞도록 고정 높이 박스 부여
    if (isTwoLine) {
      nameEl.style.setProperty('height', `${fixedNameBoxHeightPx}px`, 'important');
      nameEl.style.setProperty('display', 'inline-flex', 'important');
      nameEl.style.setProperty('align-items', 'center', 'important');
      nameEl.style.setProperty('justify-content', 'center', 'important');
    }

    let maxAllowedNameWidth = innerCardWidth;
    if (!isTwoLine && subEl) {
      const subText = subEl.textContent.trim();
      if (subText) {
        if (measureCtx) {
          measureCtx.font = `700 ${baseSubFontPx}px ${fontStack}`;
        }
        const measuredSubW = measureCtx
          ? measureCtx.measureText(subText).width
          : subText.length * baseSubFontPx * 0.65;
        maxAllowedNameWidth = Math.max(38, innerCardWidth - Math.ceil(measuredSubW) - 8);
      }
    }

    if (measureCtx) {
      measureCtx.font = `900 ${baseNameFontPx}px ${fontStack}`;
    }
    const textWidth = measureCtx
      ? measureCtx.measureText(studentName).width
      : studentName.length * baseNameFontPx * 0.92;

    if (textWidth > maxAllowedNameWidth && textWidth > 0) {
      const ratio = maxAllowedNameWidth / textWidth;
      if (fitMode === 'font-size') {
        const scaledNamePx = Math.max(
          SEATING_CONFIG.printMinFontPx,
          Math.floor(baseNameFontPx * ratio)
        );
        nameEl.style.setProperty('font-size', `${scaledNamePx}px`, 'important');
      } else {
        nameEl.style.setProperty('font-size', `${baseNameFontPx}px`, 'important');
        nameEl.style.setProperty('transform', `scaleX(${ratio.toFixed(3)})`, 'important');
        nameEl.style.setProperty('transform-origin', 'center center', 'important');
        if (!isTwoLine) {
          nameEl.style.setProperty('display', 'inline-block', 'important');
        }
        const trimSidePx = ((textWidth - maxAllowedNameWidth) / 2).toFixed(1);
        nameEl.style.setProperty('margin-left', `-${trimSidePx}px`, 'important');
        nameEl.style.setProperty('margin-right', `-${trimSidePx}px`, 'important');
      }
    } else {
      nameEl.style.setProperty('font-size', `${baseNameFontPx}px`, 'important');
    }
  });

  if (typeof onBeforePrintDialog === 'function') {
    onBeforePrintDialog();
  }

  // 5. 인쇄 종료 후 화면용 인라인 스타일 100% 원상 복구
  const handleAfterPrint = () => {
    for (let i = restoredStyles.length - 1; i >= 0; i--) {
      const { el, saved } = restoredStyles[i];
      for (const [prop, val] of Object.entries(saved)) {
        if (val) {
          el.style.setProperty(prop, val);
        } else {
          el.style.removeProperty(prop);
        }
      }
    }
    window.removeEventListener('afterprint', handleAfterPrint);
  };
  window.addEventListener('afterprint', handleAfterPrint);

  // 6. 브라우저 인쇄 다이얼로그 호출
  window.print();
}
