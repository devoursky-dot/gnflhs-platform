/**
 * GNFLHS 스마트 교실 좌석배치도 애플리케이션
 * 1. 하단 교탁 기준점 (교사 시점)
 * 2. [좌석조절 모드] vs [수업/배치 완료 모드] 단계별 분리 & 좌석위치마감
 * 3. 분단 상단에서 가로줄수 & 최대책상수 통합 정의
 * 4. 0.5칸(반 칸) 단위 이동 & 1칸 공간 미확보 시 추가버튼 자동 비활성화
 * 5. 명렬표 기본 배치 & A4 인쇄 시 명렬표 포함/제외 선택 옵션
 * 6. 다중 탭 관리 시스템 & 탭 이름 실시간 변경
 * 7. 기기 로컬 캐시 100% 무손실 실시간 자동 저장
 */

const STORAGE_KEY = 'gnflhs_seating_app_v1';

// 기본 탭 구조 생성
function createDefaultTab(
  title = '1학년 2반 일반배치',
  className = '1학년 2반',
  zoneCount = 3,
  rowCount = 4,
  maxDesks = 2,
  totalStudents = 24
) {
  const tabId = 'tab_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

  const zones = Array.from({ length: zoneCount }).map((_, zIdx) => ({
    id: `zone_${zIdx}_${Date.now()}`,
    name: `${zIdx + 1}분단`,
    rowCount: rowCount,
    maxDesks: maxDesks, // 분단 상단에서 정하는 최대 책상 수
    rows: Array.from({ length: rowCount }).map((_, rIdx) => ({
      id: `row_${zIdx}_${rIdx}_${Date.now()}`,
      desks: Array.from({ length: maxDesks }).map((_, dIdx) => ({
        id: `desk_${zIdx}_${rIdx}_${dIdx}_${Date.now()}`,
        pos: dIdx * 1.0, // 슬롯 위치 (0.0, 0.5, 1.0, 1.5...)
        studentNo: '',
        studentName: ''
      }))
    }))
  }));

  const defaultNames = [
    '김민준', '이서연', '박도윤', '정예원', '최시우', '강하은', '조지호', '윤지우',
    '장서진', '임수아', '한주원', '오채원', '서도현', '신유나', '권건우', '황다은',
    '안우진', '송민서', '유준서', '홍시은', '전승우', '고하윤', '문태윤', '손지민'
  ];

  const roster = Array.from({ length: totalStudents }).map((_, i) => ({
    id: `stu_${i + 1}`,
    no: i + 1,
    name: defaultNames[i] || `학생 ${i + 1}`,
    assignedDeskId: null
  }));

  return {
    id: tabId,
    title,
    className,
    totalCount: totalStudents,
    autoNumber: true,
    isEditMode: false, // 기본은 깔끔한 수업/배치 모드
    zones,
    roster
  };
}

let appState = {
  activeTabId: '',
  tabs: [],
  isEditMode: false,
  rosterOpen: true // 명렬표 기본 배치 (열림 상태)
};

// 1. 상태 로드 및 로컬 캐시 초기화
function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.tabs) && parsed.tabs.length > 0) {
        appState.tabs = parsed.tabs;
        appState.activeTabId = parsed.activeTabId || parsed.tabs[0].id;
        appState.rosterOpen = parsed.rosterOpen !== undefined ? parsed.rosterOpen : true;
        appState.isEditMode = parsed.isEditMode || false;
        return;
      }
    }
  } catch (e) {
    console.warn('Failed to load local seating state:', e);
  }

  const tab1 = createDefaultTab('1학년 2반 일반배치', '1학년 2반', 3, 4, 2, 24);
  const tab2 = createDefaultTab('모둠 활동형 배치', '1학년 2반 (모둠)', 2, 3, 3, 24);
  appState.tabs = [tab1, tab2];
  appState.activeTabId = tab1.id;
  appState.isEditMode = false;
  appState.rosterOpen = true;
}

// 2. 실시간 로컬 캐시 자동 저장
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      activeTabId: appState.activeTabId,
      tabs: appState.tabs,
      rosterOpen: appState.rosterOpen,
      isEditMode: appState.isEditMode
    }));

    if (window.GNFLHS && window.GNFLHS.db) {
      window.GNFLHS.db.set('seating_layouts', appState.tabs).catch(() => {});
    }

    const badge = document.getElementById('saveStatusBadge');
    if (badge) {
      badge.style.opacity = '1';
      setTimeout(() => { badge.style.opacity = '0.85'; }, 1000);
    }
  } catch (e) {
    console.warn('Auto-save error:', e);
  }
}

function getActiveTab() {
  return appState.tabs.find((t) => t.id === appState.activeTabId) || appState.tabs[0];
}

// ===================== 3. 0.5칸 기하학 및 1칸 공간 계산 엔진 =====================

// 특정 줄에서 연속된 1.0칸(책상 1개가 들어갈 수 있는 공간)이 존재하는지 검사
function findAvailableSlotForNewDesk(row, maxDesks) {
  const sorted = [...row.desks].sort((a, b) => a.pos - b.pos);
  
  // 1. 첫 책상 앞 공간
  if (sorted.length === 0) return 0.0;
  if (sorted[0].pos >= 1.0) return 0.0;

  // 2. 책상들 사이 공간
  for (let i = 0; i < sorted.length - 1; i++) {
    const endCurrent = sorted[i].pos + 1.0;
    const startNext = sorted[i + 1].pos;
    if (startNext - endCurrent >= 1.0) {
      return endCurrent;
    }
  }

  // 3. 마지막 책상 뒤 공간
  const lastEnd = sorted[sorted.length - 1].pos + 1.0;
  if (maxDesks - lastEnd >= 1.0) {
    return lastEnd;
  }

  return null; // 1칸 공간 없음 (추가 불가)
}

// 반 칸(0.5칸) 이동 가능 여부 검사 및 이동 실행
function shiftDeskPosition(row, desk, delta, maxDesks) {
  const nextPos = desk.pos + delta;
  if (nextPos < 0 || nextPos + 1.0 > maxDesks) return false;

  const otherDesks = row.desks.filter((d) => d.id !== desk.id);
  // 충돌 검사 (다른 책상과 겹치는지 확인)
  const isOverlapping = otherDesks.some((other) => {
    return Math.max(nextPos, other.pos) < Math.min(nextPos + 1.0, other.pos + 1.0);
  });

  if (isOverlapping) return false;

  desk.pos = nextPos;
  saveState();
  renderCanvas();
  return true;
}

// ===================== 4. UI 렌더링 엔진 =====================

// (1) 탭 바 렌더링
function renderTabs() {
  const container = document.getElementById('tabsContainer');
  container.innerHTML = '';

  appState.tabs.forEach((tab) => {
    const isActive = tab.id === appState.activeTabId;
    const tabEl = document.createElement('div');
    tabEl.className = `tab-pill ${isActive ? 'active' : ''}`;

    const titleSpan = document.createElement('span');
    titleSpan.textContent = tab.title;
    titleSpan.title = '더블클릭하여 탭 이름을 변경할 수 있습니다';

    titleSpan.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      const input = document.createElement('input');
      input.className = 'tab-title-edit';
      input.value = tab.title;
      tabEl.replaceChild(input, titleSpan);
      input.focus();
      input.select();

      const finishEdit = () => {
        const nextTitle = input.value.trim() || tab.title;
        tab.title = nextTitle;
        saveState();
        renderTabs();
      };
      input.addEventListener('blur', finishEdit);
      input.addEventListener('keydown', (ke) => {
        if (ke.key === 'Enter') finishEdit();
      });
    });

    tabEl.appendChild(titleSpan);

    if (appState.tabs.length > 1) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'tab-close-btn';
      closeBtn.innerHTML = '✕';
      closeBtn.title = '배치도 삭제';
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`'${tab.title}' 배치도를 삭제하시겠습니까?`)) {
          appState.tabs = appState.tabs.filter((t) => t.id !== tab.id);
          if (appState.activeTabId === tab.id) {
            appState.activeTabId = appState.tabs[0].id;
          }
          saveState();
          renderAll();
        }
      });
      tabEl.appendChild(closeBtn);
    }

    tabEl.addEventListener('click', () => {
      appState.activeTabId = tab.id;
      saveState();
      renderAll();
    });

    container.appendChild(tabEl);
  });
}

// (2) 교실 캔버스 & 분단 & 책상 렌더링
function renderCanvas() {
  const tab = getActiveTab();
  if (!tab) return;

  // 편집 모드 클래스 반영
  if (appState.isEditMode) {
    document.body.classList.add('edit-mode');
    document.getElementById('editModeLabel').textContent = '좌석 위치 마감 (완료)';
  } else {
    document.body.classList.remove('edit-mode');
    document.getElementById('editModeLabel').textContent = '좌석 조절 모드';
  }

  // 하단 교탁 이름 반영
  const teacherNameEl = document.getElementById('teacherClassName');
  if (teacherNameEl) {
    teacherNameEl.textContent = `${tab.className} 교탁`;
  }

  const container = document.getElementById('zonesContainer');
  container.innerHTML = '';

  tab.zones.forEach((zone, zIdx) => {
    const maxDesks = zone.maxDesks || 2;
    // 책상 1개 너비 90px, 간격 10px ➔ 슬롯당 100px
    const trackWidth = maxDesks * 100 + 4;

    const zoneCol = document.createElement('div');
    zoneCol.className = 'zone-column';
    zoneCol.dataset.zoneId = zone.id;
    zoneCol.style.minWidth = `${trackWidth + 24}px`;

    // 분단 헤더
    const header = document.createElement('div');
    header.className = 'zone-header';

    const titleDiv = document.createElement('div');
    titleDiv.className = 'zone-title';
    titleDiv.textContent = `${zone.name || `${zIdx + 1}분단`}`;
    header.appendChild(titleDiv);

    // [좌석 조절 모드] 일 때만 분단 헤더에 [가로줄 수] & [최대 책상 수] 스피너 노출
    const steppersWrap = document.createElement('div');
    steppersWrap.className = 'zone-header-steppers edit-only';

    // 1. 가로줄 수 스피너
    const rowStepper = document.createElement('div');
    rowStepper.className = 'header-stepper-item';
    rowStepper.title = '이 분단의 가로줄 수 조절';
    rowStepper.innerHTML = `
      <span class="lbl">줄수:</span>
      <button class="btn-minus">-</button>
      <span class="val">${zone.rowCount}</span>
      <button class="btn-plus">+</button>
    `;
    rowStepper.querySelector('.btn-minus').onclick = () => changeZoneRowCount(zone, -1);
    rowStepper.querySelector('.btn-plus').onclick = () => changeZoneRowCount(zone, 1);
    steppersWrap.appendChild(rowStepper);

    // 2. 최대 책상 수 스피너
    const maxDeskStepper = document.createElement('div');
    maxDeskStepper.className = 'header-stepper-item';
    maxDeskStepper.title = '이 분단의 최대 책상 수 조절 (분단 폭 결정)';
    maxDeskStepper.innerHTML = `
      <span class="lbl">최대책상:</span>
      <button class="btn-minus">-</button>
      <span class="val">${maxDesks}</span>
      <button class="btn-plus">+</button>
    `;
    maxDeskStepper.querySelector('.btn-minus').onclick = () => changeZoneMaxDesks(zone, -1);
    maxDeskStepper.querySelector('.btn-plus').onclick = () => changeZoneMaxDesks(zone, 1);
    steppersWrap.appendChild(maxDeskStepper);

    // 분단 삭제 버튼
    const delZoneBtn = document.createElement('button');
    delZoneBtn.className = 'zone-del-btn edit-only';
    delZoneBtn.innerHTML = '✕';
    delZoneBtn.title = '이 분단 삭제';
    delZoneBtn.onclick = () => {
      if (tab.zones.length <= 1) {
        alert('최소 1개 이상의 분단이 유지되어야 합니다.');
        return;
      }
      tab.zones = tab.zones.filter((z) => z.id !== zone.id);
      saveState();
      renderCanvas();
    };
    steppersWrap.appendChild(delZoneBtn);

    header.appendChild(steppersWrap);
    zoneCol.appendChild(header);

    // 각 가로줄 (Row) 렌더링
    zone.rows.forEach((row, rIdx) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'zone-row';
      rowEl.dataset.rowId = row.id;

      // 책상들이 0.5칸 단위로 놓이는 트랙 영역
      const desksTrack = document.createElement('div');
      desksTrack.className = 'desks-track';
      desksTrack.style.width = `${trackWidth}px`;

      // 책상 렌더링
      row.desks.forEach((desk) => {
        const deskCard = createDeskCardElement(zone, row, desk, maxDesks);
        desksTrack.appendChild(deskCard);
      });

      rowEl.appendChild(desksTrack);

      // [조절 모드 전용] 1칸 공간이 남아있을 때만 [➕ 추가] 버튼 노출!
      if (appState.isEditMode) {
        const availableSlot = findAvailableSlotForNewDesk(row, maxDesks);
        if (availableSlot !== null) {
          const addBtn = document.createElement('button');
          addBtn.className = 'row-add-desk-btn edit-only';
          addBtn.innerHTML = '+ 추가';
          addBtn.title = '이 줄에 책상 1개 추가';
          addBtn.onclick = () => {
            row.desks.push({
              id: `desk_${row.id}_${Date.now()}`,
              pos: availableSlot,
              studentNo: '',
              studentName: ''
            });
            saveState();
            renderCanvas();
          };
          rowEl.appendChild(addBtn);
        }
      }

      zoneCol.appendChild(rowEl);
    });

    container.appendChild(zoneCol);
  });

  updateRosterStats();
}

// 개별 책상 카드 엘리먼트 생성
function createDeskCardElement(zone, row, desk, maxDesks) {
  const card = document.createElement('div');
  const hasStudent = desk.studentName && desk.studentName.trim() !== '';
  card.className = `desk-card ${hasStudent ? 'assigned' : ''}`;
  card.dataset.deskId = desk.id;
  card.draggable = !appState.isEditMode; // 조절 모드가 아닐 때만 자리배치 드래그 가능

  // 슬롯 위치 기반 정밀 배치: pos * 100px (0.5 단위 지원)
  const leftPx = (desk.pos || 0) * 100;
  card.style.left = `${leftPx}px`;

  // 상단 바: 번호 뱃지 + [조절 모드 시 삭제 ✕ 버튼]
  const topBar = document.createElement('div');
  topBar.className = 'desk-top-bar';

  const noBadge = document.createElement('span');
  noBadge.className = 'desk-no-badge';
  noBadge.textContent = desk.studentNo ? `#${desk.studentNo}` : `석`;
  topBar.appendChild(noBadge);

  // [조절 모드 전용] 책상 삭제(✕) 버튼
  if (appState.isEditMode) {
    const delBtn = document.createElement('button');
    delBtn.className = 'desk-del-btn edit-only';
    delBtn.innerHTML = '✕';
    delBtn.title = '이 책상 삭제 (공간 확보)';
    delBtn.onclick = (e) => {
      e.stopPropagation();
      row.desks = row.desks.filter((d) => d.id !== desk.id);
      saveState();
      renderCanvas();
    };
    topBar.appendChild(delBtn);
  }

  card.appendChild(topBar);

  // 학생 이름 라벨 (화면 표시용)
  const nameLabel = document.createElement('div');
  nameLabel.className = `desk-name ${hasStudent ? '' : 'empty'}`;
  nameLabel.textContent = hasStudent ? desk.studentName : '빈자리';
  card.appendChild(nameLabel);

  // [인쇄 전용 뷰 컨테이너] 사용자 선택 4종 포맷 대응 (이름 강조 & 2줄 시 번호는 이름의 절반 크기)
  const printView = document.createElement('div');
  printView.className = 'desk-print-view';

  const pNum = desk.studentNo ? String(desk.studentNo) : '';
  const pName = hasStudent ? desk.studentName : '';

  // 1. 이름(번호) - 예: 김민준(1)
  const pBracket = document.createElement('div');
  pBracket.className = 'dp-item dp-format-bracket';
  if (hasStudent) {
    pBracket.innerHTML = pNum
      ? `<span class="dp-main">${pName}</span><span class="dp-sub">(${pNum})</span>`
      : `<span class="dp-main">${pName}</span>`;
  }

  // 2. 번호 이름 - 예: 1 김민준
  const pNumName = document.createElement('div');
  pNumName.className = 'dp-item dp-format-num-name';
  if (hasStudent) {
    pNumName.innerHTML = pNum
      ? `<span class="dp-sub">${pNum}</span> <span class="dp-main">${pName}</span>`
      : `<span class="dp-main">${pName}</span>`;
  }

  // 3. 위-번호 아래-이름 (두 줄: 번호는 이름의 절반 크기)
  const pTopNumBotName = document.createElement('div');
  pTopNumBotName.className = 'dp-item dp-format-top-num-bot-name';
  if (hasStudent) {
    pTopNumBotName.innerHTML = pNum
      ? `<span class="dp-sub">${pNum}</span><span class="dp-main">${pName}</span>`
      : `<span class="dp-main">${pName}</span>`;
  }

  // 4. 위-이름 아래-번호 (두 줄: 번호는 이름의 절반 크기)
  const pTopNameBotNum = document.createElement('div');
  pTopNameBotNum.className = 'dp-item dp-format-top-name-bot-num';
  if (hasStudent) {
    pTopNameBotNum.innerHTML = pNum
      ? `<span class="dp-main">${pName}</span><span class="dp-sub">${pNum}</span>`
      : `<span class="dp-main">${pName}</span>`;
  }

  printView.appendChild(pBracket);
  printView.appendChild(pNumName);
  printView.appendChild(pTopNumBotName);
  printView.appendChild(pTopNameBotNum);
  card.appendChild(printView);

  // [조절 모드 전용] 책상 하단 '반 칸(0.5칸) 이동' 버튼 바
  if (appState.isEditMode) {
    const shiftBar = document.createElement('div');
    shiftBar.className = 'desk-shift-bar edit-only';

    const btnLeft = document.createElement('button');
    btnLeft.className = 'shift-btn';
    btnLeft.innerHTML = '◀ 0.5';
    btnLeft.title = '왼쪽으로 반 칸(0.5칸) 이동';
    btnLeft.onclick = (e) => {
      e.stopPropagation();
      shiftDeskPosition(row, desk, -0.5, maxDesks);
    };

    const btnRight = document.createElement('button');
    btnRight.className = 'shift-btn';
    btnRight.innerHTML = '0.5 ▶';
    btnRight.title = '오른쪽으로 반 칸(0.5칸) 이동';
    btnRight.onclick = (e) => {
      e.stopPropagation();
      shiftDeskPosition(row, desk, 0.5, maxDesks);
    };

    shiftBar.appendChild(btnLeft);
    shiftBar.appendChild(btnRight);
    card.appendChild(shiftBar);
  }

  // 더블 클릭 시 학생 지정 모달 (운영 모드일 때)
  card.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    openDeskEditModal(desk);
  });

  // 드래그앤드롭 이벤트 (운영 모드일 때 자리 스왑 및 명렬표 배정)
  card.addEventListener('dragstart', (e) => {
    if (appState.isEditMode) return;
    e.dataTransfer.setData('text/plain', JSON.stringify({
      type: 'DESK_SWAP',
      sourceDeskId: desk.id
    }));
    card.style.opacity = '0.5';
  });

  card.addEventListener('dragend', () => {
    card.style.opacity = '1';
    document.querySelectorAll('.desk-card').forEach((el) => el.classList.remove('drag-over'));
  });

  card.addEventListener('dragover', (e) => {
    if (appState.isEditMode) return;
    e.preventDefault();
    card.classList.add('drag-over');
  });

  card.addEventListener('dragleave', () => {
    card.classList.remove('drag-over');
  });

  card.addEventListener('drop', (e) => {
    if (appState.isEditMode) return;
    e.preventDefault();
    card.classList.remove('drag-over');
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;

    try {
      const data = JSON.parse(raw);
      if (data.type === 'ROSTER_ASSIGN') {
        assignStudentToDesk(data.studentId, desk);
      } else if (data.type === 'DESK_SWAP') {
        swapDesks(data.sourceDeskId, desk.id);
      }
    } catch (err) {}
  });

  return card;
}

// (3) 출석 명렬표 서랍 렌더링 (기본 배치됨)
function renderRoster() {
  const tab = getActiveTab();
  if (!tab) return;

  const totalInput = document.getElementById('totalStudentCount');
  if (totalInput) totalInput.value = tab.totalCount;

  const chkAuto = document.getElementById('chkAutoNumber');
  if (chkAuto) chkAuto.checked = tab.autoNumber;

  const container = document.getElementById('rosterListContainer');
  container.innerHTML = '';

  tab.roster.forEach((student) => {
    const isAssigned = isStudentAssigned(student.name);

    const item = document.createElement('div');
    item.className = `roster-student-item ${isAssigned ? 'assigned' : ''}`;
    item.draggable = true;

    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', JSON.stringify({
        type: 'ROSTER_ASSIGN',
        studentId: student.id,
        no: student.no,
        name: student.name
      }));
    });

    const noBox = document.createElement('div');
    noBox.className = 'student-no-box';
    noBox.textContent = String(student.no);

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'student-name-input';
    nameInput.value = student.name || '';
    nameInput.placeholder = '이름 입력';
    nameInput.addEventListener('change', () => {
      student.name = nameInput.value.trim();
      saveState();
      renderCanvas();
    });

    const statusBadge = document.createElement('span');
    statusBadge.className = `student-status-badge ${isAssigned ? 'assigned' : 'unassigned'}`;
    statusBadge.textContent = isAssigned ? '배정됨' : '미배정';

    const delBtn = document.createElement('button');
    delBtn.className = 'student-del-btn';
    delBtn.innerHTML = '✕';
    delBtn.title = '명단에서 삭제';
    delBtn.onclick = () => {
      tab.roster = tab.roster.filter((s) => s.id !== student.id);
      tab.totalCount = tab.roster.length;
      renumberRosterIfNeeded(tab);
      saveState();
      renderRoster();
      renderCanvas();
    };

    item.appendChild(noBox);
    item.appendChild(nameInput);
    item.appendChild(statusBadge);
    item.appendChild(delBtn);

    container.appendChild(item);
  });

  updateRosterStats();
}

function updateRosterStats() {
  const tab = getActiveTab();
  if (!tab) return;

  let assignedCount = 0;
  tab.roster.forEach((s) => {
    if (isStudentAssigned(s.name)) assignedCount++;
  });

  const unassigned = tab.roster.length - assignedCount;

  const assEl = document.getElementById('assignedStat');
  const unassEl = document.getElementById('unassignedStat');
  const pillEl = document.getElementById('rosterCountPill');

  if (assEl) assEl.textContent = String(assignedCount);
  if (unassEl) unassEl.textContent = String(unassigned);
  if (pillEl) pillEl.textContent = `${assignedCount}/${tab.roster.length}`;
}

function isStudentAssigned(studentName) {
  if (!studentName) return false;
  const tab = getActiveTab();
  for (const z of tab.zones) {
    for (const r of z.rows) {
      for (const d of r.desks) {
        if (d.studentName === studentName) return true;
      }
    }
  }
  return false;
}

function renderAll() {
  renderTabs();
  renderCanvas();
  renderRoster();
}

// ===================== 5. 분단 상단 스피너 제어 =====================

function changeZoneRowCount(zone, delta) {
  const next = Math.max(1, Math.min(12, zone.rowCount + delta));
  if (next === zone.rowCount) return;

  if (delta > 0) {
    const maxDesks = zone.maxDesks || 2;
    for (let i = zone.rowCount; i < next; i++) {
      zone.rows.push({
        id: `row_${zone.id}_${i}_${Date.now()}`,
        desks: Array.from({ length: maxDesks }).map((_, di) => ({
          id: `desk_${zone.id}_${i}_${di}_${Date.now()}`,
          pos: di * 1.0,
          studentNo: '',
          studentName: ''
        }))
      });
    }
  } else {
    zone.rows = zone.rows.slice(0, next);
  }

  zone.rowCount = next;
  saveState();
  renderCanvas();
}

function changeZoneMaxDesks(zone, delta) {
  const next = Math.max(1, Math.min(5, (zone.maxDesks || 2) + delta));
  if (next === zone.maxDesks) return;

  zone.maxDesks = next;
  // 기존 책상들이 새로운 최대 폭을 넘어가면 보정
  zone.rows.forEach((r) => {
    r.desks = r.desks.filter((d) => d.pos + 1.0 <= next);
  });

  saveState();
  renderCanvas();
}

function assignStudentToDesk(studentId, desk) {
  const tab = getActiveTab();
  const student = tab.roster.find((s) => s.id === studentId);
  if (!student) return;

  clearStudentFromAllDesks(student.name);

  desk.studentName = student.name;
  desk.studentNo = String(student.no);
  saveState();
  renderCanvas();
  renderRoster();
}

function swapDesks(sourceDeskId, targetDeskId) {
  if (sourceDeskId === targetDeskId) return;
  const tab = getActiveTab();
  let sDesk = null;
  let tDesk = null;

  for (const z of tab.zones) {
    for (const r of z.rows) {
      for (const d of r.desks) {
        if (d.id === sourceDeskId) sDesk = d;
        if (d.id === targetDeskId) tDesk = d;
      }
    }
  }

  if (sDesk && tDesk) {
    const tempName = sDesk.studentName;
    const tempNo = sDesk.studentNo;
    sDesk.studentName = tDesk.studentName;
    sDesk.studentNo = tDesk.studentNo;
    tDesk.studentName = tempName;
    tDesk.studentNo = tempNo;
    saveState();
    renderCanvas();
  }
}

function clearStudentFromAllDesks(name) {
  if (!name) return;
  const tab = getActiveTab();
  for (const z of tab.zones) {
    for (const r of z.rows) {
      for (const d of r.desks) {
        if (d.studentName === name) {
          d.studentName = '';
          d.studentNo = '';
        }
      }
    }
  }
}

// ===================== 6. 명렬표 총원 및 자동 번호 엔진 =====================

function setTotalStudentCount(count) {
  const tab = getActiveTab();
  const target = Math.max(1, Math.min(60, count));
  tab.totalCount = target;

  if (tab.roster.length < target) {
    const start = tab.roster.length + 1;
    for (let i = start; i <= target; i++) {
      tab.roster.push({
        id: `stu_${Date.now()}_${i}`,
        no: i,
        name: `학생 ${i}`,
        assignedDeskId: null
      });
    }
  } else if (tab.roster.length > target) {
    tab.roster = tab.roster.slice(0, target);
  }

  renumberRosterIfNeeded(tab);
  saveState();
  renderRoster();
}

function renumberRosterIfNeeded(tab) {
  if (tab.autoNumber) {
    tab.roster.forEach((s, idx) => {
      s.no = idx + 1;
    });
  }
}

function handleRandomShuffle() {
  const tab = getActiveTab();
  const unassigned = tab.roster.filter((s) => !isStudentAssigned(s.name));

  const emptyDesks = [];
  tab.zones.forEach((z) => {
    z.rows.forEach((r) => {
      r.desks.forEach((d) => {
        if (!d.studentName) emptyDesks.push(d);
      });
    });
  });

  if (unassigned.length === 0) {
    if (confirm('모든 학생이 이미 배정되었습니다. 기존 배치를 지우고 전원 무작위 재배치하시겠습니까?')) {
      handleClearAllDesks();
      handleRandomShuffle();
    }
    return;
  }

  if (emptyDesks.length === 0) {
    alert('비어있는 책상이 없습니다. 책상을 추가하거나 기존 자리를 비워주세요.');
    return;
  }

  const shuffledStudents = [...unassigned].sort(() => Math.random() - 0.5);
  const assignCount = Math.min(shuffledStudents.length, emptyDesks.length);

  for (let i = 0; i < assignCount; i++) {
    emptyDesks[i].studentName = shuffledStudents[i].name;
    emptyDesks[i].studentNo = String(shuffledStudents[i].no);
  }

  saveState();
  renderCanvas();
  renderRoster();
}

function handleClearAllDesks() {
  const tab = getActiveTab();
  tab.zones.forEach((z) => {
    z.rows.forEach((r) => {
      r.desks.forEach((d) => {
        d.studentName = '';
        d.studentNo = '';
      });
    });
  });
  saveState();
  renderCanvas();
  renderRoster();
}

// ===================== 7. 초기 구조 설정 마법사 모달 =====================

let pendingTabTitle = '';

function openInitSetupModal(isNewTab = false) {
  const tab = getActiveTab();
  pendingTabTitle = isNewTab ? `좌석배치 ${appState.tabs.length + 1}` : tab.title;

  const modal = document.getElementById('initSetupModal');
  const zInput = document.getElementById('initZoneCount');
  const rInput = document.getElementById('initRowCount');
  const dInput = document.getElementById('initDeskCount');
  const tInput = document.getElementById('initTotalStudent');

  zInput.value = tab.zones.length || 3;
  rInput.value = tab.zones[0]?.rows?.length || 4;
  dInput.value = tab.zones[0]?.maxDesks || 2;
  tInput.value = tab.totalCount || 24;

  modal.classList.remove('hidden');
}

function applyInitSetupModal() {
  const zCount = parseInt(document.getElementById('initZoneCount').value, 10) || 3;
  const rCount = parseInt(document.getElementById('initRowCount').value, 10) || 4;
  const dCount = parseInt(document.getElementById('initDeskCount').value, 10) || 2;
  const tCount = parseInt(document.getElementById('initTotalStudent').value, 10) || 24;

  const currentTab = getActiveTab();
  const title = pendingTabTitle || currentTab.title;
  const className = currentTab.className || '1학년 2반';

  const newTab = createDefaultTab(title, className, zCount, rCount, dCount, tCount);
  newTab.isEditMode = true; // 생성 직후에는 조절 모드로 바로 시작

  if (pendingTabTitle && pendingTabTitle !== currentTab.title) {
    appState.tabs.push(newTab);
    appState.activeTabId = newTab.id;
  } else {
    const idx = appState.tabs.findIndex((t) => t.id === currentTab.id);
    newTab.id = currentTab.id;
    newTab.title = currentTab.title;
    newTab.className = currentTab.className;
    appState.tabs[idx] = newTab;
  }

  appState.isEditMode = true;
  saveState();
  document.getElementById('initSetupModal').classList.add('hidden');
  pendingTabTitle = '';
  renderAll();
}

// ===================== 8. 개별 책상 수정 모달 =====================

let editingTargetDesk = null;

function openDeskEditModal(desk) {
  editingTargetDesk = desk;
  const modal = document.getElementById('deskEditModal');
  const noInput = document.getElementById('editDeskNo');
  const nameInput = document.getElementById('editDeskName');

  noInput.value = desk.studentNo || '';
  nameInput.value = desk.studentName || '';
  modal.classList.remove('hidden');
  nameInput.focus();
}

function closeDeskEditModal() {
  document.getElementById('deskEditModal').classList.add('hidden');
  editingTargetDesk = null;
}

// ===================== 9. 이벤트 리스너 바인딩 =====================

function initEventListeners() {
  // 1. 탭 추가 버튼 ➔ 초기 마법사 팝업 바로 띄움
  document.getElementById('btnAddTab').onclick = () => {
    openInitSetupModal(true);
  };

  // 2. [좌석 조절 모드] 토글 버튼 & [좌석위치 마감] 버튼
  const btnToggleEdit = document.getElementById('btnToggleEditMode');
  const btnFinish = document.getElementById('btnFinishLayout');

  const toggleEditMode = () => {
    appState.isEditMode = !appState.isEditMode;
    saveState();
    renderCanvas();
  };

  btnToggleEdit.onclick = toggleEditMode;
  btnFinish.onclick = () => {
    appState.isEditMode = false;
    saveState();
    renderCanvas();
  };

  // 마법사 모달 버튼
  document.getElementById('btnCloseInitModal').onclick = () => {
    document.getElementById('initSetupModal').classList.add('hidden');
  };
  document.getElementById('btnCancelInitModal').onclick = () => {
    document.getElementById('initSetupModal').classList.add('hidden');
  };
  document.getElementById('btnApplyInitModal').onclick = applyInitSetupModal;

  // 3. 분단 추가 버튼
  document.getElementById('btnAddVerticalAisle').onclick = () => {
    const tab = getActiveTab();
    const nextIdx = tab.zones.length + 1;
    const defaultRowCount = tab.zones[0]?.rows?.length || 4;
    const defaultMaxDesks = tab.zones[0]?.maxDesks || 2;

    const newZone = {
      id: `zone_${Date.now()}`,
      name: `${nextIdx}분단`,
      rowCount: defaultRowCount,
      maxDesks: defaultMaxDesks,
      rows: Array.from({ length: defaultRowCount }).map((_, rIdx) => ({
        id: `row_${Date.now()}_${rIdx}`,
        desks: Array.from({ length: defaultMaxDesks }).map((_, di) => ({
          id: `desk_${Date.now()}_${rIdx}_${di}`,
          pos: di * 1.0,
          studentNo: '',
          studentName: ''
        }))
      }))
    };
    tab.zones.push(newZone);
    saveState();
    renderCanvas();
  };

  // 4. 하단 교탁 반 이름 클릭 변경
  document.getElementById('teacherDesk').onclick = () => {
    const tab = getActiveTab();
    const next = prompt('교탁에 표시할 학급/반 이름을 입력하세요:', tab.className);
    if (next !== null && next.trim()) {
      tab.className = next.trim();
      saveState();
      renderCanvas();
    }
  };

  // 5. 명렬표 서랍 토글 (기본 열림)
  const rosterSidebar = document.getElementById('rosterSidebar');
  const toggleBtn = document.getElementById('btnToggleRoster');
  const toggleRoster = () => {
    rosterSidebar.classList.toggle('collapsed');
    appState.rosterOpen = !rosterSidebar.classList.contains('collapsed');
    saveState();
  };
  toggleBtn.onclick = toggleRoster;
  document.getElementById('btnCloseRoster').onclick = toggleRoster;

  // 6. 명렬표 총원 및 번호 자동입력 변경
  document.getElementById('totalStudentCount').onchange = (e) => {
    setTotalStudentCount(parseInt(e.target.value, 10) || 24);
  };
  document.getElementById('chkAutoNumber').onchange = (e) => {
    const tab = getActiveTab();
    tab.autoNumber = e.target.checked;
    renumberRosterIfNeeded(tab);
    saveState();
    renderRoster();
  };

  // 7. 명렬표 일괄 붙여넣기 모달
  const pasteModal = document.getElementById('pasteModal');
  document.getElementById('btnBatchPaste').onclick = () => pasteModal.classList.remove('hidden');
  document.getElementById('btnClosePasteModal').onclick = () => pasteModal.classList.add('hidden');
  document.getElementById('btnCancelPaste').onclick = () => pasteModal.classList.add('hidden');

  document.getElementById('btnApplyPaste').onclick = () => {
    const text = document.getElementById('pasteTextarea').value;
    if (!text.trim()) return;
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const tab = getActiveTab();
    tab.roster = lines.map((line, idx) => {
      const match = line.match(/^(\d+)[.\s\t]+(.+)$/);
      if (match) {
        return {
          id: `stu_${Date.now()}_${idx}`,
          no: parseInt(match[1], 10),
          name: match[2].trim(),
          assignedDeskId: null
        };
      }
      return {
        id: `stu_${Date.now()}_${idx}`,
        no: idx + 1,
        name: line,
        assignedDeskId: null
      };
    });
    tab.totalCount = tab.roster.length;
    renumberRosterIfNeeded(tab);
    saveState();
    pasteModal.classList.add('hidden');
    document.getElementById('pasteTextarea').value = '';
    renderRoster();
    renderCanvas();
  };

  // 8. 학생 1명 개별 추가
  document.getElementById('btnAddSingleStudent').onclick = () => {
    const tab = getActiveTab();
    const nextNo = tab.roster.length + 1;
    const name = prompt('추가할 학생 이름을 입력하세요:', `학생 ${nextNo}`);
    if (!name) return;
    tab.roster.push({
      id: `stu_${Date.now()}`,
      no: nextNo,
      name: name.trim(),
      assignedDeskId: null
    });
    tab.totalCount = tab.roster.length;
    saveState();
    renderRoster();
  };

  // 9. 명렬 초기화
  document.getElementById('btnResetRoster').onclick = () => {
    if (confirm('현재 명렬표의 모든 학생을 삭제하시겠습니까?')) {
      const tab = getActiveTab();
      tab.roster = [];
      tab.totalCount = 0;
      saveState();
      renderRoster();
      renderCanvas();
    }
  };

  // 10. 상단 툴바 액션
  document.getElementById('btnRandomAssign').onclick = handleRandomShuffle;
  document.getElementById('btnClearDesks').onclick = () => {
    if (confirm('모든 자리를 비우고 기본 구조를 다시 설정하시겠습니까?')) {
      handleClearAllDesks();
      openInitSetupModal(false);
    }
  };

  // 11. A4 가로 인쇄 모달 (표기 양식 4종 & 명렬표 우측 균등 분배)
  const printModal = document.getElementById('printOptionModal');
  document.getElementById('btnPrintModalOpen').onclick = () => {
    printModal.classList.remove('hidden');
  };
  document.getElementById('btnClosePrintModal').onclick = () => {
    printModal.classList.add('hidden');
  };
  document.getElementById('btnCancelPrintModal').onclick = () => {
    printModal.classList.add('hidden');
  };
  document.getElementById('btnExecutePrint').onclick = () => {
    const selectedFormat = document.querySelector('input[name="printDeskFormat"]:checked')?.value || 'name-num-bracket';
    const withRoster = document.getElementById('chkPrintWithRoster').checked;
    const tab = getActiveTab();
    const rosterListContainer = document.getElementById('rosterListContainer');

    // 1. 선택된 학생 표기 양식 data 속성 바인딩
    document.body.dataset.printFormat = selectedFormat;

    // 2. 명렬표 포함 여부 및 우측 1열 전체 행 높이 100% 균등 분배 행 계산
    if (withRoster && tab && tab.roster && tab.roster.length > 0) {
      document.body.classList.remove('print-hide-roster');
      const totalStudents = Math.max(1, tab.roster.length);
      rosterListContainer.style.setProperty('--print-roster-rows', String(totalStudents));
      rosterListContainer.style.gridTemplateRows = `repeat(${totalStudents}, 1fr)`;
    } else {
      document.body.classList.add('print-hide-roster');
      rosterListContainer.style.gridTemplateRows = '';
    }

    printModal.classList.add('hidden');

    // 3. 인쇄 완료 후 인라인 스타일 복원 이벤트 등록
    const handleAfterPrint = () => {
      rosterListContainer.style.gridTemplateRows = '';
      window.removeEventListener('afterprint', handleAfterPrint);
    };
    window.addEventListener('afterprint', handleAfterPrint);

    // 4. 브라우저 인쇄 다이얼로그 호출
    window.print();
  };

  // 12. 개별 책상 수정 모달 이벤트
  document.getElementById('btnCloseDeskModal').onclick = closeDeskEditModal;
  document.getElementById('btnClearDeskItem').onclick = () => {
    if (editingTargetDesk) {
      editingTargetDesk.studentName = '';
      editingTargetDesk.studentNo = '';
      saveState();
      closeDeskEditModal();
      renderCanvas();
      renderRoster();
    }
  };
  document.getElementById('btnSaveDeskItem').onclick = () => {
    if (editingTargetDesk) {
      editingTargetDesk.studentNo = document.getElementById('editDeskNo').value.trim();
      editingTargetDesk.studentName = document.getElementById('editDeskName').value.trim();
      saveState();
      closeDeskEditModal();
      renderCanvas();
      renderRoster();
    }
  };
}

window.addEventListener('DOMContentLoaded', () => {
  loadState();
  initEventListeners();
  if (!appState.rosterOpen) {
    document.getElementById('rosterSidebar').classList.add('collapsed');
  } else {
    document.getElementById('rosterSidebar').classList.remove('collapsed');
  }
  renderAll();
});
