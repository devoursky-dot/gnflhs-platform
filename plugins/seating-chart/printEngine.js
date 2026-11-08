/**
 * GNFLHS 스마트 좌석배치도 - A4 가로(Landscape) 교실 평면도 적응형 인쇄 엔진 (printEngine.js)
 * - 실제 교실 책상 상판의 가로형 비례(가로:세로 ≈ 1.55:1 ~ 1.75:1)와 의자 등받이·전면 몰딩·교탁·칠판 구조를 재현
 * - 학생이 한 명도 없는 빈 분단(예: 4·5분단) 및 빈 줄/공석을 상황별로 자동 감지·정리하여 실제 배정 좌석을 큼직하고 균형 있게 조판
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

function isDeskAssigned(desk) {
  return Boolean(desk && typeof desk.studentName === 'string' && desk.studentName.trim().length > 0);
}

export function executeSeatingPrint({
  selectedFormat = 'name-num-bracket',
  fitMode = 'font-size',
  withRoster = true,
  autoTrimEmpty = SEATING_CONFIG.printAutoTrimEmpty,
  tab,
  rosterListContainer,
  onBeforePrintDialog
}) {
  const restoredStyles = [];
  const restoredText = [];

  // 1. 선택된 표기 양식 바인딩
  document.body.dataset.printFormat = selectedFormat;

  const zones = Array.isArray(tab?.zones) ? tab.zones : [];
  let totalAssignedInClass = 0;
  zones.forEach((z) => {
    (z.rows || []).forEach((r) => {
      (r.desks || []).forEach((d) => {
        if (isDeskAssigned(d)) totalAssignedInClass += 1;
      });
    });
  });

  // 상단 교실 배너 정보 동기화
  const printClassTitle = document.getElementById('printClassTitle');
  const printTabSubtitle = document.getElementById('printTabSubtitle');
  const printSeatSummary = document.getElementById('printSeatSummary');
  const rawClassName = (tab?.className || SEATING_CONFIG.defaultClassName).replace(/\s*교탁\s*$/, '').trim();
  if (printClassTitle) {
    printClassTitle.textContent = `${rawClassName || SEATING_CONFIG.defaultClassName} 좌석배치도`;
  }
  if (printTabSubtitle) {
    const tabTitle = (tab?.title || tab?.name || '일반배치').trim();
    printTabSubtitle.textContent = tabTitle;
  }
  if (printSeatSummary) {
    const rosterLen = Array.isArray(tab?.roster) ? tab.roster.length : totalAssignedInClass;
    printSeatSummary.textContent =
      rosterLen > 0 ? `재적 ${rosterLen}명 · 배정 ${totalAssignedInClass}명` : `배정 ${totalAssignedInClass}명`;
  }

  const hasRoster = Boolean(
    withRoster && tab && Array.isArray(tab.roster) && tab.roster.length > 0 && rosterListContainer
  );

  // 2. 명렬표 포함 여부 및 우측 초슬림 1열 균등 분할 행 계산
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

  // 3. 상황별 활성 분단·활성 줄·책상 슬롯 분석 (빈 분단 및 빈 줄 자동 정리)
  const shouldTrimEmpty = Boolean(autoTrimEmpty && totalAssignedInClass > 0);
  const zoneColumns = document.querySelectorAll('#zonesContainer .zone-column');

  const zoneMetaList = zones.map((zone, zIdx) => {
    const rows = Array.isArray(zone.rows) ? zone.rows : [];
    let assignedCount = 0;
    let maxAssignedRightEdge = 0;
    let lastAssignedRowIndex = -1;

    rows.forEach((row, rIdx) => {
      (row.desks || []).forEach((d) => {
        if (isDeskAssigned(d)) {
          assignedCount += 1;
          const rightEdge = (Number(d.pos) || 0) + 1;
          if (rightEdge > maxAssignedRightEdge) maxAssignedRightEdge = rightEdge;
          if (rIdx > lastAssignedRowIndex) lastAssignedRowIndex = rIdx;
        }
      });
    });

    const configuredMaxDesks = zone.maxDesks || SEATING_CONFIG.defaultMaxDesks;
    const effectiveMaxDesks =
      shouldTrimEmpty && assignedCount > 0
        ? Math.max(1, Math.min(configuredMaxDesks, Math.ceil(maxAssignedRightEdge)))
        : configuredMaxDesks;

    return {
      zone,
      zIdx,
      zoneEl: zoneColumns[zIdx] || null,
      assignedCount,
      isActive: shouldTrimEmpty ? assignedCount > 0 : true,
      effectiveMaxDesks,
      lastAssignedRowIndex,
      totalRows: rows.length
    };
  });

  // 만약 모든 분단이 비어 있다면 전체 분단 유지
  const activeZoneMetas = zoneMetaList.some((m) => m.isActive)
    ? zoneMetaList.filter((m) => m.isActive)
    : zoneMetaList;

  const maxRowsAcrossActive = Math.max(
    1,
    ...activeZoneMetas.map((m) =>
      shouldTrimEmpty && m.lastAssignedRowIndex >= 0 ? m.lastAssignedRowIndex + 1 : m.totalRows || 1
    )
  );

  // 4. A4 가로 인쇄 영역(287×202mm -> ~1084×763px) 기반 가로형 교실 책상 치수 산출
  const pageWidthPx = Math.floor(SEATING_CONFIG.printPageWidthMm * PX_PER_MM);
  const pageHeightPx = Math.floor(SEATING_CONFIG.printPageHeightMm * PX_PER_MM);

  const workspaceGapPx = hasRoster ? 14 : 0;
  const rosterWidthPx = hasRoster ? SEATING_CONFIG.printRosterWidthPx : 0;
  const canvasPaddingX = 28; // 좌우 패딩 + 보더 여유분
  const availCanvasW = pageWidthPx - rosterWidthPx - workspaceGapPx - canvasPaddingX;

  const headerBannerBlockH = 42; // 상단 학급 타이틀 배너(34px) + 여백(8px)
  const podiumBlockH = 62; // 하단 교탁(36px) + 칠판바(13px) + 여백(13px)
  const zoneHeaderBlockH = 34; // 분단 헤더(22px) + 하단 여백(12px)
  const availRowsH = pageHeightPx - headerBannerBlockH - podiumBlockH - zoneHeaderBlockH - 22;

  const numZones = Math.max(1, activeZoneMetas.length);
  const totalDeskSlots = Math.max(
    1,
    activeZoneMetas.reduce((sum, m) => sum + m.effectiveMaxDesks, 0)
  );

  // 분단 사이 복도(통로) 폭: 최소 28px 보장, 분단 수에 맞춰 여유로운 교실 통로 확보
  let aisleGapPx =
    numZones > 1
      ? Math.max(
          SEATING_CONFIG.printMinAisleGapPx,
          Math.min(54, Math.round((availCanvasW * 0.115) / (numZones - 1)))
        )
      : 0;

  // 책상 1개 가로 폭 산출 (현실적인 교실 책상 비례 유지를 위해 상한 146px 클램핑 후 남는 폭은 통로로 배분)
  const rawDeskW = Math.floor((availCanvasW - aisleGapPx * (numZones - 1)) / totalDeskSlots);
  const printDeskW = Math.max(70, Math.min(146, rawDeskW));

  if (numZones > 1 && printDeskW < rawDeskW) {
    const remainingW = availCanvasW - printDeskW * totalDeskSlots;
    aisleGapPx = Math.min(72, Math.floor(remainingW / (numZones - 1)));
  }

  // [핵심] 교실 책상 가로:세로 황금비율 가드레일 (절대 세로가 가로보다 길어지지 않도록 보장)
  const effectiveHeightRatio =
    maxRowsAcrossActive <= 4
      ? Math.min(0.66, SEATING_CONFIG.printDeskHeightRatio + 0.03)
      : SEATING_CONFIG.printDeskHeightRatio;
  const idealDeskH = Math.round(printDeskW * effectiveHeightRatio);
  const hardMaxDeskH = Math.round(printDeskW * SEATING_CONFIG.printDeskMaxHeightRatio);
  const minRowGapPx = maxRowsAcrossActive > 1 ? 16 : 0;
  const maxFittingDeskH = Math.floor(
    (availRowsH - minRowGapPx * (maxRowsAcrossActive - 1)) / maxRowsAcrossActive
  );

  const printDeskH = Math.max(42, Math.min(idealDeskH, hardMaxDeskH, maxFittingDeskH));

  // 앞뒤 책상 줄 간격 (의자 등받이가 들어갈 자연스러운 교실 앞뒤 간격 16~38px)
  let rowGapPx = minRowGapPx;
  if (maxRowsAcrossActive > 1) {
    const leftoverH = Math.max(0, availRowsH - printDeskH * maxRowsAcrossActive);
    const maxGap = maxRowsAcrossActive <= 4 ? 38 : 30;
    rowGapPx = Math.max(16, Math.min(maxGap, Math.floor(leftoverH / (maxRowsAcrossActive - 1))));
  }

  const totalZoneColumnH =
    zoneHeaderBlockH + printDeskH * maxRowsAcrossActive + rowGapPx * Math.max(0, maxRowsAcrossActive - 1);

  const zonesContainer = document.getElementById('zonesContainer');
  if (zonesContainer) {
    rememberStyle(restoredStyles, zonesContainer, ['gap']);
    zonesContainer.style.setProperty('gap', `${aisleGapPx}px`, 'important');
  }

  // 5. 각 분단·줄·책상의 인쇄용 치수 및 짝꿍 책상 결합 적용
  const span = SEATING_CONFIG.minDeskSlotSpan;
  let visibleZoneOrder = 0;

  zoneMetaList.forEach((meta) => {
    const { zone, zoneEl, isActive, effectiveMaxDesks } = meta;
    if (!zoneEl) return;

    if (!isActive) {
      rememberStyle(restoredStyles, zoneEl, ['display']);
      zoneEl.style.setProperty('display', 'none', 'important');
      return;
    }

    visibleZoneOrder += 1;
    const zoneTitleEl = zoneEl.querySelector('.zone-title');
    if (zoneTitleEl) {
      restoredText.push({ el: zoneTitleEl, text: zoneTitleEl.textContent });
      zoneTitleEl.textContent = `${visibleZoneOrder}분단`;
    }

    const printTrackW = effectiveMaxDesks * printDeskW;
    rememberStyle(restoredStyles, zoneEl, [
      'display',
      'width',
      'min-width',
      'height',
      'gap',
      'justify-content'
    ]);
    zoneEl.style.setProperty('width', `${printTrackW}px`, 'important');
    zoneEl.style.setProperty('min-width', `${printTrackW}px`, 'important');
    zoneEl.style.setProperty('height', `${totalZoneColumnH}px`, 'important');
    zoneEl.style.setProperty('gap', `${rowGapPx}px`, 'important');
    zoneEl.style.setProperty('justify-content', 'flex-start', 'important');

    const zoneHeaderEl = zoneEl.querySelector('.zone-header');
    if (zoneHeaderEl) {
      rememberStyle(restoredStyles, zoneHeaderEl, ['margin-bottom', 'height']);
      zoneHeaderEl.style.setProperty('height', '22px', 'important');
      zoneHeaderEl.style.setProperty('margin-bottom', '0px', 'important');
    }

    const rowEls = zoneEl.querySelectorAll('.zone-row');
    (zone.rows || []).forEach((row, rIdx) => {
      const rowEl = rowEls[rIdx];
      if (!rowEl) return;

      if (rIdx >= maxRowsAcrossActive) {
        rememberStyle(restoredStyles, rowEl, ['display']);
        rowEl.style.setProperty('display', 'none', 'important');
        return;
      }

      rememberStyle(restoredStyles, rowEl, [
        'display',
        'height',
        'min-height',
        'margin-bottom',
        'padding'
      ]);
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

        const isAssigned = isDeskAssigned(desk);
        const pos = Number(desk.pos) || 0;
        const leftPx = Math.round(pos * printDeskW);

        rememberStyle(restoredStyles, cardEl, [
          'display',
          'visibility',
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

        // 자동 정리 모드일 때 미배정 빈자리는 레이아웃 좌표만 유지하고 깔끔하게 숨김
        if (shouldTrimEmpty && !isAssigned) {
          cardEl.style.setProperty('visibility', 'hidden', 'important');
          cardEl.style.setProperty('left', `${leftPx}px`, 'important');
          cardEl.style.setProperty('width', `${printDeskW}px`, 'important');
          cardEl.style.setProperty('height', `${printDeskH}px`, 'important');
          return;
        }

        const leftNeighbor = desks.find(
          (other) => other.id !== desk.id && Math.abs((Number(other.pos) || 0) + span - pos) < 0.05
        );
        const rightNeighbor = desks.find(
          (other) => other.id !== desk.id && Math.abs(pos + span - (Number(other.pos) || 0)) < 0.05
        );

        const hasVisibleLeftNeighbor = shouldTrimEmpty
          ? Boolean(leftNeighbor && isDeskAssigned(leftNeighbor))
          : Boolean(leftNeighbor);
        const hasVisibleRightNeighbor = shouldTrimEmpty
          ? Boolean(rightNeighbor && isDeskAssigned(rightNeighbor))
          : Boolean(rightNeighbor);

        cardEl.style.setProperty('visibility', 'visible', 'important');
        cardEl.style.setProperty('left', `${leftPx}px`, 'important');
        cardEl.style.setProperty('width', `${printDeskW}px`, 'important');
        cardEl.style.setProperty('height', `${printDeskH}px`, 'important');

        cardEl.style.setProperty(
          'border-top-left-radius',
          hasVisibleLeftNeighbor ? '3.5px' : '6px',
          'important'
        );
        cardEl.style.setProperty(
          'border-bottom-left-radius',
          hasVisibleLeftNeighbor ? '3.5px' : '6px',
          'important'
        );
        cardEl.style.setProperty(
          'border-top-right-radius',
          hasVisibleRightNeighbor ? '3.5px' : '6px',
          'important'
        );
        cardEl.style.setProperty(
          'border-bottom-right-radius',
          hasVisibleRightNeighbor ? '3.5px' : '6px',
          'important'
        );

        if (isAssigned) {
          cardEl.style.setProperty(
            'border-left-width',
            hasVisibleLeftNeighbor ? '1.25px' : '2px',
            'important'
          );
          cardEl.style.setProperty(
            'border-right-width',
            hasVisibleRightNeighbor ? '1.25px' : '2px',
            'important'
          );
        }
      });
    });
  });

  // 6. 가로형 책상 내부 타이포그래피 & 4글자 이상 긴 이름 자동 폭 맞춤 + 수평 기준선 정렬
  const formatSelector =
    FORMAT_SELECTOR_MAP[selectedFormat] || FORMAT_SELECTOR_MAP['name-num-bracket'];
  const isTwoLine =
    selectedFormat === 'top-num-bot-name' || selectedFormat === 'top-name-bot-num';

  // 책상 상판 내부에 충분한 여백이 남도록 글자 크기를 책상 높이/폭에 비례 산출
  const baseNameFontPx = isTwoLine
    ? Math.max(
        15,
        Math.min(
          SEATING_CONFIG.printTwoLineFontPx,
          Math.round(printDeskH * 0.37),
          Math.round(printDeskW * 0.23)
        )
      )
    : Math.max(
        14,
        Math.min(
          SEATING_CONFIG.printOneLineFontPx,
          Math.round(printDeskH * 0.34),
          Math.round(printDeskW * 0.20)
        )
      );

  const baseSubFontPx = isTwoLine
    ? Math.max(10, Math.round(baseNameFontPx * 0.52))
    : Math.max(11, Math.round(baseNameFontPx * 0.68));

  const nameBoxHeightPx = Math.ceil(baseNameFontPx * 1.15);
  const subBoxHeightPx = Math.ceil(baseSubFontPx * 1.12);
  const innerCardWidth = Math.max(46, printDeskW - 14);

  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  const fontStack =
    '-apple-system, BlinkMacSystemFont, "Pretendard", "Malgun Gothic", "Segoe UI", sans-serif';

  document.querySelectorAll('.desk-card.assigned').forEach((card) => {
    const activeItem = card.querySelector(formatSelector);
    if (!activeItem) return;

    const nameEl = activeItem.querySelector('.dp-main');
    const subEl = activeItem.querySelector('.dp-sub');
    if (!nameEl) return;

    const studentName = nameEl.textContent.trim();
    if (!studentName) return;

    rememberStyle(restoredStyles, nameEl, [
      'font-size',
      'transform',
      'transform-origin',
      'display',
      'height',
      'line-height',
      'align-items',
      'justify-content',
      'margin-left',
      'margin-right'
    ]);
    if (subEl) {
      rememberStyle(restoredStyles, subEl, ['font-size', 'height', 'line-height', 'display']);
      subEl.style.setProperty('font-size', `${baseSubFontPx}px`, 'important');
      if (isTwoLine) {
        subEl.style.setProperty('height', `${subBoxHeightPx}px`, 'important');
        subEl.style.setProperty('line-height', `${subBoxHeightPx}px`, 'important');
      }
    }

    if (isTwoLine) {
      nameEl.style.setProperty('height', `${nameBoxHeightPx}px`, 'important');
      nameEl.style.setProperty('line-height', `${nameBoxHeightPx}px`, 'important');
      nameEl.style.setProperty('display', 'flex', 'important');
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
        maxAllowedNameWidth = Math.max(36, innerCardWidth - Math.ceil(measuredSubW) - 6);
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

  // 7. 인쇄 종료 후 화면용 인라인 스타일 및 분단 타이틀 100% 원상 복구
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
    for (let i = restoredText.length - 1; i >= 0; i--) {
      const { el, text } = restoredText[i];
      el.textContent = text;
    }
    window.removeEventListener('afterprint', handleAfterPrint);
  };
  window.addEventListener('afterprint', handleAfterPrint);

  // 8. 브라우저 인쇄 다이얼로그 호출
  window.print();
}
