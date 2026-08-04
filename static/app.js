// --- 全域變數定義 ---
let contextMenu = null;
let menuItemGoto = null;
let systemConfig = null;
let classes = [];
let classrooms = [];
let teachers = [];
let courses = [];
let schedules = [];

let selectedClassId = null;
let draggedCourseId = null;   // 當前拖曳的課程定義 ID
let draggedScheduleId = null; // 當前拖曳的既有課表 ID (代表調整位置)
let selectedCourseId = null;  // 當前被點選的課程定義 ID (點選排課模式)
let teacherSelectedCourseId = null; // 教師課表介面當前選取的課程 ID (教師排課模式)
let ignoreNextClickCell = null;    // 用以防止點選刪除排課後的 click 事件穿透


// --- DOM 元素 ---
const selectClass = document.getElementById("select-class");
const selectClassroom = document.getElementById("select-classroom");
const coursePool = document.getElementById("course-pool");
const unscheduledCount = document.getElementById("unscheduled-count");
const currentClassDisplay = document.getElementById("current-class-display");
const classGradeBadge = document.getElementById("class-grade-badge");
const gridBody = document.getElementById("schedule-grid-body");
const statusLogger = document.getElementById("status-logger");
const toastContainer = document.getElementById("toast-container");

// --- Tab 2: 教師個人課表 DOM ---
const selectTeacher = document.getElementById("select-teacher");
const teacherGridBody = document.getElementById("teacher-grid-body");
const teacherStatPeriods = document.getElementById("teacher-stat-periods");
const teacherStatGrades = document.getElementById("teacher-stat-grades");
const currentTeacherDisplay = document.getElementById("current-teacher-display");
const teacherTutorBadge = document.getElementById("teacher-tutor-badge");
const teacherStatusLogger = document.getElementById("teacher-status-logger");
const btnToggleAddTeacher = document.getElementById("btn-toggle-add-teacher");
const formAddTeacher = document.getElementById("form-add-teacher");
const inputNewTeacherName = document.getElementById("input-new-teacher-name");
const inputNewTeacherTutor = document.getElementById("input-new-teacher-tutor");
const teacherSelectClassroom = document.getElementById("teacher-select-classroom");
const teacherClassroomSelectSection = document.getElementById("teacher-classroom-select-section");

// --- Tab 2.5: 教室課表 DOM ---
const selectClassroomView = document.getElementById("select-classroom-view");
const classroomGridBody = document.getElementById("classroom-grid-body");
const classroomStatPeriods = document.getElementById("classroom-stat-periods");
const currentClassroomDisplay = document.getElementById("current-classroom-display");
const classroomTypeBadge = document.getElementById("classroom-type-badge");
const classroomStatusLogger = document.getElementById("classroom-status-logger");
const vsClassroomGroup = document.getElementById("vs-classroom-group");
const matrixTeacherSearch = document.getElementById("matrix-teacher-search");

// --- Tab 3: 教師總表 DOM ---
const teacherSummaryTableBody = document.getElementById("teacher-summary-table-body");
const mgtSelectClass = document.getElementById("mgt-select-class");
const mgtSelectTeacher = document.getElementById("mgt-select-teacher");
const mgtCoursesListBody = document.getElementById("mgt-courses-list-body");
const formAddCourse = document.getElementById("form-add-course");
const mgtInputCourseName = document.getElementById("mgt-input-course-name");
const mgtSelectClassroomName = document.getElementById("mgt-select-classroom-name");

// --- Tab 4: 班級課程設定 DOM ---
const currSelectClass = document.getElementById("curr-select-class");
const curriculumTableBody = document.getElementById("curriculum-table-body");
const currStatSubjects = document.getElementById("curr-stat-subjects");
const currStatTotal = document.getElementById("curr-stat-total");
const currStatRemaining = document.getElementById("curr-stat-remaining");
const formCurrAddCourse = document.getElementById("form-curr-add-course");
const currInputName = document.getElementById("curr-input-name");
const currSelectTeacher = document.getElementById("curr-select-teacher");
const currSelectClassroomName = document.getElementById("curr-select-classroom-name");
const currInputPeriods = document.getElementById("curr-input-periods");

// --- 右上角 view-selector DOM ---
const vsClassGroup = document.getElementById("vs-class-group");
const vsTeacherGroup = document.getElementById("vs-teacher-group");
const vsCurriculumGroup = document.getElementById("vs-curriculum-group");

// --- Tab 5: 系統設定 DOM ---
const formSettingAddClass = document.getElementById("form-setting-add-class");
const settingInputClassName = document.getElementById("setting-input-class-name");
const settingInputClassGrade = document.getElementById("setting-input-class-grade");
const settingSelectClassTutor = document.getElementById("setting-select-class-tutor");
const settingSelectClassRoom = document.getElementById("setting-select-class-room");
const settingClassesListBody = document.getElementById("setting-classes-list-body");
const btnExportSystem = document.getElementById("btn-export-system");
const inputImportSystem = document.getElementById("input-import-system");
const settingExportClass = document.getElementById("setting-export-class");
const settingExportTeacher = document.getElementById("setting-export-teacher");
const btnExportClassCsv = document.getElementById("btn-export-class-csv");
const btnExportTeacherCsv = document.getElementById("btn-export-teacher-csv");
const btnExportClassPdf = document.getElementById("btn-export-class-pdf");
const btnExportTeacherPdf = document.getElementById("btn-export-teacher-pdf");


// --- localForage 配置與 Store Helper ---
localforage.config({
    name: 'ManualSchoolTimetableDB',
    storeName: 'mst_store'
});

async function dbGet(key, defaultVal) {
    try {
        const val = await localforage.getItem(key);
        return val !== null ? val : defaultVal;
    } catch (e) {
        console.error(`localForage getItem error [${key}]:`, e);
        return defaultVal;
    }
}

async function dbSet(key, val) {
    try {
        await localforage.setItem(key, val);
    } catch (e) {
        console.error(`localForage setItem error [${key}]:`, e);
    }
}

// 產生遞增與唯一 ID Helper
function getNextId(list) {
    if (!list || list.length === 0) return 1;
    return Math.max(...list.map(item => parseInt(item.id) || 0)) + 1;
}

// 同步班級導師：班級導師即為教國語的老師
function syncClassTutors() {
    let changed = false;
    classes.forEach(c => {
        const mandarinCourse = courses.find(crs => crs.class_id === c.id && crs.name === "國語");
        const newTutorId = (mandarinCourse && mandarinCourse.teacher_id) ? mandarinCourse.teacher_id : null;
        if (c.tutor_id !== newTutorId) {
            c.tutor_id = newTutorId;
            changed = true;
        }
    });
    if (changed) {
        dbSet("mst_classes", classes);
    }
}

// 確保預設教室與自動綁定存在
function ensureDefaultClassrooms() {
    let defaultCr = classrooms.find(cr => cr.name === "班級教室");
    if (!defaultCr) {
        defaultCr = { id: getNextId(classrooms), name: "班級教室", type: "普通" };
        classrooms.push(defaultCr);
        dbSet("mst_classrooms", classrooms);
    }
    let classChanged = false;
    classes.forEach(c => {
        if (!c.default_classroom_id || !classrooms.some(cr => cr.id === c.default_classroom_id)) {
            c.default_classroom_id = defaultCr.id;
            classChanged = true;
        }
    });
    if (classChanged) {
        dbSet("mst_classes", classes);
    }
}


// --- 核心衝突偵測引擎 (JavaScript 原生版) ---
function checkWeekTypeConflict(week1, week2) {
    if ((week1 === "ODD" && week2 === "EVEN") || (week1 === "EVEN" && week2 === "ODD")) {
        return false; // 無衝突
    }
    return true; // 衝突 (含 EVERY 或 同為 ODD/EVEN)
}

function checkScheduleConflict(classId, courseId, classroomId, weekday, period, weekType = "EVERY", excludeScheduleId = null) {
    const conflicts = [];

    const targetClass = classes.find(c => c.id === classId);
    const targetCourse = courses.find(c => c.id === courseId);

    if (!targetClass || !targetCourse) {
        return ["無效的班級或課程資料"];
    }

    const targetClassroom = classroomId ? classrooms.find(cr => cr.id === classroomId) : null;
    if (classroomId && !targetClassroom) {
        return [`找不到 ID=${classroomId} 的教室資料`];
    }

    const teacherId = targetCourse.teacher_id;
    const targetTeacher = teachers.find(t => t.id === teacherId);

    // 1. 教師不可排課時間偵測
    if (targetTeacher) {
        const slotKey = `${weekday}-${period}`;
        const unavailableSlots = targetTeacher.unavailable_slots || [];
        if (unavailableSlots.includes(slotKey)) {
            conflicts.push(`${targetTeacher.name} 老師在此時段（週${weekday}第${period}節）設定為不排課時間`);
        }
    }

    // 2. 檢索該時段既存的排課紀錄
    const existingSchedules = schedules.filter(s => s.weekday === weekday && s.period === period && s.id !== excludeScheduleId);

    for (const s of existingSchedules) {
        // 同班級同時段的既有課表，預期覆蓋，故不視為衝突來源
        if (s.class_id === classId) continue;

        const existingCourse = courses.find(c => c.id === s.course_id);
        if (!existingCourse) continue;

        // 週次重疊判斷
        const isWeekOverlap = checkWeekTypeConflict(weekType, s.week_type || "EVERY");
        if (!isWeekOverlap) continue; // 單雙週錯開

        // A. 教師衝突檢測
        if (existingCourse.teacher_id === teacherId) {
            const teacherName = targetTeacher ? targetTeacher.name : "未知教師";
            const existingClass = classes.find(c => c.id === s.class_id);
            const className = existingClass ? existingClass.name : "其他班級";
            conflicts.push(`${teacherName} 老師此時段已在「${className}」授課 (${s.week_type || 'EVERY'}週)`);
        }

        // B. 教室衝突檢測 (排除普通/班級教室)
        if (targetClassroom && classroomId && s.classroom_id === classroomId && targetClassroom.name !== "班級教室" && targetClassroom.type !== "普通") {
            const existingClass = classes.find(c => c.id === s.class_id);
            const className = existingClass ? existingClass.name : "其他班級";
            conflicts.push(`教室「${targetClassroom.name}」此時段已被「${className}」佔用 (${s.week_type || 'EVERY'}週)`);
        }
    }

    return conflicts;
}


// --- 初始化載入 ---
document.addEventListener("DOMContentLoaded", () => {
    contextMenu = document.getElementById("custom-context-menu");
    menuItemGoto = document.getElementById("menu-item-goto");
    loadAllData().then(() => {
        setupEventListeners();
        setupTabListeners();
        setupFormAddCourseListener();
        setupCurriculumFormListener();
        setupSettingsListeners();
        setupCSVImports(); 
        setupConfigEditor();
        setupCourseMatrixListeners(); 
    });
});

// --- 建立動態課表網格 --- (上午五節，下午三節) ---
function generateGrid() {
    if (!gridBody) return;
    gridBody.innerHTML = "";

    if (!systemConfig || !systemConfig.periods) return;

    systemConfig.periods.forEach((p) => {
        const tr = document.createElement("tr");

        const tdPeriod = document.createElement("td");
        tdPeriod.className = "period-num";

        if (!p.is_schedulable) {
            tr.className = "rest-row";
            tr.style.height = "24px";
            tdPeriod.innerHTML = p.name;
            tdPeriod.style.height = "24px";
            tdPeriod.style.padding = "0";
            tdPeriod.style.minHeight = "24px";
            tr.appendChild(tdPeriod);

            const tdRest = document.createElement("td");
            tdRest.colSpan = 5;
            tdRest.style.textAlign = "center";
            tdRest.style.color = "var(--text-muted)";
            tdRest.style.fontSize = "12px";
            tdRest.style.background = "rgba(15, 23, 42, 0.4)";
            tdRest.style.height = "24px";
            tdRest.style.padding = "0";
            tdRest.innerText = p.type === "LUNCH" ? "☕ 午餐時間" : (p.type === "NAP" ? "💤 午休時間" : "休息時間");
            tr.appendChild(tdRest);
            gridBody.appendChild(tr);
            return; 
        }

        tdPeriod.innerHTML = `${p.name}`;
        tr.appendChild(tdPeriod);

        for (let d = 1; d <= 5; d++) {
            const td = document.createElement("td");
            td.className = "dropzone";
            td.dataset.weekday = d;
            td.dataset.period = p.id;

            td.addEventListener("click", async (e) => {
                if (ignoreNextClickCell === td) {
                    ignoreNextClickCell = null;
                    return;
                }
                if (e.target.closest(".btn-delete-placed")) return;
                if (td.classList.contains("not-available")) return;

                if (selectedCourseId) {
                    const weekday = parseInt(td.dataset.weekday);
                    const period = parseInt(td.dataset.period);
                    const classroomId = parseInt(selectClassroom.value) || null;

                    if (!selectedClassId) { showToast("請先選擇班級！", "error"); return; }

                    await handleCourseClickPlace(selectedCourseId, weekday, period, classroomId, td);
                }
            });
            tr.appendChild(td);
        }
        gridBody.appendChild(tr);
    });
}

// --- 事件綁定 ---
function setupEventListeners() {
    document.addEventListener("click", () => {
        if (contextMenu) contextMenu.classList.add("hidden");
    });
    document.addEventListener("contextmenu", (e) => {
        if (!e.target.closest(".placed-course") && contextMenu) {
            contextMenu.classList.add("hidden");
        }
    });

    selectClass.addEventListener("change", (e) => {
        selectedClassId = e.target.value ? parseInt(e.target.value) : null;
        updateClassDisplay();
        renderSchedules();
        renderCourses(); 
    });

    if (selectTeacher) {
        selectTeacher.addEventListener("change", () => {
            teacherSelectedCourseId = null; 
            renderTeacherSchedule();
            renderTeacherCourses(selectTeacher.value ? parseInt(selectTeacher.value) : null);
        });
    }

    if (selectClassroomView) {
        selectClassroomView.addEventListener("change", () => {
            renderClassroomSchedule();
        });
    }

    const btnRefreshClass = document.getElementById("btn-refresh-class");
    if (btnRefreshClass) {
        btnRefreshClass.addEventListener("click", async () => {
            const icon = btnRefreshClass.querySelector("i");
            icon.style.animation = "spin 0.6s linear";
            setTimeout(() => { icon.style.animation = ""; }, 700);
            try {
                await loadAllData();
                log("課表資料已重新整理！", "success");
                showToast("課表資料已重新整理！", "success");
            } catch (e) {
                log("重新整理失敗：" + e.message, "error");
                showToast("重新整理失敗", "error");
            }
        });
    }

    const btnRefreshTeacher = document.getElementById("btn-refresh-teacher");
    if (btnRefreshTeacher) {
        btnRefreshTeacher.addEventListener("click", async () => {
            const icon = btnRefreshTeacher.querySelector("i");
            icon.style.animation = "spin 0.6s linear";
            setTimeout(() => { icon.style.animation = ""; }, 700);
            try {
                await loadAllData();
                teacherLog("課表資料已重新整理！", "success");
                showToast("課表資料已重新整理！", "success");
            } catch (e) {
                teacherLog("重新整理失敗：" + e.message, "error");
                showToast("重新整理失敗", "error");
            }
        });
    }

    const btnRefreshClassroom = document.getElementById("btn-refresh-classroom");
    if (btnRefreshClassroom) {
        btnRefreshClassroom.addEventListener("click", async () => {
            const icon = btnRefreshClassroom.querySelector("i");
            if (icon) {
                icon.style.animation = "spin 0.6s linear";
                setTimeout(() => { icon.style.animation = ""; }, 700);
            }
            try {
                await loadAllData();
                classroomLog("課表資料已重新整理！", "success");
                showToast("課表資料已重新整理！", "success");
            } catch (e) {
                classroomLog("重新整理失敗：" + e.message, "error");
                showToast("重新整理失敗", "error");
            }
        });
    }

    if (btnToggleAddTeacher && formAddTeacher) {
        btnToggleAddTeacher.addEventListener("click", () => {
            formAddTeacher.style.display = formAddTeacher.style.display === "none" ? "block" : "none";
        });

        formAddTeacher.addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = inputNewTeacherName.value.trim();
            const isTutor = inputNewTeacherTutor.checked;

            if (!name) return;

            try {
                const newTeacher = {
                    id: getNextId(teachers),
                    name: name,
                    is_tutor: isTutor,
                    unavailable_slots: []
                };
                teachers.push(newTeacher);
                await dbSet("mst_teachers", teachers);

                showToast("新增教師成功！", "success");
                formAddTeacher.reset();
                formAddTeacher.style.display = "none";
                await loadAllData();
            } catch (err) {
                showToast("新增失敗：" + err.message, "error");
            }
        });
    }

    gridBody.addEventListener("dragover", (e) => {
        const cell = e.target.closest(".dropzone");
        if (cell && !cell.classList.contains("not-available")) {
            e.preventDefault(); 
            cell.classList.add("drag-over");
        }
    });

    gridBody.addEventListener("dragleave", (e) => {
        const cell = e.target.closest(".dropzone");
        if (cell) {
            cell.classList.remove("drag-over");
        }
    });

    gridBody.addEventListener("drop", async (e) => {
        e.preventDefault();
        const cell = e.target.closest(".dropzone");
        if (!cell || cell.classList.contains("not-available")) return;

        cell.classList.remove("drag-over");

        const weekday = parseInt(cell.dataset.weekday);
        const period = parseInt(cell.dataset.period);
        const classroomId = parseInt(selectClassroom.value) || null;

        if (!selectedClassId) {
            showToast("請先選擇班級！", "error");
            return;
        }

        if (draggedCourseId) {
            await handleCourseDrop(weekday, period, classroomId, cell);
        }

        draggedCourseId = null;
        draggedScheduleId = null;
    });
}

// --- 載入所有基礎資料 (localForage 讀取) ---
async function loadAllData() {
    try {
        systemConfig = await dbGet("mst_config", null);
        classes = await dbGet("mst_classes", []);
        classrooms = await dbGet("mst_classrooms", []);
        teachers = await dbGet("mst_teachers", []);
        courses = await dbGet("mst_courses", []);
        schedules = await dbGet("mst_schedules", []);

        if (!systemConfig || !systemConfig.periods || (classes.length === 0 && teachers.length === 0)) {
            let loadedConfig = null;
            try {
                const confRes = await fetch("config.json");
                if (confRes.ok) {
                    loadedConfig = await confRes.json();
                }
            } catch (e) {
                console.warn("直接點擊開啟 HTML (file:// 協定) 無法直接 fetch('config.json')，啟動內建預設設定。");
            }

            // 內建備用預設 config (當以 file:// 協定開啟實使用)
            if (!loadedConfig) {
                loadedConfig = {
                    periods: [
                        { id: "1", name: "第 1 節", type: "NORMAL", is_schedulable: true },
                        { id: "2", name: "第 2 節", type: "NORMAL", is_schedulable: true },
                        { id: "3", name: "第 3 節", type: "NORMAL", is_schedulable: true },
                        { id: "4", name: "第 4 節", type: "NORMAL", is_schedulable: true },
                        { id: "5", name: "第 5 節", type: "NORMAL", is_schedulable: true },
                        { id: "nap", name: "午休", type: "NAP", is_schedulable: false },
                        { id: "6", name: "第 6 節", type: "NORMAL", is_schedulable: true },
                        { id: "7", name: "第 7 節", type: "NORMAL", is_schedulable: true },
                        { id: "8", name: "第 8 節", type: "NORMAL", is_schedulable: true }
                    ],
                    classes: [
                        { code: 101, name: "一年忠班", grade: 1 },
                        { code: 102, name: "一年孝班", grade: 1 },
                        { code: 103, name: "一年仁班", grade: 1 },
                        { code: 104, name: "一年愛班", grade: 1 },
                        { code: 105, name: "一年信班", grade: 1 },
                        { code: 106, name: "一年義班", grade: 1 },
                        { code: 201, name: "二年忠班", grade: 2 },
                        { code: 202, name: "二年孝班", grade: 2 },
                        { code: 203, name: "二年仁班", grade: 2 },
                        { code: 204, name: "二年愛班", grade: 2 },
                        { code: 205, name: "二年信班", grade: 2 },
                        { code: 206, name: "二年義班", grade: 2 },
                        { code: 301, name: "三年忠班", grade: 3 },
                        { code: 302, name: "三年孝班", grade: 3 },
                        { code: 303, name: "三年仁班", grade: 3 },
                        { code: 304, name: "三年愛班", grade: 3 },
                        { code: 305, name: "三年信班", grade: 3 },
                        { code: 306, name: "三年義班", grade: 3 },
                        { code: 401, name: "四年忠班", grade: 4 },
                        { code: 402, name: "四年孝班", grade: 4 },
                        { code: 403, name: "四年仁班", grade: 4 },
                        { code: 404, name: "四年愛班", grade: 4 },
                        { code: 405, name: "四年信班", grade: 4 },
                        { code: 406, name: "四年義班", grade: 4 },
                        { code: 501, name: "五年忠班", grade: 5 },
                        { code: 502, name: "五年孝班", grade: 5 },
                        { code: 503, name: "五年仁班", grade: 5 },
                        { code: 504, name: "五年愛班", grade: 5 },
                        { code: 505, name: "五年信班", grade: 5 },
                        { code: 506, name: "五年義班", grade: 5 },
                        { code: 601, name: "六年忠班", grade: 6 },
                        { code: 602, name: "六年孝班", grade: 6 },
                        { code: 603, name: "六年仁班", grade: 6 },
                        { code: 604, name: "六年愛班", grade: 6 },
                        { code: 605, name: "六年信班", grade: 6 },
                        { code: 606, name: "六年義班", grade: 6 }
                    ]
                };
            }

            systemConfig = { periods: loadedConfig.periods };
            if (classes.length === 0 && loadedConfig.classes) {
                classes = loadedConfig.classes.map((c, idx) => ({
                    id: idx + 1,
                    code: c.code,
                    name: c.name,
                    grade: c.grade,
                    tutor_id: null,
                    default_classroom_id: null
                }));
            }

            await dbSet("mst_config", systemConfig);
            await dbSet("mst_classes", classes);
        }

        ensureDefaultClassrooms();
        syncClassTutors();

        generateGrid();
        generateTeacherGrid();
        generateClassroomGrid();

        populateSelectors();
        updateClassDisplay();
        renderCourses();
        renderSchedules();

        populateTeacherSelect();
        renderTeacherSchedule();
        renderTeacherCourses(selectTeacher?.value ? parseInt(selectTeacher.value) : null);
        renderTeacherSummary();
        populateMgtSelectors();

        renderClassroomSchedule();

        populateCurriculumSelectors();
        renderCurriculumView();

        renderSettingsUI();

        renderCourseMatrix();
        renderMatrixTeacherList();
    } catch (err) {
        log("資料載入失敗: " + err.message, "error");
    }
}

// --- 填充下拉選單 ---
function populateSelectors() {
    selectClass.innerHTML = '<option value="">-- 請選擇班級 --</option>';
    classes.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = `${c.name} (${c.grade}年級)`;
        if (selectedClassId === c.id) opt.selected = true;
        selectClass.appendChild(opt);
    });

    if (!selectedClassId && classes.length > 0) {
        selectedClassId = classes[0].id;
        selectClass.value = selectedClassId;
    }

    selectClassroom.innerHTML = "";
    if (teacherSelectClassroom) teacherSelectClassroom.innerHTML = "";
    if (selectClassroomView) selectClassroomView.innerHTML = '<option value="">-- 請選擇科任教室 --</option>';
    classrooms.forEach(cr => {
        const isOtherNormalClassroom = (cr.type === "普通" ||
            cr.type === "普通教室" ||
            (cr.type && cr.type.includes("普通"))) &&
            cr.name !== "班級教室";

        const opt = document.createElement("option");
        opt.value = cr.id;
        opt.textContent = `${cr.name} [${cr.type}]`;

        if (!isOtherNormalClassroom) {
            selectClassroom.appendChild(opt.cloneNode(true));
            if (teacherSelectClassroom) {
                teacherSelectClassroom.appendChild(opt.cloneNode(true));
            }
        }
        const isNormalClassroom = cr.name === "班級教室" ||
            cr.type === "普通" ||
            cr.type === "普通教室" ||
            (cr.type && cr.type.includes("普通"));
        if (selectClassroomView && !isNormalClassroom) {
            selectClassroomView.appendChild(opt.cloneNode(true));
        }
    });

    if (selectClassroomView && !selectClassroomView.value) {
        const nonNormalClassroom = classrooms.find(cr => {
            const isNormal = cr.name === "班級教室" ||
                cr.type === "普通" ||
                cr.type === "普通教室" ||
                (cr.type && cr.type.includes("普通"));
            return !isNormal;
        });
        if (nonNormalClassroom) {
            selectClassroomView.value = nonNormalClassroom.id;
        }
    }

    const defaultCr = classrooms.find(cr => cr.name === "班級教室");
    if (defaultCr) {
        selectClassroom.value = defaultCr.id;
        if (teacherSelectClassroom) {
            teacherSelectClassroom.value = defaultCr.id;
        }
    }
}

// --- 更新上方班級顯示狀態與設定預設教室 ---
function updateClassDisplay() {
    const activeClass = classes.find(c => c.id === selectedClassId);

    document.querySelectorAll(".dropzone").forEach(cell => {
        cell.classList.remove("not-available");
    });

    if (activeClass) {
        currentClassDisplay.textContent = activeClass.name;
        classGradeBadge.textContent = `${activeClass.grade} 年級`;
        classGradeBadge.style.display = "inline-block";

        if (activeClass.default_classroom_id) {
            selectClassroom.value = activeClass.default_classroom_id;
        }
    } else {
        currentClassDisplay.textContent = "尚未選擇班級";
        classGradeBadge.style.display = "none";
    }
}

// --- 渲染待排課程池 (Sidebar) ---
function renderCourses() {
    coursePool.innerHTML = "";
    if (courses.length === 0) {
        coursePool.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-folder-open"></i>
                <p>請先前往「班級課程設定」新增科目</p>
            </div>
        `;
        unscheduledCount.textContent = "0";
        return;
    }

    const classCourses = courses.filter(c => c.class_id === selectedClassId);

    if (classCourses.length === 0) {
        coursePool.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-folder-open"></i>
                <p>此班級尚未指派任何授課科目</p>
            </div>
        `;
        unscheduledCount.textContent = "0";
        return;
    }

    classCourses.forEach(c => {
        const card = document.createElement("div");
        card.className = `course-card week-${(c.week_type || 'EVERY').toLowerCase()}`;
        if (selectedCourseId === c.id) {
            card.classList.add("active");
        }
        card.draggable = true;

        const teacher = teachers.find(t => t.id === c.teacher_id);
        const teacherName = teacher ? teacher.name : "未知教師";
        const teacherShortName = teacherName.split(" ")[0]; 

        const scheduledPeriods = schedules
            .filter(s => s.course_id === c.id && s.class_id === selectedClassId)
            .reduce((sum, s) => sum + (s.week_type === "EVERY" ? 1.0 : 0.5), 0);
        const required = c.required_periods || 0;
        const remaining = required - scheduledPeriods;
        const isDone = remaining <= 0;

        const periodTag = required > 0
            ? `<span class="period-badge ${isDone ? 'done' : (remaining <= 1 ? 'almost' : '')}">${scheduledPeriods}/${required} 節${isDone ? ' ✓' : ` · 還需 ${remaining} 節`}</span>`
            : `<span class="period-badge">${scheduledPeriods} 節已排</span>`;

        const roomLabel = c.classroom_name || '班級教室';
        const weekBadge = '';

        card.innerHTML = `
            <div class="course-info">
                <span class="course-name">${weekBadge}${c.name} <span class="teacher-inline-name">(${teacherShortName})</span></span>
                <span class="room-tag">${roomLabel}</span>
            </div>
            <div class="course-details">
                ${periodTag}
            </div>
        `;

        card.addEventListener("dragstart", (e) => {
            draggedCourseId = c.id;
            draggedScheduleId = null;
            e.dataTransfer.effectAllowed = "move";
            autoSwitchClassroomForCourse(c);
        });

        card.addEventListener("click", () => {
            if (selectedCourseId === c.id) {
                selectedCourseId = null;
                card.classList.remove("active");
                log(`已取消選取課程「${c.name}」`, "system-msg");
            } else {
                selectedCourseId = c.id;
                document.querySelectorAll(".course-card").forEach(el => el.classList.remove("active"));
                card.classList.add("active");
                log(`已點選「${c.name} (${teacherShortName})」課程。請直接點擊右側課表空格進行排課（可點擊多節）。`);
                autoSwitchClassroomForCourse(c);
            }
        });

        coursePool.appendChild(card);
    });

    const pendingCount = classCourses.filter(c => {
        const scheduledPeriods = schedules
            .filter(sc => sc.course_id === c.id && sc.class_id === selectedClassId)
            .reduce((sum, sc) => sum + (sc.week_type === "EVERY" ? 1.0 : 0.5), 0);
        return scheduledPeriods < (c.required_periods || 0);
    }).length;
    unscheduledCount.textContent = pendingCount;
}

// --- 渲染已排課表 (Main Grid) ---
async function renderSchedules() {
    document.querySelectorAll("#class-schedule-view .dropzone").forEach(cell => {
        cell.querySelectorAll(".placed-course").forEach(p => p.remove());
    });

    if (!selectedClassId) return;

    const classSchedules = schedules
        .filter(s => s.class_id === selectedClassId)
        .sort((a, b) => {
            if (a.week_type === "ODD" && b.week_type === "EVEN") return -1;
            if (a.week_type === "EVEN" && b.week_type === "ODD") return 1;
            return 0;
        });

    classSchedules.forEach(s => {
        const cell = document.querySelector(`#class-schedule-view .dropzone[data-weekday="${s.weekday}"][data-period="${s.period}"]`);
        if (!cell) return;

        const course = courses.find(c => c.id === s.course_id);
        const classroom = classrooms.find(cr => cr.id === s.classroom_id);
        const teacher = course ? teachers.find(t => t.id === course.teacher_id) : null;

        if (!course) return;

        const div = document.createElement("div");
        div.className = `placed-course week-${(s.week_type || 'EVERY').toLowerCase()}`;
        div.draggable = true;

        const weekBadge = s.week_type === "ODD" ? '<span class="week-tag inline">[單]</span> ' :
            s.week_type === "EVEN" ? '<span class="week-tag inline">[雙]</span> ' : '';

        div.innerHTML = `
            <div class="placed-header">
                <span class="placed-name">${weekBadge}${course.name}</span>
                <button class="btn-delete-placed" title="取消排課">
                    <i class="fa-solid fa-square-xmark"></i>
                </button>
            </div>
            <div class="placed-footer">
                <span>${teacher ? teacher.name.split(" ")[0] : ""}</span>
                <span>${classroom ? classroom.name : "班級教室"}</span>
            </div>
        `;

        div.addEventListener("dragstart", (e) => {
            draggedScheduleId = s.id;
            draggedCourseId = s.course_id;
            e.dataTransfer.effectAllowed = "move";
            setTimeout(() => div.style.opacity = "0.4", 0);
        });

        div.addEventListener("dragend", () => {
            div.style.opacity = "1";
        });

        div.querySelector(".btn-delete-placed").addEventListener("mousedown", async (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            ignoreNextClickCell = cell;
            setTimeout(() => {
                if (ignoreNextClickCell === cell) ignoreNextClickCell = null;
            }, 300);

            if (confirm(`確定要取消「${course.name}」的排課嗎？`)) {
                await deleteSchedule(s.id);
            }
        });

        div.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const teacherId = course.teacher_id;
            const teacher = teachers.find(t => t.id === teacherId);
            const teacherName = teacher ? teacher.name : "該教師";

            const ul = contextMenu?.querySelector("ul");
            if (ul) {
                ul.innerHTML = `<li id="menu-item-goto"></li>`;
            }

            const menuItemGoto = document.getElementById("menu-item-goto");
            if (menuItemGoto && contextMenu) {
                menuItemGoto.innerHTML = `<i class="fa-solid fa-arrow-right-to-bracket"></i> 前往 ${teacherName} 的課表`;
                menuItemGoto.onclick = () => {
                    const tabBtn = document.querySelector(`.tab-btn[data-tab="teacher-schedule-view"]`);
                    if (tabBtn) tabBtn.click();

                    if (selectTeacher) {
                        selectTeacher.value = teacherId;
                        teacherSelectedCourseId = null;
                        renderTeacherSchedule();
                        renderTeacherCourses(teacherId);
                    }
                    contextMenu.classList.add("hidden");
                };

                contextMenu.style.left = `${e.pageX}px`;
                contextMenu.style.top = `${e.pageY}px`;
                contextMenu.classList.remove("hidden");
            }
        });

        cell.appendChild(div);
    });
}

// 預設教室自動補齊 Helper
function getOrFixClassroomId(courseId, targetClassroomId) {
    if (targetClassroomId) return targetClassroomId;
    const course = courses.find(c => c.id === courseId);
    const targetName = course ? course.classroom_name : "班級教室";
    let defaultCr = classrooms.find(cr => cr.name === targetName);
    if (!defaultCr) defaultCr = classrooms.find(cr => cr.name === "班級教室");
    if (!defaultCr) {
        defaultCr = { id: getNextId(classrooms), name: "班級教室", type: "普通" };
        classrooms.push(defaultCr);
        dbSet("mst_classrooms", classrooms);
    }
    return defaultCr.id;
}

// --- 處理 Drop 排課行為 ---
async function handleCourseDrop(weekday, period, classroomId, cell) {
    let weekType = "EVERY";
    if (draggedScheduleId) {
        const orig = schedules.find(s => s.id === draggedScheduleId);
        if (orig) weekType = orig.week_type || "EVERY";
    } else {
        const weekTypeEl = document.querySelector('input[name="placing-week-type-class"]:checked');
        weekType = weekTypeEl ? weekTypeEl.value : "EVERY";
    }

    const targetCourseId = draggedScheduleId ? schedules.find(s => s.id === draggedScheduleId)?.course_id : draggedCourseId;
    const finalClassroomId = getOrFixClassroomId(targetCourseId, classroomId);

    const conflicts = checkScheduleConflict(
        selectedClassId,
        targetCourseId,
        finalClassroomId,
        weekday,
        period,
        weekType,
        draggedScheduleId
    );

    if (conflicts.length > 0) {
        cell.classList.add("grid-cell-conflict");
        setTimeout(() => cell.classList.remove("grid-cell-conflict"), 1500);

        conflicts.forEach(msg => {
            log(`排課衝突：${msg}`, "error");
            showToast(msg, "error");
        });
        return;
    }

    schedules = schedules.filter(s => {
        if (draggedScheduleId && s.id === draggedScheduleId) return false;
        if (s.class_id === selectedClassId && s.weekday === weekday && s.period === period) {
            return !checkWeekTypeConflict(weekType, s.week_type || "EVERY");
        }
        return true;
    });

    if (draggedScheduleId) {
        schedules.push({
            id: draggedScheduleId,
            class_id: selectedClassId,
            course_id: targetCourseId,
            classroom_id: finalClassroomId,
            weekday: weekday,
            period: period,
            week_type: weekType
        });
    } else {
        const newSchedId = getNextId(schedules);
        schedules.push({
            id: newSchedId,
            class_id: selectedClassId,
            course_id: targetCourseId,
            classroom_id: finalClassroomId,
            weekday: weekday,
            period: period,
            week_type: weekType
        });
    }

    await dbSet("mst_schedules", schedules);
    await loadAllData();
    showToast(draggedScheduleId ? "課表調整成功！" : "排課成功！", "success");
    log(draggedScheduleId ? `課表調整成功！將課程排至週 ${weekday} 第 ${period} 節。` : `排課成功！已將課程排至週 ${weekday} 第 ${period} 節。`, "success");
}

// --- 處理 Click-to-Place 排課行為 ---
async function handleCourseClickPlace(courseId, weekday, period, classroomId, cell) {
    const weekTypeEl = document.querySelector('input[name="placing-week-type-class"]:checked');
    const weekType = weekTypeEl ? weekTypeEl.value : "EVERY";
    const finalClassroomId = getOrFixClassroomId(courseId, classroomId);

    const conflicts = checkScheduleConflict(
        selectedClassId,
        courseId,
        finalClassroomId,
        weekday,
        period,
        weekType
    );

    if (conflicts.length > 0) {
        cell.classList.add("grid-cell-conflict");
        setTimeout(() => cell.classList.remove("grid-cell-conflict"), 1500);

        conflicts.forEach(msg => {
            log(`排課衝突：${msg}`, "error");
            showToast(msg, "error");
        });
        return;
    }

    schedules = schedules.filter(s => {
        if (s.class_id === selectedClassId && s.weekday === weekday && s.period === period) {
            return !checkWeekTypeConflict(weekType, s.week_type || "EVERY");
        }
        return true;
    });

    schedules.push({
        id: getNextId(schedules),
        class_id: selectedClassId,
        course_id: courseId,
        classroom_id: finalClassroomId,
        weekday: weekday,
        period: period,
        week_type: weekType
    });

    await dbSet("mst_schedules", schedules);
    await loadAllData();
    showToast("點選排課成功！", "success");
    log(`排課成功！已點選排入週 ${weekday} 第 ${period} 節。`, "success");
}

// --- 刪除課表 ---
async function deleteSchedule(scheduleId) {
    schedules = schedules.filter(s => s.id !== scheduleId);
    await dbSet("mst_schedules", schedules);
    await loadAllData();
    showToast("已成功取消排課！", "success");
    log("已成功取消一節排課紀錄。", "system-msg");
}

// --- 輔助函式：狀態日誌記錄 ---
function log(msg, type = "system-msg") {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const div = document.createElement("div");
    div.className = `log-entry ${type}`;
    div.innerHTML = `[${time}] ${msg}`;
    statusLogger.appendChild(div);
    statusLogger.scrollTop = statusLogger.scrollHeight;
}

// --- 輔助函式：Toast 彈出訊息 ---
function showToast(msg, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    let icon = "fa-circle-info";
    if (type === "success") icon = "fa-circle-check";
    if (type === "error") icon = "fa-circle-exclamation";
    if (type === "warning") icon = "fa-triangle-exclamation";

    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${msg}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = "toastOut 0.3s forwards";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// 自動將授課教室切換為該科目設定的預設教室類型
function autoSwitchClassroomForCourse(course) {
    if (!selectClassroom || !course) return;

    let targetRoomName = course.classroom_name;
    const currentClass = classes.find(c => c.id === selectedClassId);

    if (!targetRoomName || targetRoomName === "班級教室" || targetRoomName === "普通") {
        if (currentClass && currentClass.default_classroom_id) {
            selectClassroom.value = currentClass.default_classroom_id;
            return;
        }
        targetRoomName = "班級教室";
    }

    const matchedRoom = classrooms.find(cr => cr.name === targetRoomName);
    if (matchedRoom) {
        selectClassroom.value = matchedRoom.id;
    } else {
        const typeRoom = classrooms.find(cr => cr.type === targetRoomName);
        if (typeRoom) {
            selectClassroom.value = typeRoom.id;
        } else if (currentClass && currentClass.default_classroom_id) {
            selectClassroom.value = currentClass.default_classroom_id;
        }
    }
}

// --- 建立 Tab 2 教師網格 ---
function generateTeacherGrid() {
    if (!teacherGridBody) return;
    teacherGridBody.innerHTML = "";
    if (!systemConfig || !systemConfig.periods) return;

    systemConfig.periods.forEach((p) => {
        const tr = document.createElement("tr");
        const tdPeriod = document.createElement("td");
        tdPeriod.className = "period-num";

        if (!p.is_schedulable) {
            tr.className = "rest-row";
            tr.style.height = "24px";
            tdPeriod.innerHTML = p.name;
            tr.appendChild(tdPeriod);

            const tdRest = document.createElement("td");
            tdRest.colSpan = 5;
            tdRest.innerText = p.type === "LUNCH" ? "☕ 午餐時間" : (p.type === "NAP" ? "💤 午休時間" : "休息時間");
            tdRest.style.textAlign = "center";
            tr.appendChild(tdRest);
            teacherGridBody.appendChild(tr);
            return;
        }

        tdPeriod.innerHTML = `${p.name}`;
        tr.appendChild(tdPeriod);

        for (let d = 1; d <= 5; d++) {
            const td = document.createElement("td");
            td.className = "dropzone";
            td.dataset.weekday = d;
            td.dataset.period = p.id;

            td.addEventListener("click", async (e) => {
                if (ignoreNextClickCell === td) {
                    ignoreNextClickCell = null;
                    return;
                }
                if (e.target.closest(".btn-delete-placed")) return;

                if (teacherSelectedCourseId) {
                    const weekday = parseInt(td.dataset.weekday);
                    const period = parseInt(td.dataset.period);
                    const classroomId = parseInt(teacherSelectClassroom?.value) || null;
                    const course = courses.find(c => c.id === teacherSelectedCourseId);

                    if (course) {
                        await handleTeacherCourseClickPlace(course.class_id, teacherSelectedCourseId, weekday, period, classroomId, td);
                    }
                } else {
                    await handleTeacherSlotClick(d, parseInt(p.id), td);
                }
            });
            tr.appendChild(td);
        }
        teacherGridBody.appendChild(tr);
    });
}

// 處理教師排課介面的點選排課行為
async function handleTeacherCourseClickPlace(classId, courseId, weekday, period, classroomId, cell) {
    const weekTypeEl = document.querySelector('input[name="placing-week-type-teacher"]:checked');
    const weekType = weekTypeEl ? weekTypeEl.value : "EVERY";
    const finalClassroomId = getOrFixClassroomId(courseId, classroomId);

    const conflicts = checkScheduleConflict(
        classId,
        courseId,
        finalClassroomId,
        weekday,
        period,
        weekType
    );

    if (conflicts.length > 0) {
        cell.classList.add("grid-cell-conflict");
        setTimeout(() => cell.classList.remove("grid-cell-conflict"), 1500);

        conflicts.forEach(msg => {
            teacherLog(`排課衝突：${msg}`, "error");
            showToast(msg, "error");
        });
        return;
    }

    schedules = schedules.filter(s => {
        if (s.class_id === classId && s.weekday === weekday && s.period === period) {
            return !checkWeekTypeConflict(weekType, s.week_type || "EVERY");
        }
        return true;
    });

    schedules.push({
        id: getNextId(schedules),
        class_id: classId,
        course_id: courseId,
        classroom_id: finalClassroomId,
        weekday: weekday,
        period: period,
        week_type: weekType
    });

    await dbSet("mst_schedules", schedules);
    await loadAllData();
    showToast("點選排課成功！", "success");
    teacherLog(`排課成功！已點選排入週 ${weekday} 第 ${period} 節。`, "success");
}

// --- 填充 Tab 2 教師下拉選單 ---
function populateTeacherSelect() {
    if (!selectTeacher) return;
    selectTeacher.innerHTML = '<option value="">-- 請選擇教師 --</option>';
    teachers.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent = `${t.name}${t.is_tutor ? ' (導師)' : ''}`;
        selectTeacher.appendChild(opt);
    });
}

// --- 渲染教師待排課程池 (Tab 2 側邊欄) ---
function renderTeacherCourses(teacherId) {
    const pool = document.getElementById("teacher-course-pool");
    if (!pool) return;
    pool.innerHTML = "";

    if (!teacherId) {
        pool.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-user-tie"></i>
                <p>請先選擇教師</p>
            </div>
        `;
        return;
    }

    const tCourses = courses.filter(c => c.teacher_id === teacherId);
    if (tCourses.length === 0) {
        pool.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-folder-open"></i>
                <p>該教師尚未指派任何課程</p>
            </div>
        `;
        return;
    }

    tCourses.forEach(c => {
        const cls = classes.find(cl => cl.id === c.class_id);
        const className = cls ? cls.name : "未知班級";

        const card = document.createElement("div");
        card.className = `course-card week-${(c.week_type || 'EVERY').toLowerCase()}`;
        if (teacherSelectedCourseId === c.id) {
            card.classList.add("active");
        }

        const scheduledPeriods = schedules
            .filter(s => s.course_id === c.id)
            .reduce((sum, s) => sum + (s.week_type === "EVERY" ? 1.0 : 0.5), 0);
        const required = c.required_periods || 0;
        const remaining = required - scheduledPeriods;
        const isDone = remaining <= 0;

        const periodTag = required > 0
            ? `<span class="period-badge ${isDone ? 'done' : (remaining <= 1 ? 'almost' : '')}">${scheduledPeriods}/${required} 節${isDone ? ' ✓' : ` · 還需 ${remaining} 節`}</span>`
            : `<span class="period-badge">${scheduledPeriods} 節已排</span>`;

        card.innerHTML = `
            <div class="course-info">
                <span class="course-name">${c.name} <span class="teacher-inline-name">(${className})</span></span>
                <span class="room-tag">${c.classroom_name}</span>
            </div>
            <div class="course-details">
                ${periodTag}
            </div>
        `;

        card.addEventListener("click", () => {
            if (teacherSelectedCourseId === c.id) {
                teacherSelectedCourseId = null;
                card.classList.remove("active");
                teacherLog(`已取消選取課程「${c.name} (${className})」`, "system-msg");
            } else {
                teacherSelectedCourseId = c.id;
                pool.querySelectorAll(".course-card").forEach(el => el.classList.remove("active"));
                card.classList.add("active");
                teacherLog(`已點選「${c.name} (${className})」課程。請點擊右側課表進行排課。`);
                autoSwitchTeacherClassroomForCourse(c);
            }
        });

        pool.appendChild(card);
    });
}

function autoSwitchTeacherClassroomForCourse(course) {
    if (!teacherSelectClassroom || !course) return;

    let targetRoomName = course.classroom_name;
    const currentClass = classes.find(c => c.id === course.class_id);

    if (!targetRoomName || targetRoomName === "班級教室" || targetRoomName === "普通") {
        if (currentClass && currentClass.default_classroom_id) {
            teacherSelectClassroom.value = currentClass.default_classroom_id;
            return;
        }
        targetRoomName = "班級教室";
    }

    const matchedRoom = classrooms.find(cr => cr.name === targetRoomName);
    if (matchedRoom) {
        teacherSelectClassroom.value = matchedRoom.id;
    } else {
        const typeRoom = classrooms.find(cr => cr.type === targetRoomName);
        if (typeRoom) {
            teacherSelectClassroom.value = typeRoom.id;
        } else if (currentClass && currentClass.default_classroom_id) {
            teacherSelectClassroom.value = currentClass.default_classroom_id;
        }
    }
}

// --- 渲染教師個人課表 (Tab 2) ---
function renderTeacherSchedule() {
    if (!teacherGridBody) return;

    document.querySelectorAll("#teacher-grid-body td.dropzone").forEach(cell => {
        cell.innerHTML = "";
        cell.className = "dropzone";
    });

    const teacherId = selectTeacher?.value ? parseInt(selectTeacher.value) : null;
    if (!teacherId) {
        currentTeacherDisplay.textContent = "尚未選擇教師";
        teacherTutorBadge.style.display = "none";
        teacherStatPeriods.textContent = "0";
        teacherStatGrades.textContent = "0";
        return;
    }

    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher) return;

    currentTeacherDisplay.textContent = teacher.name;
    teacherLog(`已載入 ${teacher.name} 老師的個人課表。`, "system-msg");

    if (teacher.is_tutor) {
        teacherTutorBadge.style.display = "inline-block";
        teacherTutorBadge.textContent = "導師";
    } else {
        teacherTutorBadge.style.display = "none";
    }

    const teacherSchedules = schedules.filter(s => {
        const c = courses.find(course => course.id === s.course_id);
        return c && c.teacher_id === teacherId;
    });

    const totalPeriods = teacherSchedules.reduce((sum, s) => sum + (s.week_type === "EVERY" ? 1.0 : 0.5), 0);
    teacherStatPeriods.textContent = totalPeriods;

    const gradesSet = new Set();
    teacherSchedules.forEach(s => {
        const cls = classes.find(c => c.id === s.class_id);
        if (cls) {
            gradesSet.add(cls.grade);
        }
    });
    teacherStatGrades.textContent = gradesSet.size;

    const unavailableSlots = teacher.unavailable_slots || [];

    for (let d = 1; d <= 5; d++) {
        for (let p = 1; p <= 8; p++) {
            const cell = document.querySelector(`#teacher-grid-body td[data-weekday="${d}"][data-period="${p}"]`);
            if (!cell) continue;

            const slotKey = `${d}-${p}`;
            if (unavailableSlots.includes(slotKey)) {
                cell.classList.add("unavailable-cell");
            }

            const scheds = teacherSchedules
                .filter(s => s.weekday === d && s.period === p)
                .sort((a, b) => {
                    if (a.week_type === "ODD" && b.week_type === "EVEN") return -1;
                    if (a.week_type === "EVEN" && b.week_type === "ODD") return 1;
                    return 0;
                });

            scheds.forEach(sched => {
                const cls = classes.find(c => c.id === sched.class_id);
                const course = courses.find(c => c.id === sched.course_id);
                const room = classrooms.find(r => r.id === sched.classroom_id);

                const weekType = (sched && sched.week_type) ? sched.week_type.toLowerCase() : "every";
                const weekBadge = sched && sched.week_type === "ODD" ? '<span class="week-tag inline">[單]</span> ' :
                    sched && sched.week_type === "EVEN" ? '<span class="week-tag inline">[雙]</span> ' : '';

                const div = document.createElement("div");
                div.className = `placed-course week-${weekType}`;
                div.innerHTML = `
                    <div class="placed-header">
                        <span class="placed-name">${weekBadge}${course ? course.name : "未知課程"}</span>
                        <button class="btn-delete-placed" title="取消排課">
                            <i class="fa-solid fa-square-xmark"></i>
                        </button>
                    </div>
                    <div class="placed-footer">
                        <span>${cls ? cls.name : "未知班級"}</span>
                        <span>${room ? room.name : ""}</span>
                    </div>
                `;

                div.querySelector(".btn-delete-placed").addEventListener("mousedown", async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    
                    ignoreNextClickCell = cell;
                    setTimeout(() => {
                        if (ignoreNextClickCell === cell) ignoreNextClickCell = null;
                    }, 300);

                    if (confirm(`確定要取消「${course.name}」的排課嗎？`)) {
                        await deleteSchedule(sched.id);
                    }
                });

                div.addEventListener("contextmenu", (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const classId = sched.class_id;
                    const className = cls ? cls.name : "該班級";
                    const teacherId = course ? course.teacher_id : null;
                    const teacherName = teacher ? teacher.name : "該教師";

                    const ul = contextMenu?.querySelector("ul");
                    if (ul) {
                        ul.innerHTML = `
                            <li id="menu-item-goto-class"><i class="fa-solid fa-graduation-cap"></i> 前往 ${className} 的課表</li>
                        `;
                        ul.querySelector("#menu-item-goto-class").onclick = () => {
                            const tabBtn = document.querySelector(`.tab-btn[data-tab="class-schedule-view"]`);
                            if (tabBtn) tabBtn.click();
                            if (selectClass) {
                                selectClass.value = classId;
                                selectedClassId = classId;
                                updateClassDisplay();
                                renderSchedules();
                                renderCourses();
                            }
                            contextMenu.classList.add("hidden");
                        };
                    }

                    contextMenu.style.left = `${e.pageX}px`;
                    contextMenu.style.top = `${e.pageY}px`;
                    contextMenu.classList.remove("hidden");
                });

                cell.appendChild(div);
                cell.classList.remove("unavailable-cell");
            });
        }
    }
}

// --- 處理不排課時段設定點擊 ---
async function handleTeacherSlotClick(weekday, period, cell) {
    const teacherId = selectTeacher?.value ? parseInt(selectTeacher.value) : null;
    if (!teacherId) {
        showToast("請先選擇教師！", "error");
        return;
    }

    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher) return;

    const hasClass = schedules.some(s => {
        const c = courses.find(course => course.id === s.course_id);
        return c && c.teacher_id === teacherId && s.weekday === weekday && s.period === period;
    });

    if (hasClass) {
        showToast("該時段已排定課程，請先至班級課表取消排課！", "error");
        return;
    }

    const slotKey = `${weekday}-${period}`;
    let unavailableSlots = [...(teacher.unavailable_slots || [])];

    if (unavailableSlots.includes(slotKey)) {
        unavailableSlots = unavailableSlots.filter(s => s !== slotKey);
        teacherLog(`取消設定不排課時間：週 ${weekday} 第 ${period} 節`, "system-msg");
    } else {
        unavailableSlots.push(slotKey);
        teacherLog(`設定不排課時間：週 ${weekday} 第 ${period} 節`, "success");
    }

    try {
        teacher.unavailable_slots = unavailableSlots;
        await dbSet("mst_teachers", teachers);
        showToast("教師不排課時間段更新成功！", "success");
        renderTeacherSchedule();
    } catch (err) {
        showToast("更新失敗：" + err.message, "error");
    }
}

function teacherLog(msg, type = "system-msg") {
    if (!teacherStatusLogger) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const div = document.createElement("div");
    div.className = `log-entry ${type}`;
    div.innerHTML = `[${time}] ${msg}`;
    teacherStatusLogger.appendChild(div);
    teacherStatusLogger.scrollTop = teacherStatusLogger.scrollHeight;
}

// =========================================================================
// ==================== CSV 批次匯入整合功能 ===============================
// =========================================================================

function setupCSVImports() {
    const inputTeachers = document.getElementById("input-import-teachers-csv");
    if (inputTeachers) {
        inputTeachers.addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const text = await file.text();
            await processCSVImport(text, "teachers");
            e.target.value = "";
        });
    }

    const inputClassrooms = document.getElementById("input-import-classrooms-csv");
    if (inputClassrooms) {
        inputClassrooms.addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const text = await file.text();
            await processCSVImport(text, "classrooms");
            e.target.value = "";
        });
    }

    const inputCourses = document.getElementById("input-import-courses-csv");
    if (inputCourses) {
        inputCourses.addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const text = await file.text();
            await processCSVImport(text, "courses");
            e.target.value = "";
        });
    }
}

async function processCSVImport(text, type) {
    const clean = text.replace(/^﻿/, "");
    const lines = clean.split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith("#"));
    if (lines.length === 0) {
        showToast("CSV 檔案沒有有效資料！", "error");
        return;
    }

    const dataLines = lines.slice(1);
    let successCount = 0;

    if (type === "teachers") {
        dataLines.forEach(line => {
            const cols = line.split(",");
            const name = (cols[0] || "").trim();
            if (!name) return;
            const slots = [];
            for (let day = 1; day <= 5; day++) {
                const cell = (cols[day] || "").trim();
                if (!cell) continue;
                cell.split(";").forEach(p => {
                    const period = parseInt(p.trim());
                    if (period > 0) slots.push(`${day}-${period}`);
                });
            }
            let teacher = teachers.find(t => t.name === name);
            if (teacher) {
                teacher.unavailable_slots = slots;
            } else {
                teachers.push({
                    id: getNextId(teachers),
                    name: name,
                    is_tutor: false,
                    unavailable_slots: slots
                });
            }
            successCount++;
        });
        await dbSet("mst_teachers", teachers);
    } else if (type === "classrooms") {
        dataLines.forEach(line => {
            const cols = line.split(",");
            const name = (cols[0] || "").trim();
            if (!name) return;
            const cType = (cols[1] || "").trim() || "普通";
            let room = classrooms.find(r => r.name === name);
            if (room) {
                room.type = cType;
            } else {
                classrooms.push({
                    id: getNextId(classrooms),
                    name: name,
                    type: cType
                });
            }
            successCount++;
        });
        await dbSet("mst_classrooms", classrooms);
    } else if (type === "courses") {
        dataLines.forEach(line => {
            const cols = line.split(",");
            const classQuery = (cols[0] || "").trim();
            const subject = (cols[1] || "").trim();
            if (!classQuery || !subject) return;

            // 支援班級代號 (101) 或 班級名稱 (一年忠班) 比對
            const cls = classes.find(c => String(c.code) === classQuery || c.name === classQuery);
            if (!cls) return;

            const teacherName = (cols[3] || "").trim();
            let teacherId = null;
            if (teacherName) {
                let teacher = teachers.find(t => t.name === teacherName);
                if (!teacher) {
                    teacher = {
                        id: getNextId(teachers),
                        name: teacherName,
                        is_tutor: false,
                        unavailable_slots: []
                    };
                    teachers.push(teacher);
                }
                teacherId = teacher.id;
            }

            const periodsCount = parseFloat(cols[2]) || 1;
            const roomName = (cols[4] || "").trim() || "班級教室";
            
            // 單雙週中文轉換
            const rawWType = (cols[5] || "").trim();
            let wType = "EVERY";
            if (rawWType.includes("單") || rawWType.toUpperCase() === "ODD") {
                wType = "ODD";
            } else if (rawWType.includes("雙") || rawWType.toUpperCase() === "EVEN") {
                wType = "EVEN";
            }

            let course = courses.find(c => c.class_id === cls.id && c.name === subject);
            if (course) {
                course.teacher_id = teacherId;
                course.required_periods = periodsCount;
                course.classroom_name = roomName;
                course.week_type = wType;
            } else {
                courses.push({
                    id: getNextId(courses),
                    class_id: cls.id,
                    name: subject,
                    teacher_id: teacherId,
                    required_periods: periodsCount,
                    classroom_name: roomName,
                    week_type: wType,
                    paired_course_id: null
                });
            }
            successCount++;
        });
        await dbSet("mst_teachers", teachers);
        await dbSet("mst_courses", courses);
    }

    showToast(`匯入成功！共新增/更新 ${successCount} 筆資料`, "success");
    await loadAllData();
}

// --- 渲染教師統計總表 (Tab 3) ---
function renderTeacherSummary() {
    if (!teacherSummaryTableBody) return;
    teacherSummaryTableBody.innerHTML = "";

    teachers.forEach(t => {
        const tr = document.createElement("tr");

        const tdName = document.createElement("td");
        tdName.innerHTML = `<strong>${t.name}</strong>`;
        tr.appendChild(tdName);

        const teacherSchedules = schedules.filter(s => {
            const c = courses.find(course => course.id === s.course_id);
            return c && c.teacher_id === t.id;
        });

        const gradesSet = new Set();
        teacherSchedules.forEach(s => {
            const cls = classes.find(c => c.id === s.class_id);
            if (cls) {
                gradesSet.add(cls.grade);
            }
        });

        const tdGrades = document.createElement("td");
        tdGrades.textContent = gradesSet.size > 0
            ? `${gradesSet.size} 個年級 (${Array.from(gradesSet).sort().map(g => g + '年').join(', ')})`
            : "0 個年級";
        tr.appendChild(tdGrades);

        const tdPeriods = document.createElement("td");
        const teacherCourses = courses.filter(c => c.teacher_id === t.id);
        const plannedTotal = teacherCourses.reduce((sum, c) => sum + (c.required_periods || 0), 0);
        const scheduledCount = teacherSchedules.reduce((sum, s) => sum + (s.week_type === "EVERY" ? 1.0 : 0.5), 0);
        const allDone = plannedTotal > 0 && scheduledCount >= plannedTotal;
        tdPeriods.innerHTML = `
            <span class="stat-value" style="font-size: 15px; color: var(--accent-cyan); font-weight:700;">${scheduledCount}</span>
            <span style="font-size: 13px; color: var(--text-muted);">/ ${plannedTotal} 節</span>
            ${allDone ? '<span class="badge-complete" style="margin-left: 6px;">✓ 排滿</span>' : (plannedTotal > 0 ? `<span class="badge-pending" style="margin-left: 6px;">差 ${plannedTotal - scheduledCount} 節</span>` : '')}
        `;
        tr.appendChild(tdPeriods);

        const tdCourses = document.createElement("td");
        const ul = document.createElement("ul");

        if (teacherCourses.length === 0) {
            tdCourses.innerHTML = '<span class="text-muted" style="font-size: 13px;">無指派科目</span>';
        } else {
            teacherCourses.sort((a, b) => {
                const idxA = classes.findIndex(c => c.id === a.class_id);
                const idxB = classes.findIndex(c => c.id === b.class_id);
                const valA = idxA === -1 ? 9999 : idxA;
                const valB = idxB === -1 ? 9999 : idxB;
                return valA - valB;
            }).forEach(c => {
                const cls = classes.find(classObj => classObj.id === c.class_id);
                const cScheduled = schedules
                    .filter(s => s.course_id === c.id && s.class_id === c.class_id)
                    .reduce((sum, s) => sum + (s.week_type === "EVERY" ? 1.0 : 0.5), 0);
                const cRequired = c.required_periods || 0;
                const li = document.createElement("li");
                li.title = `已排 ${cScheduled} / 需排 ${cRequired} 節`;
                li.textContent = `${cls ? cls.name : '未定班級'}: ${c.name} (${cScheduled}/${cRequired})`;
                ul.appendChild(li);
            });
            tdCourses.appendChild(ul);
        }
        tr.appendChild(tdCourses);

        teacherSummaryTableBody.appendChild(tr);
    });
}

// --- 填充班級課程與教師指派管理下拉選單 ---
function populateMgtSelectors() {
    if (!mgtSelectClass || !mgtSelectTeacher) return;

    mgtSelectClass.innerHTML = '<option value="">-- 選擇班級 --</option>';
    classes.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.name;
        mgtSelectClass.appendChild(opt);
    });

    mgtSelectTeacher.innerHTML = '<option value="">-- 選擇教師 --</option>';
    teachers.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent = t.name;
        mgtSelectTeacher.appendChild(opt);
    });
}

// --- Tab 3 新增/異動課程事件 ---
function setupFormAddCourseListener() {
    if (!mgtSelectClass) return;

    mgtSelectClass.addEventListener("change", () => {
        renderMgtCoursesList();
    });

    if (formAddCourse) {
        formAddCourse.addEventListener("submit", async (e) => {
            e.preventDefault();
            const classId = parseInt(mgtSelectClass.value);
            const courseName = mgtInputCourseName.value.trim();
            const teacherId = parseInt(mgtSelectTeacher.value);
            const classroomName = mgtSelectClassroomName.value;

            if (!classId || !courseName || !teacherId) {
                showToast("請填寫所有欄位！", "error");
                return;
            }

            try {
                let course = courses.find(c => c.class_id === classId && c.name === courseName);
                if (course) {
                    course.teacher_id = teacherId;
                    course.classroom_name = classroomName;
                } else {
                    courses.push({
                        id: getNextId(courses),
                        class_id: classId,
                        name: courseName,
                        teacher_id: teacherId,
                        classroom_name: classroomName,
                        required_periods: 1,
                        week_type: "EVERY",
                        paired_course_id: null
                    });
                }
                await dbSet("mst_courses", courses);
                syncClassTutors();
                showToast("課程指派成功！", "success");
                mgtInputCourseName.value = "";
                await loadAllData();
            } catch (err) {
                showToast("網路錯誤：" + err.message, "error");
            }
        });
    }
}

// --- 渲染 Tab 3 管理表格 ---
function renderMgtCoursesList() {
    if (!mgtCoursesListBody) return;
    mgtCoursesListBody.innerHTML = "";

    const classId = mgtSelectClass.value ? parseInt(mgtSelectClass.value) : null;
    if (!classId) return;

    const classCourses = courses.filter(c => c.class_id === classId);
    classCourses.forEach(c => {
        const teacher = teachers.find(t => t.id === c.teacher_id);
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td><strong>${c.name}</strong></td>
            <td>${teacher ? teacher.name : "未指派"}</td>
            <td>${c.classroom_name}</td>
            <td>${c.required_periods || 1} 節</td>
            <td>
                <button class="btn btn-secondary btn-sm" onclick="handleDeleteCourse(${c.id})" style="color: var(--accent-pink);">
                    <i class="fa-solid fa-trash"></i> 刪除
                </button>
            </td>
        `;
        mgtCoursesListBody.appendChild(tr);
    });
}

// --- 刪除課程 helper ---
async function handleDeleteCourse(courseId) {
    courses = courses.filter(c => c.id !== courseId);
    schedules = schedules.filter(s => s.course_id !== courseId);
    await dbSet("mst_courses", courses);
    await dbSet("mst_schedules", schedules);
    syncClassTutors();
    showToast("已成功刪除課程！", "success");
    await loadAllData();
}

// --- Tab 4 班級課程設定分頁 ---
function populateCurriculumSelectors() {
    if (!currSelectClass) return;

    currSelectClass.innerHTML = '<option value="">-- 請選擇班級 --</option>';
    classes.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = `${c.name} (${c.grade}年級)`;
        if (selectedClassId === c.id) opt.selected = true;
        currSelectClass.appendChild(opt);
    });

    if (currSelectTeacher) {
        currSelectTeacher.innerHTML = '<option value="">-- 請選擇授課教師 --</option>';
        teachers.forEach(t => {
            const opt = document.createElement("option");
            opt.value = t.id;
            opt.textContent = `${t.name}${t.is_tutor ? ' (導師)' : ''}`;
            currSelectTeacher.appendChild(opt);
        });
    }

    if (currSelectClassroomName) {
        currSelectClassroomName.innerHTML = '<option value="班級教室">班級教室 (預設)</option>';
        classrooms.forEach(cr => {
            if (cr.name !== "班級教室") {
                const opt = document.createElement("option");
                opt.value = cr.name;
                opt.textContent = `${cr.name} [${cr.type}]`;
                currSelectClassroomName.appendChild(opt);
            }
        });
    }
}

// --- 渲染 Tab 4 班級課程一覽 ---
function renderCurriculumView() {
    if (!curriculumTableBody) return;
    curriculumTableBody.innerHTML = "";

    const classId = currSelectClass?.value ? parseInt(currSelectClass.value) : selectedClassId;
    if (!classId) return;

    const classCourses = courses.filter(c => c.class_id === classId);

    let totalPlanned = 0;
    let totalScheduled = 0;

    classCourses.forEach(c => {
        const required = c.required_periods || 0;
        totalPlanned += required;

        const scheduledCount = schedules
            .filter(s => s.course_id === c.id && s.class_id === classId)
            .reduce((sum, s) => sum + (s.week_type === "EVERY" ? 1.0 : 0.5), 0);
        totalScheduled += scheduledCount;

        const isDone = scheduledCount >= required && required > 0;
        const isOver = scheduledCount > required;
        const pct = required > 0 ? Math.min(100, Math.round((scheduledCount / required) * 100)) : 0;

        const tr = document.createElement("tr");

        const tdName = document.createElement("td");
        tdName.innerHTML = `<strong>${c.name}</strong>`;
        tr.appendChild(tdName);

        const tdTeacher = document.createElement("td");
        const tSelect = document.createElement("select");
        tSelect.className = "curriculum-inline-select";
        tSelect.innerHTML = '<option value="">-- 未指派 --</option>';
        teachers.forEach(t => {
            const opt = document.createElement("option");
            opt.value = t.id;
            opt.textContent = t.name;
            if (String(t.id) === String(c.teacher_id)) opt.selected = true;
            tSelect.appendChild(opt);
        });
        tSelect.addEventListener("change", async () => {
            const newTId = tSelect.value ? parseInt(tSelect.value) : null;
            await handleCurriculumUpdateCourse(c.id, { teacher_id: newTId });
        });
        tdTeacher.appendChild(tSelect);
        tr.appendChild(tdTeacher);

        const tdRoom = document.createElement("td");
        const rSelect = document.createElement("select");
        rSelect.className = "curriculum-inline-select";
        rSelect.innerHTML = '<option value="班級教室">班級教室</option>';
        classrooms.forEach(cr => {
            if (cr.name !== "班級教室") {
                const opt = document.createElement("option");
                opt.value = cr.name;
                opt.textContent = cr.name;
                if (cr.name === c.classroom_name) opt.selected = true;
                rSelect.appendChild(opt);
            }
        });
        rSelect.addEventListener("change", async () => {
            await handleCurriculumUpdateCourse(c.id, { classroom_name: rSelect.value });
        });
        tdRoom.appendChild(rSelect);
        tr.appendChild(tdRoom);

        const tdRequired = document.createElement("td");
        const pInput = document.createElement("input");
        pInput.type = "number";
        pInput.className = "period-inline-input";
        pInput.min = 0.1;
        pInput.max = 40;
        pInput.step = "any";
        pInput.value = required;
        pInput.addEventListener("change", async () => {
            const newVal = parseFloat(pInput.value);
            if (newVal > 0) {
                await handleCurriculumUpdateCourse(c.id, { required_periods: newVal });
            }
        });
        tdRequired.appendChild(pInput);
        tr.appendChild(tdRequired);

        const tdScheduled = document.createElement("td");
        tdScheduled.innerHTML = `<span style="font-size: 15px; font-weight: 700; color: ${isDone ? '#10b981' : 'var(--accent-cyan)'};">${scheduledCount}</span>`;
        tr.appendChild(tdScheduled);

        const tdRemaining = document.createElement("td");
        const diff = required - scheduledCount;
        if (isDone && !isOver) {
            tdRemaining.innerHTML = '<span class="badge-complete">已排滿</span>';
        } else if (isOver) {
            tdRemaining.innerHTML = `<span class="badge-pending" style="background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.4); color: #fca5a5;">超出 ${-diff} 節</span>`;
        } else {
            tdRemaining.innerHTML = `<span class="badge-pending">還需 ${diff} 節</span>`;
        }
        tr.appendChild(tdRemaining);

        const tdPct = document.createElement("td");
        tdPct.innerHTML = `
            <div class="progress-bar-wrap">
                <div class="progress-bar-fill ${isDone ? 'complete' : (isOver ? 'over' : '')}" style="width: ${pct}%"></div>
            </div>
            <span class="progress-text">${pct}%</span>
        `;
        tr.appendChild(tdPct);

        const tdAction = document.createElement("td");
        const btnDel = document.createElement("button");
        btnDel.className = "btn-danger-icon";
        btnDel.title = "刪除此科目";
        btnDel.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
        btnDel.addEventListener("click", async () => {
            if (confirm(`確定要刪除班級的「${c.name}」科目設定嗎？此操作不可復原。`)) {
                await handleDeleteCourse(c.id);
            }
        });
        tdAction.appendChild(btnDel);
        tr.appendChild(tdAction);

        curriculumTableBody.appendChild(tr);
    });

    if (currStatSubjects) currStatSubjects.textContent = classCourses.length;
    if (currStatTotal) currStatTotal.textContent = totalPlanned;
    if (currStatRemaining) currStatRemaining.textContent = totalPlanned - totalScheduled;
}

// --- 處理 Tab 4 課程屬性即時更新 ---
async function handleCurriculumUpdateCourse(courseId, changes) {
    const course = courses.find(c => c.id === courseId);
    if (!course) return;

    Object.assign(course, changes);
    await dbSet("mst_courses", courses);
    syncClassTutors();
    showToast("課程設定已更新！", "success");
    
    // 全面刷新關聯 UI
    renderCurriculumView();
    renderTeacherSummary();
    renderCourses();
    if (typeof populateTeacherSelect === "function") populateTeacherSelect();
    if (typeof renderTeacherSchedule === "function") renderTeacherSchedule();
    if (typeof renderTeacherCourses === "function") renderTeacherCourses(selectTeacher?.value ? parseInt(selectTeacher.value) : null);
    if (typeof renderCourseMatrix === "function") renderCourseMatrix();
}

// --- Tab 4 新增科目至班級的表單監聽 ---
function setupCurriculumFormListener() {
    if (!formCurrAddCourse) return;

    if (currSelectClass) {
        currSelectClass.addEventListener("change", () => {
            renderCurriculumView();
        });
    }

    formCurrAddCourse.addEventListener("submit", async (e) => {
        e.preventDefault();

        const classId = parseInt(currSelectClass.value);
        const courseName = currInputName.value.trim();
        const teacherId = parseInt(currSelectTeacher.value);
        const classroomName = currSelectClassroomName.value;
        const requiredPeriods = parseFloat(currInputPeriods.value) || 1;

        if (!classId || !courseName || !teacherId) {
            showToast("請填寫所有必要欄位！", "error");
            return;
        }

        const newCourse = {
            id: getNextId(courses),
            name: courseName,
            teacher_id: teacherId,
            class_id: classId,
            classroom_name: classroomName,
            week_type: "EVERY",
            required_periods: requiredPeriods,
            paired_course_id: null
        };

        courses.push(newCourse);
        await dbSet("mst_courses", courses);
        syncClassTutors();
        showToast(`新增「${courseName}」成功！`, "success");
        currInputName.value = "";
        await loadAllData();
    });
}

// --- Tab 5 系統設定與維護 UI 渲染 ---
function renderSettingsUI() {
    if (settingSelectClassTutor) {
        settingSelectClassTutor.innerHTML = '<option value="">無導師</option>';
        teachers.forEach(t => {
            if (t.is_tutor) {
                settingSelectClassTutor.innerHTML += `<option value="${t.id}">${t.name}</option>`;
            }
        });
    }

    if (settingSelectClassRoom) {
        settingSelectClassRoom.innerHTML = '<option value="">無預設教室</option>';
        classrooms.forEach(r => {
            if (r.type === '普通') {
                settingSelectClassRoom.innerHTML += `<option value="${r.id}">${r.name}</option>`;
            }
        });
    }

    if (settingClassesListBody) {
        settingClassesListBody.innerHTML = '';
        classes.forEach(c => {
            const tutor = teachers.find(t => t.id === c.tutor_id)?.name || '無';
            const room = classrooms.find(r => r.id === c.default_classroom_id)?.name || '無';
            const tr = document.createElement("tr");
            const codeDisplay = c.code ? c.code : '<span class="text-muted">-</span>';
            tr.innerHTML = `
                <td>${codeDisplay}</td>
                <td>${c.name}</td>
                <td>${c.grade}</td>
                <td>${tutor}</td>
                <td>${room}</td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="deleteClass(${c.id})" style="color: var(--accent-pink);">
                        <i class="fa-solid fa-trash"></i> 刪除
                    </button>
                </td>
            `;
            settingClassesListBody.appendChild(tr);
        });
    }

    if (settingExportClass) {
        settingExportClass.innerHTML = '<option value="">選擇班級...</option>';
        classes.forEach(c => {
            settingExportClass.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        });
    }
    if (settingExportTeacher) {
        settingExportTeacher.innerHTML = '<option value="">選擇教師...</option>';
        teachers.forEach(t => {
            settingExportTeacher.innerHTML += `<option value="${t.id}">${t.name}</option>`;
        });
    }

    const editor = document.getElementById("setting-config-editor");
    if (editor) {
        const fullConfigDisplay = {
            periods: systemConfig ? (systemConfig.periods || systemConfig) : [],
            classes: classes.map(c => ({ code: c.code, name: c.name, grade: c.grade }))
        };
        editor.value = JSON.stringify(fullConfigDisplay, null, 2);
    }
}

async function deleteClass(classId) {
    if (!confirm("確定要刪除此班級嗎？若該班級尚有課程或課表將無法刪除。")) return;
    const hasCourse = courses.some(c => c.class_id === classId);
    const hasSchedule = schedules.some(s => s.class_id === classId);
    if (hasCourse || hasSchedule) {
        showToast("此班級尚有課程或課表，請先刪除相關資料", "error");
        return;
    }
    classes = classes.filter(c => c.id !== classId);
    await dbSet("mst_classes", classes);
    showToast("班級已刪除", "success");
    await loadAllData();
}

// --- 系統設定分頁事件綁定 ---
function setupSettingsListeners() {
    if (formSettingAddClass) {
        formSettingAddClass.addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = settingInputClassName.value.trim();
            const grade = parseInt(settingInputClassGrade.value);

            if (!name || !grade) {
                showToast("請輸入班級名稱與年級", "error");
                return;
            }

            const newClass = {
                id: getNextId(classes),
                name: name,
                grade: grade,
                tutor_id: settingSelectClassTutor.value ? parseInt(settingSelectClassTutor.value) : null,
                default_classroom_id: settingSelectClassRoom.value ? parseInt(settingSelectClassRoom.value) : null
            };

            classes.push(newClass);
            await dbSet("mst_classes", classes);
            showToast("班級新增成功", "success");
            formSettingAddClass.reset();
            await loadAllData();
        });
    }

    // 2. 匯出全站 JSON
    if (btnExportSystem) {
        btnExportSystem.addEventListener("click", async () => {
            try {
                const data = {
                    config: systemConfig,
                    classes: classes,
                    classrooms: classrooms,
                    teachers: teachers,
                    courses: courses,
                    schedules: schedules
                };
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `STC_Backup_${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
                showToast("系統資料已匯出", "success");
            } catch (error) {
                showToast("匯出失敗", "error");
            }
        });
    }

    // 3. 匯入全站 JSON
    if (inputImportSystem) {
        inputImportSystem.addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (!confirm("警告：匯入資料將覆蓋現有系統中所有資料！\n\n確定要繼續嗎？")) {
                e.target.value = "";
                return;
            }
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const jsonPayload = JSON.parse(ev.target.result);
                    if (jsonPayload.config) await dbSet("mst_config", jsonPayload.config);
                    if (jsonPayload.classes) await dbSet("mst_classes", jsonPayload.classes);
                    if (jsonPayload.classrooms) await dbSet("mst_classrooms", jsonPayload.classrooms);
                    if (jsonPayload.teachers) await dbSet("mst_teachers", jsonPayload.teachers);
                    if (jsonPayload.courses) await dbSet("mst_courses", jsonPayload.courses);
                    if (jsonPayload.schedules) await dbSet("mst_schedules", jsonPayload.schedules);

                    showToast("系統資料匯入成功，即將重整頁面", "success");
                    setTimeout(() => window.location.reload(), 1500);
                } catch (error) {
                    showToast("檔案讀取或匯入失敗：" + error.message, "error");
                }
                e.target.value = "";
            };
            reader.readAsText(file);
        });
    }

    // 4. 匯出全部班級 CSV
    if (btnExportClassCsv) {
        btnExportClassCsv.addEventListener("click", () => {
            exportAllClassesCsv();
        });
    }

    // 5. 匯出全部教師 CSV
    if (btnExportTeacherCsv) {
        btnExportTeacherCsv.addEventListener("click", () => {
            exportAllTeachersCsv();
        });
    }

    // 6. 匯出全體班級與專科教室 PDF
    if (btnExportClassPdf) {
        btnExportClassPdf.addEventListener("click", () => {
            exportAllClassesPdf();
        });
    }

    // 7. 匯出全體教師 PDF
    if (btnExportTeacherPdf) {
        btnExportTeacherPdf.addEventListener("click", () => {
            exportAllTeachersPdf();
        });
    }
}

// --- 取得動態科目 ---
function getDynamicSubjects() {
    const subjects = new Set();
    courses.forEach(c => {
        if (c.name) subjects.add(c.name);
    });
    return Array.from(subjects).sort();
}

function exportAllClassesCsv() {
    if (classes.length === 0) {
        showToast("無班級資料可匯出", "error");
        return;
    }

    let csvContent = "\uFEFF";
    const sortedSubjects = getDynamicSubjects();

    const schedulablePeriods = (systemConfig && systemConfig.periods && systemConfig.periods.length > 0)
        ? systemConfig.periods.filter(p => p.is_schedulable).map(p => parseInt(p.id))
        : [1, 2, 3, 4, 5, 6, 7, 8];

    const weekdays = ["一", "二", "三", "四", "五"];
    let headers = ["班級名稱"];
    weekdays.forEach(w => {
        schedulablePeriods.forEach(p => {
            headers.push(`${w}${p}`);
        });
    });
    sortedSubjects.forEach(sub => {
        headers.push(sub);
    });
    csvContent += headers.join(",") + "\n";

    classes.forEach(cls => {
        let row = [cls.name];
        for (let d = 1; d <= 5; d++) {
            for (const p of schedulablePeriods) {
                const scheds = schedules
                    .filter(s => s.class_id === cls.id && s.weekday === d && s.period === p)
                    .sort((a, b) => {
                        if (a.week_type === "ODD" && b.week_type === "EVEN") return -1;
                        if (a.week_type === "EVEN" && b.week_type === "ODD") return 1;
                        return 0;
                    });
                let cellParts = [];
                scheds.forEach(s => {
                    const course = courses.find(c => c.id === s.course_id);
                    if (course) {
                        let text = course.name;
                        if (s.week_type === "ODD") text += "(單)";
                        else if (s.week_type === "EVEN") text += "(雙)";
                        cellParts.push(text);
                    }
                });

                const cellText = cellParts.join(" ");
                row.push(`"${cellText}"`);
            }
        }
        sortedSubjects.forEach(sub => {
            const course = courses.find(c => c.class_id === cls.id && c.name === sub);
            const teacher = course ? teachers.find(t => t.id === course.teacher_id) : null;
            const teacherName = teacher ? teacher.name : "";
            row.push(`"${teacherName}"`);
        });
        csvContent += row.join(",") + "\n";
    });

    const specialRooms = classrooms.filter(cr => cr.type !== "普通" && cr.name !== "班級教室");
    specialRooms.forEach(cr => {
        let row = [cr.name];
        for (let d = 1; d <= 5; d++) {
            for (const p of schedulablePeriods) {
                const scheds = schedules
                    .filter(s => s.classroom_id === cr.id && s.weekday === d && s.period === p)
                    .sort((a, b) => {
                        if (a.week_type === "ODD" && b.week_type === "EVEN") return -1;
                        if (a.week_type === "EVEN" && b.week_type === "ODD") return 1;
                        return 0;
                    });
                let cellParts = [];
                scheds.forEach(s => {
                    const course = courses.find(c => c.id === s.course_id);
                    const cls = classes.find(c => c.id === s.class_id);
                    if (course && cls) {
                        let text = `${course.name}(${cls.name})`;
                        if (s.week_type === "ODD") text += "(單)";
                        else if (s.week_type === "EVEN") text += "(雙)";
                        cellParts.push(text);
                    }
                });

                const cellText = cellParts.join(" ");
                row.push(`"${cellText}"`);
            }
        }
        sortedSubjects.forEach(() => {
            row.push('""');
        });
        csvContent += row.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `全體班級與專科教室總課表.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// --- PDF 匯出輔助函式：動態生成班級課表網格 HTML ---
function generateClassGridHtml(classId, className, subtitle) {
    const classSchedules = schedules.filter(s => s.class_id === classId);

    let tableHtml = `
        <table>
            <thead>
                <tr>
                    <th style="width: 15%;">節次/時間</th>
                    <th style="width: 17%;">週一</th>
                    <th style="width: 17%;">週二</th>
                    <th style="width: 17%;">週三</th>
                    <th style="width: 17%;">週四</th>
                    <th style="width: 17%;">週五</th>
                </tr>
            </thead>
            <tbody>
    `;

    const periods = (systemConfig && systemConfig.periods && systemConfig.periods.length > 0)
        ? systemConfig.periods
        : [
            { id: "1", is_schedulable: true, name: "第一節" },
            { id: "2", is_schedulable: true, name: "第二節" },
            { id: "3", is_schedulable: true, name: "第三節" },
            { id: "4", is_schedulable: true, name: "第四節" },
            { id: "5", is_schedulable: true, name: "第五節" },
            { id: "LUNCH", is_schedulable: false, name: "午休", type: "LUNCH" },
            { id: "6", is_schedulable: true, name: "第六節" },
            { id: "7", is_schedulable: true, name: "第七節" },
            { id: "8", is_schedulable: true, name: "第八節" }
        ];

    periods.forEach(p => {
        if (!p.is_schedulable) {
            const restText = p.type === "LUNCH" ? "☕ 午餐時間" : (p.type === "NAP" ? "💤 午休時間" : "休息時間");
            tableHtml += `
                <tr class="rest-row">
                    <td>${p.name}</td>
                    <td colspan="5">${restText}</td>
                </tr>
            `;
        } else {
            tableHtml += `<tr><td>${p.name}</td>`;
            for (let d = 1; d <= 5; d++) {
                const scheds = classSchedules
                    .filter(s => s.weekday === d && s.period === parseInt(p.id))
                    .sort((a, b) => {
                        if (a.week_type === "ODD" && b.week_type === "EVEN") return -1;
                        if (a.week_type === "EVEN" && b.week_type === "ODD") return 1;
                        return 0;
                    });
                let cellContent = "";
                if (scheds.length > 0) {
                    let itemsHtml = "";
                    scheds.forEach(s => {
                        const course = courses.find(c => c.id === s.course_id);
                        const teacher = course ? teachers.find(t => t.id === course.teacher_id) : null;
                        const classroom = classrooms.find(cr => cr.id === s.classroom_id);
                        if (course) {
                            const weekTag = s.week_type === "ODD" ? '[單] ' : s.week_type === "EVEN" ? '[雙] ' : '';
                            const roomText = classroom && classroom.name !== "班級教室" ? ` (${classroom.name})` : '';
                            const weekClass = (s.week_type === "ODD" || s.week_type === "EVEN") ? 'alternate-week' : 'every-week';
                            itemsHtml += `
                                <div class="placed-course ${weekClass}">
                                    <div class="placed-name">${weekTag}${course.name}${roomText}</div>
                                    <div class="placed-footer">
                                        <span>${className}</span>
                                        <span>${teacher ? teacher.name : ''}</span>
                                    </div>
                                </div>
                            `;
                        }
                    });
                    cellContent = `<div class="pdf-cell-container">${itemsHtml}</div>`;
                }
                tableHtml += `<td>${cellContent}</td>`;
            }
            tableHtml += `</tr>`;
        }
    });

    tableHtml += `</tbody></table>`;

    return `
        <div class="pdf-page">
            <div class="pdf-page-header">
                <h1>${className} 課表</h1>
                <p>${subtitle}</p>
            </div>
            <div class="pdf-page-body">
                ${tableHtml}
            </div>
        </div>
    `;
}

// --- PDF 匯出輔助函式：動態生成專科教室課表網格 HTML ---
function generateRoomGridHtml(roomId, roomName, subtitle) {
    let tableHtml = `
        <table>
            <thead>
                <tr>
                    <th style="width: 15%;">節次/時間</th>
                    <th style="width: 17%;">週一</th>
                    <th style="width: 17%;">週二</th>
                    <th style="width: 17%;">週三</th>
                    <th style="width: 17%;">週四</th>
                    <th style="width: 17%;">週五</th>
                </tr>
            </thead>
            <tbody>
    `;

    const periods = (systemConfig && systemConfig.periods && systemConfig.periods.length > 0)
        ? systemConfig.periods
        : [
            { id: "1", is_schedulable: true, name: "第一節" },
            { id: "2", is_schedulable: true, name: "第二節" },
            { id: "3", is_schedulable: true, name: "第三節" },
            { id: "4", is_schedulable: true, name: "第四節" },
            { id: "5", is_schedulable: true, name: "第五節" },
            { id: "LUNCH", is_schedulable: false, name: "午休", type: "LUNCH" },
            { id: "6", is_schedulable: true, name: "第六節" },
            { id: "7", is_schedulable: true, name: "第七節" },
            { id: "8", is_schedulable: true, name: "第八節" }
        ];

    periods.forEach(p => {
        if (!p.is_schedulable) {
            const restText = p.type === "LUNCH" ? "☕ 午餐時間" : (p.type === "NAP" ? "💤 午休時間" : "休息時間");
            tableHtml += `
                <tr class="rest-row">
                    <td>${p.name}</td>
                    <td colspan="5">${restText}</td>
                </tr>
            `;
        } else {
            tableHtml += `<tr><td>${p.name}</td>`;
            for (let d = 1; d <= 5; d++) {
                const scheds = schedules
                    .filter(s => s.classroom_id === roomId && s.weekday === d && s.period === parseInt(p.id))
                    .sort((a, b) => {
                        if (a.week_type === "ODD" && b.week_type === "EVEN") return -1;
                        if (a.week_type === "EVEN" && b.week_type === "ODD") return 1;
                        return 0;
                    });

                let cellContent = "";
                if (scheds.length > 0) {
                    let itemsHtml = "";
                    scheds.forEach(s => {
                        const course = courses.find(c => c.id === s.course_id);
                        const cls = classes.find(c => c.id === s.class_id);
                        const teacher = course ? teachers.find(t => t.id === course.teacher_id) : null;
                        if (course) {
                            const weekTag = s.week_type === "ODD" ? '[單] ' : s.week_type === "EVEN" ? '[雙] ' : '';
                            const weekClass = (s.week_type === "ODD" || s.week_type === "EVEN") ? 'alternate-week' : 'every-week';
                            itemsHtml += `
                                <div class="placed-course ${weekClass}">
                                    <div class="placed-name">${weekTag}${course.name}</div>
                                    <div class="placed-footer">
                                        <span>${cls ? cls.name : ''}</span>
                                        <span>${teacher ? teacher.name : ''}</span>
                                    </div>
                                </div>
                            `;
                        }
                    });
                    cellContent = `<div class="pdf-cell-container">${itemsHtml}</div>`;
                }
                tableHtml += `<td>${cellContent}</td>`;
            }
            tableHtml += `</tr>`;
        }
    });

    tableHtml += `</tbody></table>`;

    return `
        <div class="pdf-page">
            <div class="pdf-page-header">
                <h1>${roomName} 課表</h1>
                <p>${subtitle}</p>
            </div>
            <div class="pdf-page-body">
                ${tableHtml}
            </div>
        </div>
    `;
}

// --- PDF 匯出輔助函式：動態生成教師課表網格 HTML ---
function generateTeacherGridHtml(teacherId, teacherName, subtitle, teacherObj) {
    const teacherCourses = courses.filter(c => c.teacher_id === teacherId);
    const teacherCourseIds = teacherCourses.map(c => c.id);
    const teacherSchedules = schedules.filter(s => teacherCourseIds.includes(s.course_id));
    const unavailableSlots = (teacherObj && teacherObj.unavailable_slots) || [];

    let tableHtml = `
        <table>
            <thead>
                <tr>
                    <th style="width: 15%;">節次/時間</th>
                    <th style="width: 17%;">週一</th>
                    <th style="width: 17%;">週二</th>
                    <th style="width: 17%;">週三</th>
                    <th style="width: 17%;">週四</th>
                    <th style="width: 17%;">週五</th>
                </tr>
            </thead>
            <tbody>
    `;

    const periods = (systemConfig && systemConfig.periods && systemConfig.periods.length > 0)
        ? systemConfig.periods
        : [
            { id: "1", is_schedulable: true, name: "第一節" },
            { id: "2", is_schedulable: true, name: "第二節" },
            { id: "3", is_schedulable: true, name: "第三節" },
            { id: "4", is_schedulable: true, name: "第四節" },
            { id: "5", is_schedulable: true, name: "第五節" },
            { id: "LUNCH", is_schedulable: false, name: "午休", type: "LUNCH" },
            { id: "6", is_schedulable: true, name: "第六節" },
            { id: "7", is_schedulable: true, name: "第七節" },
            { id: "8", is_schedulable: true, name: "第八節" }
        ];

    periods.forEach(p => {
        if (!p.is_schedulable) {
            const restText = p.type === "LUNCH" ? "☕ 午餐時間" : (p.type === "NAP" ? "💤 午休時間" : "休息時間");
            tableHtml += `
                <tr class="rest-row">
                    <td>${p.name}</td>
                    <td colspan="5">${restText}</td>
                </tr>
            `;
        } else {
            tableHtml += `<tr><td>${p.name}</td>`;
            for (let d = 1; d <= 5; d++) {
                const slotKey = `${d}-${p.id}`;
                const isUnavailable = unavailableSlots.includes(slotKey);

                if (isUnavailable) {
                    tableHtml += `<td class="unavailable-cell">不排課</td>`;
                } else {
                    const scheds = teacherSchedules
                        .filter(s => s.weekday === d && s.period === parseInt(p.id))
                        .sort((a, b) => {
                            if (a.week_type === "ODD" && b.week_type === "EVEN") return -1;
                            if (a.week_type === "EVEN" && b.week_type === "ODD") return 1;
                            return 0;
                        });

                    let cellContent = "";
                    if (scheds.length > 0) {
                        let itemsHtml = "";
                        scheds.forEach(s => {
                            const course = courses.find(c => c.id === s.course_id);
                            const cls = classes.find(c => c.id === s.class_id);
                            const classroom = classrooms.find(cr => cr.id === s.classroom_id);
                            if (course) {
                                const weekTag = s.week_type === "ODD" ? '[單] ' : s.week_type === "EVEN" ? '[雙] ' : '';
                                const roomText = classroom && classroom.name !== "班級教室" ? ` (${classroom.name})` : '';
                                const weekClass = (s.week_type === "ODD" || s.week_type === "EVEN") ? 'alternate-week' : 'every-week';
                                itemsHtml += `
                                    <div class="placed-course ${weekClass}">
                                        <div class="placed-name">${weekTag}${course.name}${roomText}</div>
                                        <div class="placed-footer">
                                            <span>${cls ? cls.name : ''}</span>
                                            <span>${teacherName}</span>
                                        </div>
                                    </div>
                                `;
                            }
                        });
                        cellContent = `<div class="pdf-cell-container">${itemsHtml}</div>`;
                    }
                    tableHtml += `<td>${cellContent}</td>`;
                }
            }
            tableHtml += `</tr>`;
        }
    });

    tableHtml += `</tbody></table>`;

    return `
        <div class="pdf-page">
            <div class="pdf-page-header">
                <h1>${teacherName} 老師個人課表</h1>
                <p>${subtitle}</p>
            </div>
            <div class="pdf-page-body">
                ${tableHtml}
            </div>
        </div>
    `;
}

// --- Tab 分頁切換監聽 ---
function setupTabListeners() {
    const tabBtns = document.querySelectorAll(".tab-btn");
    const contents = document.querySelectorAll(".tab-content");

    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            tabBtns.forEach(b => b.classList.remove("active"));
            contents.forEach(c => c.classList.add("hidden"));

            btn.classList.add("active");
            const tabId = btn.dataset.tab;
            const targetContent = document.getElementById(tabId);
            if (targetContent) targetContent.classList.remove("hidden");

            if (vsClassGroup) vsClassGroup.style.display = "none";
            if (vsTeacherGroup) vsTeacherGroup.style.display = "none";
            if (vsCurriculumGroup) vsCurriculumGroup.style.display = "none";
            if (vsClassroomGroup) vsClassroomGroup.style.display = "none";

            if (tabId === "class-schedule-view") {
                if (vsClassGroup) vsClassGroup.style.display = "flex";
                renderSchedules();
            } else if (tabId === "teacher-schedule-view") {
                if (vsTeacherGroup) vsTeacherGroup.style.display = "flex";
                renderTeacherSchedule();
            } else if (tabId === "classroom-schedule-view") {
                if (vsClassroomGroup) vsClassroomGroup.style.display = "flex";
                renderClassroomSchedule();
            } else if (tabId === "teacher-summary-view") {
                renderTeacherSummary();
            } else if (tabId === "class-curriculum-view") {
                if (vsCurriculumGroup) vsCurriculumGroup.style.display = "flex";
                renderCurriculumView();
            } else if (tabId === "system-settings-view") {
                renderSettingsUI();
            } else if (tabId === "course-matrix-view") {
                renderCourseMatrix();
                renderMatrixTeacherList();
            }
        });
    });
}

function setupConfigEditor() {
    const editor = document.getElementById("setting-config-editor");
    const btnSave = document.getElementById("btn-save-config");

    if (editor && btnSave) {
        editor.value = JSON.stringify(systemConfig, null, 2);

        btnSave.addEventListener("click", async () => {
            try {
                const newConfig = JSON.parse(editor.value);
                systemConfig = newConfig;
                await dbSet("mst_config", systemConfig);
                showToast("設定檔儲存成功，即將重整", "success");
                setTimeout(() => window.location.reload(), 1000);
            } catch (err) {
                showToast("JSON 格式錯誤: " + err.message, "error");
            }
        });
    }
}

async function exportAllClassesPdf() {
    showToast("正在建立班級與專科教室 PDF（共多頁），請稍候...", "info");

    const wrapper = document.createElement("div");
    wrapper.style.cssText = "position:fixed;top:0;left:-9999px;width:794px;";
    document.body.appendChild(wrapper);

    // 1. 班級頁面
    classes.forEach(c => {
        const tutor = teachers.find(t => t.id === c.tutor_id)?.name || "無";
        const subtitle = `導師：${tutor}`;
        wrapper.innerHTML += generateClassGridHtml(c.id, c.name, subtitle);
    });

    // 2. 專科教室頁面
    const specialRooms = classrooms.filter(cr => cr.type !== "普通" && cr.name !== "班級教室");
    specialRooms.forEach(cr => {
        const subtitle = `教室類型：${cr.type} 專用教室`;
        wrapper.innerHTML += generateRoomGridHtml(cr.id, cr.name, subtitle);
    });

    // 等瀏覽器完成佈局
    await new Promise(r => requestAnimationFrame(r));

    try {
        const pdf = new window.jspdf.jsPDF("p", "mm", "a4");
        const pages = wrapper.querySelectorAll(".pdf-page");
        for (let i = 0; i < pages.length; i++) {
            showToast(`正在渲染第 ${i + 1}/${pages.length} 頁...`, "info");
            const canvas = await html2canvas(pages[i], { scale: 2, useCORS: true, logging: false });
            const imgData = canvas.toDataURL("image/jpeg", 0.98);
            if (i > 0) pdf.addPage();
            pdf.addImage(imgData, "JPEG", 0, 0, 210, 297);
        }
        showToast("正在產生 PDF 檔案...", "info");
        pdf.save("全體班級與專科教室總課表.pdf");
        showToast("全體班級與專科教室 PDF 匯出完成！", "success");
    } catch (e) {
        showToast("PDF 匯出失敗：" + e.message, "error");
    } finally {
        if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
    }
}


async function exportAllTeachersPdf() {
    showToast("正在建立教師個人課表 PDF（共多頁），請稍候...", "info");

    const wrapper = document.createElement("div");
    wrapper.style.cssText = "position:fixed;top:0;left:-9999px;width:794px;";
    document.body.appendChild(wrapper);

    teachers.forEach(t => {
        const tutorInfo = t.is_tutor ? "導師" : "專任教師";
        const sub = `身份：${tutorInfo}`;
        wrapper.innerHTML += generateTeacherGridHtml(t.id, t.name, sub, t);
    });

    // 等瀏覽器完成佈局
    await new Promise(r => requestAnimationFrame(r));

    try {
        const pdf = new window.jspdf.jsPDF("p", "mm", "a4");
        const pages = wrapper.querySelectorAll(".pdf-page");
        for (let i = 0; i < pages.length; i++) {
            showToast(`正在渲染第 ${i + 1}/${pages.length} 頁...`, "info");
            const canvas = await html2canvas(pages[i], { scale: 2, useCORS: true, logging: false });
            const imgData = canvas.toDataURL("image/jpeg", 0.98);
            if (i > 0) pdf.addPage();
            pdf.addImage(imgData, "JPEG", 0, 0, 210, 297);
        }
        showToast("正在產生 PDF 檔案...", "info");
        pdf.save("全體教師總課表.pdf");
        showToast("全體教師 PDF 匯出完成！", "success");
    } catch (e) {
        showToast("PDF 匯出失敗：" + e.message, "error");
    } finally {
        if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
    }
}

function setupConfigEditor() {
    const editor = document.getElementById("setting-config-editor");
    const btnSave = document.getElementById("btn-save-config");

    if (editor && btnSave) {
        if (systemConfig) {
            editor.value = JSON.stringify(systemConfig, null, 2);
        }

        btnSave.addEventListener("click", async () => {
            try {
                const parsed = JSON.parse(editor.value);
                
                // 1. 如果輸入包含 periods / classes 頂層物件
                if (parsed.periods) {
                    systemConfig = { periods: parsed.periods };
                } else if (Array.isArray(parsed)) {
                    systemConfig = { periods: parsed };
                } else {
                    systemConfig = parsed;
                }
                await dbSet("mst_config", systemConfig);

                // 2. 如果輸入的 JSON 含有 classes 陣列，自動一併更新班級列表
                if (parsed.classes && Array.isArray(parsed.classes)) {
                    const newClasses = parsed.classes.map((c, idx) => ({
                        id: c.id || (idx + 1),
                        code: c.code || (idx + 101),
                        name: c.name || `${c.grade || 1}年級班`,
                        grade: c.grade || 1,
                        tutor_id: c.tutor_id || null,
                        default_classroom_id: c.default_classroom_id || null
                    }));
                    classes = newClasses;
                    await dbSet("mst_classes", classes);
                }

                showToast("設定檔儲存成功，即將重整", "success");
                setTimeout(() => window.location.reload(), 1000);
            } catch (err) {
                showToast("JSON 格式錯誤: " + err.message, "error");
            }
        });
    }
}

// =========================================================================
// ==================== Tab 6: 課程總表 (Course Matrix) =====================
// =========================================================================

// 常見科目預設順序，未在列表中的排在後面
const SUBJECT_ORDER = ["國語", "數學", "英語", "外師", "自然", "社會", "閱作", "寫字", "體育", "美勞", "音樂", "電腦"];

// 當前選取的教師 ID（課程總表用）
let matrixSelectedTeacherId = null;

/**
 * 動態獲取所有不重複的科目並排序
 */
function getDynamicSubjects() {
    if (!courses) return [];
    const subjectsSet = new Set(courses.map(c => c.name));
    const subjects = Array.from(subjectsSet);

    subjects.sort((a, b) => {
        let indexA = SUBJECT_ORDER.indexOf(a);
        let indexB = SUBJECT_ORDER.indexOf(b);
        if (indexA === -1) indexA = 999;
        if (indexB === -1) indexB = 999;

        if (indexA !== indexB) {
            return indexA - indexB;
        }
        return a.localeCompare(b, "zh-TW");
    });

    return subjects;
}

/**
 * 渲染課程總表左側的班級×科目矩陣
 */
function renderCourseMatrix() {
    const tbody = document.getElementById("course-matrix-body");
    if (!tbody) return;
    tbody.innerHTML = "";

    const subjects = getDynamicSubjects();

    // 動態渲染 Table Header (thead tr)
    const theadTr = document.querySelector("#course-matrix-table thead tr");
    if (theadTr) {
        theadTr.innerHTML = '<th class="sticky-col">班級</th>';
        subjects.forEach(subject => {
            const th = document.createElement("th");
            th.textContent = subject;
            theadTr.appendChild(th);
        });
    }

    // 直接使用 classes 本身（已依據 config.json 的順序）
    const sortedClasses = [...classes];

    sortedClasses.forEach(cls => {
        const tr = document.createElement("tr");

        // 班級名稱固定列
        const tdClass = document.createElement("td");
        tdClass.className = "sticky-col";
        tdClass.textContent = cls.name;
        tr.appendChild(tdClass);

        // 每個科目一個儲存格
        subjects.forEach(subject => {
            const td = document.createElement("td");
            td.className = "matrix-cell";
            td.dataset.classId = cls.id;
            td.dataset.subject = subject;

            // 查找此班級+科目是否已有課程
            const course = courses.find(c => c.class_id === cls.id && c.name === subject);
            if (course) {
                const teacher = teachers.find(t => t.id === course.teacher_id);
                td.classList.add("has-teacher");
                td.innerHTML = `
                    <div class="cell-teacher">${teacher ? teacher.name : "?"}</div>
                    <div class="cell-periods">${course.required_periods}節</div>
                `;
            } else {
                td.classList.add("empty");
                td.textContent = "—";
            }

            // 點擊指派教師
            td.addEventListener("click", () => handleMatrixCellClick(cls.id, subject, td));
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });
}

/**
 * 渲染課程總表右側的教師名單
 */
function renderMatrixTeacherList() {
    const listEl = document.getElementById("matrix-teacher-list");
    if (!listEl) return;
    listEl.innerHTML = "";

    const keyword = matrixTeacherSearch ? matrixTeacherSearch.value.trim().toLowerCase() : "";
    const filteredTeachers = teachers.filter(t => t.name.toLowerCase().includes(keyword));

    // 計算每位教師的總節數
    filteredTeachers.forEach(t => {
        const totalPeriods = courses
            .filter(c => c.teacher_id === t.id)
            .reduce((sum, c) => sum + (c.required_periods || 0), 0);

        const item = document.createElement("div");
        item.className = "matrix-teacher-item";
        if (matrixSelectedTeacherId === t.id) item.classList.add("selected");
        item.dataset.teacherId = t.id;

        let periodBadgeClass = "";
        let periodBadgeStyle = "";
        if (totalPeriods > 24) {
            periodBadgeStyle = "background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.5); font-weight: 700;";
        } else if (totalPeriods > 20) {
            periodBadgeStyle = "background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.5); font-weight: 700;";
        }

        item.innerHTML = `
            <span class="teacher-name">${t.name}</span>
            <span class="teacher-periods" style="${periodBadgeStyle}">${totalPeriods} 節</span>
        `;

        item.addEventListener("click", () => {
            // 切換選取
            if (matrixSelectedTeacherId === t.id) {
                matrixSelectedTeacherId = null;
            } else {
                matrixSelectedTeacherId = t.id;
            }
            // 更新選取狀態 UI
            updateMatrixSelectedUI();
            // 重新高亮
            listEl.querySelectorAll(".matrix-teacher-item").forEach(el => {
                el.classList.toggle("selected", parseInt(el.dataset.teacherId) === matrixSelectedTeacherId);
            });
        });

        listEl.appendChild(item);
    });
}

/**
 * 更新底部已選教師提示
 */
function updateMatrixSelectedUI() {
    const infoEl = document.getElementById("matrix-selected-info");
    const nameEl = document.getElementById("matrix-selected-name");
    if (!infoEl || !nameEl) return;

    if (matrixSelectedTeacherId) {
        const t = teachers.find(t => t.id === matrixSelectedTeacherId);
        nameEl.textContent = t ? `已選取：${t.name}` : "未知教師";
        infoEl.style.display = "flex";
    } else {
        infoEl.style.display = "none";
    }
}

/**
 * 處理課程矩陣儲存格點擊
 */
async function handleMatrixCellClick(classId, subject, tdEl) {
    if (!matrixSelectedTeacherId) {
        showToast("請先在右側點選一位教師", "error");
        return;
    }

    const teacher = teachers.find(t => t.id === matrixSelectedTeacherId);
    if (!teacher) return;

    // 查找此班級+科目是否已有課程
    const existingCourse = courses.find(c => c.class_id === classId && c.name === subject);

    if (existingCourse && existingCourse.teacher_id === matrixSelectedTeacherId) {
        // 已經是同一位老師了，不做事
        showToast(`「${subject}」已經指派給 ${teacher.name}`, "info");
        return;
    }

    try {
        if (existingCourse) {
            existingCourse.teacher_id = matrixSelectedTeacherId;
        } else {
            const newCourse = {
                id: getNextId(courses),
                name: subject,
                teacher_id: matrixSelectedTeacherId,
                class_id: classId,
                classroom_name: "班級教室",
                week_type: "EVERY",
                required_periods: 1,
                paired_course_id: null
            };
            courses.push(newCourse);
        }

        // 寫入前端本地資料庫 (localForage)
        await dbSet("mst_courses", courses);
        syncClassTutors();

        // 效果呈現
        tdEl.classList.remove("empty");
        tdEl.classList.add("has-teacher", "just-assigned");
        tdEl.innerHTML = `
            <div class="cell-teacher">${teacher.name}</div>
            <div class="cell-periods">${existingCourse ? existingCourse.required_periods : 1}節</div>
        `;
        setTimeout(() => tdEl.classList.remove("just-assigned"), 500);

        // 連動更新全系統 UI
        renderMatrixTeacherList();
        renderCurriculumView();
        renderTeacherSummary();
        renderCourses();
        if (typeof populateTeacherSelect === "function") populateTeacherSelect();
        if (typeof renderTeacherSchedule === "function") renderTeacherSchedule();
        if (typeof renderTeacherCourses === "function") renderTeacherCourses(selectTeacher?.value ? parseInt(selectTeacher.value) : null);

        const className = classes.find(c => c.id === classId)?.name || "";
        showToast(`已將「${className}」的「${subject}」指派給 ${teacher.name}`, "success");

    } catch (err) {
        showToast("系統錯誤：" + err.message, "error");
    }
}

/**
 * 初始化課程總表的事件綁定
 */
function setupCourseMatrixListeners() {
    const deselectBtn = document.getElementById("matrix-deselect-btn");
    if (deselectBtn) {
        deselectBtn.addEventListener("click", () => {
            matrixSelectedTeacherId = null;
            updateMatrixSelectedUI();
            document.querySelectorAll(".matrix-teacher-item").forEach(el => el.classList.remove("selected"));
        });
    }

    if (matrixTeacherSearch) {
        matrixTeacherSearch.addEventListener("input", () => {
            renderMatrixTeacherList();
        });
    }
}

// --- 渲染左側教師已安排的科目（教師排課面板） ---
function renderTeacherCourses(teacherId) {
    const poolEl = document.getElementById("teacher-course-pool");
    const poolSection = document.getElementById("teacher-course-pool-section");
    if (!poolEl || !poolSection) return;

    poolEl.innerHTML = "";

    if (!teacherId) {
        poolSection.style.display = "none";
        if (teacherClassroomSelectSection) teacherClassroomSelectSection.style.display = "none";
        return;
    }

    const teacherCourses = courses.filter(c => c.teacher_id === teacherId);

    if (teacherCourses.length === 0) {
        poolEl.innerHTML = `
            <div class="empty-state" style="padding: 10px; font-size: 13px; text-align: center; color: var(--text-muted);">
                <p>此教師目前沒有安排授課科目。</p>
            </div>
        `;
        poolSection.style.display = "block";
        if (teacherClassroomSelectSection) teacherClassroomSelectSection.style.display = "none";
        return;
    }

    poolSection.style.display = "block";
    if (teacherClassroomSelectSection) teacherClassroomSelectSection.style.display = "block";

    teacherCourses.forEach(c => {
        const card = document.createElement("div");
        card.className = `course-card week-${(c.week_type || 'EVERY').toLowerCase()}`;
        if (teacherSelectedCourseId === c.id) {
            card.classList.add("active");
        }

        // 尋找班級名稱
        const cls = classes.find(classItem => classItem.id === c.class_id);
        const className = cls ? cls.name : "未知班級";

        // 計算此課程在此班級已排入的節數
        const scheduledPeriods = schedules
            .filter(s => s.course_id === c.id && s.class_id === c.class_id)
            .reduce((sum, s) => sum + (s.week_type === "EVERY" ? 1.0 : 0.5), 0);
        const required = c.required_periods || 0;
        const remaining = required - scheduledPeriods;
        const isDone = remaining <= 0;

        // 節數顯示標籤
        const periodTag = required > 0
            ? `<span class="period-badge ${isDone ? 'done' : (remaining <= 1 ? 'almost' : '')}">${scheduledPeriods}/${required} 節${isDone ? ' ✓' : ` · 還需 ${remaining} 節`}</span>`
            : `<span class="period-badge">${scheduledPeriods} 節已排</span>`;

        // 科目不區分單雙週，移除教師科目池的單雙週標籤
        const weekBadge = '';

        card.innerHTML = `
            <div class="course-info">
                <span class="course-name">${weekBadge}${c.name} <span class="teacher-inline-name">(${className})</span></span>
                <span class="room-tag">${c.classroom_name}</span>
            </div>
            <div class="course-details">
                ${periodTag}
            </div>
        `;

        // 點擊事件：點選教師排課模式
        card.addEventListener("click", () => {
            if (teacherSelectedCourseId === c.id) {
                teacherSelectedCourseId = null;
                card.classList.remove("active");
                teacherLog(`已取消選取課程「${c.name}」`, "system-msg");
            } else {
                teacherSelectedCourseId = c.id;
                document.querySelectorAll("#teacher-course-pool .course-card").forEach(el => el.classList.remove("active"));
                card.classList.add("active");
                teacherLog(`已選取「${className} - ${c.name}」。請直接點擊右側教師課表空格進行排課。`);
                // 自動切換教室
                autoSwitchClassroomForCourse(c, true);
            }
        });

        poolEl.appendChild(card);
    });
}

// --- 處理教師排課 Click-to-Place 行為 ---
async function handleTeacherCourseClickPlace(courseId, weekday, period, cell) {
    const course = courses.find(c => c.id === courseId);
    if (!course) return;

    const weekTypeEl = document.querySelector('input[name="placing-week-type-teacher"]:checked');
    const weekType = weekTypeEl ? weekTypeEl.value : "EVERY";

    // 檢查班級在該時段是否已有其他衝突的課程 (班級教室衝堂)
    const classConflict = schedules.find(s =>
        s.class_id === course.class_id &&
        s.weekday === weekday &&
        s.period === period &&
        !((weekType === "ODD" && s.week_type === "EVEN") || (weekType === "EVEN" && s.week_type === "ODD"))
    );

    if (classConflict) {
        const existingCourse = courses.find(c => c.id === classConflict.course_id);
        const courseName = existingCourse ? existingCourse.name : "其他課程";
        showToast(`班級教室衝堂：該班級在此時段已有課程「${courseName}」，請先至班級課表取消排課！`, "error");
        teacherLog(`排課失敗：班級教室衝堂，此時段已排定「${courseName}」`, "error");

        // 觸發紅震動與發光動畫
        cell.classList.add("grid-cell-conflict");
        setTimeout(() => cell.classList.remove("grid-cell-conflict"), 1500);
        return;
    }

    let classroomId = teacherSelectClassroom ? (parseInt(teacherSelectClassroom.value) || null) : null;

    const payload = {
        class_id: course.class_id,
        course_id: courseId,
        classroom_id: classroomId,
        weekday: weekday,
        period: period,
        week_type: weekType
    };

    try {
        // 先呼叫後端 API 檢查衝突
        const checkRes = await fetch("/api/schedules/check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!checkRes.ok) {
            showToast("檢查排課衝突失敗！", "error");
            return;
        }

        const checkResult = await checkRes.json();
        if (checkResult.has_conflict) {
            cell.classList.add("grid-cell-conflict");
            setTimeout(() => cell.classList.remove("grid-cell-conflict"), 1500);

            checkResult.conflict_messages.forEach(msg => {
                teacherLog(`排課衝突：${msg}`, "error");
                showToast(msg, "error");
            });
            return;
        }

        // 無衝突，進行寫入
        const res = await fetch("/api/schedules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            await loadAllData();
            showToast("排課成功！", "success");
            teacherLog(`排課成功！已點選排入週 ${weekday} 第 ${period} 節。`, "success");
        } else {
            const err = await res.json();
            const detailMsg = typeof err.detail === "object" ? err.detail.message : err.detail;
            showToast("排課失敗：" + (detailMsg || "伺服器錯誤"), "error");
        }
    } catch (err) {
        showToast("網路錯誤：" + err.message, "error");
        teacherLog("錯誤：" + err.message, "error");
    }
}

// =========================================================================
// ==================== 教室使用課表 (Classroom Schedule) ==================
// =========================================================================

// --- 建立教室課表網格 ---
function generateClassroomGrid() {
    if (!classroomGridBody) return;
    classroomGridBody.innerHTML = "";

    if (!systemConfig || !systemConfig.periods) return;

    systemConfig.periods.forEach((p) => {
        const tr = document.createElement("tr");

        const tdPeriod = document.createElement("td");
        tdPeriod.className = "period-num";

        if (!p.is_schedulable) {
            tr.className = "rest-row";
            tr.style.height = "24px";
            tdPeriod.innerHTML = p.name;
            tdPeriod.style.height = "24px";
            tdPeriod.style.padding = "0";
            tdPeriod.style.minHeight = "24px";
            tr.appendChild(tdPeriod);

            const tdRest = document.createElement("td");
            tdRest.colSpan = 5;
            tdRest.style.textAlign = "center";
            tdRest.style.color = "var(--text-muted)";
            tdRest.style.fontSize = "12px";
            tdRest.style.background = "rgba(15, 23, 42, 0.4)";
            tdRest.style.height = "24px";
            tdRest.style.padding = "0";
            tdRest.innerText = p.type === "LUNCH" ? "☕ 午餐時間" : (p.type === "NAP" ? "💤 午休時間" : "休息時間");
            tr.appendChild(tdRest);
            classroomGridBody.appendChild(tr);
            return;
        }

        tdPeriod.innerHTML = `${p.name}`;
        tr.appendChild(tdPeriod);

        for (let d = 1; d <= 5; d++) {
            const td = document.createElement("td");
            td.className = "dropzone";
            td.dataset.weekday = d;
            td.dataset.period = p.id;
            tr.appendChild(td);
        }
        classroomGridBody.appendChild(tr);
    });
}

// --- 渲染教室使用課表 ---
function renderClassroomSchedule() {
    if (!classroomGridBody) return;

    // 清空課表
    document.querySelectorAll("#classroom-grid-body td.dropzone").forEach(cell => {
        cell.innerHTML = "";
        cell.className = "dropzone";
    });

    const classroomId = selectClassroomView?.value ? parseInt(selectClassroomView.value) : null;
    if (!classroomId) {
        currentClassroomDisplay.textContent = "尚未選擇教室";
        classroomTypeBadge.style.display = "none";
        if (classroomStatPeriods) classroomStatPeriods.textContent = "0";
        return;
    }

    const classroom = classrooms.find(r => r.id === classroomId);
    if (!classroom) return;

    currentClassroomDisplay.textContent = classroom.name;
    classroomLog(`已載入教室「${classroom.name}」的使用課表。`, "system-msg");
    classroomTypeBadge.textContent = classroom.type + "教室";
    classroomTypeBadge.style.display = "inline-block";

    // 篩選出此教室的排課紀錄
    const roomSchedules = schedules.filter(s => s.classroom_id === classroomId);

    const totalPeriods = roomSchedules.reduce((sum, s) => sum + (s.week_type === "EVERY" ? 1.0 : 0.5), 0);
    if (classroomStatPeriods) classroomStatPeriods.textContent = totalPeriods;

    for (let d = 1; d <= 5; d++) {
        for (let p = 1; p <= 8; p++) {
            const cell = document.querySelector(`#classroom-grid-body td[data-weekday="${d}"][data-period="${p}"]`);
            if (!cell) continue;

            // 找尋排課紀錄並排序，確保單週在雙週上方
            const scheds = roomSchedules
                .filter(s => s.weekday === d && s.period === p)
                .sort((a, b) => {
                    if (a.week_type === "ODD" && b.week_type === "EVEN") return -1;
                    if (a.week_type === "EVEN" && b.week_type === "ODD") return 1;
                    return 0;
                });

            scheds.forEach(sched => {
                const cls = classes.find(c => c.id === sched.class_id);
                const course = courses.find(c => c.id === sched.course_id);
                const teacher = course ? teachers.find(t => t.id === course.teacher_id) : null;

                const weekType = (sched && sched.week_type) ? sched.week_type.toLowerCase() : "every";
                const weekBadge = sched && sched.week_type === "ODD" ? '<span class="week-tag inline">[單]</span> ' :
                    sched && sched.week_type === "EVEN" ? '<span class="week-tag inline">[雙]</span> ' : '';

                const div = document.createElement("div");
                div.className = `placed-course week-${weekType}`;
                div.innerHTML = `
                    <div class="placed-header">
                        <span class="placed-name">${weekBadge}${course ? course.name : "未知課程"}</span>
                        <button class="btn-delete-placed" title="取消排課">
                            <i class="fa-solid fa-square-xmark"></i>
                        </button>
                    </div>
                    <div class="placed-footer">
                        <span>${cls ? cls.name : "未知班級"}</span>
                        <span>${teacher ? teacher.name.split(" ")[0] : ""}</span>
                    </div>
                `;

                // 修正取消排課點擊失效 Bug：
                // 在 mousedown 階段阻止冒泡並執行確認與刪除，這能防止父元素卡片啟動 HTML5 拖曳機制而吞噬點擊事件
                div.querySelector(".btn-delete-placed").addEventListener("mousedown", async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    
                    // 阻止隨後的 cell 點擊事件觸發 Click-to-Place 排課
                    ignoreNextClickCell = cell;
                    setTimeout(() => {
                        if (ignoreNextClickCell === cell) ignoreNextClickCell = null;
                    }, 300);

                    if (confirm(`確定要取消「${course ? course.name : ""}」的排課嗎？`)) {
                        await deleteSchedule(sched.id);
                        renderClassroomSchedule(); // 刪除後更新教室課表
                    }
                });

                // 右鍵雙向跳轉
                div.addEventListener("contextmenu", (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const classId = sched.class_id;
                    const className = cls ? cls.name : "該班級";
                    const teacherId = course ? course.teacher_id : null;
                    const teacherName = teacher ? teacher.name : "該教師";

                    const ul = contextMenu?.querySelector("ul");
                    if (ul) {
                        ul.innerHTML = `
                            <li id="menu-item-goto-class"><i class="fa-solid fa-graduation-cap"></i> 前往 ${className} 的課表</li>
                            <li id="menu-item-goto-teacher"><i class="fa-solid fa-user-tie"></i> 前往 ${teacherName} 的課表</li>
                        `;

                        ul.querySelector("#menu-item-goto-class").onclick = () => {
                            const tabBtn = document.querySelector(`.tab-btn[data-tab="class-schedule-view"]`);
                            if (tabBtn) tabBtn.click();
                            if (selectClass) {
                                selectClass.value = classId;
                                selectedClassId = classId;
                                updateClassDisplay();
                                renderSchedules();
                                renderCourses();
                            }
                            contextMenu.classList.add("hidden");
                        };

                        ul.querySelector("#menu-item-goto-teacher").onclick = () => {
                            const tabBtn = document.querySelector(`.tab-btn[data-tab="teacher-schedule-view"]`);
                            if (tabBtn) tabBtn.click();
                            if (selectTeacher) {
                                selectTeacher.value = teacherId;
                                teacherSelectedCourseId = null;
                                renderTeacherSchedule();
                                renderTeacherCourses(teacherId);
                            }
                            contextMenu.classList.add("hidden");
                        };
                    }

                    contextMenu.style.left = `${e.pageX}px`;
                    contextMenu.style.top = `${e.pageY}px`;
                    contextMenu.classList.remove("hidden");
                });

                cell.appendChild(div);
            });
        }
    }
}

// --- 教室日誌 ---
function classroomLog(msg, type = "system-msg") {
    if (!classroomStatusLogger) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const div = document.createElement("div");
    div.className = `log-entry ${type}`;
    div.innerHTML = `[${time}] ${msg}`;
    classroomStatusLogger.appendChild(div);
    classroomStatusLogger.scrollTop = classroomStatusLogger.scrollHeight;
}
