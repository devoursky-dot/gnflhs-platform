/**
 * GNFLHS 스마트 좌석배치도 - A4 가로(Landscape) 1페이지 맞춤 인쇄 & 이름 자동 폭 조절 엔진 (printEngine.js)
 * - 4종 표기 포맷(이름(번호) / 번호 이름 / 위-번호 아래-이름 / 위-이름 아래-번호)
 * - 우측 초슬림 1열 출석 명렬표 균등 분배(repeat(N, 1fr))
 * - 줄바꿈 절대 방지: [방식 1: 폰트 비례 축소] vs [방식 2: 가로 장평 압축(scaleX)]
 */
import { SEATING_CONFIG } from './config.js';

const FORMAT_SELECTOR_MAP = {
  'name-num-bracket': '.dp-format-bracket',
  'num-name': '.dp-format-num-name',
  'top-num-bot-name': '.dp-format-top-num-bot-name',
  'top-name-bot-num': '.dp-format-top-name-bot-num'
};

export function executeSeatingPrint({
  selectedFormat = 'name-num-bracket',
  fitMode = 'font-size',
  withRoster = true,
  tab,
  rosterListContainer,
  onBeforePrintDialog
}) {
  // 1. 선택된 학생 표기 양식 data 속성 바인딩
  document.body.dataset.printFormat = selectedFormat;

  // 2. 명렬표 포함 여부 및 우측 1열 전체 행 높이 100% 균등 분배 행 계산
  if (withRoster && tab && Array.isArray(tab.roster) && tab.roster.length > 0 && rosterListContainer) {
    document.body.classList.remove('print-hide-roster');
    const totalStudents = Math.max(1, tab.roster.length);
    rosterListContainer.style.setProperty('--print-roster-rows', String(totalStudents));
    rosterListContainer.style.gridTemplateRows = `repeat(${totalStudents}, 1fr)`;
  } else {
    document.body.classList.add('print-hide-roster');
    if (rosterListContainer) {
      rosterListContainer.style.gridTemplateRows = '';
    }
  }

  // 3. 긴 이름 자동 폭 조절 계산 (줄바꿈 절대 방지 & 폰트비례축소 vs 가로장평압축)
  const activeSelector = FORMAT_SELECTOR_MAP[selectedFormat] || '.dp-format-bracket';
  const isTwoLine = selectedFormat.startsWith('top-');
  const baseFontSize = isTwoLine
    ? SEATING_CONFIG.printTwoLineFontPx
    : SEATING_CONFIG.printOneLineFontPx;

  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  if (measureCtx) {
    measureCtx.font = `900 ${baseFontSize}px -apple-system, BlinkMacSystemFont, "Pretendard", sans-serif`;
  }

  const modifiedElements = [];
  const innerCardWidth = SEATING_CONFIG.printCardInnerWidthPx;

  document.querySelectorAll('.desk-card.assigned').forEach((card) => {
    const item = card.querySelector(activeSelector);
    if (!item) return;
    const nameEl = item.querySelector('.dp-main');
    if (!nameEl) return;

    const studentName = nameEl.textContent.trim();
    if (!studentName) return;

    let maxAllowedWidth = innerCardWidth;
    if (!isTwoLine) {
      // 단일 행 포맷(이름(번호) / 번호 이름)의 경우 번호 텍스트 폭 공제
      const subEl = item.querySelector('.dp-sub');
      const subText = subEl ? subEl.textContent.trim() : '';
      const subWidth = subText ? subText.length * 8 + 12 : 0;
      maxAllowedWidth = Math.max(SEATING_CONFIG.printMinSingleLineNamePx, innerCardWidth - subWidth);
    }

    const textWidth = measureCtx
      ? measureCtx.measureText(studentName).width
      : studentName.length * baseFontSize * 0.9;

    if (textWidth > maxAllowedWidth && textWidth > 0) {
      const ratio = maxAllowedWidth / textWidth;
      if (fitMode === 'font-size') {
        const scaledSize = Math.max(
          SEATING_CONFIG.printMinFontPx,
          Math.floor(baseFontSize * ratio)
        );
        nameEl.style.fontSize = `${scaledSize}px`;
        nameEl.style.transform = '';
      } else {
        nameEl.style.transform = `scaleX(${ratio.toFixed(3)})`;
        nameEl.style.transformOrigin = 'center center';
        nameEl.style.display = 'inline-block';
      }
      modifiedElements.push(nameEl);
    }
  });

  if (typeof onBeforePrintDialog === 'function') {
    onBeforePrintDialog();
  }

  // 4. 인쇄 완료 후 인라인 스타일 복원 이벤트 등록
  const handleAfterPrint = () => {
    if (rosterListContainer) {
      rosterListContainer.style.gridTemplateRows = '';
    }
    modifiedElements.forEach((el) => {
      el.style.fontSize = '';
      el.style.transform = '';
      el.style.transformOrigin = '';
      el.style.display = '';
    });
    window.removeEventListener('afterprint', handleAfterPrint);
  };
  window.addEventListener('afterprint', handleAfterPrint);

  // 5. 브라우저 인쇄 다이얼로그 호출
  window.print();
}
