// static/js/tab-teacher-schedule.js
// --- Tab 2: 教師個人課表與不排課設定 ---

import { state, dom } from './state.js';
import { dbSet, getNextId, getOrFixClassroomId } from './storage.js';
import { checkScheduleConflict, checkWeekTypeConflict } from './conflict-engine.js';
import { showToast, teacherLog, autoSwitchClassroomForCourse } from './utils.js';
import { showContextMenu } from './context-menu.js';
import { openFloatingSchedule } from './floating-window.js';
import { deleteSchedule } from './tab-class-schedule.js';

let refreshAllViews = null;

export function setTeacherScheduleRefreshCallback(cb) {
    refreshAllViews = cb;
}

// --- 建立 Tab 2 教師網格 ---
export function generateTeacherGrid() {
    if (!dom.teacherGridBody) return;
    dom.teacherGridBody.innerHTML = "";
    if (!state.systemConfig || !state.systemConfig.periods) return;

    state.systemConfig.periods.forEach((p) => {
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
            dom.teacherGridBody.appendChild(tr);
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

                if (state.teacherSelectedCourseId) {
                    const weekday = parseInt(td.dataset.weekday);
                    const period = parseInt(td.dataset.period);
                    const classroomId = parseInt(dom.teacherSelectClassroom?.value) || null;
                    const course = state.courses.find(c => c.id === state.teacherSelectedCourseId);

                    if (course) {
                        await handleTeacherCourseClickPlace(course.class_id, state.teacherSelectedCourseId, weekday, period, classroomId, td);
                    }
                } else {
                    await handleTeacherSlotClick(d, parseInt(p.id), td);
                }
            });
            tr.appendChild(td);
        }
        dom.teacherGridBody.appendChild(tr);
    });
}

// 處理教師排課介面的點選排課行為
export async function handleTeacherCourseClickPlace(classId, courseId, weekday, period, classroomId, cell) {
    const weekTypeEl = document.querySelector('input[name="placing-week-type-teacher"]:checked');
    const weekType = weekTypeEl ? weekTypeEl.value : "EVERY";
    const finalClassroomId = getOrFixClassroomId(courseId, classroomId);

    // 1. 檢查一般衝突（教師時間、教室衝突）
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
            teacherLog(`排課衝突：${msg}`, "error", null, refreshAllViews);
            showToast(msg, "error");
        });
        return;
    }

    // 2. 檢查班級在該時段是否已有其他衝突的課程
    const existingSlotCourses = state.schedules
        .filter(s => s.class_id === classId && s.weekday === weekday && s.period === period)
        .map(s => {
            const c = state.courses.find(item => item.id === s.course_id);
            const t = c ? state.teachers.find(item => item.id === c.teacher_id) : null;
            const cName = c ? c.name : "未知課程";
            const tName = t ? t.name.split(" ")[0] : "";
            const typeStr = s.week_type === "GROUP" ? "分組" : (s.week_type === "ODD" ? "單週" : (s.week_type === "EVEN" ? "雙週" : "每週"));
            return `${cName}${tName ? ' - ' + tName : ''}(${typeStr})`;
        });

    if (weekType !== "GROUP") {
        const classConflict = state.schedules.find(s =>
            s.class_id === classId &&
            s.weekday === weekday &&
            s.period === period &&
            checkWeekTypeConflict(weekType, s.week_type || "EVERY")
        );

        if (classConflict && classConflict.course_id !== courseId) {
            const existingCourse = state.courses.find(c => c.id === classConflict.course_id);
            const courseName = existingCourse ? existingCourse.name : "其他課程";
            const existingTeacher = existingCourse ? state.teachers.find(t => t.id === existingCourse.teacher_id) : null;
            const teacherName = existingTeacher ? existingTeacher.name : "";
            const teacherStr = teacherName ? ` (${teacherName} 老師)` : "";

            showToast(`班級衝堂：該班級在此時段已有課程「${courseName}」${teacherStr}，請先至班級課表取消或調整！`, "error");
            teacherLog(`排課失敗：班級衝堂，此時段已排定「${courseName}」${teacherStr}`, "error", null, refreshAllViews);

            cell.classList.add("grid-cell-conflict");
            setTimeout(() => cell.classList.remove("grid-cell-conflict"), 1500);
            return;
        }

        state.schedules = state.schedules.filter(s => {
            if (s.class_id === classId && s.weekday === weekday && s.period === period) {
                return !checkWeekTypeConflict(weekType, s.week_type || "EVERY");
            }
            return true;
        });
    }

    state.schedules.push({
        id: getNextId(state.schedules),
        class_id: classId,
        course_id: courseId,
        classroom_id: finalClassroomId,
        weekday: weekday,
        period: period,
        week_type: weekType
    });

    await dbSet("mst_schedules", state.schedules);
    if (refreshAllViews) await refreshAllViews();

    const curClass = state.classes.find(c => c.id === classId);
    const curCourse = state.courses.find(c => c.id === courseId);
    const className = curClass ? curClass.name : "該班級";
    const courseName = curCourse ? curCourse.name : "該課程";

    if (weekType === "GROUP" && existingSlotCourses.length > 0) {
        const existInfo = existingSlotCourses.join("、");
        showToast(`ℹ️ 該班級此節已有【${existInfo}】，已成功加入分組課程！`, "info");
        teacherLog(`分組排課成功！已將「${className}」的「${courseName}」以分組模式排入週 ${weekday} 第 ${period} 節（此節既有：${existInfo}）。`, "success", JSON.parse(JSON.stringify(state.schedules)), refreshAllViews);
    } else {
        showToast("點選排課成功！", "success");
        teacherLog(`排課成功！已將「${className}」的「${courseName}」排入週 ${weekday} 第 ${period} 節。`, "success", JSON.parse(JSON.stringify(state.schedules)), refreshAllViews);
    }
}

// --- 填充 Tab 2 教師下拉選單 ---
export function populateTeacherSelect() {
    if (!dom.selectTeacher) return;
    const currentVal = dom.selectTeacher.value;
    dom.selectTeacher.innerHTML = '<option value="">-- 請選擇教師 --</option>';
    state.teachers.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent = `${t.name}${t.is_tutor ? ' (導師)' : ''}`;
        if (currentVal && String(t.id) === String(currentVal)) {
            opt.selected = true;
        }
        dom.selectTeacher.appendChild(opt);
    });

    if (currentVal && state.teachers.some(t => String(t.id) === String(currentVal))) {
        dom.selectTeacher.value = currentVal;
    }
}

// --- 渲染教師個人課表 (Tab 2) ---
export function renderTeacherSchedule() {
    if (!dom.teacherGridBody) return;

    document.querySelectorAll("#teacher-grid-body td.dropzone").forEach(cell => {
        cell.innerHTML = "";
        cell.className = "dropzone";
    });

    const teacherId = dom.selectTeacher?.value ? parseInt(dom.selectTeacher.value) : null;
    if (!teacherId) {
        if (dom.currentTeacherDisplay) dom.currentTeacherDisplay.textContent = "尚未選擇教師";
        if (dom.teacherTutorBadge) dom.teacherTutorBadge.style.display = "none";
        if (dom.teacherStatPeriods) dom.teacherStatPeriods.textContent = "0";
        if (dom.teacherStatGrades) dom.teacherStatGrades.textContent = "0";
        return;
    }

    const teacher = state.teachers.find(t => String(t.id) === String(teacherId));
    if (!teacher) return;

    if (dom.currentTeacherDisplay) dom.currentTeacherDisplay.textContent = teacher.name;
    teacherLog(`已載入 ${teacher.name} 老師的個人課表。`, "system-msg", null, refreshAllViews);

    if (dom.teacherTutorBadge) {
        if (teacher.is_tutor) {
            dom.teacherTutorBadge.style.display = "inline-block";
            dom.teacherTutorBadge.textContent = "導師";
        } else {
            dom.teacherTutorBadge.style.display = "none";
        }
    }

    const teacherSchedules = state.schedules.filter(s => {
        const c = state.courses.find(course => String(course.id) === String(s.course_id));
        return c && String(c.teacher_id) === String(teacherId);
    });

    const totalPeriods = teacherSchedules.reduce((sum, s) => sum + (s.week_type === "ODD" || s.week_type === "EVEN" ? 0.5 : 1.0), 0);
    if (dom.teacherStatPeriods) dom.teacherStatPeriods.textContent = totalPeriods;

    const gradesSet = new Set();
    teacherSchedules.forEach(s => {
        const cls = state.classes.find(c => String(c.id) === String(s.class_id));
        if (cls) {
            gradesSet.add(cls.grade);
        }
    });
    if (dom.teacherStatGrades) dom.teacherStatGrades.textContent = gradesSet.size;

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
                const cls = state.classes.find(c => String(c.id) === String(sched.class_id));
                const course = state.courses.find(c => String(c.id) === String(sched.course_id));
                const room = state.classrooms.find(r => String(r.id) === String(sched.classroom_id));

                const weekType = (sched && sched.week_type) ? sched.week_type.toLowerCase() : "every";
                const weekBadge = sched && sched.week_type === "ODD" ? '<span class="week-tag inline">[單]</span> ' :
                    sched && sched.week_type === "EVEN" ? '<span class="week-tag inline">[雙]</span> ' :
                        sched && sched.week_type === "GROUP" ? '<span class="week-tag inline" style="color: #c4b5fd;">[組]</span> ' : '';

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

                    state.ignoreNextClickCell = cell;
                    setTimeout(() => {
                        if (state.ignoreNextClickCell === cell) state.ignoreNextClickCell = null;
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

                    const ul = dom.contextMenu?.querySelector("ul");
                    if (ul) {
                        ul.innerHTML = `
                            <li id="menu-item-popup-class" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <i class="fa-solid fa-window-restore" style="color: var(--accent-cyan);"></i>
                                <span>彈出顯示 ${className} 的課表</span>
                            </li>
                            <li id="menu-item-goto-class" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <i class="fa-solid fa-graduation-cap"></i>
                                <span>前往 ${className} 的課表</span>
                            </li>
                        `;

                        const itemPopup = ul.querySelector("#menu-item-popup-class");
                        if (itemPopup) {
                            itemPopup.onclick = () => {
                                openFloatingSchedule('class', classId);
                                dom.contextMenu.classList.add("hidden");
                            };
                        }

                        const itemGoto = ul.querySelector("#menu-item-goto-class");
                        if (itemGoto) {
                            itemGoto.onclick = () => {
                                const tabBtn = document.querySelector(`.tab-btn[data-tab="class-schedule-view"]`);
                                if (tabBtn) tabBtn.click();
                                if (dom.selectClass) {
                                    dom.selectClass.value = classId;
                                    state.selectedClassId = classId;
                                    if (refreshAllViews) refreshAllViews();
                                }
                                dom.contextMenu.classList.add("hidden");
                            };
                        }
                    }

                    showContextMenu(e);
                });

                cell.appendChild(div);
                cell.classList.remove("unavailable-cell");
            });
        }
    }
}

// --- 處理不排課時段設定點擊 ---
export async function handleTeacherSlotClick(weekday, period, cell) {
    const teacherId = dom.selectTeacher?.value ? parseInt(dom.selectTeacher.value) : null;
    if (!teacherId) {
        showToast("請先選擇教師！", "error");
        return;
    }

    const teacher = state.teachers.find(t => t.id === teacherId);
    if (!teacher) return;

    const hasClass = state.schedules.some(s => {
        const c = state.courses.find(course => course.id === s.course_id);
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
        teacherLog(`取消設定不排課時間：週 ${weekday} 第 ${period} 節`, "system-msg", null, refreshAllViews);
    } else {
        unavailableSlots.push(slotKey);
        teacherLog(`設定不排課時間：週 ${weekday} 第 ${period} 節`, "success", null, refreshAllViews);
    }

    try {
        teacher.unavailable_slots = unavailableSlots;
        await dbSet("mst_teachers", state.teachers);
        showToast("教師不排課時間段更新成功！", "success");
        renderTeacherSchedule();
    } catch (err) {
        showToast("更新失敗：" + err.message, "error");
    }
}

// --- 渲染左側教師已安排的科目（教師排課面板） ---
export function renderTeacherCourses(teacherId) {
    if (!dom.teacherCoursePool || !dom.teacherCoursePoolSection) return;

    dom.teacherCoursePool.innerHTML = "";

    if (!teacherId) {
        dom.teacherCoursePoolSection.style.display = "none";
        if (dom.teacherClassroomSelectSection) dom.teacherClassroomSelectSection.style.display = "none";
        return;
    }

    const teacherCourses = state.courses.filter(c => c.teacher_id === teacherId);

    if (teacherCourses.length === 0) {
        dom.teacherCoursePool.innerHTML = `
            <div class="empty-state" style="padding: 10px; font-size: 13px; text-align: center; color: var(--text-muted);">
                <p>此教師目前沒有安排授課科目。</p>
            </div>
        `;
        dom.teacherCoursePoolSection.style.display = "block";
        if (dom.teacherClassroomSelectSection) dom.teacherClassroomSelectSection.style.display = "none";
        return;
    }

    dom.teacherCoursePoolSection.style.display = "block";
    if (dom.teacherClassroomSelectSection) dom.teacherClassroomSelectSection.style.display = "block";

    teacherCourses.forEach(c => {
        const card = document.createElement("div");
        card.className = `course-card week-${(c.week_type || 'EVERY').toLowerCase()}`;
        if (state.teacherSelectedCourseId === c.id) {
            card.classList.add("active");
        }

        const cls = state.classes.find(classItem => classItem.id === c.class_id);
        const className = cls ? cls.name : "未知班級";

        const scheduledPeriods = state.schedules
            .filter(s => s.course_id === c.id && s.class_id === c.class_id)
            .reduce((sum, s) => sum + (s.week_type === "EVERY" ? 1.0 : 0.5), 0);
        const required = c.required_periods || 0;
        const remaining = required - scheduledPeriods;
        const isDone = remaining <= 0;

        const isOver = scheduledPeriods > required && required > 0;
        const periodTag = required > 0
            ? (isOver
                ? `<span class="period-badge" style="background:rgba(239,68,68,0.15);border-color:rgba(239,68,68,0.4);color:#f87171;">${scheduledPeriods}/${required} 節 · 超出 ${scheduledPeriods - required} 節</span>`
                : `<span class="period-badge ${isDone ? 'done' : ''}">${scheduledPeriods}/${required} 節${isDone ? ' ✓' : ` · 還需 ${remaining} 節`}</span>`)
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
            if (state.teacherSelectedCourseId === c.id) {
                state.teacherSelectedCourseId = null;
                card.classList.remove("active");
                teacherLog(`已取消選取課程「${c.name}」`, "system-msg", null, refreshAllViews);
            } else {
                state.teacherSelectedCourseId = c.id;
                document.querySelectorAll("#teacher-course-pool .course-card").forEach(el => el.classList.remove("active"));
                card.classList.add("active");
                teacherLog(`已選取「${className} - ${c.name}」。請直接點擊右側教師課表空格進行排課。`, "system-msg", null, refreshAllViews);
                autoSwitchClassroomForCourse(c, true);
            }
        });

        card.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const classId = c.class_id;
            const clsObj = state.classes.find(classItem => classItem.id === classId);
            const classNameStr = clsObj ? clsObj.name : "該班級";

            const ul = dom.contextMenu?.querySelector("ul");
            if (ul) {
                ul.innerHTML = `
                    <li id="menu-item-popup-class" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <i class="fa-solid fa-window-restore" style="color: var(--accent-cyan);"></i>
                        <span>彈出顯示 ${classNameStr} 的課表</span>
                    </li>
                    <li id="menu-item-goto-class" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <i class="fa-solid fa-graduation-cap"></i>
                        <span>前往 ${classNameStr} 的課表</span>
                    </li>
                `;
                const itemPopup = ul.querySelector("#menu-item-popup-class");
                if (itemPopup) {
                    itemPopup.onclick = () => {
                        openFloatingSchedule('class', classId);
                        dom.contextMenu.classList.add("hidden");
                    };
                }
                const itemGoto = ul.querySelector("#menu-item-goto-class");
                if (itemGoto) {
                    itemGoto.onclick = () => {
                        const tabBtn = document.querySelector(`.tab-btn[data-tab="class-schedule-view"]`);
                        if (tabBtn) tabBtn.click();
                        if (dom.selectClass) {
                            dom.selectClass.value = classId;
                            state.selectedClassId = classId;
                            if (refreshAllViews) refreshAllViews();
                        }
                        dom.contextMenu.classList.add("hidden");
                    };
                }
            }
            showContextMenu(e);
        });

        dom.teacherCoursePool.appendChild(card);
    });
}

// --- 教師課表事件監聽 ---
export function setupTeacherScheduleEventListeners() {
    if (dom.selectTeacher) {
        dom.selectTeacher.addEventListener("change", () => {
            state.teacherSelectedCourseId = null;
            renderTeacherSchedule();
            renderTeacherCourses(dom.selectTeacher.value ? parseInt(dom.selectTeacher.value) : null);
        });
    }

    if (dom.btnRefreshTeacher) {
        dom.btnRefreshTeacher.addEventListener("click", async () => {
            const icon = dom.btnRefreshTeacher.querySelector("i");
            if (icon) {
                icon.style.animation = "spin 0.6s linear";
                setTimeout(() => { icon.style.animation = ""; }, 700);
            }
            try {
                if (refreshAllViews) await refreshAllViews();
                teacherLog("課表資料已重新整理！", "success", JSON.parse(JSON.stringify(state.schedules)), refreshAllViews);
                showToast("課表資料已重新整理！", "success");
            } catch (e) {
                teacherLog("重新整理失敗：" + e.message, "error", null, refreshAllViews);
                showToast("重新整理失敗", "error");
            }
        });
    }

    if (dom.btnToggleAddTeacher && dom.formAddTeacher) {
        dom.btnToggleAddTeacher.addEventListener("click", () => {
            dom.formAddTeacher.style.display = dom.formAddTeacher.style.display === "none" ? "block" : "none";
        });

        dom.formAddTeacher.addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = dom.inputNewTeacherName.value.trim();
            const isTutor = dom.inputNewTeacherTutor.checked;

            if (!name) return;

            try {
                const newTeacher = {
                    id: getNextId(state.teachers),
                    name: name,
                    is_tutor: isTutor,
                    unavailable_slots: []
                };
                state.teachers.push(newTeacher);
                await dbSet("mst_teachers", state.teachers);

                showToast("新增教師成功！", "success");
                dom.formAddTeacher.reset();
                dom.formAddTeacher.style.display = "none";
                if (refreshAllViews) await refreshAllViews();
            } catch (err) {
                showToast("新增失敗：" + err.message, "error");
            }
        });
    }
}
