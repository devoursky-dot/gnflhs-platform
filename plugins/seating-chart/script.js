/**
 * GNFLHS 스마트 교실 좌석배치도 애플리케이션
 * 1. 하단 교탁 기준점 (교사 시점)
 * 2. 처음 만들 때 1회 팝업으로 기본 구조(분단수/줄수/책상수) 설정
 * 3. 가장 많은 책상을 기준으로 분단 폭 자동 조정
 * 4. 책상 위치 조절: 비어있는 칸 이동 & 두 책상의 중간(센터) 배치
 * 5. 다중 탭 관리 시스템 & 탭 이름 실시간 변경
 * 6. 기기 로컬 캐시 100% 무손실 실시간 자동 저장
 * 7. 수업용 출석 명렬표 (총원 입력 시 자동 생성, 번호 자동입력 체크, 일괄 붙여넣기, 드래그 배정)
 */

const STORAGE_KEY = 'gnflhs_seating_app_v1';

// 기본 탭 구조 생성 (초기 마법사 파라미터 적용)
function createDefaultTab(
  title = '1학년 2반 일반배치',
  className = '1학년 2반',
  zoneCount = 3,
  rowCount = 4,
  deskCount = 2,
  totalStudents = 24
) {
  const tabId = 'tab_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

  const zones = Array.from({ length: zoneCount }).map((_, zIdx) => ({
    id: `zone_${zIdx}_${Date.now()}`,
    name: `${zIdx + 1}분단`,
    rowCount: rowCount,
    rows: Array.from({ length: rowCount }).map((_, rIdx) => ({
      id: `row_${zIdx}_${rIdx}_${Date.now()}`,
      deskCount: deskCount,
      align: 'left', // 'left' | 'center' (중간) | 'right' | 'split'
      desks: Array.from({ length: deskCount }).map((_, dIdx) => ({
        id: `desk_${zIdx}_${rIdx}_${dIdx}_${Date.now()}`,
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
    zones,
    roster
  };
}

let appState = {
  activeTabId: '',
  tabs: [],
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

  // 초기 탭 생성
  const tab1 = createDefaultTab('1학년 2반 일반배치', '1학년 2반', 3, 4, 2, 24);
  const tab2 = createDefaultTab('모둠 활동형 배치', '1학년 2반 (모둠)', 2, 3, 3, 24);
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

  const teacherNameEl = document.getElementById('teacherClassName');
  if (teacherNameEl) {
    teacherNameEl.textContent = `${tab.className} 교탁`;
  }

  const container = document.getElementById('zonesContainer');
  container.innerHTML = '';

  tab.zones.forEach((zone, zIdx) => {
    // 분단 내에서 가장 많은 책상 개수 계산 (분단 폭 결정)
    const maxDesksInZone = Math.max(1, ...zone.rows.map((r) => r.desks.length));

    const zoneCol = document.createElement('div');
    zoneCol.className = 'zone-column';
    zoneCol.dataset.zoneId = zone.id;
    // 가장 많은 책상을 기준으로 분단 폭을 자동 조절 (책상 90px + gap 10px + padding 24px)
    zoneCol.style.minWidth = `${maxDesksInZone * 100 + 14}px`;

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
      const rowEl = document.createElement('div');
      rowEl.className = 'zone-row';
      rowEl.dataset.rowId = row.id;

      // 줄별 책상 수 스피너
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
      deskVal.textContent = String(row.desks.length);

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

      // 위치 조절 정렬 필 (좌측 / 두 책상의 중간 / 우측 / 양끝)
      // 책상이 분단 최대치보다 적을 때 위치를 선택할 수 있게 제공
      if (row.desks.length < maxDesksInZone && row.desks.length > 0) {
        const alignPill = document.createElement('div');
        alignPill.className = 'row-align-pill';
        alignPill.title = '해당 줄 책상 위치 정렬';

        const currentAlign = row.align || 'left';

        const btnLeft = document.createElement('button');
        btnLeft.className = `row-align-btn ${currentAlign === 'left' ? 'active' : ''}`;
        btnLeft.textContent = '좌';
        btnLeft.title = '좌측 정렬';
        btnLeft.onclick = () => {
          row.align = 'left';
          saveState();
          renderCanvas();
        };

        const btnCenter = document.createElement('button');
        btnCenter.className = `row-align-btn ${currentAlign === 'center' ? 'active' : ''}`;
        btnCenter.textContent = '중간';
        btnCenter.title = '두 책상의 중간(정중앙)에 배치';
        btnCenter.onclick = () => {
          row.align = 'center';
          saveState();
          renderCanvas();
        };

        const btnRight = document.createElement('button');
        btnRight.className = `row-align-btn ${currentAlign === 'right' ? 'active' : ''}`;
        btnRight.textContent = '우';
        btnRight.title = '우측 정렬';
        btnRight.onclick = () => {
          row.align = 'right';
          saveState();
          renderCanvas();
        };

        alignPill.appendChild(btnLeft);
        alignPill.appendChild(btnCenter);
        alignPill.appendChild(btnRight);
        rowEl.appendChild(alignPill);
      }

      // 책상 래퍼 (정렬 클래스 결합)
      const desksWrap = document.createElement('div');
      const alignClass = row.align === 'center' ? 'align-center' : row.align === 'right' ? 'align-right' : '';
      desksWrap.className = `desks-wrap ${alignClass}`;

      // 책상 렌더링
      row.desks.forEach((desk, dIdx) => {
        const deskCard = createDeskCardElement(zone, row, desk, dIdx);
        desksWrap.appendChild(deskCard);
      });

      // 만약 분단의 최대 책상보다 줄의 책상이 적고 '좌측 정렬'인 경우, 뒤에 빈 칸(Empty Slot)을 렌더링
      // 책상을 마우스로 빈 칸에 옮겨놓을 수 있는 드롭 타겟 제공
      if (row.align === 'left' && row.desks.length < maxDesksInZone) {
        const emptySlotsCount = maxDesksInZone - row.desks.length;
        for (let s = 0; s < emptySlotsCount; s++) {
          const emptySlot = document.createElement('div');
          emptySlot.className = 'desk-slot-empty';
          emptySlot.textContent = '+ 빈자리';
          emptySlot.title = '책상을 이 빈 칸으로 드래그하여 옮길 수 있습니다';

          // 빈 칸 드래그오버 & 드롭 핸들러
          emptySlot.addEventListener('dragover', (e) => {
            e.preventDefault();
            emptySlot.classList.add('drag-over');
          });
          emptySlot.addEventListener('dragleave', () => {
            emptySlot.classList.remove('drag-over');
          });
          emptySlot.addEventListener('drop', (e) => {
            e.preventDefault();
            emptySlot.classList.remove('drag-over');
            const raw = e.dataTransfer.getData('text/plain');
            if (!raw) return;
            try {
              const data = JSON.parse(raw);
              if (data.type === 'DESK_SWAP') {
                moveDeskToRow(data.sourceDeskId, row);
              } else if (data.type === 'ROSTER_ASSIGN') {
                // 명렬표 학생을 새 책상으로 빈 자리에 추가 배정
                const newDesk = {
                  id: `desk_${row.id}_${Date.now()}`,
                  studentNo: String(data.no),
                  studentName: data.name
                };
                row.desks.push(newDesk);
                row.deskCount = row.desks.length;
                saveState();
                renderCanvas();
                renderRoster();
              }
            } catch (err) {}
          });

          desksWrap.appendChild(emptySlot);
        }
      }

      rowEl.appendChild(desksWrap);
      zoneCol.appendChild(rowEl);
    });

    container.appendChild(zoneCol);
  });

  updateRosterStats();
}

// 개별 책상 카드 엘리먼트 생성
function createDeskCardElement(zone, row, desk, dIdx) {
  const card = document.createElement('div');
  const hasStudent = desk.studentName && desk.studentName.trim() !== '';
  card.className = `desk-card ${hasStudent ? 'assigned' : ''}`;
  card.dataset.deskId = desk.id;
  card.draggable = true;

  const topBar = document.createElement('div');
  topBar.className = 'desk-top-bar';

  const noBadge = document.createElement('span');
  noBadge.className = 'desk-no-badge';
  noBadge.textContent = desk.studentNo ? `#${desk.studentNo}` : `[${dIdx + 1}]`;

  // 줄 내 책상 순서 좌우 변경
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

  const nameLabel = document.createElement('div');
  nameLabel.className = `desk-name ${hasStudent ? '' : 'empty'}`;
  nameLabel.textContent = hasStudent ? desk.studentName : '빈자리';
  card.appendChild(nameLabel);

  card.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    openDeskEditModal(desk);
  });

  // 드래그앤드롭 이벤트
  card.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({
      type: 'DESK_SWAP',
      sourceDeskId: desk.id
    }));
    card.style.opacity = '0.5';
  });

  card.addEventListener('dragend', () => {
    card.style.opacity = '1';
    document.querySelectorAll('.desk-card, .desk-slot-empty').forEach((el) => el.classList.remove('drag-over'));
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
        assignStudentToDesk(data.studentId, desk);
      } else if (data.type === 'DESK_SWAP') {
        swapDesks(data.sourceDeskId, desk.id);
      }
    } catch (err) {}
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

  tab.roster.forEach((student) => {
    const isAssigned = isStudentAssigned(student.name, student.no);

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

// ===================== 4. 좌석 및 구역 조작 비즈니스 로직 =====================

function changeZoneRowCount(zone, delta) {
  const next = Math.max(1, Math.min(12, zone.rowCount + delta));
  if (next === zone.rowCount) return;

  if (delta > 0) {
    const defaultDeskCount = zone.rows[0]?.desks?.length || 2;
    for (let i = zone.rowCount; i < next; i++) {
      const newRow = {
        id: `row_${zone.id}_${i}_${Date.now()}`,
        deskCount: defaultDeskCount,
        align: 'left',
        desks: Array.from({ length: defaultDeskCount }).map((_, di) => ({
          id: `desk_${zone.id}_${i}_${di}_${Date.now()}`,
          studentNo: '',
          studentName: ''
        }))
      };
      zone.rows.push(newRow);
    }
  } else {
    zone.rows = zone.rows.slice(0, next);
  }

  zone.rowCount = next;
  saveState();
  renderCanvas();
}

function changeRowDeskCount(zone, row, delta) {
  const next = Math.max(1, Math.min(6, row.desks.length + delta));
  if (next === row.desks.length) return;

  if (delta > 0) {
    for (let i = row.desks.length; i < next; i++) {
      row.desks.push({
        id: `desk_${row.id}_${i}_${Date.now()}`,
        studentNo: '',
        studentName: ''
      });
    }
  } else {
    row.desks = row.desks.slice(0, next);
  }

  row.deskCount = row.desks.length;
  saveState();
  renderCanvas();
}

// 책상을 특정 줄(row)로 이동 (빈 칸으로 이동)
function moveDeskToRow(sourceDeskId, targetRow) {
  const tab = getActiveTab();
  let foundDesk = null;

  // 원본 책상 찾아서 분리
  for (const z of tab.zones) {
    for (const r of z.rows) {
      const idx = r.desks.findIndex((d) => d.id === sourceDeskId);
      if (idx !== -1) {
        foundDesk = r.desks.splice(idx, 1)[0];
        r.deskCount = r.desks.length;
        break;
      }
    }
  }

  if (foundDesk) {
    targetRow.desks.push(foundDesk);
    targetRow.deskCount = targetRow.desks.length;
    saveState();
    renderCanvas();
  }
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

// ===================== 5. 명렬표 총원 및 자동 번호 엔진 =====================

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
  const unassigned = tab.roster.filter((s) => !isStudentAssigned(s.name, s.no));

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

// ===================== 6. 초기 구조 설정 마법사 모달 =====================

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
  dInput.value = tab.zones[0]?.rows[0]?.desks?.length || 2;
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

  // 새 탭 추가인지 또는 현재 탭 재구성인지 판단
  if (pendingTabTitle && pendingTabTitle !== currentTab.title) {
    appState.tabs.push(newTab);
    appState.activeTabId = newTab.id;
  } else {
    // 현재 탭 덮어쓰기
    const idx = appState.tabs.findIndex((t) => t.id === currentTab.id);
    newTab.id = currentTab.id;
    newTab.title = currentTab.title;
    newTab.className = currentTab.className;
    appState.tabs[idx] = newTab;
  }

  saveState();
  document.getElementById('initSetupModal').classList.add('hidden');
  pendingTabTitle = '';
  renderAll();
}

// ===================== 7. 개별 책상 수정 모달 =====================

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

// ===================== 8. 이벤트 리스너 바인딩 =====================

function initEventListeners() {
  // 1. 탭 추가 버튼 ➔ 초기 마법사 팝업 바로 띄움
  document.getElementById('btnAddTab').onclick = () => {
    openInitSetupModal(true);
  };

  // 2. 툴바 [기본구조 설정] 버튼 ➔ 초기 마법사 팝업 다시 띄움
  document.getElementById('btnReconfigLayout').onclick = () => {
    openInitSetupModal(false);
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
    const defaultDeskCount = tab.zones[0]?.rows[0]?.desks?.length || 2;

    const newZone = {
      id: `zone_${Date.now()}`,
      name: `${nextIdx}분단`,
      rowCount: defaultRowCount,
      rows: Array.from({ length: defaultRowCount }).map((_, rIdx) => ({
        id: `row_${Date.now()}_${rIdx}`,
        deskCount: defaultDeskCount,
        align: 'left',
        desks: Array.from({ length: defaultDeskCount }).map((_, di) => ({
          id: `desk_${Date.now()}_${rIdx}_${di}`,
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

  // 5. 명렬표 서랍 토글
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
    if (confirm('모든 책상의 배정을 비우시겠습니까?')) handleClearAllDesks();
  };
  document.getElementById('btnPrint').onclick = () => window.print();

  // 11. 개별 책상 수정 모달 이벤트
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
  }
  renderAll();
});
