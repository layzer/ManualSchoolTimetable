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
        setupCSVImports(); // CSV 批次匯入整合功能
        setupConfigEditor();
        setupCourseMatrixListeners(); // 課程總表
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
            return; // equivalent to continue in forEach
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
    // 全域點擊時隱藏右鍵選單
    document.addEventListener("click", () => {
        if (contextMenu) contextMenu.classList.add("hidden");
    });
    document.addEventListener("contextmenu", (e) => {
        if (!e.target.closest(".placed-course") && contextMenu) {
            contextMenu.classList.add("hidden");
        }
    });

    // 選擇班級切換
    selectClass.addEventListener("change", (e) => {
        selectedClassId = e.target.value ? parseInt(e.target.value) : null;
        updateClassDisplay();
        renderSchedules();
        renderCourses(); // 切換班級時，也重繪左側與班級特化的課程池
    });

    // 選擇教師切換
    if (selectTeacher) {
        selectTeacher.addEventListener("change", () => {
            teacherSelectedCourseId = null; // 清除選取的課程
            renderTeacherSchedule();
            renderTeacherCourses(selectTeacher.value ? parseInt(selectTeacher.value) : null);
        });
    }

    // 選擇教室切換
    if (selectClassroomView) {
        selectClassroomView.addEventListener("change", () => {
            renderClassroomSchedule();
        });
    }

    // 班級課表重新整理按鈕
    const btnRefreshClass = document.getElementById("btn-refresh-class");
    if (btnRefreshClass) {
        btnRefreshClass.addEventListener("click", async () => {
            const icon = btnRefreshClass.querySelector("i");
            icon.style.animation = "spin 0.6s linear";
            setTimeout(() => { icon.style.animation = ""; }, 700);
            try {
                await reloadSchedules();
                await (async () => {
                    const [resCourses] = await Promise.all([fetch("/api/courses")]);
                    courses = await resCourses.json();
                })();
                renderSchedules();
                renderCourses();
                renderTeacherSummary();
                log("課表資料已重新整理！", "success");
                showToast("課表資料已重新整理！", "success");
            } catch (e) {
                log("重新整理失敗：" + e.message, "error");
                showToast("重新整理失敗", "error");
            }
        });
    }

    // 教師課表重新整理按鈕
    const btnRefreshTeacher = document.getElementById("btn-refresh-teacher");
    if (btnRefreshTeacher) {
        btnRefreshTeacher.addEventListener("click", async () => {
            const icon = btnRefreshTeacher.querySelector("i");
            icon.style.animation = "spin 0.6s linear";
            setTimeout(() => { icon.style.animation = ""; }, 700);
            try {
                await reloadSchedules();
                await (async () => {
                    const [resCourses] = await Promise.all([fetch("/api/courses")]);
                    courses = await resCourses.json();
                })();
                renderTeacherSchedule();
                renderTeacherCourses(selectTeacher?.value ? parseInt(selectTeacher.value) : null);
                renderTeacherSummary();
                teacherLog("課表資料已重新整理！", "success");
                showToast("課表資料已重新整理！", "success");
            } catch (e) {
                teacherLog("重新整理失敗：" + e.message, "error");
                showToast("重新整理失敗", "error");
            }
        });
    }

    // 教室課表重新整理按鈕
    const btnRefreshClassroom = document.getElementById("btn-refresh-classroom");
    if (btnRefreshClassroom) {
        btnRefreshClassroom.addEventListener("click", async () => {
            const icon = btnRefreshClassroom.querySelector("i");
            if (icon) {
                icon.style.animation = "spin 0.6s linear";
                setTimeout(() => { icon.style.animation = ""; }, 700);
            }
            try {
                await reloadSchedules();
                await (async () => {
                    const [resCourses] = await Promise.all([fetch("/api/courses")]);
                    courses = await resCourses.json();
                })();
                renderClassroomSchedule();
                classroomLog("課表資料已重新整理！", "success");
                showToast("課表資料已重新整理！", "success");
            } catch (e) {
                classroomLog("重新整理失敗：" + e.message, "error");
                showToast("重新整理失敗", "error");
            }
        });
    }


    // 新增教師表單切換與送出
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
                const res = await fetch("/api/teachers", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, is_tutor: isTutor })
                });

                if (res.ok) {
                    showToast("新增教師成功！", "success");
                    formAddTeacher.reset();
                    formAddTeacher.style.display = "none";
                    await loadAllData();
                } else {
                    const err = await res.json();
                    showToast("新增失敗：" + (err.detail || "伺服器錯誤"), "error");
                }
            } catch (err) {
                showToast("網路錯誤：" + err.message, "error");
            }
        });
    }



    // 課表放置區 Drag & Drop 監聽
    gridBody.addEventListener("dragover", (e) => {
        const cell = e.target.closest(".dropzone");
        if (cell && !cell.classList.contains("not-available")) {
            e.preventDefault(); // 允許放置
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

        // 重設拖曳狀態
        draggedCourseId = null;
        draggedScheduleId = null;
    });
}

// --- 載入所有基礎資料 ---
async function loadAllData() {
    try {
        const [resConfig, resClasses, resClassrooms, resTeachers, resCourses, resSchedules] = await Promise.all([
            fetch("/api/config"),
            fetch("/api/classes"),
            fetch("/api/classrooms"),
            fetch("/api/teachers"),
            fetch("/api/courses"),
            fetch("/api/schedules")
        ]);

        systemConfig = await resConfig.json();
        classes = await resClasses.json();
        classrooms = await resClassrooms.json();
        teachers = await resTeachers.json();
        courses = await resCourses.json();
        schedules = await resSchedules.json();

        // 偵測到資料庫全空時自動加載示範資料
        if (teachers.length === 0 && courses.length === 0) {
            try {
                const initRes = await fetch("/api/init-demo-data", { method: "POST" });
                if (initRes.ok) {
                    const [resTeachers2, resCourses2, resClassrooms2] = await Promise.all([
                        fetch("/api/teachers"),
                        fetch("/api/courses"),
                        fetch("/api/classrooms")
                    ]);
                    teachers = await resTeachers2.json();
                    courses = await resCourses2.json();
                    classrooms = await resClassrooms2.json();
                }
            } catch (initErr) {
                console.error("自動載入範例資料失敗:", initErr);
            }
        }

        generateGrid();
        generateTeacherGrid();
        generateClassroomGrid();

        populateSelectors();
        updateClassDisplay();
        renderCourses();
        renderSchedules();

        // 重新繪製教師與總表分頁的資料
        populateTeacherSelect();
        renderTeacherSchedule();
        renderTeacherCourses(selectTeacher.value ? parseInt(selectTeacher.value) : null);
        renderTeacherSummary();
        populateMgtSelectors();

        // 重新繪製教室課表
        renderClassroomSchedule();

        // 重新繪製班級課程設定分頁
        populateCurriculumSelectors();
        renderCurriculumView();

        // 繪製系統設定分頁
        renderSettingsUI();

        // 繪製課程總表
        renderCourseMatrix();
        renderMatrixTeacherList();
    } catch (err) {
        log("資料載入失敗，請確認 API 伺服器已啟動: " + err.message, "error");
    }
}

// --- 填充下拉選單 ---
function populateSelectors() {
    // 班級
    selectClass.innerHTML = '<option value="">-- 請選擇班級 --</option>';
    classes.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = `${c.name} (${c.grade}年級)`;
        if (selectedClassId === c.id) opt.selected = true;
        selectClass.appendChild(opt);
    });

    // 如果尚未選擇且有班級，預設選第一個
    if (!selectedClassId && classes.length > 0) {
        selectedClassId = classes[0].id;
        selectClass.value = selectedClassId;
    }

    // 教室
    selectClassroom.innerHTML = "";
    if (teacherSelectClassroom) teacherSelectClassroom.innerHTML = "";
    if (selectClassroomView) selectClassroomView.innerHTML = '<option value="">-- 請選擇科任教室 --</option>';
    classrooms.forEach(cr => {
        const opt = document.createElement("option");
        opt.value = cr.id;
        opt.textContent = `${cr.name} [${cr.type}]`;
        selectClassroom.appendChild(opt.cloneNode(true));
        if (teacherSelectClassroom) {
            teacherSelectClassroom.appendChild(opt.cloneNode(true));
        }
        if (selectClassroomView && cr.name !== "班級教室" && cr.type !== "普通") {
            selectClassroomView.appendChild(opt.cloneNode(true));
        }
    });

    // 預設選擇第一個科任教室
    if (selectClassroomView && !selectClassroomView.value) {
        const nonNormalClassroom = classrooms.find(cr => cr.name !== "班級教室" && cr.type !== "普通");
        if (nonNormalClassroom) {
            selectClassroomView.value = nonNormalClassroom.id;
        }
    }
}

// --- 更新上方班級顯示狀態與設定預設教室 ---
function updateClassDisplay() {
    const activeClass = classes.find(c => c.id === selectedClassId);

    // 重設所有格子的放學遮罩 (無放學佔位，全面開啟排課)
    document.querySelectorAll(".dropzone").forEach(cell => {
        cell.classList.remove("not-available");
    });

    if (activeClass) {
        currentClassDisplay.textContent = activeClass.name;
        classGradeBadge.textContent = `${activeClass.grade} 年級`;
        classGradeBadge.style.display = "inline-block";

        // 自動將授課教室切換為該班級的預設班級教室
        if (activeClass.default_classroom_id) {
            selectClassroom.value = activeClass.default_classroom_id;
        }
    } else {
        currentClassDisplay.textContent = "尚未選擇班級";
        classGradeBadge.style.display = "none";
    }
}

// 標記某天某節次範圍為放學遮罩
function applyDismissalMask(weekday, startPeriod, endPeriod) {
    for (let p = startPeriod; p <= endPeriod; p++) {
        const cell = document.querySelector(`.dropzone[data-weekday="${weekday}"][data-period="${p}"]`);
        if (cell) {
            cell.classList.add("not-available");
        }
    }
}

// --- 渲染待排課程池 (Sidebar) ---
function renderCourses() {
    coursePool.innerHTML = "";
    if (courses.length === 0) {
        coursePool.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-folder-open"></i>
                <p>請先點擊上方「初始化範例資料」按鈕</p>
            </div>
        `;
        unscheduledCount.textContent = "0";
        return;
    }

    // 只篩選屬於目前選定班級的課程
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

        // 尋找教師名稱
        const teacher = teachers.find(t => t.id === c.teacher_id);
        const teacherName = teacher ? teacher.name : "未知教師";
        const teacherShortName = teacherName.split(" ")[0]; // 取得姓與名

        // 計算此課程在目前班級已排入的節數（EVERY 算 1.0，ODD/EVEN 算 0.5）
        const scheduledPeriods = schedules
            .filter(s => s.course_id === c.id && s.class_id === selectedClassId)
            .reduce((sum, s) => sum + (s.week_type === "EVERY" ? 1.0 : 0.5), 0);
        const required = c.required_periods || 0;
        const remaining = required - scheduledPeriods;
        const isDone = remaining <= 0;

        // 節數顯示標籤
        const periodTag = required > 0
            ? `<span class="period-badge ${isDone ? 'done' : (remaining <= 1 ? 'almost' : '')}">${scheduledPeriods}/${required} 節${isDone ? ' ✓' : ` · 還需 ${remaining} 節`}</span>`
            : `<span class="period-badge">${scheduledPeriods} 節已排</span>`;

        // 教室名稱對應
        const roomLabel = c.classroom_name;

        // 科目不區分單雙週，移除待排池的單雙週標籤
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

        // 拖曳事件
        card.addEventListener("dragstart", (e) => {
            draggedCourseId = c.id;
            draggedScheduleId = null; // 代表從池子拖曳 (全新排課)
            e.dataTransfer.effectAllowed = "move";

            // 自動切換教室
            autoSwitchClassroomForCourse(c);
        });

        // 點擊事件：點選排課模式
        card.addEventListener("click", () => {
            if (selectedCourseId === c.id) {
                // 取消選取
                selectedCourseId = null;
                card.classList.remove("active");
                log(`已取消選取課程「${c.name}」`, "system-msg");
            } else {
                // 選取課程
                selectedCourseId = c.id;
                document.querySelectorAll(".course-card").forEach(el => el.classList.remove("active"));
                card.classList.add("active");
                log(`已點選「${c.name} (${teacherShortName})」課程。請直接點擊右側課表空格進行排課（可點擊多節）。`);

                // 自動切換教室
                autoSwitchClassroomForCourse(c);
            }
        });

        coursePool.appendChild(card);
    });

    // 計算尚有剩餘節數的課程數量（角標顯示）
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
    // 清空現有單元格中的放置課表（限定在班級課表分頁）
    document.querySelectorAll("#class-schedule-view .dropzone").forEach(cell => {
        // 保留 dataset，但清空內容
        cell.querySelectorAll(".placed-course").forEach(p => p.remove());
    });

    if (!selectedClassId) return;

    // 篩選出該班級的排課紀錄並排序，確保單週在雙週上方
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

        // 拖曳已排課表 (移位調整)
        div.addEventListener("dragstart", (e) => {
            draggedScheduleId = s.id;
            draggedCourseId = s.course_id; // 同步，方便衝突檢測
            e.dataTransfer.effectAllowed = "move";
            // 稍微延遲讓拖曳陰影正常顯示，原格子暫時變半透明
            setTimeout(() => div.style.opacity = "0.4", 0);
        });

        div.addEventListener("dragend", () => {
            div.style.opacity = "1";
        });

        // 修正取消排課點擊失效 Bug：
        // 1. 在 mousedown 階段阻止冒泡，這能防止父元素卡片啟動 HTML5 拖曳機制
        div.querySelector(".btn-delete-placed").addEventListener("mousedown", (e) => {
            e.stopPropagation();
            ignoreNextClickCell = cell;
            setTimeout(() => {
                if (ignoreNextClickCell === cell) ignoreNextClickCell = null;
            }, 300);
        });

        // 2. 在 click 階段執行確認與刪除，此處為同步的使用者觸發上下文，confirm 絕對不會被瀏覽器封鎖
        div.querySelector(".btn-delete-placed").addEventListener("click", async (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (confirm(`確定要取消「${course.name}」的排課嗎？`)) {
                await deleteSchedule(s.id);
            }
        });

        // 右鍵跳轉教師課表
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

// --- 處理 Drop 排課行為 ---
async function handleCourseDrop(weekday, period, classroomId, cell) {
    let weekType = "EVERY";
    if (draggedScheduleId) {
        const orig = schedules.find(s => s.id === draggedScheduleId);
        if (orig) weekType = orig.week_type;
    } else {
        const weekTypeEl = document.querySelector('input[name="placing-week-type-class"]:checked');
        weekType = weekTypeEl ? weekTypeEl.value : "EVERY";
    }

    const payload = {
        class_id: selectedClassId,
        course_id: draggedScheduleId ? schedules.find(s => s.id === draggedScheduleId)?.course_id : draggedCourseId,
        classroom_id: classroomId,
        weekday: weekday,
        period: period,
        week_type: weekType
    };

    try {
        // 先呼叫後端 API 檢查衝突
        const checkUrl = `/api/schedules/check` + (draggedScheduleId ? `?exclude_id=${draggedScheduleId}` : "");
        const checkRes = await fetch(checkUrl, {
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
                log(`排課衝突：${msg}`, "error");
                showToast(msg, "error");
            });
            return;
        }

        // 無衝突，進行寫入
        let res;
        if (draggedScheduleId) {
            res = await fetch(`/api/schedules/${draggedScheduleId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
        } else {
            res = await fetch("/api/schedules", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
        }

        if (res.ok) {
            await loadAllData();
            showToast(draggedScheduleId ? "課表調整成功！" : "排課成功！", "success");
            log(draggedScheduleId ? `課表調整成功！將課程排至週 ${weekday} 第 ${period} 節。` : `排課成功！已將課程排至週 ${weekday} 第 ${period} 節。`, "success");
        } else {
            const err = await res.json();
            const detailMsg = typeof err.detail === "object" ? err.detail.message : err.detail;
            showToast("排課失敗：" + (detailMsg || "伺服器錯誤"), "error");
        }
    } catch (err) {
        showToast("網路錯誤：" + err.message, "error");
    }
}

// --- 處理 Click-to-Place 排課行為 ---
async function handleCourseClickPlace(courseId, weekday, period, classroomId, cell) {
    const weekTypeEl = document.querySelector('input[name="placing-week-type-class"]:checked');
    const weekType = weekTypeEl ? weekTypeEl.value : "EVERY";

    const payload = {
        class_id: selectedClassId,
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
                log(`排課衝突：${msg}`, "error");
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
            showToast("點選排課成功！", "success");
            log(`排課成功！已點選排入週 ${weekday} 第 ${period} 節。`, "success");
        } else {
            const err = await res.json();
            const detailMsg = typeof err.detail === "object" ? err.detail.message : err.detail;
            showToast("排課失敗：" + (detailMsg || "伺服器錯誤"), "error");
        }
    } catch (err) {
        showToast("網路錯誤：" + err.message, "error");
    }
}

// --- 刪除課表 ---
async function deleteSchedule(scheduleId) {
    try {
        const res = await fetch(`/api/schedules/${scheduleId}`, { method: "DELETE" });
        if (res.ok) {
            await loadAllData();
            showToast("已成功取消排課！", "success");
            log("已成功取消一節排課紀錄。", "system-msg");
        } else {
            showToast("取消排課失敗", "error");
        }
    } catch (err) {
        log("刪除錯誤：" + err.message, "error");
    }
}

// --- 輔助函式：狀態日誌記錄 ---
function log(msg, type = "system-msg") {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const div = document.createElement("div");
    div.className = `log-entry ${type}`;
    div.innerHTML = `[${time}] ${msg}`;
    statusLogger.appendChild(div);

    // 自動滾動到底部
    statusLogger.scrollTop = statusLogger.scrollHeight;
}

// --- 輔助函式：Toast 彈出訊息 ---
function showToast(msg, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    let icon = "fa-circle-info";
    if (type === "success") icon = "fa-circle-check";
    if (type === "error") icon = "fa-triangle-exclamation";

    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <div>${msg}</div>
    `;

    toastContainer.appendChild(toast);

    // 3.5秒後自動淡出刪除
    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(120%)";
        toast.style.transition = "all 0.5s ease";
        setTimeout(() => toast.remove(), 500);
    }, 3500);
}

// --- 根據課程要求的教室類型，自動切換教室選單 ---
function autoSwitchClassroomForCourse(course, isTeacherView = false) {
    if (!course) return;

    // 尋找名稱完全符合的教室
    let targetRoom = classrooms.find(cr => cr.name === course.classroom_name);
    const selectEl = isTeacherView ? teacherSelectClassroom : selectClassroom;
    if (!selectEl) return;

    // 如果是班級教室，則用目前班級的 default_classroom_id
    if (course.classroom_name === "班級教室") {
        const activeClassId = isTeacherView ? course.class_id : selectedClassId;
        const activeClass = classes.find(c => c.id === activeClassId);
        if (activeClass && activeClass.default_classroom_id) {
            selectEl.value = activeClass.default_classroom_id;
            if (isTeacherView) teacherLog(`已自動切換授課場地至「班級教室」`);
            else log(`已自動切換授課場地至「班級教室」`);
            return;
        }
    }

    if (targetRoom) {
        selectEl.value = targetRoom.id;
        if (isTeacherView) teacherLog(`已自動切換授課場地至「${targetRoom.name}」`);
        else log(`已自動切換授課場地至「${targetRoom.name}」`);
    }
}

// =========================================================================
// ==================== 以下為三大介面擴充之新增功能 =====================
// =========================================================================

// --- 建立教師個人課表網格 ---
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

            td.addEventListener("click", (e) => {
                if (ignoreNextClickCell === td) {
                    ignoreNextClickCell = null;
                    return;
                }
                if (e.target.closest(".btn-delete-placed")) return;

                const weekday = parseInt(td.dataset.weekday);
                const period = parseInt(td.dataset.period);

                if (teacherSelectedCourseId) {
                    handleTeacherCourseClickPlace(teacherSelectedCourseId, weekday, period, td);
                } else {
                    if (e.target.closest(".placed-course")) return; // 有課時點擊無效，避免轉為不可排課時段
                    handleTeacherSlotClick(weekday, period, td);
                }
            });
            tr.appendChild(td);
        }
        teacherGridBody.appendChild(tr);
    });
}

// --- 實作 Tab 分頁切換行為 ---
function setupTabListeners() {
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach(c => c.classList.add("hidden"));

            btn.classList.add("active");
            const targetTab = btn.dataset.tab;
            document.getElementById(targetTab).classList.remove("hidden");

            // 更新右上角 view-selector
            if (vsClassGroup) vsClassGroup.style.display = "none";
            if (vsTeacherGroup) vsTeacherGroup.style.display = "none";
            if (vsCurriculumGroup) vsCurriculumGroup.style.display = "none";
            if (vsClassroomGroup) vsClassroomGroup.style.display = "none";

            if (targetTab === "class-schedule-view") {
                if (vsClassGroup) vsClassGroup.style.display = "flex";
            } else if (targetTab === "teacher-schedule-view") {
                if (vsTeacherGroup) vsTeacherGroup.style.display = "flex";
            } else if (targetTab === "class-curriculum-view") {
                if (vsCurriculumGroup) vsCurriculumGroup.style.display = "flex";
            } else if (targetTab === "classroom-schedule-view") {
                if (vsClassroomGroup) vsClassroomGroup.style.display = "flex";
            }

            // 切換 Tab 後即時刷新資料
            if (targetTab === "teacher-schedule-view") {
                populateTeacherSelect();
                renderTeacherSchedule();
                renderTeacherCourses(selectTeacher.value ? parseInt(selectTeacher.value) : null);
            } else if (targetTab === "classroom-schedule-view") {
                renderClassroomSchedule();
            } else if (targetTab === "teacher-summary-view") {
                renderTeacherSummary();
                populateMgtSelectors();
            } else if (targetTab === "class-schedule-view") {
                renderSchedules();
                renderCourses();
            } else if (targetTab === "class-curriculum-view") {
                populateCurriculumSelectors();
                renderCurriculumView();
            } else if (targetTab === "course-matrix-view") {
                renderCourseMatrix();
                renderMatrixTeacherList();
                updateMatrixSelectedUI();
            }
        });
    });
}

// --- 填充教師下拉選單 ---
function populateTeacherSelect() {
    if (!selectTeacher) return;
    const currentVal = selectTeacher.value;
    selectTeacher.innerHTML = '<option value="">-- 請選擇教師 --</option>';
    teachers.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent = t.is_tutor ? `${t.name} (導師)` : t.name;
        selectTeacher.appendChild(opt);
    });
    if (currentVal && teachers.some(t => t.id === parseInt(currentVal))) {
        selectTeacher.value = currentVal;
    } else if (teachers.length > 0) {
        selectTeacher.value = teachers[0].id;
    }

}

// --- 渲染教師個人課表與統計 ---
function renderTeacherSchedule() {
    if (!teacherGridBody) return;

    // 清空課表
    document.querySelectorAll("#teacher-grid-body td.dropzone").forEach(cell => {
        cell.innerHTML = "";
        cell.className = "dropzone";
    });

    const teacherId = selectTeacher.value ? parseInt(selectTeacher.value) : null;
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
    teacherLog(`已載入教師「${teacher.name}」的個人課表與統計。`, "system-msg");
    teacherTutorBadge.style.display = teacher.is_tutor ? "inline-block" : "none";

    // 篩選出此教師的排課紀錄
    const teacherSchedules = schedules.filter(s => {
        const c = courses.find(course => course.id === s.course_id);
        return c && c.teacher_id === teacherId;
    });

    const totalPeriods = teacherSchedules.reduce((sum, s) => sum + (s.week_type === "EVERY" ? 1.0 : 0.5), 0);
    teacherStatPeriods.textContent = totalPeriods;

    // 統計教授年級數去重
    const gradesSet = new Set();
    teacherSchedules.forEach(s => {
        const cls = classes.find(c => c.id === s.class_id);
        if (cls) {
            gradesSet.add(cls.grade);
        }
    });
    teacherStatGrades.textContent = gradesSet.size;

    // 標記不可排課時段與已排課程
    const unavailableSlots = teacher.unavailable_slots || [];

    for (let d = 1; d <= 5; d++) {
        for (let p = 1; p <= 8; p++) {
            const cell = document.querySelector(`#teacher-grid-body td[data-weekday="${d}"][data-period="${p}"]`);
            if (!cell) continue;

            const slotKey = `${d}-${p}`;
            if (unavailableSlots.includes(slotKey)) {
                cell.classList.add("unavailable-cell");
            }

            // 找尋排課紀錄並排序，確保單週在雙週上方
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

                // 修正取消排課點擊失效 Bug：
                // 1. 在 mousedown 階段阻止冒泡，這能防止父元素卡片啟動 HTML5 拖曳機制
                div.querySelector(".btn-delete-placed").addEventListener("mousedown", (e) => {
                    e.stopPropagation();
                    ignoreNextClickCell = cell;
                    setTimeout(() => {
                        if (ignoreNextClickCell === cell) ignoreNextClickCell = null;
                    }, 300);
                });

                // 2. 在 click 階段執行確認與刪除，此處為同步的使用者觸發上下文，confirm 絕對不會被瀏覽器封鎖
                div.querySelector(".btn-delete-placed").addEventListener("click", async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (confirm(`確定要取消「${course.name}」的排課嗎？`)) {
                        await deleteSchedule(sched.id);
                    }
                });

                // 右鍵跳轉班級課表
                div.addEventListener("contextmenu", (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const classId = sched.class_id;
                    const cls = classes.find(c => c.id === classId);
                    const className = cls ? cls.name : "該班級";

                    const ul = contextMenu?.querySelector("ul");
                    if (ul) {
                        ul.innerHTML = `<li id="menu-item-goto"></li>`;
                    }

                    const menuItemGoto = document.getElementById("menu-item-goto");
                    if (menuItemGoto && contextMenu) {
                        menuItemGoto.innerHTML = `<i class="fa-solid fa-arrow-right-to-bracket"></i> 前往 ${className} 的課表`;
                        menuItemGoto.onclick = () => {
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

                        contextMenu.style.left = `${e.pageX}px`;
                        contextMenu.style.top = `${e.pageY}px`;
                        contextMenu.classList.remove("hidden");
                    }
                });

                cell.appendChild(div);
                cell.classList.remove("unavailable-cell"); // 有課時強制覆蓋不可排樣式
            });
        }
    }
}

// --- 處理不排課時段設定點擊 ---
async function handleTeacherSlotClick(weekday, period, cell) {
    const teacherId = selectTeacher.value ? parseInt(selectTeacher.value) : null;
    if (!teacherId) {
        showToast("請先選擇教師！", "error");
        return;
    }

    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher) return;

    // 有課則不允許設定不排課
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
        const res = await fetch(`/api/teachers/${teacherId}/unavailable-slots`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(unavailableSlots)
        });

        if (res.ok) {
            const updated = await res.json();
            teachers = teachers.map(t => t.id === updated.id ? updated : t);
            showToast("教師不排課時間段更新成功！", "success");
            renderTeacherSchedule();
        } else {
            showToast("更新失敗", "error");
        }
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
    // 1. 教師與空堂
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

    // 2. 專科教室
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

    // 3. 班級科目
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

    const dataLines = lines.slice(1); // skip header
    const entries = [];

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
            entries.push({ teacher_name: name, unavailable_slots: slots });
        });
        await uploadCSVData("/api/teachers/import-with-slots", { entries });
    } else if (type === "classrooms") {
        dataLines.forEach(line => {
            const cols = line.split(",");
            const name = (cols[0] || "").trim();
            if (!name) return;
            entries.push({
                name: name,
                type: (cols[1] || "").trim() || "普通"
            });
        });
        await uploadCSVData("/api/classrooms/import-csv", { entries });
    } else if (type === "courses") {
        dataLines.forEach(line => {
            const cols = line.split(",");
            const className = (cols[0] || "").trim();
            const subject = (cols[1] || "").trim();
            if (!className || !subject) return;
            entries.push({
                class_name: className,
                subject: subject,
                periods: parseInt(cols[2]) || 1,
                teacher_name: (cols[3] || "").trim(),
                classroom_name: (cols[4] || "").trim() || null,
                week_type: (cols[5] || "EVERY").trim().toUpperCase()
            });
        });
        await uploadCSVData("/api/courses/import-csv", { entries });
    }
}

async function uploadCSVData(url, payload) {
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (res.ok) {
            showToast(`匯入成功！共新增/更新 ${result.success_count} 筆資料`, "success");
            if (result.failed_entries && result.failed_entries.length > 0) {
                console.warn("部分匯入失敗:", result.failed_entries);
                showToast(`有 ${result.failed_entries.length} 筆資料匯入失敗，請查看控制台`, "error");
            }
            await loadAllData();
        } else {
            showToast("匯入失敗：" + (result.detail || "伺服器錯誤"), "error");
        }
    } catch (err) {
        showToast("網路錯誤：" + err.message, "error");
    }
}

async function reloadSchedules() {
    try {
        const res = await fetch("/api/schedules");
        if (res.ok) schedules = await res.json();
    } catch (e) {
        console.error("reloadSchedules error", e);
    }
}

// --- 渲染教師統計總表 (Tab 3) ---
function renderTeacherSummary() {
    if (!teacherSummaryTableBody) return;
    teacherSummaryTableBody.innerHTML = "";

    teachers.forEach(t => {
        const tr = document.createElement("tr");

        // 姓名
        const tdName = document.createElement("td");
        tdName.innerHTML = `<strong>${t.name}</strong>`;
        tr.appendChild(tdName);

        // 授課節數與教授年級
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
        // 計算此教師所有課程的「計劃總節數」與「已排入節數」
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

        // 負責班級與科目學科一覽（附節數進度）
        const tdCourses = document.createElement("td");
        const ul = document.createElement("ul");

        if (teacherCourses.length === 0) {
            tdCourses.innerHTML = '<span class="text-muted" style="font-size: 13px;">無指派科目</span>';
        } else {
            // 排序課程
            teacherCourses.sort((a, b) => {
                const clsA = classes.find(c => c.id === a.class_id)?.name || "";
                const clsB = classes.find(c => c.id === b.class_id)?.name || "";
                return clsA.localeCompare(clsB);
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

    // 班級
    mgtSelectClass.innerHTML = '<option value="">-- 選擇班級 --</option>';
    classes.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.name;
        mgtSelectClass.appendChild(opt);
    });

    // 教師
    mgtSelectTeacher.innerHTML = '<option value="">-- 選擇教師 --</option>';
    teachers.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent = t.name;
        mgtSelectTeacher.appendChild(opt);
    });

    renderMgtCoursesList();
}

// --- 渲染現有班級授課學科清單 ---
function renderMgtCoursesList() {
    if (!mgtCoursesListBody) return;
    mgtCoursesListBody.innerHTML = "";

    // 依班級排序
    const sortedCourses = [...courses].sort((a, b) => {
        const classA = classes.find(c => c.id === a.class_id)?.name || "";
        const classB = classes.find(c => c.id === b.class_id)?.name || "";
        return classA.localeCompare(classB);
    });

    if (sortedCourses.length === 0) {
        mgtCoursesListBody.innerHTML = '<tr><td colspan="4" class="text-muted" style="text-align: center; padding: 20px;">無現有科目配置</td></tr>';
        return;
    }

    sortedCourses.forEach(c => {
        const tr = document.createElement("tr");
        const cls = classes.find(classObj => classObj.id === c.class_id);

        const tdClass = document.createElement("td");
        tdClass.textContent = cls ? cls.name : "通用 / 未指派";
        tr.appendChild(tdClass);

        const tdSubject = document.createElement("td");
        tdSubject.innerHTML = `<strong>${c.name}</strong> <span class="text-muted" style="font-size: 11px;">[${c.classroom_name}]</span>`;
        tr.appendChild(tdSubject);

        // 即時變更教師下拉選單
        const tdTeacher = document.createElement("td");
        const select = document.createElement("select");
        select.className = "mini-select";

        teachers.forEach(t => {
            const opt = document.createElement("option");
            opt.value = t.id;
            opt.textContent = t.name;
            if (t.id === c.teacher_id) opt.selected = true;
            select.appendChild(opt);
        });

        select.addEventListener("change", async () => {
            const newTeacherId = parseInt(select.value);
            await handleUpdateCourseTeacher(c.id, newTeacherId);
        });

        tdTeacher.appendChild(select);
        tr.appendChild(tdTeacher);

        // 刪除按鈕
        const tdAction = document.createElement("td");
        const btnDel = document.createElement("button");
        btnDel.className = "btn-danger-icon";
        btnDel.title = "刪除此學科";
        btnDel.innerHTML = '<i class="fa-solid fa-trash-can"></i>';

        btnDel.addEventListener("click", async () => {
            const className = cls ? cls.name : '未指派班級';
            if (confirm(`確定要刪除「${className} - ${c.name}」課程配置嗎？這會清除該班級的此待排課程卡片。`)) {
                await handleDeleteCourse(c.id);
            }
        });

        tdAction.appendChild(btnDel);
        tr.appendChild(tdAction);

        mgtCoursesListBody.appendChild(tr);
    });
}

// --- 呼叫 API 更新課程指派教師 ---
async function handleUpdateCourseTeacher(courseId, newTeacherId) {
    const course = courses.find(c => c.id === courseId);
    if (!course) return;

    const payload = {
        name: course.name,
        teacher_id: newTeacherId,
        class_id: course.class_id,
        classroom_name: course.classroom_name,
        week_type: course.week_type,
        required_periods: course.required_periods || 1,
        paired_course_id: course.paired_course_id
    };

    try {
        const res = await fetch(`/api/courses/${courseId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            const updated = await res.json();
            courses = courses.map(c => c.id === updated.id ? updated : c);
            showToast("授課教師變更成功！", "success");
            renderTeacherSummary();
            renderSchedules();
        } else {
            const err = await res.json();
            showToast("變更失敗：" + (err.detail || "伺服器錯誤"), "error");
        }
    } catch (err) {
        showToast("網路錯誤：" + err.message, "error");
    }
}

// --- 刪除授課課程 ---
async function handleDeleteCourse(courseId) {
    try {
        const res = await fetch(`/api/courses/${courseId}`, {
            method: "DELETE"
        });

        if (res.ok) {
            courses = courses.filter(c => c.id !== courseId);
            showToast("學科配置刪除成功！", "success");

            // 重新渲染清單與總表
            renderMgtCoursesList();
            renderTeacherSummary();
            renderCourses();
        } else {
            const err = await res.json();
            const detailMsg = typeof err.detail === "object" ? err.detail.message : err.detail;
            showToast("刪除失敗：" + (detailMsg || "該課程目前已被排入課表中，請先將其從課表移除"), "error");
        }
    } catch (err) {
        showToast("網路錯誤：" + err.message, "error");
    }
}

// --- 表單新增班級授課配置監聽器 ---
function setupFormAddCourseListener() {
    if (!formAddCourse) return;

    formAddCourse.addEventListener("submit", async (e) => {
        e.preventDefault();

        const classId = parseInt(mgtSelectClass.value);
        const courseName = mgtInputCourseName.value.trim();
        const teacherId = parseInt(mgtSelectTeacher.value);
        const classroomName = mgtSelectClassroomName.value;

        if (!classId || !courseName || !teacherId) {
            showToast("請填寫所有必要欄位！", "error");
            return;
        }

        const payload = {
            name: courseName,
            teacher_id: teacherId,
            class_id: classId,
            classroom_name: classroomName,
            week_type: "EVERY",
            required_periods: 1,
            paired_course_id: null
        };

        try {
            const res = await fetch("/api/courses", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const newCourse = await res.json();
                courses.push(newCourse);
                showToast("新增班級授課配置成功！", "success");

                // 清空表單科目輸入
                mgtInputCourseName.value = "";

                // 重新渲染
                renderMgtCoursesList();
                renderTeacherSummary();
                renderCourses(); // 更新排課畫面的待排池
            } else {
                showToast("新增授課配置失敗！", "error");
            }
        } catch (err) {
            showToast("網路錯誤：" + err.message, "error");
        }
    });
}

// =========================================================================
// ==================== Tab 4: 班級課程設定介面功能 ========================
// =========================================================================

// --- 填充 Tab 4 班級選單與教師選單 ---
function populateCurriculumSelectors() {
    if (!currSelectClass) return;
    const prevVal = currSelectClass.value;
    currSelectClass.innerHTML = '<option value="">-- 請選擇班級 --</option>';
    classes.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = `${c.name} (${c.grade} 年級)`;
        currSelectClass.appendChild(opt);
    });
    if (prevVal && classes.some(c => c.id === parseInt(prevVal))) {
        currSelectClass.value = prevVal;
    } else if (classes.length > 0) {
        currSelectClass.value = classes[0].id;
    }

    // 教師選單
    if (currSelectTeacher) {
        const prevTeacher = currSelectTeacher.value;
        currSelectTeacher.innerHTML = '<option value="">-- 選擇教師 --</option>';
        teachers.forEach(t => {
            const opt = document.createElement("option");
            opt.value = t.id;
            opt.textContent = t.name;
            currSelectTeacher.appendChild(opt);
        });
        if (prevTeacher && teachers.some(t => t.id === parseInt(prevTeacher))) {
            currSelectTeacher.value = prevTeacher;
        }
    }

    // 教室名稱
    if (currSelectClassroomName) {
        currSelectClassroomName.innerHTML = '';
        classrooms.forEach(cr => {
            const opt = document.createElement("option");
            opt.value = cr.name;
            opt.textContent = cr.name;
            currSelectClassroomName.appendChild(opt);
        });
        if (classrooms.some(cr => cr.name === "班級教室")) {
            currSelectClassroomName.value = "班級教室";
        }
    }
}

// --- 渲染 Tab 4 課程設定表格 ---
function renderCurriculumView() {
    if (!curriculumTableBody) return;
    curriculumTableBody.innerHTML = "";

    const classId = currSelectClass ? parseInt(currSelectClass.value) : null;
    if (!classId) {
        curriculumTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 24px; color: var(--text-muted);">請選擇班級以檢視課程設定</td></tr>';
        return;
    }

    const classCourses = courses.filter(c => c.class_id === classId);

    // 更新統計晶片
    const totalPlanned = classCourses.reduce((s, c) => s + (c.required_periods || 0), 0);
    const totalScheduled = classCourses.reduce((sum, c) => {
        const scCount = schedules
            .filter(sc => sc.course_id === c.id && sc.class_id === classId)
            .reduce((total, sc) => total + (sc.week_type === "EVERY" ? 1.0 : 0.5), 0);
        return sum + scCount;
    }, 0);
    const remaining = totalPlanned - totalScheduled;

    if (currStatSubjects) currStatSubjects.textContent = classCourses.length;
    if (currStatTotal) currStatTotal.textContent = totalPlanned;
    if (currStatRemaining) currStatRemaining.textContent = Math.max(0, remaining);

    if (classCourses.length === 0) {
        curriculumTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 24px; color: var(--text-muted);">此班級尚無課程設定，請於下方新增科目</td></tr>';
        return;
    }

    classCourses.forEach(c => {
        const tr = document.createElement("tr");
        const teacher = teachers.find(t => t.id === c.teacher_id);
        const scheduledCount = schedules
            .filter(s => s.course_id === c.id && s.class_id === classId)
            .reduce((sum, s) => sum + (s.week_type === "EVERY" ? 1.0 : 0.5), 0);
        const required = c.required_periods || 0;
        const pct = required > 0 ? Math.min(100, Math.round(scheduledCount / required * 100)) : 0;
        const isDone = scheduledCount >= required && required > 0;
        const isOver = scheduledCount > required;

        // 科目名稱（可行內編輯）
        const tdName = document.createElement("td");
        tdName.innerHTML = `<strong>${c.name}</strong>`;
        tr.appendChild(tdName);

        // 任課教師（即時可換）
        const tdTeacher = document.createElement("td");
        const tSelect = document.createElement("select");
        tSelect.className = "mini-select";
        teachers.forEach(t => {
            const opt = document.createElement("option");
            opt.value = t.id;
            opt.textContent = t.name;
            if (t.id === c.teacher_id) opt.selected = true;
            tSelect.appendChild(opt);
        });
        tSelect.addEventListener("change", async () => {
            await handleCurriculumUpdateCourse(c.id, { teacher_id: parseInt(tSelect.value) });
        });
        tdTeacher.appendChild(tSelect);
        tr.appendChild(tdTeacher);

        // 教室（可換）
        const tdRoom = document.createElement("td");
        const rSelect = document.createElement("select");
        rSelect.className = "mini-select";
        classrooms.forEach(cr => {
            const opt = document.createElement("option");
            opt.value = cr.name;
            opt.textContent = cr.name;
            if (cr.name === c.classroom_name) opt.selected = true;
            rSelect.appendChild(opt);
        });
        rSelect.addEventListener("change", async () => {
            await handleCurriculumUpdateCourse(c.id, { classroom_name: rSelect.value });
        });
        tdRoom.appendChild(rSelect);
        tr.appendChild(tdRoom);

        // 計劃節數（可行內修改）
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

        // 已排入課表
        const tdScheduled = document.createElement("td");
        tdScheduled.innerHTML = `<span style="font-size: 15px; font-weight: 700; color: ${isDone ? '#10b981' : 'var(--accent-cyan)'};">${scheduledCount}</span>`;
        tr.appendChild(tdScheduled);

        // 尚需節數
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

        // 進度條
        const tdPct = document.createElement("td");
        tdPct.innerHTML = `
            <div class="progress-bar-wrap">
                <div class="progress-bar-fill ${isDone ? 'complete' : (isOver ? 'over' : '')}" style="width: ${pct}%"></div>
            </div>
            <span class="progress-text">${pct}%</span>
        `;
        tr.appendChild(tdPct);

        // 刪除按鈕
        const tdAction = document.createElement("td");
        const btnDel = document.createElement("button");
        btnDel.className = "btn-danger-icon";
        btnDel.title = "刪除此科目";
        btnDel.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
        btnDel.addEventListener("click", async () => {
            if (confirm(`確定要刪除班級的「${c.name}」科目設定嗎？此操作不可復原。`)) {
                await handleDeleteCourse(c.id);
                renderCurriculumView();
            }
        });
        tdAction.appendChild(btnDel);
        tr.appendChild(tdAction);

        curriculumTableBody.appendChild(tr);
    });
}

// --- 處理 Tab 4 課程屬性即時更新 ---
async function handleCurriculumUpdateCourse(courseId, changes) {
    const course = courses.find(c => c.id === courseId);
    if (!course) return;

    const payload = {
        name: course.name,
        teacher_id: course.teacher_id,
        class_id: course.class_id,
        classroom_name: course.classroom_name,
        week_type: course.week_type,
        required_periods: course.required_periods || 1,
        paired_course_id: course.paired_course_id,
        ...changes
    };

    try {
        const res = await fetch(`/api/courses/${courseId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            const updated = await res.json();
            courses = courses.map(c => c.id === updated.id ? updated : c);
            showToast("課程設定已更新！", "success");
            renderCurriculumView();
            renderTeacherSummary();
            renderCourses();
        } else {
            const err = await res.json();
            showToast("更新失敗：" + (err.detail || "伺服器錯誤"), "error");
        }
    } catch (err) {
        showToast("網路錯誤：" + err.message, "error");
    }
}

// --- Tab 4 新增科目至班級的表單監聽 ---
function setupCurriculumFormListener() {
    if (!formCurrAddCourse) return;

    // 當切換班級時，重新渲染表格
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

        const payload = {
            name: courseName,
            teacher_id: teacherId,
            class_id: classId,
            classroom_name: classroomName,
            week_type: "EVERY",
            required_periods: requiredPeriods,
            paired_course_id: null
        };

        try {
            const res = await fetch("/api/courses", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const newCourse = await res.json();
                courses.push(newCourse);
                showToast(`新增「${courseName}」成功！`, "success");
                currInputName.value = "";
                currInputPeriods.value = "2";

                renderCurriculumView();
                renderTeacherSummary();
                populateMgtSelectors();
                renderCourses();
            } else {
                showToast("新增失敗！", "error");
            }
        } catch (err) {
            showToast("網路錯誤：" + err.message, "error");
        }
    });
}

// --- Tab 5: 系統設定功能 ---

function setupSettingsListeners() {
    // 1. 新增班級
    if (formSettingAddClass) {
        formSettingAddClass.addEventListener("submit", async (e) => {
            e.preventDefault();
            const codeVal = document.getElementById("setting-input-class-code").value.trim();
            const payload = {
                code: codeVal ? codeVal : null,
                name: settingInputClassName.value.trim(),
                grade: parseInt(settingInputClassGrade.value),
                tutor_id: settingSelectClassTutor.value ? parseInt(settingSelectClassTutor.value) : null,
                default_classroom_id: settingSelectClassRoom.value ? parseInt(settingSelectClassRoom.value) : null
            };
            try {
                const res = await fetch("/api/classes", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    showToast("班級新增成功", "success");
                    formSettingAddClass.reset();
                    await loadAllData();
                } else {
                    const err = await res.json();
                    showToast(err.detail || "新增失敗", "error");
                }
            } catch (error) {
                console.error(error);
                showToast("網路錯誤", "error");
            }
        });
    }

    // 2. 匯出系統 JSON
    if (btnExportSystem) {
        btnExportSystem.addEventListener("click", async () => {
            try {
                const res = await fetch("/api/system/export");
                if (res.ok) {
                    const data = await res.json();
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `STC_Backup_${new Date().toISOString().split('T')[0]}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    showToast("系統資料已匯出", "success");
                }
            } catch (error) {
                showToast("匯出失敗", "error");
            }
        });
    }

    // 3. 匯入系統 JSON
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
                    const res = await fetch("/api/system/import", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(jsonPayload)
                    });
                    if (res.ok) {
                        showToast("系統資料匯入成功，即將重整頁面", "success");
                        setTimeout(() => window.location.reload(), 1500);
                    } else {
                        const err = await res.json();
                        showToast(err.detail || "匯入失敗", "error");
                    }
                } catch (error) {
                    showToast("檔案讀取或匯入失敗", "error");
                }
                e.target.value = ""; // clear
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

    // 6. 匯出全部班級與專科教室 PDF (A4直向滿版)
    const btnExportClassPdf = document.getElementById("btn-export-class-pdf");
    if (btnExportClassPdf) {
        btnExportClassPdf.addEventListener("click", () => {
            exportAllClassesPdf();
        });
    }

    // 7. 匯出全部教師 PDF (A4直向滿版)
    const btnExportTeacherPdf = document.getElementById("btn-export-teacher-pdf");
    if (btnExportTeacherPdf) {
        btnExportTeacherPdf.addEventListener("click", () => {
            exportAllTeachersPdf();
        });
    }
}

function renderSettingsUI() {
    // 填充導師選項
    if (settingSelectClassTutor) {
        settingSelectClassTutor.innerHTML = '<option value="">無導師</option>';
        teachers.forEach(t => {
            if (t.is_tutor) {
                settingSelectClassTutor.innerHTML += `<option value="${t.id}">${t.name}</option>`;
            }
        });
    }

    // 填充預設教室選項
    if (settingSelectClassRoom) {
        settingSelectClassRoom.innerHTML = '<option value="">無預設教室</option>';
        classrooms.forEach(r => {
            if (r.type === '普通') {
                settingSelectClassRoom.innerHTML += `<option value="${r.id}">${r.name}</option>`;
            }
        });
    }

    // 繪製班級列表
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

    // 填充匯出下拉選單
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
}

async function deleteClass(classId) {
    if (!confirm("確定要刪除此班級嗎？若該班級尚有課程或課表將無法刪除。")) return;
    try {
        const res = await fetch(`/api/classes/${classId}`, { method: "DELETE" });
        if (res.ok) {
            showToast("班級已刪除", "success");
            await loadAllData();
        } else {
            const err = await res.json();
            showToast(err.detail || "刪除失敗", "error");
        }
    } catch (err) {
        showToast("網路錯誤", "error");
    }
}

function exportAllClassesCsv() {
    if (classes.length === 0) {
        showToast("無班級資料可匯出", "error");
        return;
    }

    let csvContent = "\uFEFF"; // BOM for Excel UTF-8

    // 檔頭
    const weekdays = ["一", "二", "三", "四", "五"];
    const periods = [1, 2, 3, 4, 5, 6, 7, 8];
    let headers = ["班級名稱"];
    weekdays.forEach(w => {
        periods.forEach(p => {
            headers.push(`${w}${p}`);
        });
    });
    csvContent += headers.join(",") + "\n";

    // 填寫每一行 (班級)
    classes.forEach(cls => {
        let row = [cls.name];
        for (let d = 1; d <= 5; d++) {
            for (let p = 1; p <= 8; p++) {
                // 找出此班級、此 weekday=d、此 period=p 的所有排課紀錄並排序，確保單週在雙週前
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
        csvContent += row.join(",") + "\n";
    });

    // 填寫每一行 (專科教室)
    const specialRooms = classrooms.filter(cr => cr.type !== "普通" && cr.name !== "班級教室");
    specialRooms.forEach(cr => {
        let row = [cr.name];
        for (let d = 1; d <= 5; d++) {
            for (let p = 1; p <= 8; p++) {
                // 找出此教室、此 weekday=d、此 period=p 的所有排課紀錄並排序，確保單週在雙週前
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

function exportAllTeachersCsv() {
    if (teachers.length === 0) {
        showToast("無教師資料可匯出", "error");
        return;
    }

    let csvContent = "\uFEFF"; // BOM for Excel UTF-8

    // 檔頭
    const weekdays = ["一", "二", "三", "四", "五"];
    const periods = [1, 2, 3, 4, 5, 6, 7, 8];
    let headers = ["教師姓名"];
    weekdays.forEach(w => {
        periods.forEach(p => {
            headers.push(`${w}${p}`);
        });
    });
    csvContent += headers.join(",") + "\n";

    // 填寫每一行 (教師)
    teachers.forEach(t => {
        let row = [t.name];
        for (let d = 1; d <= 5; d++) {
            for (let p = 1; p <= 8; p++) {
                // 檢查是否不可排課
                const slotStr = `${d}-${p}`;
                if (t.unavailable_slots && t.unavailable_slots.includes(slotStr)) {
                    row.push('"🚫不可排"');
                    continue;
                }

                // 找出此教師、此 weekday=d、此 period=p 的所有排課紀錄並排序，確保單週在雙週前
                const scheds = schedules
                    .filter(s => {
                        const course = courses.find(c => c.id === s.course_id);
                        return course && course.teacher_id === t.id && s.weekday === d && s.period === p;
                    })
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
        csvContent += row.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `全體教師總課表.csv`;
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

    const periodNames = {
        "1": "第一節",
        "2": "第二節",
        "3": "第三節",
        "4": "第四節",
        "5": "第五節",
        "6": "第六節",
        "7": "第七節",
        "8": "第八節"
    };

    const schedulePeriods = [
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

    schedulePeriods.forEach(p => {
        if (!p.is_schedulable) {
            tableHtml += `
                <tr class="rest-row">
                    <td>${p.name}</td>
                    <td colspan="5">☕ 午餐與午休時間</td>
                </tr>
            `;
        } else {
            tableHtml += `<tr><td>${periodNames[p.id]}</td>`;
            for (let d = 1; d <= 5; d++) {
                const scheds = classSchedules
                    .filter(s => s.weekday === d && s.period === parseInt(p.id))
                    .sort((a, b) => {
                        if (a.week_type === "ODD" && b.week_type === "EVEN") return -1;
                        if (a.week_type === "EVEN" && b.week_type === "ODD") return 1;
                        return 0;
                    });
                tableHtml += `<td>`;
                scheds.forEach(s => {
                    const course = courses.find(c => c.id === s.course_id);
                    const teacher = course ? teachers.find(t => t.id === course.teacher_id) : null;
                    const classroom = classrooms.find(cr => cr.id === s.classroom_id);

                    if (course) {
                        const weekTag = s.week_type === "ODD" ? '<span class="week-tag inline">[單]</span> ' :
                            s.week_type === "EVEN" ? '<span class="week-tag inline">[雙]</span> ' : '';

                        tableHtml += `
                            <div class="placed-course">
                                <div class="placed-name">${weekTag}${course.name}</div>
                                <div class="placed-footer">
                                    <span>${teacher ? teacher.name.split(" ")[0] : ""}</span>
                                    <span>${classroom ? classroom.name : "班級教室"}</span>
                                </div>
                            </div>
                        `;
                    }
                });
                tableHtml += `</td>`;
            }
            tableHtml += `</tr>`;
        }
    });

    tableHtml += `</tbody></table>`;

    return `
        <div class="pdf-page">
            <div class="pdf-page-header">
                <h1>${className} 班級課表</h1>
                <p>${subtitle}</p>
            </div>
            <div class="pdf-page-body">
                ${tableHtml}
            </div>
        </div>
    `.trim();
}

// --- PDF 匯出輔助函式：動態生成專科教室課表網格 HTML ---
function generateRoomGridHtml(classroomId, classroomName, subtitle) {
    const roomSchedules = schedules.filter(s => s.classroom_id === classroomId);

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

    const periodNames = {
        "1": "第一節",
        "2": "第二節",
        "3": "第三節",
        "4": "第四節",
        "5": "第五節",
        "6": "第六節",
        "7": "第七節",
        "8": "第八節"
    };

    const schedulePeriods = [
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

    schedulePeriods.forEach(p => {
        if (!p.is_schedulable) {
            tableHtml += `
                <tr class="rest-row">
                    <td>${p.name}</td>
                    <td colspan="5">☕ 午餐與午休時間</td>
                </tr>
            `;
        } else {
            tableHtml += `<tr><td>${periodNames[p.id]}</td>`;
            for (let d = 1; d <= 5; d++) {
                const scheds = roomSchedules
                    .filter(s => s.weekday === d && s.period === parseInt(p.id))
                    .sort((a, b) => {
                        if (a.week_type === "ODD" && b.week_type === "EVEN") return -1;
                        if (a.week_type === "EVEN" && b.week_type === "ODD") return 1;
                        return 0;
                    });
                tableHtml += `<td>`;
                scheds.forEach(s => {
                    const course = courses.find(c => c.id === s.course_id);
                    const teacher = course ? teachers.find(t => t.id === course.teacher_id) : null;
                    const cls = classes.find(c => c.id === s.class_id);

                    if (course) {
                        const weekTag = s.week_type === "ODD" ? '<span class="week-tag inline">[單]</span> ' :
                            s.week_type === "EVEN" ? '<span class="week-tag inline">[雙]</span> ' : '';

                        tableHtml += `
                            <div class="placed-course">
                                <div class="placed-name">${weekTag}${course.name}</div>
                                <div class="placed-footer">
                                    <span>${cls ? cls.name : ""}</span>
                                    <span>${teacher ? teacher.name.split(" ")[0] : ""}</span>
                                </div>
                            </div>
                        `;
                    }
                });
                tableHtml += `</td>`;
            }
            tableHtml += `</tr>`;
        }
    });

    tableHtml += `</tbody></table>`;

    return `
        <div class="pdf-page">
            <div class="pdf-page-header">
                <h1>${classroomName} 教室使用課表</h1>
                <p>${subtitle}</p>
            </div>
            <div class="pdf-page-body">
                ${tableHtml}
            </div>
        </div>
    `.trim();
}

// --- PDF 匯出輔助函式：動態生成教師課表網格 HTML ---
function generateTeacherGridHtml(teacherId, teacherName, subtitle, teacherObj) {
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

    const periodNames = {
        "1": "第一節",
        "2": "第二節",
        "3": "第三節",
        "4": "第四節",
        "5": "第五節",
        "6": "第六節",
        "7": "第七節",
        "8": "第八節"
    };

    const schedulePeriods = [
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

    schedulePeriods.forEach(p => {
        if (!p.is_schedulable) {
            tableHtml += `
                <tr class="rest-row">
                    <td>${p.name}</td>
                    <td colspan="5">☕ 午餐與午休時間</td>
                </tr>
            `;
        } else {
            tableHtml += `<tr><td>${periodNames[p.id]}</td>`;
            for (let d = 1; d <= 5; d++) {
                // 檢查是否不可排課
                const slotKey = `${d}-${p.id}`;
                if (teacherObj.unavailable_slots && teacherObj.unavailable_slots.includes(slotKey)) {
                    tableHtml += `<td class="unavailable-cell">🚫不可排</td>`;
                    continue;
                }

                // 找出此教師在該時段的所有排課紀錄並排序，確保單週在雙週上方
                const scheds = schedules
                    .filter(s => {
                        const course = courses.find(c => c.id === s.course_id);
                        return course && course.teacher_id === teacherId && s.weekday === d && s.period === parseInt(p.id);
                    })
                    .sort((a, b) => {
                        if (a.week_type === "ODD" && b.week_type === "EVEN") return -1;
                        if (a.week_type === "EVEN" && b.week_type === "ODD") return 1;
                        return 0;
                    });

                tableHtml += `<td>`;
                scheds.forEach(s => {
                    const course = courses.find(c => c.id === s.course_id);
                    const cls = classes.find(c => c.id === s.class_id);
                    const classroom = classrooms.find(cr => cr.id === s.classroom_id);

                    if (course) {
                        const weekTag = s.week_type === "ODD" ? '<span class="week-tag inline">[單]</span> ' :
                            s.week_type === "EVEN" ? '<span class="week-tag inline">[雙]</span> ' : '';

                        tableHtml += `
                            <div class="placed-course">
                                <div class="placed-name">${weekTag}${course.name}</div>
                                <div class="placed-footer">
                                    <span>${cls ? cls.name : ""}</span>
                                    <span>${classroom ? classroom.name : "班級教室"}</span>
                                </div>
                            </div>
                        `;
                    }
                });
                tableHtml += `</td>`;
            }
            tableHtml += `</tr>`;
        }
    });

    tableHtml += `</tbody></table>`;

    return `
        <div class="pdf-page">
            <div class="pdf-page-header">
                <h1>${teacherName} 個人課表</h1>
                <p>${subtitle}</p>
            </div>
            <div class="pdf-page-body">
                ${tableHtml}
            </div>
        </div>
    `.trim();
}

async function exportAllClassesPdf() {
    showToast("正在建立班級與專科教室 PDF（共多頁），請稍候...", "info");

    const wrapper = document.createElement("div");
    wrapper.style.cssText = "position:fixed;top:0;left:-9999px;width:794px;";
    document.body.appendChild(wrapper);

    // 1. 班級頁面
    classes.forEach(c => {
        const tutor = teachers.find(t => t.id === c.tutor_id)?.name || "無";
        const defaultRoom = classrooms.find(cr => cr.id === c.default_classroom_id)?.name || "班級教室";
        const subtitle = `導師：${tutor} | 班級教室：${defaultRoom}`;
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
        editor.value = JSON.stringify(systemConfig, null, 2);

        btnSave.addEventListener("click", async () => {
            try {
                const newConfig = JSON.parse(editor.value);
                const res = await fetch("/api/config", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(newConfig)
                });

                if (res.ok) {
                    showToast("設定檔儲存成功，即將重整", "success");
                    setTimeout(() => window.location.reload(), 1000);
                } else {
                    const err = await res.json();
                    showToast("儲存失敗：" + err.detail, "error");
                }
            } catch (err) {
                showToast("JSON 格式錯誤或網路錯誤: " + err.message, "error");
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

    // 按年級→班級代碼排序
    const sortedClasses = [...classes].sort((a, b) => {
        if (a.grade !== b.grade) return a.grade - b.grade;
        return a.code.localeCompare(b.code, "zh-TW");
    });

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

        item.innerHTML = `
            <span class="teacher-name">${t.name}</span>
            <span class="teacher-periods">${totalPeriods} 節</span>
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
        const payload = {
            name: subject,
            teacher_id: matrixSelectedTeacherId,
            class_id: classId,
            classroom_name: "班級教室",
            week_type: "EVERY",
            required_periods: existingCourse ? existingCourse.required_periods : 1
        };

        if (existingCourse) {
            // 更新現有課程的教師
            const res = await fetch(`/api/courses/${existingCourse.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                const updated = await res.json();
                courses = courses.map(c => c.id === updated.id ? updated : c);
            } else {
                showToast("更新失敗", "error");
                return;
            }
        } else {
            // 新增課程
            const res = await fetch("/api/courses", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                const newCourse = await res.json();
                courses.push(newCourse);
            } else {
                showToast("新增失敗", "error");
                return;
            }
        }

        // 更新格子顯示
        tdEl.classList.remove("empty");
        tdEl.classList.add("has-teacher", "just-assigned");
        tdEl.innerHTML = `
            <div class="cell-teacher">${teacher.name}</div>
            <div class="cell-periods">${existingCourse ? existingCourse.required_periods : 1}節</div>
        `;
        setTimeout(() => tdEl.classList.remove("just-assigned"), 500);

        // 更新教師名單的節數顯示
        renderMatrixTeacherList();

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
                // 1. 在 mousedown 階段阻止冒泡，這能防止父元素卡片啟動 HTML5 拖曳機制
                div.querySelector(".btn-delete-placed").addEventListener("mousedown", (e) => {
                    e.stopPropagation();
                    ignoreNextClickCell = cell;
                    setTimeout(() => {
                        if (ignoreNextClickCell === cell) ignoreNextClickCell = null;
                    }, 300);
                });

                // 2. 在 click 階段執行確認與刪除，此處為同步的使用者觸發上下文，confirm 絕對不會被瀏覽器封鎖
                div.querySelector(".btn-delete-placed").addEventListener("click", async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
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
