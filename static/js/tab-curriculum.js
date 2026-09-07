// static/js/tab-curriculum.js
// --- Tab 4: 班級課程設定分頁 ---

import { state, dom } from './state.js';
import { dbSet, getNextId, syncClassTutors } from './storage.js';
import { showToast } from './utils.js';
import { handleDeleteCourse } from './tab-teacher-summary.js';

let refreshAllViews = null;

export function setCurriculumRefreshCallback(cb) {
    refreshAllViews = cb;
}

// --- 填充 Tab 4 班級與教師、教室下拉選單 ---
export function populateCurriculumSelectors() {
    if (!dom.currSelectClass) return;
    const prevCurrTeacher = dom.currSelectTeacher ? dom.currSelectTeacher.value : null;
    const prevCurrClassroom = dom.currSelectClassroomName ? dom.currSelectClassroomName.value : null;

    dom.currSelectClass.innerHTML = '<option value="">-- 請選擇班級 --</option>';
    state.classes.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = `${c.name} (${c.grade}年級)`;
        if (state.selectedClassId === c.id) opt.selected = true;
        dom.currSelectClass.appendChild(opt);
    });

    if (dom.currSelectTeacher) {
        dom.currSelectTeacher.innerHTML = '<option value="">-- 請選擇授課教師 --</option>';
        state.teachers.forEach(t => {
            const opt = document.createElement("option");
            opt.value = t.id;
            opt.textContent = `${t.name}${t.is_tutor ? ' (導師)' : ''}`;
            if (prevCurrTeacher && String(t.id) === String(prevCurrTeacher)) opt.selected = true;
            dom.currSelectTeacher.appendChild(opt);
        });
        if (prevCurrTeacher && state.teachers.some(t => String(t.id) === String(prevCurrTeacher))) {
            dom.currSelectTeacher.value = prevCurrTeacher;
        }
    }

    if (dom.currSelectClassroomName) {
        dom.currSelectClassroomName.innerHTML = '<option value="班級教室">班級教室 (預設)</option>';
        state.classrooms.forEach(cr => {
            if (cr.name !== "班級教室") {
                const opt = document.createElement("option");
                opt.value = cr.name;
                opt.textContent = `${cr.name} [${cr.type}]`;
                if (prevCurrClassroom && cr.name === prevCurrClassroom) opt.selected = true;
                dom.currSelectClassroomName.appendChild(opt);
            }
        });
        if (prevCurrClassroom) {
            dom.currSelectClassroomName.value = prevCurrClassroom;
        }
    }
}

// --- 渲染 Tab 4 班級課程一覽 ---
export function renderCurriculumView() {
    if (!dom.curriculumTableBody) return;
    dom.curriculumTableBody.innerHTML = "";

    const classId = dom.currSelectClass?.value ? parseInt(dom.currSelectClass.value) : state.selectedClassId;
    if (!classId) return;

    const classCourses = state.courses.filter(c => c.class_id === classId);

    let totalPlanned = 0;
    let totalScheduled = 0;

    classCourses.forEach(c => {
        const required = c.required_periods || 0;
        totalPlanned += required;

        const scheduledCount = state.schedules
            .filter(s => s.course_id === c.id && s.class_id === classId)
            .reduce((sum, s) => sum + (s.week_type === "ODD" || s.week_type === "EVEN" ? 0.5 : 1.0), 0);
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
        state.teachers.forEach(t => {
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
        state.classrooms.forEach(cr => {
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
            tdRemaining.innerHTML = `<span class="badge-pending" style="background:rgba(239,68,68,0.15);border-color:rgba(239,68,68,0.4);color:#f87171;">超出 ${-diff} 節</span>`;
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

        dom.curriculumTableBody.appendChild(tr);
    });

    if (dom.currStatSubjects) dom.currStatSubjects.textContent = classCourses.length;
    if (dom.currStatTotal) dom.currStatTotal.textContent = totalPlanned;
    if (dom.currStatRemaining) dom.currStatRemaining.textContent = totalPlanned - totalScheduled;
}

// --- 處理 Tab 4 課程屬性即時更新 ---
export async function handleCurriculumUpdateCourse(courseId, changes) {
    const course = state.courses.find(c => c.id === courseId);
    if (!course) return;

    Object.assign(course, changes);
    await dbSet("mst_courses", state.courses);
    syncClassTutors();
    showToast("課程設定已更新！", "success");

    if (refreshAllViews) await refreshAllViews();
}

// --- Tab 4 新增科目至班級的表單監聽 ---
export function setupCurriculumFormListener() {
    if (!dom.formCurrAddCourse) return;

    if (dom.currSelectClass) {
        dom.currSelectClass.addEventListener("change", () => {
            renderCurriculumView();
        });
    }

    dom.formCurrAddCourse.addEventListener("submit", async (e) => {
        e.preventDefault();

        const classId = parseInt(dom.currSelectClass.value);
        const courseName = dom.currInputName.value.trim();
        const teacherId = parseInt(dom.currSelectTeacher.value);
        const classroomName = dom.currSelectClassroomName.value;
        const requiredPeriods = parseFloat(dom.currInputPeriods.value) || 1;

        if (!classId || !courseName || !teacherId) {
            showToast("請填寫所有必要欄位！", "error");
            return;
        }

        const newCourse = {
            id: getNextId(state.courses),
            name: courseName,
            teacher_id: teacherId,
            class_id: classId,
            classroom_name: classroomName,
            week_type: "EVERY",
            required_periods: requiredPeriods,
            paired_course_id: null
        };

        state.courses.push(newCourse);
        await dbSet("mst_courses", state.courses);
        syncClassTutors();
        showToast(`新增「${courseName}」成功！`, "success");
        dom.currInputName.value = "";
        if (refreshAllViews) await refreshAllViews();
    });
}
