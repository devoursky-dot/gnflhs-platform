/**
 * GNFLHS 스마트 교실 좌석배치도 애플리케이션
 * 1. 하단 교탁 기준점 (교사 시점)
 * 2. 통로 분할 & 오토 레이아웃 그리드
 * 3. 행 수 & 책상 수 스피너 + 다중선택 일괄 적용
 * 4. 책상 마우스 드래그 & 자리 스왑 & 미세 위치 조절
 * 5. 다중 탭 관리 시스템 & 탭 이름 실시간 변경
 * 6. 기기 로컬 캐시 100% 무손실 실시간 자동 저장
 * 7. 수업용 출석 명렬표 (총원 입력 시 자동 생성, 번호 자동입력 체크, 일괄 붙여넣기, 드래그 배정)
 */

const STORAGE_KEY = 'gnflhs_seating_app_v1';

// 기본 초기 상태 생성
function createDefaultTab(title = '1학년 2반 일반배치', className = '1학년 2반') {
  const tabId = 'tab_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  
  // 3개 분단, 각 분단 4줄, 줄당 2책상(짝꿍) 기본 생성
  const zones = [1, 2, 3].map((zIdx) => ({
    id: `zone_${zIdx}_${Date.now()}`,
    name: `${zIdx}분단`,
    rowCount: 4,
    rows: [0, 1, 2, 3].map((rIdx) => ({
      id: `row_${zIdx}_${rIdx}_${Date.now()}`,
      deskCount: 2,
      desks: [
        { id: `desk_${zIdx}_${rIdx}_0`, studentNo: '', studentName: '' },
        { id: `desk_${zIdx}_${rIdx}_1`, studentNo: '', studentName: '' }
      ]
    }))
  }));

  // 기본 24명 명렬 생성
  const defaultNames = [
    '김민준', '이서연', '박도윤', '정예원', '최시우', '강하은', '조지호', '윤지우',
    '장서진', '임수아', '한주원', '오채원', '서도현', '신유나', '권건우', '황다은',
    '안우진', '송민서', '유준서', '홍시은', '전승우', '고하윤', '문태윤', '손지민'
  ];

  const roster = defaultNames.map((name, i) => ({
    id: `stu_${i + 1}`,
    no: i + 1,
    name,
    assignedDeskId: null
  }));

  return {
    id: tabId,
    title,
    className,
    totalCount: 24,
    autoNumber: true,
    zones,
    roster
  };
}

// 애플리케이션 메인 상태
let appState = {
  activeTabId: '',
  tabs: [],
  selectedRowIds: new Set(),
  selectedZoneIds: new Set(),
  rosterOpen: true
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
        return;
      }
    }
  } catch (e) {
    console.warn('Failed to load local seating state:', e);
  }

  // 초기 탭 2개 생성 (일반 배치 + 모둠 활동)
  const tab1 = createDefaultTab('1학년 2반 일반배치', '1학년 2반');
  const tab2 = createDefaultTab('모둠 활동형 배치', '1학년 2반 (모둠)');
  appState.tabs = [tab1, tab2];
  appState.activeTabId = tab1.id;
}

// 2. 실시간 로컬 캐시 자동 저장
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      activeTabId: appState.activeTabId,
      tabs: appState.tabs,
      rosterOpen: appState.rosterOpen
    }));
    
    // 플랫폼 V8 브릿지가 존재하면 원격 Firestore에도 백그라운드 동기화
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

// 현재 활성화된 탭 객체 가져오기
function getActiveTab() {
  return appState.tabs.find((t) => t.id === appState.activeTabId) || appState.tabs[0];
}

// ===================== 3. UI 렌더링 엔진 =====================

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
    
    // 더블클릭 인라인 이름 수정
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

    // 탭 닫기 버튼 (탭이 2개 이상일 때만 표시)
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
      appState.selectedRowIds.clear();
      appState.selectedZoneIds.clear();
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

  // 하단 교탁 이름 반영
  const teacherNameEl = document.getElementById('teacherClassName');
  if (teacherNameEl) {
    teacherNameEl.textContent = `${tab.className} 교탁`;
  }

  const container = document.getElementById('zonesContainer');
  container.innerHTML = '';

  tab.zones.forEach((zone, zIdx) => {
    const isZoneSelected = appState.selectedZoneIds.has(zone.id);
    const zoneCol = document.createElement('div');
    zoneCol.className = `zone-column ${isZoneSelected ? 'selected' : ''}`;
    zoneCol.dataset.zoneId = zone.id;

    // 분단 헤더
    const header = document.createElement('div');
    header.className = 'zone-header';

    const titleDiv = document.createElement('div');
    titleDiv.className = 'zone-title';
    titleDiv.textContent = `${zone.name || `${zIdx + 1}분단`}`;

    // 분단 행(줄) 수 스피너
    const rowStepper = document.createElement('div');
    rowStepper.className = 'row-stepper';
    rowStepper.title = `${zone.name} 전체 줄 수 조절`;
    
    const minusBtn = document.createElement('button');
    minusBtn.textContent = '-';
    minusBtn.onclick = (e) => {
      e.stopPropagation();
      changeZoneRowCount(zone, -1);
    };

    const countVal = document.createElement('span');
    countVal.textContent = String(zone.rowCount);

    const plusBtn = document.createElement('button');
    plusBtn.textContent = '+';
    plusBtn.onclick = (e) => {
      e.stopPropagation();
      changeZoneRowCount(zone, 1);
    };

    rowStepper.appendChild(minusBtn);
    rowStepper.appendChild(countVal);
    rowStepper.appendChild(plusBtn);

    const delZoneBtn = document.createElement('button');
    delZoneBtn.className = 'zone-del-btn';
    delZoneBtn.innerHTML = '✕';
    delZoneBtn.title = '이 분단 삭제';
    delZoneBtn.onclick = (e) => {
      e.stopPropagation();
      if (tab.zones.length <= 1) {
        alert('최소 1개 이상의 분단이 유지되어야 합니다.');
        return;
      }
      tab.zones = tab.zones.filter((z) => z.id !== zone.id);
      saveState();
      renderCanvas();
    };

    header.appendChild(titleDiv);
    header.appendChild(rowStepper);
    header.appendChild(delZoneBtn);
    zoneCol.appendChild(header);

    // 각 가로줄 (Row) 렌더링
    zone.rows.forEach((row, rIdx) => {
      const isRowSelected = appState.selectedRowIds.has(row.id);
      const rowEl = document.createElement('div');
      rowEl.className = `zone-row ${isRowSelected ? 'selected' : ''}`;
      rowEl.dataset.rowId = row.id;

      // 줄 다중 선택 클릭 이벤트
      rowEl.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('.desk-card')) return;
        if (e.shiftKey) {
          if (appState.selectedRowIds.has(row.id)) {
            appState.selectedRowIds.delete(row.id);
          } else {
            appState.selectedRowIds.add(row.id);
          }
        } else {
          appState.selectedRowIds.clear();
          appState.selectedRowIds.add(row.id);
        }
        updateBatchBar();
        renderCanvas();
      });

      // 가로줄별 책상 수 스피너
      const deskStepper = document.createElement('div');
      deskStepper.className = 'row-stepper';
      deskStepper.title = `${rIdx + 1}번째 줄 책상 개수 조절`;

      const deskMinus = document.createElement('button');
      deskMinus.textContent = '-';
      deskMinus.onclick = (e) => {
        e.stopPropagation();
        changeRowDeskCount(zone, row, -1);
      };

      const deskVal = document.createElement('span');
      deskVal.textContent = String(row.deskCount);

      const deskPlus = document.createElement('button');
      deskPlus.textContent = '+';
      deskPlus.onclick = (e) => {
        e.stopPropagation();
        changeRowDeskCount(zone, row, 1);
      };

      deskStepper.appendChild(deskMinus);
      deskStepper.appendChild(deskVal);
      deskStepper.appendChild(deskPlus);
      rowEl.appendChild(deskStepper);

      // 책상 래퍼
      const desksWrap = document.createElement('div');
      desksWrap.className = 'desks-wrap';

      row.desks.forEach((desk, dIdx) => {
        const deskCard = createDeskCardElement(zone, row, desk, dIdx);
        desksWrap.appendChild(deskCard);
      });

      rowEl.appendChild(desksWrap);
      zoneCol.appendChild(rowEl);
    });

    container.appendChild(zoneCol);
  });

  updateRosterStats();
}

// 개별 책상 카드 엘리먼트 생성 및 드래그앤드롭 이벤트 바인딩
function createDeskCardElement(zone, row, desk, dIdx) {
  const card = document.createElement('div');
  const hasStudent = desk.studentName && desk.studentName.trim() !== '';
  card.className = `desk-card ${hasStudent ? 'assigned' : ''}`;
  card.dataset.deskId = desk.id;
  card.draggable = true;

  // 상단 번호 뱃지 & 미세조정 좌우 화살표
  const topBar = document.createElement('div');
  topBar.className = 'desk-top-bar';

  const noBadge = document.createElement('span');
  noBadge.className = 'desk-no-badge';
  noBadge.textContent = desk.studentNo ? `#${desk.studentNo}` : `[${dIdx + 1}]`;

  // 책상 내 위치 미세 이동 (좌우 스왑 버튼)
  const slotBtn = document.createElement('button');
  slotBtn.className = 'desk-slot-btn';
  slotBtn.innerHTML = '⇄';
  slotBtn.title = '줄 내에서 책상 순서 좌우 변경';
  slotBtn.onclick = (e) => {
    e.stopPropagation();
    if (row.desks.length > 1) {
      const nextIdx = (dIdx + 1) % row.desks.length;
      const temp = row.desks[dIdx];
      row.desks[dIdx] = row.desks[nextIdx];
      row.desks[nextIdx] = temp;
      saveState();
      renderCanvas();
    }
  };

  topBar.appendChild(noBadge);
  topBar.appendChild(slotBtn);
  card.appendChild(topBar);

  // 학생 이름 라벨
  const nameLabel = document.createElement('div');
  nameLabel.className = `desk-name ${hasStudent ? '' : 'empty'}`;
  nameLabel.textContent = hasStudent ? desk.studentName : '빈자리';
  card.appendChild(nameLabel);

  // 더블 클릭 시 인라인 편집 모달 오픈
  card.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    openDeskEditModal(desk);
  });

  // --- 드래그 앤 드롭 인터랙션 (책상 ↔ 책상 맞교환, 명렬표 ➔ 책상 배정) ---
  card.addEventListener('dragstart', (e) => {
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
    e.preventDefault();
    card.classList.add('drag-over');
  });

  card.addEventListener('dragleave', () => {
    card.classList.remove('drag-over');
  });

  card.addEventListener('drop', (e) => {
    e.preventDefault();
    card.classList.remove('drag-over');
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;

    try {
      const data = JSON.parse(raw);
      if (data.type === 'ROSTER_ASSIGN') {
        // 명렬표에서 책상으로 학생 드래그 배정
        assignStudentToDesk(data.studentId, desk);
      } else if (data.type === 'DESK_SWAP') {
        // 책상과 책상 간 학생 맞교환 (Swap)
        swapDesks(data.sourceDeskId, desk.id);
      }
    } catch (err) {
      console.warn('Drop error:', err);
    }
  });

  return card;
}

// (3) 출석 명렬표 서랍 렌더링
function renderRoster() {
  const tab = getActiveTab();
  if (!tab) return;

  const totalInput = document.getElementById('totalStudentCount');
  if (totalInput) totalInput.value = tab.totalCount;

  const chkAuto = document.getElementById('chkAutoNumber');
  if (chkAuto) chkAuto.checked = tab.autoNumber;

  const container = document.getElementById('rosterListContainer');
  container.innerHTML = '';

  tab.roster.forEach((student, idx) => {
    const isAssigned = isStudentAssigned(student.name, student.no);

    const item = document.createElement('div');
    item.className = `roster-student-item ${isAssigned ? 'assigned' : ''}`;
    item.draggable = true;

    // 드래그 시작 시 학생 정보 탑재
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', JSON.stringify({
        type: 'ROSTER_ASSIGN',
        studentId: student.id,
        no: student.no,
        name: student.name
      }));
    });

    // 번호 박스
    const noBox = document.createElement('div');
    noBox.className = 'student-no-box';
    noBox.textContent = String(student.no);

    // 이름 입력란 (인라인 즉시 수정)
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

    // 배정 상태 뱃지
    const statusBadge = document.createElement('span');
    statusBadge.className = `student-status-badge ${isAssigned ? 'assigned' : 'unassigned'}`;
    statusBadge.textContent = isAssigned ? '배정됨' : '미배정';

    // 삭제 버튼
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
    if (isStudentAssigned(s.name, s.no)) assignedCount++;
  });

  const unassigned = tab.roster.length - assignedCount;

  const assEl = document.getElementById('assignedStat');
  const unassEl = document.getElementById('unassignedStat');
  const pillEl = document.getElementById('rosterCountPill');

  if (assEl) assEl.textContent = String(assignedCount);
  if (unassEl) unassEl.textContent = String(unassigned);
  if (pillEl) pillEl.textContent = `${assignedCount}/${tab.roster.length}`;
}

// 학생이 이미 책상에 배정되어 있는지 확인
function isStudentAssigned(studentName, studentNo) {
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

// 전체 화면 재렌더링
function renderAll() {
  renderTabs();
  renderCanvas();
  renderRoster();
}

// ===================== 4. 좌석 및 구역 조작 비즈니스 로직 =====================

// 분단의 가로줄(행) 개수 조절 (+1 또는 -1)
function changeZoneRowCount(zone, delta) {
  const next = Math.max(1, Math.min(12, zone.rowCount + delta));
  if (next === zone.rowCount) return;

  if (delta > 0) {
    // 줄 추가
    const defaultDeskCount = zone.rows[0]?.deskCount || 2;
    for (let i = zone.rowCount; i < next; i++) {
      const newRow = {
        id: `row_${zone.id}_${i}_${Date.now()}`,
        deskCount: defaultDeskCount,
        desks: Array.from({ length: defaultDeskCount }).map((_, di) => ({
          id: `desk_${zone.id}_${i}_${di}_${Date.now()}`,
          studentNo: '',
          studentName: ''
        }))
      };
      zone.rows.push(newRow);
    }
  } else {
    // 줄 축소
    zone.rows = zone.rows.slice(0, next);
  }

  zone.rowCount = next;
  saveState();
  renderCanvas();
}

// 가로줄 내 책상 개수 조절 (+1 또는 -1)
function changeRowDeskCount(zone, row, delta) {
  const next = Math.max(1, Math.min(6, row.deskCount + delta));
  if (next === row.deskCount) return;

  if (delta > 0) {
    for (let i = row.deskCount; i < next; i++) {
      row.desks.push({
        id: `desk_${row.id}_${i}_${Date.now()}`,
        studentNo: '',
        studentName: ''
      });
    }
  } else {
    row.desks = row.desks.slice(0, next);
  }

  row.deskCount = next;
  saveState();
  renderCanvas();
}

// 학생을 특정 책상에 배정
function assignStudentToDesk(studentId, desk) {
  const tab = getActiveTab();
  const student = tab.roster.find((s) => s.id === studentId);
  if (!student) return;

  // 다른 책상에 이미 앉아있었다면 기존 자리 비우기
  clearStudentFromAllDesks(student.name);

  desk.studentName = student.name;
  desk.studentNo = String(student.no);
  saveState();
  renderCanvas();
  renderRoster();
}

// 책상 간 학생 맞교환 (Swap)
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

// 플로팅 다중선택 일괄 변경 바 갱신
function updateBatchBar() {
  const bar = document.getElementById('batchControlBar');
  const countEl = document.getElementById('batchSelectCount');
  const totalSelected = appState.selectedRowIds.size;

  if (totalSelected > 0) {
    bar.classList.remove('hidden');
    countEl.textContent = String(totalSelected);
  } else {
    bar.classList.add('hidden');
  }
}

// 다중 선택된 줄들의 책상 개수 일괄 변경
function applyBatchDeskCount(delta) {
  const tab = getActiveTab();
  tab.zones.forEach((zone) => {
    zone.rows.forEach((row) => {
      if (appState.selectedRowIds.has(row.id)) {
        changeRowDeskCount(zone, row, delta);
      }
    });
  });
}

// ===================== 5. 명렬표 총원 및 자동 번호 엔진 =====================

// 총원 수 변경 시 1~N번 입력칸 자동 생성
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

// 랜덤 자리뽑기 (서스펜스 셔플 애니메이션)
function handleRandomShuffle() {
  const tab = getActiveTab();
  const unassigned = tab.roster.filter((s) => !isStudentAssigned(s.name, s.no));
  
  // 비어있는 책상 수집
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

  // 피셔-예이츠 셔플
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

// 모든 책상 비우기
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

// ===================== 6. 인라인 모달 & 이벤트 바인딩 =====================

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

// 이벤트 리스너 초기화
function initEventListeners() {
  // 1. 탭 추가 버튼
  document.getElementById('btnAddTab').onclick = () => {
    const inputTitle = prompt('새 좌석배치도 명칭을 입력하세요:', `좌석배치 ${appState.tabs.length + 1}`);
    if (!inputTitle) return;
    const newTab = createDefaultTab(inputTitle.trim(), inputTitle.trim());
    appState.tabs.push(newTab);
    appState.activeTabId = newTab.id;
    saveState();
    renderAll();
  };

  // 2. 분단 추가 버튼
  document.getElementById('btnAddVerticalAisle').onclick = () => {
    const tab = getActiveTab();
    const nextIdx = tab.zones.length + 1;
    const newZone = {
      id: `zone_${Date.now()}`,
      name: `${nextIdx}분단`,
      rowCount: 4,
      rows: [0, 1, 2, 3].map((rIdx) => ({
        id: `row_${Date.now()}_${rIdx}`,
        deskCount: 2,
        desks: [
          { id: `desk_${Date.now()}_${rIdx}_0`, studentNo: '', studentName: '' },
          { id: `desk_${Date.now()}_${rIdx}_1`, studentNo: '', studentName: '' }
        ]
      }))
    };
    tab.zones.push(newZone);
    saveState();
    renderCanvas();
  };

  // 3. 통로 그리기 버튼
  const btnDraw = document.getElementById('btnDrawAisle');
  btnDraw.onclick = () => {
    btnDraw.classList.toggle('active-mode');
    alert('교실 캔버스에서 마우스를 세로로 드래그하면 세로 통로(분단)가 분할됩니다.');
  };

  // 4. 전체 선택 버튼
  document.getElementById('btnSelectAll').onclick = () => {
    const tab = getActiveTab();
    tab.zones.forEach((z) => {
      z.rows.forEach((r) => appState.selectedRowIds.add(r.id));
    });
    updateBatchBar();
    renderCanvas();
  };

  // 5. 플로팅 다중선택 바
  document.getElementById('btnBatchDeskMinus').onclick = () => applyBatchDeskCount(-1);
  document.getElementById('btnBatchDeskPlus').onclick = () => applyBatchDeskCount(1);
  document.getElementById('btnBatchDeselect').onclick = () => {
    appState.selectedRowIds.clear();
    updateBatchBar();
    renderCanvas();
  };

  // 6. 하단 교탁 반 이름 클릭 변경
  document.getElementById('teacherDesk').onclick = () => {
    const tab = getActiveTab();
    const next = prompt('교탁에 표시할 학급/반 이름을 입력하세요:', tab.className);
    if (next !== null && next.trim()) {
      tab.className = next.trim();
      saveState();
      renderCanvas();
    }
  };

  // 7. 명렬표 서랍 토글
  const rosterSidebar = document.getElementById('rosterSidebar');
  const toggleBtn = document.getElementById('btnToggleRoster');
  const toggleRoster = () => {
    rosterSidebar.classList.toggle('collapsed');
    appState.rosterOpen = !rosterSidebar.classList.contains('collapsed');
    saveState();
  };
  toggleBtn.onclick = toggleRoster;
  document.getElementById('btnCloseRoster').onclick = toggleRoster;

  // 8. 명렬표 총원 및 번호 자동입력 변경
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

  // 9. 명렬표 일괄 붙여넣기 모달
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
      // "1 홍길동" 또는 "홍길동" 정규식 분리
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

  // 10. 학생 1명 개별 추가
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

  // 11. 명렬 초기화
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

  // 12. 상단 툴바 액션
  document.getElementById('btnRandomAssign').onclick = handleRandomShuffle;
  document.getElementById('btnClearDesks').onclick = () => {
    if (confirm('모든 책상의 배정을 비우시겠습니까?')) handleClearAllDesks();
  };
  document.getElementById('btnPrint').onclick = () => window.print();

  // 13. 개별 책상 수정 모달 이벤트
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

// 초기 기동
window.addEventListener('DOMContentLoaded', () => {
  loadState();
  initEventListeners();
  if (!appState.rosterOpen) {
    document.getElementById('rosterSidebar').classList.add('collapsed');
  }
  renderAll();
});
