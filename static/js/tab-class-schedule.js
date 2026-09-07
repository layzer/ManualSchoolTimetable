// static/js/tab-class-schedule.js
// --- Tab 1: 班級課表互動與排課邏輯 ---

import { state, dom } from './state.js';
import { dbSet, getNextId, getOrFixClassroomId } from './storage.js';
import { checkScheduleConflict, checkWeekTypeConflict } from './conflict-engine.js';
import { showToast, log, autoSwitchClassroomForCourse } from './utils.js';
import { showContextMenu } from './context-menu.js';
import { openFloatingSchedule } from './floating-window.js';

let refreshAllViews = null;

export function setClassScheduleRefreshCallback(cb) {
    refreshAllViews = cb;
}

// --- 建立動態課表網格 --- (每天 9 行：上午 1~5 節，第 6 節午休橫跨週一至週五，下午 6~8 節)
export function generateGrid() {
    if (!dom.gridBody) return;
    dom.gridBody.innerHTML = "";

    if (!state.systemConfig || !state.systemConfig.periods) return;

    state.systemConfig.periods.forEach((p) => {
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
            dom.gridBody.appendChild(tr);
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
                if (state.ignoreNextClickCell === td) {
                    state.ignoreNextClickCell = null;
                    return;
                }
                if (e.target.closest(".btn-delete-placed")) return;
                if (td.classList.contains("not-available")) return;

                if (state.selectedCourseId) {
                    const weekday = parseInt(td.dataset.weekday);
                    const period = parseInt(td.dataset.period);
                    const classroomId = parseInt(dom.selectClassroom.value) || null;

                    if (!state.selectedClassId) { showToast("請先選擇班級！", "error"); return; }

                    await handleCourseClickPlace(state.selectedCourseId, weekday, period, classroomId, td);
                }
            });
            tr.appendChild(td);
        }
        dom.gridBody.appendChild(tr);
    });
}

// --- 填充班級與教室下拉選單 ---
export function populateSelectors() {
    const prevClassId = dom.selectClass ? dom.selectClass.value : null;
    const prevClassroomId = dom.selectClassroom ? dom.selectClassroom.value : null;
    const prevClassroomView = dom.selectClassroomView ? dom.selectClassroomView.value : null;
    const prevTeacherClassroom = dom.teacherSelectClassroom ? dom.teacherSelectClassroom.value : null;

    if (dom.selectClass) {
        dom.selectClass.innerHTML = '<option value="">-- 請選擇班級 --</option>';
        state.classes.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c.id;
            opt.textContent = `${c.name} (${c.grade}年級)`;
            if (state.selectedClassId === c.id || (prevClassId && String(c.id) === String(prevClassId))) opt.selected = true;
            dom.selectClass.appendChild(opt);
        });

        if (!state.selectedClassId && state.classes.length > 0) {
            state.selectedClassId = state.classes[0].id;
            dom.selectClass.value = state.selectedClassId;
        } else if (state.selectedClassId) {
            dom.selectClass.value = state.selectedClassId;
        }
    }

    if (dom.selectClassroom) dom.selectClassroom.innerHTML = "";
    if (dom.teacherSelectClassroom) dom.teacherSelectClassroom.innerHTML = "";
    if (dom.selectClassroomView) dom.selectClassroomView.innerHTML = '<option value="">-- 請選擇科任教室 --</option>';
    if (dom.mgtSelectClassroomName) dom.mgtSelectClassroomName.innerHTML = '<option value="班級教室">班級教室 (預設)</option>';

    state.classrooms.forEach(cr => {
        const opt = document.createElement("option");
        opt.value = cr.id;
        opt.textContent = `${cr.name} [${cr.type}]`;

        if (dom.selectClassroom) dom.selectClassroom.appendChild(opt.cloneNode(true));
        if (dom.teacherSelectClassroom) dom.teacherSelectClassroom.appendChild(opt.cloneNode(true));
        if (dom.selectClassroomView && cr.name !== "班級教室") {
            dom.selectClassroomView.appendChild(opt.cloneNode(true));
        }

        if (dom.mgtSelectClassroomName && cr.name !== "班級教室") {
            const mgtOpt = document.createElement("option");
            mgtOpt.value = cr.name;
            mgtOpt.textContent = `${cr.name} [${cr.type}]`;
            dom.mgtSelectClassroomName.appendChild(mgtOpt);
        }
    });

    if (dom.selectClassroomView) {
        if (prevClassroomView && state.classrooms.some(cr => String(cr.id) === String(prevClassroomView))) {
            dom.selectClassroomView.value = prevClassroomView;
        } else {
            const firstNonDefaultRoom = state.classrooms.find(cr => cr.name !== "班級教室");
            if (firstNonDefaultRoom) {
                dom.selectClassroomView.value = firstNonDefaultRoom.id;
            } else if (state.classrooms.length > 0) {
                dom.selectClassroomView.value = state.classrooms[0].id;
            }
        }
    }

    const defaultCr = state.classrooms.find(cr => cr.name === "班級教室");
    const currentClass = state.classes.find(c => String(c.id) === String(state.selectedClassId));
    const classDefaultCrId = currentClass?.default_classroom_id || defaultCr?.id;

    if (dom.selectClassroom) {
        if (prevClassroomId && state.classrooms.some(cr => String(cr.id) === String(prevClassroomId))) {
            dom.selectClassroom.value = prevClassroomId;
        } else if (classDefaultCrId) {
            dom.selectClassroom.value = classDefaultCrId;
        }
    }

    if (dom.teacherSelectClassroom) {
        if (prevTeacherClassroom && state.classrooms.some(cr => String(cr.id) === String(prevTeacherClassroom))) {
            dom.teacherSelectClassroom.value = prevTeacherClassroom;
        } else if (defaultCr) {
            dom.teacherSelectClassroom.value = defaultCr.id;
        }
    }
}

// --- 更新上方班級顯示狀態與設定預設教室 ---
export function updateClassDisplay(shouldResetClassroom = false) {
    const activeClass = state.classes.find(c => String(c.id) === String(state.selectedClassId));

    document.querySelectorAll(".dropzone").forEach(cell => {
        cell.classList.remove("not-available");
    });

    if (activeClass) {
        if (dom.currentClassDisplay) dom.currentClassDisplay.textContent = activeClass.name;
        if (dom.classGradeBadge) {
            dom.classGradeBadge.style.display = "inline-block";
            dom.classGradeBadge.textContent = `${activeClass.grade} 年級`;
        }
        if (shouldResetClassroom && activeClass.default_classroom_id && dom.selectClassroom) {
            dom.selectClassroom.value = activeClass.default_classroom_id;
        }
    } else {
        if (dom.currentClassDisplay) dom.currentClassDisplay.textContent = "尚未選擇班級";
        if (dom.classGradeBadge) dom.classGradeBadge.style.display = "none";
    }
}

// --- 清除班級排課選取的課程狀態 ---
export function clearSelectedCourse() {
    state.selectedCourseId = null;
    document.querySelectorAll(".course-card").forEach(el => el.classList.remove("active"));
    updateClassScheduleHighlights();
}

// --- 更新班級課表同課程卡片的高亮提示 ---
export function updateClassScheduleHighlights() {
    const placedCards = document.querySelectorAll("#class-schedule-view .placed-course");
    placedCards.forEach(card => {
        const courseId = parseInt(card.dataset.courseId);
        if (state.selectedCourseId && courseId === state.selectedCourseId) {
            card.classList.add("highlight-matched");
        } else {
            card.classList.remove("highlight-matched");
        }
    });
}

// --- 渲染待排課程池 (Sidebar) ---
export function renderCourses() {
    if (!dom.coursePool) return;

    if (state.selectedCourseId) {
        const selCourse = state.courses.find(c => String(c.id) === String(state.selectedCourseId));
        if (!selCourse || String(selCourse.class_id) !== String(state.selectedClassId)) {
            clearSelectedCourse();
        }
    }

    dom.coursePool.innerHTML = "";
    if (state.courses.length === 0) {
        dom.coursePool.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-folder-open"></i>
                <p>請先前往「班級課程設定」新增科目</p>
            </div>
        `;
        if (dom.unscheduledCount) dom.unscheduledCount.textContent = "0";
        return;
    }

    const classCourses = state.courses.filter(c => String(c.class_id) === String(state.selectedClassId));

    if (classCourses.length === 0) {
        dom.coursePool.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-folder-open"></i>
                <p>此班級尚未指派任何授課科目</p>
            </div>
        `;
        if (dom.unscheduledCount) dom.unscheduledCount.textContent = "0";
        return;
    }

    classCourses.forEach(c => {
        const card = document.createElement("div");
        card.className = `course-card week-${(c.week_type || 'EVERY').toLowerCase()}`;
        if (String(state.selectedCourseId) === String(c.id)) {
            card.classList.add("active");
        }
        card.draggable = true;

        const teacher = state.teachers.find(t => String(t.id) === String(c.teacher_id));
        const teacherName = teacher ? teacher.name : "未知教師";
        const teacherShortName = teacherName.split(" ")[0];

        const scheduledPeriods = state.schedules
            .filter(s => String(s.course_id) === String(c.id) && String(s.class_id) === String(state.selectedClassId))
            .reduce((sum, s) => sum + (s.week_type === "ODD" || s.week_type === "EVEN" ? 0.5 : 1.0), 0);
        const required = c.required_periods || 0;
        const remaining = required - scheduledPeriods;
        const isDone = remaining <= 0;

        const isOver = scheduledPeriods > required && required > 0;
        const periodTag = required > 0
            ? (isOver
                ? `<span class="period-badge" style="background:rgba(239,68,68,0.15);border-color:rgba(239,68,68,0.4);color:#f87171;">${scheduledPeriods}/${required} 節 · 超出 ${scheduledPeriods - required} 節</span>`
                : `<span class="period-badge ${isDone ? 'done' : ''}">${scheduledPeriods}/${required} 節${isDone ? ' ✓' : ` · 還需 ${remaining} 節`}</span>`)
            : `<span class="period-badge">${scheduledPeriods} 節已排</span>`;

        const roomLabel = c.classroom_name || '班級教室';

        card.innerHTML = `
            <div class="course-info">
                <span class="course-name">${c.name} <span class="teacher-inline-name">(${teacherShortName})</span></span>
                <span class="room-tag">${roomLabel}</span>
            </div>
            <div class="course-details">
                ${periodTag}
            </div>
        `;

        card.addEventListener("dragstart", (e) => {
            state.draggedCourseId = c.id;
            state.draggedScheduleId = null;
            e.dataTransfer.effectAllowed = "move";
            autoSwitchClassroomForCourse(c);
        });

        card.addEventListener("click", () => {
            if (String(state.selectedCourseId) === String(c.id)) {
                state.selectedCourseId = null;
                card.classList.remove("active");
                updateClassScheduleHighlights();
                log(`已取消選取課程「${c.name}」`, "system-msg", null, refreshAllViews);
            } else {
                state.selectedCourseId = c.id;
                document.querySelectorAll(".course-card").forEach(el => el.classList.remove("active"));
                card.classList.add("active");
                updateClassScheduleHighlights();
                log(`已點選「${c.name} (${teacherShortName})」課程。請直接點擊右側課表空格進行排課（可點擊多節）。`, "system-msg", null, refreshAllViews);
                autoSwitchClassroomForCourse(c);
            }
        });

        // 右鍵選單：彈出或前往教師個人課表
        card.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const teacherId = c.teacher_id;
            const teacherObj = state.teachers.find(t => t.id === teacherId);
            const teacherNameStr = teacherObj ? teacherObj.name : "該教師";

            const ul = dom.contextMenu?.querySelector("ul");
            if (ul) {
                ul.innerHTML = `
                    <li id="menu-item-popup-teacher" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <i class="fa-solid fa-window-restore" style="color: var(--accent-cyan);"></i>
                        <span>彈出顯示 ${teacherNameStr} 的課表</span>
                    </li>
                    <li id="menu-item-goto-teacher" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <i class="fa-solid fa-arrow-right-to-bracket"></i>
                        <span>前往 ${teacherNameStr} 的課表</span>
                    </li>
                `;
                const itemPopup = ul.querySelector("#menu-item-popup-teacher");
                if (itemPopup) {
                    itemPopup.onclick = () => {
                        openFloatingSchedule('teacher', teacherId);
                        dom.contextMenu.classList.add("hidden");
                    };
                }
                const itemGoto = ul.querySelector("#menu-item-goto-teacher");
                if (itemGoto) {
                    itemGoto.onclick = () => {
                        const tabBtn = document.querySelector(`.tab-btn[data-tab="teacher-schedule-view"]`);
                        if (tabBtn) tabBtn.click();
                        if (dom.selectTeacher) {
                            dom.selectTeacher.value = teacherId;
                            state.teacherSelectedCourseId = null;
                            if (refreshAllViews) refreshAllViews();
                        }
                        dom.contextMenu.classList.add("hidden");
                    };
                }
            }
            showContextMenu(e);
        });

        dom.coursePool.appendChild(card);
    });

    const pendingCount = classCourses.filter(c => {
        const scheduledPeriods = state.schedules
            .filter(sc => String(sc.course_id) === String(c.id) && String(sc.class_id) === String(state.selectedClassId))
            .reduce((sum, sc) => sum + (sc.week_type === "ODD" || sc.week_type === "EVEN" ? 0.5 : 1.0), 0);
        return scheduledPeriods < (c.required_periods || 0);
    }).length;
    if (dom.unscheduledCount) dom.unscheduledCount.textContent = pendingCount;
}

// --- 渲染已排課表 (Main Grid) ---
export function renderSchedules() {
    document.querySelectorAll("#class-schedule-view .dropzone").forEach(cell => {
        cell.classList.remove("has-group-split");
        cell.querySelectorAll(".placed-course").forEach(p => p.remove());
    });

    if (!state.selectedClassId) return;

    const classSchedules = state.schedules
        .filter(s => String(s.class_id) === String(state.selectedClassId))
        .sort((a, b) => {
            if (a.week_type === "ODD" && b.week_type === "EVEN") return -1;
            if (a.week_type === "EVEN" && b.week_type === "ODD") return 1;
            return 0;
        });

    const slotMap = {};
    classSchedules.forEach(s => {
        const key = `${s.weekday}-${s.period}`;
        if (!slotMap[key]) slotMap[key] = [];
        slotMap[key].push(s);
    });

    Object.entries(slotMap).forEach(([key, list]) => {
        const [w, p] = key.split("-");
        const cell = document.querySelector(`#class-schedule-view .dropzone[data-weekday="${w}"][data-period="${p}"]`);
        if (cell) {
            const hasGroup = list.some(s => s.week_type === "GROUP");
            const isAlternateOnly = list.length === 2 && list.some(s => s.week_type === "ODD") && list.some(s => s.week_type === "EVEN");
            if (hasGroup || (list.length > 1 && !isAlternateOnly)) {
                cell.classList.add("has-group-split");
            }
        }
    });

    classSchedules.forEach(s => {
        const cell = document.querySelector(`#class-schedule-view .dropzone[data-weekday="${s.weekday}"][data-period="${s.period}"]`);
        if (!cell) return;

        const course = state.courses.find(c => String(c.id) === String(s.course_id));
        const classroom = state.classrooms.find(cr => String(cr.id) === String(s.classroom_id));
        const teacher = course ? state.teachers.find(t => String(t.id) === String(course.teacher_id)) : null;

        if (!course) return;

        const div = document.createElement("div");
        div.className = `placed-course week-${(s.week_type || 'EVERY').toLowerCase()}`;
        div.dataset.courseId = s.course_id;
        if (state.selectedCourseId && String(s.course_id) === String(state.selectedCourseId)) {
            div.classList.add("highlight-matched");
        }
        div.draggable = true;

        const weekBadge = s.week_type === "ODD" ? '<span class="week-tag inline">[單]</span> ' :
            s.week_type === "EVEN" ? '<span class="week-tag inline">[雙]</span> ' : '';

        div.innerHTML = `
            <div class="placed-header">
                <span class="placed-name" title="${course.name}">${weekBadge}${course.name}</span>
                <button class="btn-delete-placed" title="取消排課">
                    <i class="fa-solid fa-square-xmark"></i>
                </button>
            </div>
            <div class="placed-footer">
                <span title="${teacher ? teacher.name : ''}">${teacher ? teacher.name.split(" ")[0] : ""}</span>
                <span title="${classroom ? classroom.name : '班級教室'}">${classroom ? classroom.name : "班級教室"}</span>
            </div>
        `;

        div.addEventListener("dragstart", (e) => {
            state.draggedScheduleId = s.id;
            state.draggedCourseId = s.course_id;
            e.dataTransfer.effectAllowed = "move";
            setTimeout(() => div.style.opacity = "0.4", 0);
        });

        div.addEventListener("dragend", () => {
            div.style.opacity = "1";
        });

        // 取消排課按鈕：必須使用 mousedown 事件監聽，防 HTML5 拖曳機制吞噬點擊事件
        div.querySelector(".btn-delete-placed").addEventListener("mousedown", async (e) => {
            e.stopPropagation();
            e.preventDefault();

            state.ignoreNextClickCell = cell;
            setTimeout(() => {
                if (state.ignoreNextClickCell === cell) state.ignoreNextClickCell = null;
            }, 300);

            if (confirm(`確定要取消「${course.name}」的排課嗎？`)) {
                await deleteSchedule(s.id);
            }
        });

        div.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const teacherId = course.teacher_id;
            const teacherObj = state.teachers.find(t => t.id === teacherId);
            const teacherNameStr = teacherObj ? teacherObj.name : "該教師";

            const ul = dom.contextMenu?.querySelector("ul");
            if (ul) {
                ul.innerHTML = `
                    <li id="menu-item-popup-teacher" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <i class="fa-solid fa-window-restore" style="color: var(--accent-cyan);"></i>
                        <span>彈出顯示 ${teacherNameStr} 的課表</span>
                    </li>
                    <li id="menu-item-goto-teacher" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <i class="fa-solid fa-arrow-right-to-bracket"></i>
                        <span>前往 ${teacherNameStr} 的課表</span>
                    </li>
                `;

                const itemPopup = ul.querySelector("#menu-item-popup-teacher");
                if (itemPopup) {
                    itemPopup.onclick = () => {
                        openFloatingSchedule('teacher', teacherId);
                        dom.contextMenu.classList.add("hidden");
                    };
                }

                const itemGoto = ul.querySelector("#menu-item-goto-teacher");
                if (itemGoto) {
                    itemGoto.onclick = () => {
                        const tabBtn = document.querySelector(`.tab-btn[data-tab="teacher-schedule-view"]`);
                        if (tabBtn) tabBtn.click();

                        if (dom.selectTeacher) {
                            dom.selectTeacher.value = teacherId;
                            state.teacherSelectedCourseId = null;
                            if (refreshAllViews) refreshAllViews();
                        }
                        dom.contextMenu.classList.add("hidden");
                    };
                }

                showContextMenu(e);
            }
        });

        cell.appendChild(div);
    });
}

// --- 處理 Drop 排課行為 ---
export async function handleCourseDrop(weekday, period, classroomId, cell) {
    let weekType = "EVERY";
    if (state.draggedScheduleId) {
        const orig = state.schedules.find(s => s.id === state.draggedScheduleId);
        if (orig) weekType = orig.week_type || "EVERY";
    } else {
        const weekTypeEl = document.querySelector('input[name="placing-week-type-class"]:checked');
        weekType = weekTypeEl ? weekTypeEl.value : "EVERY";
    }

    const targetCourseId = state.draggedScheduleId ? state.schedules.find(s => s.id === state.draggedScheduleId)?.course_id : state.draggedCourseId;
    if (!state.draggedScheduleId) {
        const targetCourse = state.courses.find(c => c.id === targetCourseId);
        if (!targetCourse || targetCourse.class_id !== state.selectedClassId) {
            showToast("拖曳的課程不屬於當前班級！", "error");
            log("排課失敗：拖曳的課程不屬於當前選取之班級。", "error", null, refreshAllViews);
            return;
        }
    }
    const finalClassroomId = getOrFixClassroomId(targetCourseId, classroomId);

    const conflicts = checkScheduleConflict(
        state.selectedClassId,
        targetCourseId,
        finalClassroomId,
        weekday,
        period,
        weekType,
        state.draggedScheduleId
    );

    if (conflicts.length > 0) {
        cell.classList.add("grid-cell-conflict");
        setTimeout(() => cell.classList.remove("grid-cell-conflict"), 1500);

        conflicts.forEach(msg => {
            log(`排課衝突：${msg}`, "error", null, refreshAllViews);
            showToast(msg, "error");
        });
        return;
    }

    const existingSlotCourses = state.schedules
        .filter(s => s.class_id === state.selectedClassId && s.weekday === weekday && s.period === period && (!state.draggedScheduleId || s.id !== state.draggedScheduleId))
        .map(s => {
            const c = state.courses.find(item => item.id === s.course_id);
            const t = c ? state.teachers.find(item => item.id === c.teacher_id) : null;
            const cName = c ? c.name : "未知課程";
            const tName = t ? t.name.split(" ")[0] : "";
            const typeStr = s.week_type === "GROUP" ? "分組" : (s.week_type === "ODD" ? "單週" : (s.week_type === "EVEN" ? "雙週" : "每週"));
            return `${cName}${tName ? ' - ' + tName : ''}(${typeStr})`;
        });

    if (weekType === "GROUP") {
        state.schedules = state.schedules.filter(s => {
            if (state.draggedScheduleId && s.id === state.draggedScheduleId) return false;
            return true;
        });
    } else {
        state.schedules = state.schedules.filter(s => {
            if (state.draggedScheduleId && s.id === state.draggedScheduleId) return false;
            if (s.class_id === state.selectedClassId && s.weekday === weekday && s.period === period) {
                return !checkWeekTypeConflict(weekType, s.week_type || "EVERY");
            }
            return true;
        });
    }

    if (state.draggedScheduleId) {
        state.schedules.push({
            id: state.draggedScheduleId,
            class_id: state.selectedClassId,
            course_id: targetCourseId,
            classroom_id: finalClassroomId,
            weekday: weekday,
            period: period,
            week_type: weekType
        });
    } else {
        const newSchedId = getNextId(state.schedules);
        state.schedules.push({
            id: newSchedId,
            class_id: state.selectedClassId,
            course_id: targetCourseId,
            classroom_id: finalClassroomId,
            weekday: weekday,
            period: period,
            week_type: weekType
        });
    }

    await dbSet("mst_schedules", state.schedules);
    if (refreshAllViews) await refreshAllViews();

    const curClass = state.classes.find(c => c.id === state.selectedClassId);
    const curCourse = state.courses.find(c => c.id === targetCourseId);
    const className = curClass ? curClass.name : "該班級";
    const courseName = curCourse ? curCourse.name : "該課程";

    if (weekType === "GROUP" && existingSlotCourses.length > 0) {
        const existInfo = existingSlotCourses.join("、");
        showToast(`ℹ️ 該時段已有【${existInfo}】，已成功加入分組課程！`, "info");
        log(`分組排課成功！已將「${className}」的「${courseName}」以分組模式加入週 ${weekday} 第 ${period} 節（此節既有：${existInfo}）。`, "success", JSON.parse(JSON.stringify(state.schedules)), refreshAllViews);
    } else {
        showToast(state.draggedScheduleId ? "課表調整成功！" : "排課成功！", "success");
        log(
            state.draggedScheduleId
                ? `課表調整成功！已將「${className}」的「${courseName}」調整至週 ${weekday} 第 ${period} 節。`
                : `排課成功！已將「${className}」的「${courseName}」排至週 ${weekday} 第 ${period} 節。`,
            "success",
            JSON.parse(JSON.stringify(state.schedules)),
            refreshAllViews
        );
    }
}

// --- 處理 Click-to-Place 排課行為 ---
export async function handleCourseClickPlace(courseId, weekday, period, classroomId, cell) {
    const targetCourse = state.courses.find(c => c.id === courseId);
    if (!targetCourse || targetCourse.class_id !== state.selectedClassId) {
        clearSelectedCourse();
        showToast("選取的課程不屬於當前班級，已取消選取！", "error");
        log("排課失敗：選取的課程不屬於當前選取之班級。", "error", null, refreshAllViews);
        return;
    }

    const weekTypeEl = document.querySelector('input[name="placing-week-type-class"]:checked');
    const weekType = weekTypeEl ? weekTypeEl.value : "EVERY";
    const finalClassroomId = getOrFixClassroomId(courseId, classroomId);

    const conflicts = checkScheduleConflict(
        state.selectedClassId,
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
            log(`排課衝突：${msg}`, "error", null, refreshAllViews);
            showToast(msg, "error");
        });
        return;
    }

    const existingSlotCourses = state.schedules
        .filter(s => s.class_id === state.selectedClassId && s.weekday === weekday && s.period === period)
        .map(s => {
            const c = state.courses.find(item => item.id === s.course_id);
            const t = c ? state.teachers.find(item => item.id === c.teacher_id) : null;
            const cName = c ? c.name : "未知課程";
            const tName = t ? t.name.split(" ")[0] : "";
            const typeStr = s.week_type === "GROUP" ? "分組" : (s.week_type === "ODD" ? "單週" : (s.week_type === "EVEN" ? "雙週" : "每週"));
            return `${cName}${tName ? ' - ' + tName : ''}(${typeStr})`;
        });

    if (weekType === "GROUP") {
        // 分組排課不刪除該班該時段的既有課程
    } else {
        state.schedules = state.schedules.filter(s => {
            if (s.class_id === state.selectedClassId && s.weekday === weekday && s.period === period) {
                return !checkWeekTypeConflict(weekType, s.week_type || "EVERY");
            }
            return true;
        });
    }

    state.schedules.push({
        id: getNextId(state.schedules),
        class_id: state.selectedClassId,
        course_id: courseId,
        classroom_id: finalClassroomId,
        weekday: weekday,
        period: period,
        week_type: weekType
    });

    await dbSet("mst_schedules", state.schedules);
    if (refreshAllViews) await refreshAllViews();

    const curClass = state.classes.find(c => c.id === state.selectedClassId);
    const className = curClass ? curClass.name : "該班級";
    const courseName = targetCourse.name;

    if (weekType === "GROUP" && existingSlotCourses.length > 0) {
        const existInfo = existingSlotCourses.join("、");
        showToast(`ℹ️ 該時段已有【${existInfo}】，已成功加入分組課程！`, "info");
        log(`分組點選排課成功！已將「${className}」的「${courseName}」以分組模式排入週 ${weekday} 第 ${period} 節（此節既有：${existInfo}）。`, "success", JSON.parse(JSON.stringify(state.schedules)), refreshAllViews);
    } else {
        showToast("點選排課成功！", "success");
        log(`排課成功！已將「${className}」的「${courseName}」排入週 ${weekday} 第 ${period} 節。`, "success", JSON.parse(JSON.stringify(state.schedules)), refreshAllViews);
    }
}

// --- 刪除課表 ---
export async function deleteSchedule(scheduleId) {
    const targetSched = state.schedules.find(s => s.id === scheduleId);
    let detailMsg = "已成功取消一節排課紀錄。";
    if (targetSched) {
        const cls = state.classes.find(c => c.id === targetSched.class_id);
        const crs = state.courses.find(c => c.id === targetSched.course_id);
        const clsName = cls ? cls.name : "該班級";
        const crsName = crs ? crs.name : "該課程";
        detailMsg = `已取消「${clsName}」週 ${targetSched.weekday} 第 ${targetSched.period} 節「${crsName}」的排課。`;
    }

    state.schedules = state.schedules.filter(s => s.id !== scheduleId);
    await dbSet("mst_schedules", state.schedules);
    if (refreshAllViews) await refreshAllViews();
    showToast("已成功取消排課！", "success");
    log(detailMsg, "system-msg", JSON.parse(JSON.stringify(state.schedules)), refreshAllViews);
}

// --- 班級課表事件綁定 ---
export function setupClassScheduleEventListeners() {
    if (dom.selectClass) {
        dom.selectClass.addEventListener("change", (e) => {
            state.selectedClassId = e.target.value ? parseInt(e.target.value) : null;
            clearSelectedCourse();
            updateClassDisplay(true);
            renderSchedules();
            renderCourses();
        });
    }

    if (dom.btnNextClass) {
        dom.btnNextClass.addEventListener("click", () => {
            if (!dom.selectClass) return;
            const validOptions = Array.from(dom.selectClass.options).filter(opt => opt.value !== "");
            if (validOptions.length === 0) {
                showToast("目前無可切換的班級！", "info");
                return;
            }

            const currentVal = dom.selectClass.value;
            const currentIndex = validOptions.findIndex(opt => opt.value === currentVal);

            let nextOption = validOptions[0];
            if (currentIndex !== -1) {
                const nextIndex = (currentIndex + 1) % validOptions.length;
                nextOption = validOptions[nextIndex];
            }

            dom.selectClass.value = nextOption.value;
            dom.selectClass.dispatchEvent(new Event("change"));

            const targetClass = state.classes.find(c => String(c.id) === String(nextOption.value));
            const className = targetClass ? targetClass.name : nextOption.textContent;
            showToast(`已切換至「${className}」`, "info");
        });
    }

    if (dom.btnRefreshClass) {
        dom.btnRefreshClass.addEventListener("click", async () => {
            const icon = dom.btnRefreshClass.querySelector("i");
            if (icon) {
                icon.style.animation = "spin 0.6s linear";
                setTimeout(() => { icon.style.animation = ""; }, 700);
            }
            try {
                if (refreshAllViews) await refreshAllViews();
                log("課表資料已重新整理！", "success", JSON.parse(JSON.stringify(state.schedules)), refreshAllViews);
                showToast("課表資料已重新整理！", "success");
            } catch (e) {
                log("重新整理失敗：" + e.message, "error", null, refreshAllViews);
                showToast("重新整理失敗", "error");
            }
        });
    }

    if (dom.gridBody) {
        dom.gridBody.addEventListener("dragover", (e) => {
            const cell = e.target.closest(".dropzone");
            if (cell && !cell.classList.contains("not-available")) {
                e.preventDefault();
                cell.classList.add("drag-over");
            }
        });

        dom.gridBody.addEventListener("dragleave", (e) => {
            const cell = e.target.closest(".dropzone");
            if (cell) {
                cell.classList.remove("drag-over");
            }
        });

        dom.gridBody.addEventListener("drop", async (e) => {
            e.preventDefault();
            const cell = e.target.closest(".dropzone");
            if (!cell || cell.classList.contains("not-available")) return;

            cell.classList.remove("drag-over");

            const weekday = parseInt(cell.dataset.weekday);
            const period = parseInt(cell.dataset.period);
            const classroomId = parseInt(dom.selectClassroom.value) || null;

            if (!state.selectedClassId) {
                showToast("請先選擇班級！", "error");
                return;
            }

            if (state.draggedCourseId) {
                await handleCourseDrop(weekday, period, classroomId, cell);
            }

            state.draggedCourseId = null;
            state.draggedScheduleId = null;
        });
    }
}
