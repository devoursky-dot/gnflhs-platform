/**
 * GNFLHS 스마트 교실 좌석배치도 애플리케이션 (v1.3.0 멀티모듈 아키텍처)
 * - ./config.js      : env.json 선언형 환경변수 로드 및 상·하한 방어 클램핑
 * - ./geometry.js    : 반 칸(0.5칸) 이동 및 1칸 공간 검증 엔진
 * - ./state.js       : 로컬/클라우드 상태 영속화 및 명렬표/분단 도메인 로직
 * - ./printEngine.js : A4 가로 1페이지 맞춤 인쇄 & 이름 자동 폭 조절(폰트축소/장평압축) 엔진
 * - ./script.js      : DOM 렌더링 및 사용자 인터랙션 컨트롤러
 */

import { SEATING_CONFIG } from './config.js';
import { findAvailableSlotForNewDesk, tryShiftDeskPosition } from './geometry.js';
import {
  appState,
  createZoneObject,
  createDefaultTab,
  loadState,
  saveState,
  getActiveTab,
  isStudentAssigned,
  assignStudentToDesk,
  swapDesks,
  renumberRosterIfNeeded,
  applyTotalStudentCount,
  clearAllDesksInTab,
  updateZoneRowCount,
  updateZoneMaxDesks,
  parseBatchRosterLines
} from './state.js';
import { executeSeatingPrint } from './printEngine.js';

function pulseSaveBadge() {
  const badge = document.getElementById('saveStatusBadge');
  if (badge) {
    badge.style.opacity = '1';
    setTimeout(() => {
      badge.style.opacity = '0.85';
    }, 1000);
  }
}

function persistState() {
  saveState(pulseSaveBadge);
}

// ===================== 1. UI 렌더링 엔진 =====================

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
        persistState();
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
          persistState();
          renderAll();
        }
      });
      tabEl.appendChild(closeBtn);
    }

    tabEl.addEventListener('click', () => {
      appState.activeTabId = tab.id;
      persistState();
      renderAll();
    });

    container.appendChild(tabEl);
  });
}

function renderCanvas() {
  const tab = getActiveTab();
  if (!tab) return;

  if (appState.isEditMode) {
    document.body.classList.add('edit-mode');
    document.getElementById('editModeLabel').textContent = '좌석 위치 마감 (완료)';
  } else {
    document.body.classList.remove('edit-mode');
    document.getElementById('editModeLabel').textContent = '좌석 조절 모드';
  }

  const teacherNameEl = document.getElementById('teacherClassName');
  if (teacherNameEl) {
    const baseClass = (tab.className || SEATING_CONFIG.defaultClassName)
      .replace(/\s*교탁\s*$/, '')
      .trim();
    teacherNameEl.textContent = `${baseClass || SEATING_CONFIG.defaultClassName} 교탁`;
  }

  const container = document.getElementById('zonesContainer');
  container.innerHTML = '';

  tab.zones.forEach((zone, zIdx) => {
    const maxDesks = zone.maxDesks || SEATING_CONFIG.defaultMaxDesks;
    const trackWidth = maxDesks * SEATING_CONFIG.deskWidthPx;

    const zoneCol = document.createElement('div');
    zoneCol.className = 'zone-column';
    zoneCol.dataset.zoneId = zone.id;
    zoneCol.style.minWidth = `${trackWidth + SEATING_CONFIG.zoneTrackPaddingPx}px`;

    const header = document.createElement('div');
    header.className = 'zone-header';

    const titleDiv = document.createElement('div');
    titleDiv.className = 'zone-title';
    titleDiv.textContent = `${zone.name || `${zIdx + 1}분단`}`;
    header.appendChild(titleDiv);

    const steppersWrap = document.createElement('div');
    steppersWrap.className = 'zone-header-steppers edit-only';

    const rowStepper = document.createElement('div');
    rowStepper.className = 'header-stepper-item';
    rowStepper.title = '이 분단의 가로줄 수 조절';
    rowStepper.innerHTML = `
      <span class="lbl">줄수:</span>
      <button class="btn-minus">-</button>
      <span class="val">${zone.rowCount}</span>
      <button class="btn-plus">+</button>
    `;
    rowStepper.querySelector('.btn-minus').onclick = () => {
      if (updateZoneRowCount(zone, -1)) {
        persistState();
        renderCanvas();
      }
    };
    rowStepper.querySelector('.btn-plus').onclick = () => {
      if (updateZoneRowCount(zone, 1)) {
        persistState();
        renderCanvas();
      }
    };
    steppersWrap.appendChild(rowStepper);

    const maxDeskStepper = document.createElement('div');
    maxDeskStepper.className = 'header-stepper-item';
    maxDeskStepper.title = '이 분단의 최대 책상 수 조절 (분단 폭 결정)';
    maxDeskStepper.innerHTML = `
      <span class="lbl">최대책상:</span>
      <button class="btn-minus">-</button>
      <span class="val">${maxDesks}</span>
      <button class="btn-plus">+</button>
    `;
    maxDeskStepper.querySelector('.btn-minus').onclick = () => {
      if (updateZoneMaxDesks(zone, -1)) {
        persistState();
        renderCanvas();
      }
    };
    maxDeskStepper.querySelector('.btn-plus').onclick = () => {
      if (updateZoneMaxDesks(zone, 1)) {
        persistState();
        renderCanvas();
      }
    };
    steppersWrap.appendChild(maxDeskStepper);

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
      persistState();
      renderCanvas();
    };
    steppersWrap.appendChild(delZoneBtn);

    header.appendChild(steppersWrap);
    zoneCol.appendChild(header);

    zone.rows.forEach((row) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'zone-row';
      rowEl.dataset.rowId = row.id;

      const desksTrack = document.createElement('div');
      desksTrack.className = 'desks-track';
      desksTrack.style.width = `${trackWidth}px`;

      row.desks.forEach((desk) => {
        const deskCard = createDeskCardElement(row, desk, maxDesks);
        desksTrack.appendChild(deskCard);
      });

      rowEl.appendChild(desksTrack);

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
            persistState();
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

function createDeskCardElement(row, desk, maxDesks) {
  const card = document.createElement('div');
  const hasStudent = desk.studentName && desk.studentName.trim() !== '';
  card.className = `desk-card ${hasStudent ? 'assigned' : ''}`;
  card.dataset.deskId = desk.id;
  card.draggable = !appState.isEditMode;

  const leftPx = (desk.pos || 0) * SEATING_CONFIG.deskWidthPx;
  card.style.left = `${leftPx}px`;

  const topBar = document.createElement('div');
  topBar.className = 'desk-top-bar';

  const noBadge = document.createElement('span');
  noBadge.className = 'desk-no-badge';
  noBadge.textContent = desk.studentNo ? `#${desk.studentNo}` : '석';
  topBar.appendChild(noBadge);

  if (appState.isEditMode) {
    const delBtn = document.createElement('button');
    delBtn.className = 'desk-del-btn edit-only';
    delBtn.innerHTML = '✕';
    delBtn.title = '이 책상 삭제 (공간 확보)';
    delBtn.onclick = (e) => {
      e.stopPropagation();
      row.desks = row.desks.filter((d) => d.id !== desk.id);
      persistState();
      renderCanvas();
    };
    topBar.appendChild(delBtn);
  }

  card.appendChild(topBar);

  const nameLabel = document.createElement('div');
  nameLabel.className = `desk-name ${hasStudent ? '' : 'empty'}`;
  nameLabel.textContent = hasStudent ? desk.studentName : '빈자리';
  card.appendChild(nameLabel);

  // 인쇄 전용 뷰 컨테이너 (4종 표기 포맷)
  const printView = document.createElement('div');
  printView.className = 'desk-print-view';

  const pNum = desk.studentNo ? String(desk.studentNo) : '';
  const pName = hasStudent ? desk.studentName : '';

  const pBracket = document.createElement('div');
  pBracket.className = 'dp-item dp-format-bracket';
  if (hasStudent) {
    pBracket.innerHTML = pNum
      ? `<span class="dp-main">${pName}</span><span class="dp-sub">(${pNum})</span>`
      : `<span class="dp-main">${pName}</span>`;
  }

  const pNumName = document.createElement('div');
  pNumName.className = 'dp-item dp-format-num-name';
  if (hasStudent) {
    pNumName.innerHTML = pNum
      ? `<span class="dp-sub">${pNum}</span> <span class="dp-main">${pName}</span>`
      : `<span class="dp-main">${pName}</span>`;
  }

  const pTopNumBotName = document.createElement('div');
  pTopNumBotName.className = 'dp-item dp-format-top-num-bot-name';
  if (hasStudent) {
    pTopNumBotName.innerHTML = pNum
      ? `<span class="dp-sub">${pNum}</span><span class="dp-main">${pName}</span>`
      : `<span class="dp-main">${pName}</span>`;
  }

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

  if (appState.isEditMode) {
    const step = SEATING_CONFIG.deskShiftStep;
    const shiftBar = document.createElement('div');
    shiftBar.className = 'desk-shift-bar edit-only';

    const btnLeft = document.createElement('button');
    btnLeft.className = 'shift-btn';
    btnLeft.innerHTML = `◀ ${step}`;
    btnLeft.title = `왼쪽으로 반 칸(${step}칸) 이동`;
    btnLeft.onclick = (e) => {
      e.stopPropagation();
      if (tryShiftDeskPosition(row, desk, -step, maxDesks)) {
        persistState();
        renderCanvas();
      }
    };

    const btnRight = document.createElement('button');
    btnRight.className = 'shift-btn';
    btnRight.innerHTML = `${step} ▶`;
    btnRight.title = `오른쪽으로 반 칸(${step}칸) 이동`;
    btnRight.onclick = (e) => {
      e.stopPropagation();
      if (tryShiftDeskPosition(row, desk, step, maxDesks)) {
        persistState();
        renderCanvas();
      }
    };

    shiftBar.appendChild(btnLeft);
    shiftBar.appendChild(btnRight);
    card.appendChild(shiftBar);
  }

  card.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    openDeskEditModal(desk);
  });

  card.addEventListener('dragstart', (e) => {
    if (appState.isEditMode) return;
    e.dataTransfer.setData(
      'text/plain',
      JSON.stringify({
        type: 'DESK_SWAP',
        sourceDeskId: desk.id
      })
    );
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
        if (assignStudentToDesk(data.studentId, desk)) {
          persistState();
          renderCanvas();
          renderRoster();
        }
      } else if (data.type === 'DESK_SWAP') {
        if (swapDesks(data.sourceDeskId, desk.id)) {
          persistState();
          renderCanvas();
        }
      }
    } catch {}
  });

  return card;
}

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
      e.dataTransfer.setData(
        'text/plain',
        JSON.stringify({
          type: 'ROSTER_ASSIGN',
          studentId: student.id,
          no: student.no,
          name: student.name
        })
      );
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
      persistState();
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
      persistState();
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

function renderAll() {
  renderTabs();
  renderCanvas();
  renderRoster();
}

// ===================== 2. 추첨 · 초기화 · 모달 제어 =====================

function handleClearAllDesks() {
  const tab = getActiveTab();
  clearAllDesksInTab(tab);
  persistState();
  renderCanvas();
  renderRoster();
}

function handleRandomShuffle() {
  const tab = getActiveTab();
  if (!tab) return;
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

  persistState();
  renderCanvas();
  renderRoster();
}

let pendingTabTitle = '';

function openInitSetupModal(isNewTab = false) {
  const tab = getActiveTab();
  pendingTabTitle = isNewTab ? `좌석배치 ${appState.tabs.length + 1}` : tab.title;

  const modal = document.getElementById('initSetupModal');
  document.getElementById('initZoneCount').value = tab.zones.length || SEATING_CONFIG.defaultZones;
  document.getElementById('initRowCount').value =
    tab.zones[0]?.rows?.length || SEATING_CONFIG.defaultRows;
  document.getElementById('initDeskCount').value =
    tab.zones[0]?.maxDesks || SEATING_CONFIG.defaultMaxDesks;
  document.getElementById('initTotalStudent').value =
    tab.totalCount || SEATING_CONFIG.defaultStudents;

  modal.classList.remove('hidden');
}

function applyInitSetupModal() {
  const zCount =
    parseInt(document.getElementById('initZoneCount').value, 10) || SEATING_CONFIG.defaultZones;
  const rCount =
    parseInt(document.getElementById('initRowCount').value, 10) || SEATING_CONFIG.defaultRows;
  const dCount =
    parseInt(document.getElementById('initDeskCount').value, 10) || SEATING_CONFIG.defaultMaxDesks;
  const tCount =
    parseInt(document.getElementById('initTotalStudent').value, 10) ||
    SEATING_CONFIG.defaultStudents;

  const currentTab = getActiveTab();
  const title = pendingTabTitle || currentTab.title;
  const className = currentTab.className || SEATING_CONFIG.defaultClassName;

  const newTab = createDefaultTab(title, className, zCount, rCount, dCount, tCount);
  newTab.isEditMode = true;

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
  persistState();
  document.getElementById('initSetupModal').classList.add('hidden');
  pendingTabTitle = '';
  renderAll();
}

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

// ===================== 3. 이벤트 리스너 바인딩 =====================

function initEventListeners() {
  document.getElementById('btnAddTab').onclick = () => {
    openInitSetupModal(true);
  };

  const btnToggleEdit = document.getElementById('btnToggleEditMode');
  const btnFinish = document.getElementById('btnFinishLayout');

  btnToggleEdit.onclick = () => {
    appState.isEditMode = !appState.isEditMode;
    persistState();
    renderCanvas();
  };
  btnFinish.onclick = () => {
    appState.isEditMode = false;
    persistState();
    renderCanvas();
  };

  document.getElementById('btnCloseInitModal').onclick = () => {
    document.getElementById('initSetupModal').classList.add('hidden');
  };
  document.getElementById('btnCancelInitModal').onclick = () => {
    document.getElementById('initSetupModal').classList.add('hidden');
  };
  document.getElementById('btnApplyInitModal').onclick = applyInitSetupModal;

  document.getElementById('btnAddVerticalAisle').onclick = () => {
    const tab = getActiveTab();
    if (!tab) return;
    if (tab.zones.length >= SEATING_CONFIG.maxZones) {
      alert(`최대 ${SEATING_CONFIG.maxZones}분단까지만 추가할 수 있습니다.`);
      return;
    }
    const defaultRowCount = tab.zones[0]?.rows?.length || SEATING_CONFIG.defaultRows;
    const defaultMaxDesks = tab.zones[0]?.maxDesks || SEATING_CONFIG.defaultMaxDesks;
    const newZone = createZoneObject(tab.zones.length, defaultRowCount, defaultMaxDesks);
    tab.zones.push(newZone);
    persistState();
    renderCanvas();
  };

  document.getElementById('teacherDesk').onclick = () => {
    const tab = getActiveTab();
    const next = prompt('교탁에 표시할 학급/반 이름을 입력하세요:', tab.className);
    if (next !== null && next.trim()) {
      tab.className = next.trim();
      persistState();
      renderCanvas();
    }
  };

  const rosterSidebar = document.getElementById('rosterSidebar');
  const toggleRoster = () => {
    rosterSidebar.classList.toggle('collapsed');
    appState.rosterOpen = !rosterSidebar.classList.contains('collapsed');
    persistState();
  };
  document.getElementById('btnToggleRoster').onclick = toggleRoster;
  document.getElementById('btnCloseRoster').onclick = toggleRoster;

  document.getElementById('totalStudentCount').onchange = (e) => {
    applyTotalStudentCount(
      parseInt(e.target.value, 10) || SEATING_CONFIG.defaultStudents
    );
    persistState();
    renderRoster();
  };
  document.getElementById('chkAutoNumber').onchange = (e) => {
    const tab = getActiveTab();
    tab.autoNumber = e.target.checked;
    renumberRosterIfNeeded(tab);
    persistState();
    renderRoster();
  };

  const pasteModal = document.getElementById('pasteModal');
  document.getElementById('btnBatchPaste').onclick = () => pasteModal.classList.remove('hidden');
  document.getElementById('btnClosePasteModal').onclick = () => pasteModal.classList.add('hidden');
  document.getElementById('btnCancelPaste').onclick = () => pasteModal.classList.add('hidden');

  document.getElementById('btnApplyPaste').onclick = () => {
    const text = document.getElementById('pasteTextarea').value;
    if (!text.trim()) return;
    const parsedRoster = parseBatchRosterLines(text);
    if (parsedRoster.length === 0) return;

    const tab = getActiveTab();
    tab.roster = parsedRoster;
    tab.totalCount = tab.roster.length;
    renumberRosterIfNeeded(tab);
    persistState();
    pasteModal.classList.add('hidden');
    document.getElementById('pasteTextarea').value = '';
    renderRoster();
    renderCanvas();
  };

  document.getElementById('btnAddSingleStudent').onclick = () => {
    const tab = getActiveTab();
    if (tab.roster.length >= SEATING_CONFIG.maxStudents) {
      alert(`최대 ${SEATING_CONFIG.maxStudents}명까지만 등록할 수 있습니다.`);
      return;
    }
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
    persistState();
    renderRoster();
  };

  document.getElementById('btnResetRoster').onclick = () => {
    if (confirm('현재 명렬표의 모든 학생을 삭제하시겠습니까?')) {
      const tab = getActiveTab();
      tab.roster = [];
      tab.totalCount = 0;
      persistState();
      renderRoster();
      renderCanvas();
    }
  };

  document.getElementById('btnRandomAssign').onclick = handleRandomShuffle;
  document.getElementById('btnClearDesks').onclick = () => {
    if (confirm('모든 자리를 비우고 기본 구조를 다시 설정하시겠습니까?')) {
      handleClearAllDesks();
      openInitSetupModal(false);
    }
  };

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
    const selectedFormat =
      document.querySelector('input[name="printDeskFormat"]:checked')?.value ||
      'name-num-bracket';
    const fitMode =
      document.querySelector('input[name="printNameFitMode"]:checked')?.value || 'font-size';
    const withRoster = document.getElementById('chkPrintWithRoster').checked;
    const autoTrimEmpty = document.getElementById('chkPrintAutoTrimEmpty')
      ? document.getElementById('chkPrintAutoTrimEmpty').checked
      : SEATING_CONFIG.printAutoTrimEmpty;
    const tab = getActiveTab();
    const rosterListContainer = document.getElementById('rosterListContainer');

    executeSeatingPrint({
      selectedFormat,
      fitMode,
      withRoster,
      autoTrimEmpty,
      tab,
      rosterListContainer,
      onBeforePrintDialog: () => printModal.classList.add('hidden')
    });
  };

  document.getElementById('btnCloseDeskModal').onclick = closeDeskEditModal;
  document.getElementById('btnClearDeskItem').onclick = () => {
    if (editingTargetDesk) {
      editingTargetDesk.studentName = '';
      editingTargetDesk.studentNo = '';
      persistState();
      closeDeskEditModal();
      renderCanvas();
      renderRoster();
    }
  };
  document.getElementById('btnSaveDeskItem').onclick = () => {
    if (editingTargetDesk) {
      editingTargetDesk.studentNo = document.getElementById('editDeskNo').value.trim();
      editingTargetDesk.studentName = document.getElementById('editDeskName').value.trim();
      persistState();
      closeDeskEditModal();
      renderCanvas();
      renderRoster();
    }
  };
}

function bootstrapSeatingApp() {
  loadState();
  initEventListeners();
  const sidebar = document.getElementById('rosterSidebar');
  if (sidebar) {
    sidebar.classList.toggle('collapsed', !appState.rosterOpen);
  }
  renderAll();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', bootstrapSeatingApp);
} else {
  bootstrapSeatingApp();
}
