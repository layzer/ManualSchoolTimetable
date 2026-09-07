// static/js/tab-teacher-summary.js
// --- Tab 3: 教師總表、課程管理與 Tab 6: 課程總表矩陣 (Course Matrix) ---

import { state, dom } from './state.js';
import { dbSet, getNextId, syncClassTutors } from './storage.js';
import { showToast } from './utils.js';

let refreshAllViews = null;

export function setTeacherSummaryRefreshCallback(cb) {
    refreshAllViews = cb;
}

// 常見科目預設順序，未在列表中的排在後面
export const SUBJECT_ORDER = ["國語", "數學", "英語", "外師", "自然", "社會", "閱作", "寫字", "體育", "美勞", "音樂", "電腦"];

/**
 * 動態獲取所有不重複的科目並排序
 */
export function getDynamicSubjects() {
    if (!state.courses) return [];
    const subjectsSet = new Set(state.courses.map(c => c.name));
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

// --- 渲染教師統計總表 (Tab 3) ---
export function renderTeacherSummary() {
    if (!dom.teacherSummaryTableBody) return;
    dom.teacherSummaryTableBody.innerHTML = "";

    state.teachers.forEach(t => {
        const tr = document.createElement("tr");

        const tdName = document.createElement("td");
        tdName.innerHTML = `<strong>${t.name}</strong>`;
        tr.appendChild(tdName);

        const teacherSchedules = state.schedules.filter(s => {
            const c = state.courses.find(course => course.id === s.course_id);
            return c && c.teacher_id === t.id;
        });

        const gradesSet = new Set();
        teacherSchedules.forEach(s => {
            const cls = state.classes.find(c => c.id === s.class_id);
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
        const teacherCourses = state.courses.filter(c => c.teacher_id === t.id);
        const plannedTotal = teacherCourses.reduce((sum, c) => sum + (c.required_periods || 0), 0);
        const scheduledCount = teacherSchedules.reduce((sum, s) => sum + (s.week_type === "ODD" || s.week_type === "EVEN" ? 0.5 : 1.0), 0);
        const allDone = plannedTotal > 0 && scheduledCount >= plannedTotal;
        tdPeriods.innerHTML = `
            <span class="stat-value" style="font-size: 15px; color: var(--accent-cyan); font-weight:700;">${scheduledCount}</span>
            <span style="font-size: 13px; color: var(--text-muted);">/ ${plannedTotal} 節</span>
            ${allDone ? '<span class="badge-complete" style="margin-left: 6px;">✓ 排滿</span>' : (scheduledCount > plannedTotal && plannedTotal > 0 ? `<span class="badge-pending" style="margin-left: 6px; background:rgba(239,68,68,0.15);border-color:rgba(239,68,68,0.4);color:#f87171;">超出 ${scheduledCount - plannedTotal} 節</span>` : (plannedTotal > 0 ? `<span class="badge-pending" style="margin-left: 6px;">差 ${plannedTotal - scheduledCount} 節</span>` : ''))}
        `;
        tr.appendChild(tdPeriods);

        const tdCourses = document.createElement("td");
        const ul = document.createElement("ul");

        if (teacherCourses.length === 0) {
            tdCourses.innerHTML = '<span class="text-muted" style="font-size: 13px;">無指派科目</span>';
        } else {
            teacherCourses.sort((a, b) => {
                const idxA = state.classes.findIndex(c => c.id === a.class_id);
                const idxB = state.classes.findIndex(c => c.id === b.class_id);
                const valA = idxA === -1 ? 9999 : idxA;
                const valB = idxB === -1 ? 9999 : idxB;
                return valA - valB;
            }).forEach(c => {
                const cls = state.classes.find(classObj => classObj.id === c.class_id);
                const cScheduled = state.schedules
                    .filter(s => s.course_id === c.id && s.class_id === c.class_id)
                    .reduce((sum, s) => sum + (s.week_type === "ODD" || s.week_type === "EVEN" ? 0.5 : 1.0), 0);
                const cRequired = c.required_periods || 0;
                const li = document.createElement("li");
                li.title = `已排 ${cScheduled} / 需排 ${cRequired} 節`;
                li.textContent = `${cls ? cls.name : '未定班級'}: ${c.name} (${cScheduled}/${cRequired})`;
                ul.appendChild(li);
            });
            tdCourses.appendChild(ul);
        }
        tr.appendChild(tdCourses);

        dom.teacherSummaryTableBody.appendChild(tr);
    });
}

// --- 填充班級課程與教師指派管理下拉選單 ---
export function populateMgtSelectors() {
    if (!dom.mgtSelectClass || !dom.mgtSelectTeacher) return;
    const prevClass = dom.mgtSelectClass.value;
    const prevTeacher = dom.mgtSelectTeacher.value;

    dom.mgtSelectClass.innerHTML = '<option value="">-- 選擇班級 --</option>';
    state.classes.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.name;
        if (prevClass && String(c.id) === String(prevClass)) opt.selected = true;
        dom.mgtSelectClass.appendChild(opt);
    });
    if (prevClass && state.classes.some(c => String(c.id) === String(prevClass))) {
        dom.mgtSelectClass.value = prevClass;
    }

    dom.mgtSelectTeacher.innerHTML = '<option value="">-- 選擇教師 --</option>';
    state.teachers.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent = t.name;
        if (prevTeacher && String(t.id) === String(prevTeacher)) opt.selected = true;
        dom.mgtSelectTeacher.appendChild(opt);
    });
    if (prevTeacher && state.teachers.some(t => String(t.id) === String(prevTeacher))) {
        dom.mgtSelectTeacher.value = prevTeacher;
    }
}

// --- 渲染 Tab 3 管理表格 ---
export function renderMgtCoursesList() {
    if (!dom.mgtCoursesListBody) return;
    dom.mgtCoursesListBody.innerHTML = "";

    const classId = dom.mgtSelectClass?.value ? parseInt(dom.mgtSelectClass.value) : null;
    if (!classId) return;

    const classCourses = state.courses.filter(c => c.class_id === classId);
    classCourses.forEach(c => {
        const teacher = state.teachers.find(t => t.id === c.teacher_id);
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td><strong>${c.name}</strong></td>
            <td>${teacher ? teacher.name : "未指派"}</td>
            <td>${c.classroom_name}</td>
            <td>${c.required_periods || 1} 節</td>
            <td>
                <button class="btn btn-secondary btn-sm btn-delete-mgt-course" data-course-id="${c.id}" style="color: var(--accent-pink);">
                    <i class="fa-solid fa-trash"></i> 刪除
                </button>
            </td>
        `;
        tr.querySelector(".btn-delete-mgt-course")?.addEventListener("click", () => handleDeleteCourse(c.id));
        dom.mgtCoursesListBody.appendChild(tr);
    });
}

// --- 刪除課程 helper ---
export async function handleDeleteCourse(courseId) {
    state.courses = state.courses.filter(c => c.id !== courseId);
    state.schedules = state.schedules.filter(s => s.course_id !== courseId);
    await dbSet("mst_courses", state.courses);
    await dbSet("mst_schedules", state.schedules);
    syncClassTutors();
    showToast("已成功刪除課程！", "success");
    if (refreshAllViews) await refreshAllViews();
}
window.handleDeleteCourse = handleDeleteCourse;

// --- Tab 3 新增/異動課程事件 ---
export function setupFormAddCourseListener() {
    if (!dom.mgtSelectClass) return;

    dom.mgtSelectClass.addEventListener("change", () => {
        renderMgtCoursesList();
    });

    if (dom.formAddCourse) {
        dom.formAddCourse.addEventListener("submit", async (e) => {
            e.preventDefault();
            const classId = parseInt(dom.mgtSelectClass.value);
            const courseName = dom.mgtInputCourseName.value.trim();
            const teacherId = parseInt(dom.mgtSelectTeacher.value);
            const classroomName = dom.mgtSelectClassroomName.value;

            if (!classId || !courseName || !teacherId) {
                showToast("請填寫所有欄位！", "error");
                return;
            }

            try {
                let course = state.courses.find(c => c.class_id === classId && c.name === courseName);
                if (course) {
                    course.teacher_id = teacherId;
                    course.classroom_name = classroomName;
                } else {
                    state.courses.push({
                        id: getNextId(state.courses),
                        class_id: classId,
                        name: courseName,
                        teacher_id: teacherId,
                        classroom_name: classroomName,
                        required_periods: 1,
                        week_type: "EVERY",
                        paired_course_id: null
                    });
                }
                await dbSet("mst_courses", state.courses);
                syncClassTutors();
                showToast("課程指派成功！", "success");
                dom.mgtInputCourseName.value = "";
                if (refreshAllViews) await refreshAllViews();
            } catch (err) {
                showToast("網路錯誤：" + err.message, "error");
            }
        });
    }
}

// =========================================================================
// ==================== Tab 6: 課程總表 (Course Matrix) =====================
// =========================================================================

/**
 * 渲染課程總表左側的班級×科目矩陣
 */
export function renderCourseMatrix() {
    const tbody = dom.courseMatrixBody;
    if (!tbody) return;
    tbody.innerHTML = "";

    const subjects = getDynamicSubjects();

    const theadTr = document.querySelector("#course-matrix-table thead tr");
    if (theadTr) {
        theadTr.innerHTML = '<th class="sticky-col">班級</th>';
        subjects.forEach(subject => {
            const th = document.createElement("th");
            th.textContent = subject;
            theadTr.appendChild(th);
        });
    }

    const sortedClasses = [...state.classes];

    sortedClasses.forEach(cls => {
        const tr = document.createElement("tr");

        const tdClass = document.createElement("td");
        tdClass.className = "sticky-col";
        tdClass.textContent = cls.name;
        tr.appendChild(tdClass);

        subjects.forEach(subject => {
            const td = document.createElement("td");
            td.className = "matrix-cell";
            td.dataset.classId = cls.id;
            td.dataset.subject = subject;

            const course = state.courses.find(c => c.class_id === cls.id && c.name === subject);
            if (course) {
                const teacher = state.teachers.find(t => t.id === course.teacher_id);
                td.classList.add("has-teacher");
                td.title = `${cls.name} - ${subject} (任課教師：${teacher ? teacher.name : "未指派"}，${course.required_periods}節)`;
                td.innerHTML = `
                    <div class="cell-teacher">${teacher ? teacher.name : "?"}</div>
                    <div class="cell-periods">${course.required_periods}節</div>
                `;
            } else {
                td.classList.add("empty");
                td.title = `${cls.name} - ${subject} (尚未指派教師)`;
                td.textContent = "—";
            }

            td.addEventListener("click", () => handleMatrixCellClick(cls.id, subject, td));
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });

    bindCourseMatrixHoverListeners();
}

/**
 * 渲染課程總表右側的教師名單
 */
export function renderMatrixTeacherList() {
    const listEl = dom.matrixTeacherList;
    if (!listEl) return;
    listEl.innerHTML = "";

    const keyword = dom.matrixTeacherSearch ? dom.matrixTeacherSearch.value.trim().toLowerCase() : "";
    const filteredTeachers = state.teachers.filter(t => t.name.toLowerCase().includes(keyword));

    filteredTeachers.forEach(t => {
        const totalPeriods = state.courses
            .filter(c => c.teacher_id === t.id)
            .reduce((sum, c) => sum + (c.required_periods || 0), 0);

        const item = document.createElement("div");
        item.className = "matrix-teacher-item";
        if (state.matrixSelectedTeacherId === t.id) item.classList.add("selected");
        item.dataset.teacherId = t.id;

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
            if (String(state.matrixSelectedTeacherId) === String(t.id)) {
                state.matrixSelectedTeacherId = null;
            } else {
                state.matrixSelectedTeacherId = t.id;
            }
            updateMatrixSelectedUI();
            listEl.querySelectorAll(".matrix-teacher-item").forEach(el => {
                el.classList.toggle("selected", String(el.dataset.teacherId) === String(state.matrixSelectedTeacherId));
            });
        });

        listEl.appendChild(item);
    });
}

/**
 * 更新底部已選教師提示
 */
export function updateMatrixSelectedUI() {
    const infoEl = dom.matrixSelectedInfo;
    const nameEl = dom.matrixSelectedName;
    if (!infoEl || !nameEl) return;

    if (state.matrixSelectedTeacherId) {
        const t = state.teachers.find(t => String(t.id) === String(state.matrixSelectedTeacherId));
        nameEl.textContent = t ? `已選取：${t.name}` : "未知教師";
        infoEl.style.display = "flex";
    } else {
        infoEl.style.display = "none";
    }
}

/**
 * 處理課程矩陣儲存格點擊
 */
export async function handleMatrixCellClick(classId, subject, tdEl) {
    if (!state.matrixSelectedTeacherId) {
        showToast("請先在右側點選一位教師", "error");
        return;
    }

    const teacher = state.teachers.find(t => String(t.id) === String(state.matrixSelectedTeacherId));
    if (!teacher) return;

    const existingCourse = state.courses.find(c => String(c.class_id) === String(classId) && c.name === subject);

    if (existingCourse && String(existingCourse.teacher_id) === String(state.matrixSelectedTeacherId)) {
        showToast(`「${subject}」已經指派給 ${teacher.name}`, "info");
        return;
    }

    try {
        if (existingCourse) {
            existingCourse.teacher_id = state.matrixSelectedTeacherId;
        } else {
            const newCourse = {
                id: getNextId(state.courses),
                name: subject,
                teacher_id: state.matrixSelectedTeacherId,
                class_id: classId,
                classroom_name: "班級教室",
                week_type: "EVERY",
                required_periods: 1,
                paired_course_id: null
            };
            state.courses.push(newCourse);
        }

        await dbSet("mst_courses", state.courses);
        syncClassTutors();

        const className = state.classes.find(c => String(c.id) === String(classId))?.name || "";
        tdEl.classList.remove("empty");
        tdEl.classList.add("has-teacher", "just-assigned");
        tdEl.title = `${className} - ${subject} (任課教師：${teacher.name}，${existingCourse ? existingCourse.required_periods : 1}節)`;
        tdEl.innerHTML = `
            <div class="cell-teacher">${teacher.name}</div>
            <div class="cell-periods">${existingCourse ? existingCourse.required_periods : 1}節</div>
        `;
        setTimeout(() => tdEl.classList.remove("just-assigned"), 500);

        if (refreshAllViews) await refreshAllViews();

        showToast(`已將「${className}」的「${subject}」指派給 ${teacher.name}`, "success");
    } catch (err) {
        showToast("系統錯誤：" + err.message, "error");
    }
}

/**
 * 初始化課程總表的事件綁定
 */
export function setupCourseMatrixListeners() {
    if (dom.matrixDeselectBtn) {
        dom.matrixDeselectBtn.addEventListener("click", () => {
            state.matrixSelectedTeacherId = null;
            updateMatrixSelectedUI();
            document.querySelectorAll(".matrix-teacher-item").forEach(el => el.classList.remove("selected"));
        });
    }

    if (dom.matrixTeacherSearch) {
        dom.matrixTeacherSearch.addEventListener("input", () => {
            renderMatrixTeacherList();
        });
    }

    bindCourseMatrixHoverListeners();
}

/**
 * 綁定課程總表 欄位與列的 Hover 高亮互動事件
 */
export function bindCourseMatrixHoverListeners() {
    const matrixWrap = document.querySelector(".matrix-table-wrap");
    const matrixTable = dom.courseMatrixTable;

    if (!matrixTable || matrixTable.dataset.hoverListenersBound === "true") return;
    matrixTable.dataset.hoverListenersBound = "true";

    const clearHoverEffects = () => {
        matrixTable.querySelectorAll(".hover-col, .hover-col-header, .hover-row-header").forEach(el => {
            el.classList.remove("hover-col", "hover-col-header", "hover-row-header");
        });
    };

    matrixTable.addEventListener("mouseover", (e) => {
        const cell = e.target.closest("th, td");
        if (!cell || !matrixTable.contains(cell)) return;

        const cellIndex = cell.cellIndex;
        if (cellIndex === undefined || cellIndex < 0) return;

        matrixTable.querySelectorAll(".hover-col, .hover-col-header, .hover-row-header").forEach(el => {
            el.classList.remove("hover-col", "hover-col-header", "hover-row-header");
        });

        const targetTh = matrixTable.querySelector(`thead tr th:nth-child(${cellIndex + 1})`);
        if (targetTh) {
            targetTh.classList.add("hover-col-header");
        }

        const colTds = matrixTable.querySelectorAll(`tbody tr > td:nth-child(${cellIndex + 1})`);
        colTds.forEach(td => td.classList.add("hover-col"));

        const tr = cell.parentElement;
        if (tr && tr.parentElement && tr.parentElement.tagName === "TBODY") {
            const rowHeader = tr.querySelector("td.sticky-col");
            if (rowHeader) {
                rowHeader.classList.add("hover-row-header");
            }
        }
    });

    matrixTable.addEventListener("mouseleave", clearHoverEffects);
    if (matrixWrap) {
        matrixWrap.addEventListener("mouseleave", clearHoverEffects);
    }
}
