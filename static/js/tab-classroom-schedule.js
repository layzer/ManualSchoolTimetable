// static/js/tab-classroom-schedule.js
// --- Tab 2.5: 科任教室課表查詢與使用統計 ---

import { state, dom } from './state.js';
import { classroomLog, showToast } from './utils.js';
import { showContextMenu } from './context-menu.js';
import { openFloatingSchedule } from './floating-window.js';
import { deleteSchedule } from './tab-class-schedule.js';

let refreshAllViews = null;

export function setClassroomScheduleRefreshCallback(cb) {
    refreshAllViews = cb;
}

// --- 建立教室課表網格 ---
export function generateClassroomGrid() {
    if (!dom.classroomGridBody) return;
    dom.classroomGridBody.innerHTML = "";

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
            dom.classroomGridBody.appendChild(tr);
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
        dom.classroomGridBody.appendChild(tr);
    });
}

// --- 渲染教室使用課表 ---
export function renderClassroomSchedule() {
    if (!dom.classroomGridBody) return;

    // 清空課表
    document.querySelectorAll("#classroom-grid-body td.dropzone").forEach(cell => {
        cell.innerHTML = "";
        cell.className = "dropzone";
    });

    const classroomId = dom.selectClassroomView?.value ? parseInt(dom.selectClassroomView.value) : null;
    if (!classroomId) {
        if (dom.currentClassroomDisplay) dom.currentClassroomDisplay.textContent = "尚未選擇教室";
        if (dom.classroomTypeBadge) dom.classroomTypeBadge.style.display = "none";
        if (dom.classroomStatPeriods) dom.classroomStatPeriods.textContent = "0";
        return;
    }

    const classroom = state.classrooms.find(r => String(r.id) === String(classroomId));
    if (!classroom) return;

    if (dom.currentClassroomDisplay) dom.currentClassroomDisplay.textContent = classroom.name;
    classroomLog(`已載入教室「${classroom.name}」的使用課表。`, "system-msg", null, refreshAllViews);
    if (dom.classroomTypeBadge) {
        dom.classroomTypeBadge.textContent = classroom.type + "教室";
        dom.classroomTypeBadge.style.display = "inline-block";
    }

    const roomSchedules = state.schedules.filter(s => String(s.classroom_id) === String(classroomId));

    const totalPeriods = roomSchedules.reduce((sum, s) => sum + (s.week_type === "EVERY" ? 1.0 : 0.5), 0);
    if (dom.classroomStatPeriods) dom.classroomStatPeriods.textContent = totalPeriods;

    for (let d = 1; d <= 5; d++) {
        for (let p = 1; p <= 8; p++) {
            const cell = document.querySelector(`#classroom-grid-body td[data-weekday="${d}"][data-period="${p}"]`);
            if (!cell) continue;

            const scheds = roomSchedules
                .filter(s => s.weekday === d && s.period === p)
                .sort((a, b) => {
                    if (a.week_type === "ODD" && b.week_type === "EVEN") return -1;
                    if (a.week_type === "EVEN" && b.week_type === "ODD") return 1;
                    return 0;
                });

            scheds.forEach(sched => {
                const cls = state.classes.find(c => String(c.id) === String(sched.class_id));
                const course = state.courses.find(c => String(c.id) === String(sched.course_id));
                const teacher = course ? state.teachers.find(t => String(t.id) === String(course.teacher_id)) : null;

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
                        <span>${teacher ? teacher.name.split(" ")[0] : ""}</span>
                    </div>
                `;

                // 取消排課按鈕：必須使用 mousedown 事件監聽
                div.querySelector(".btn-delete-placed").addEventListener("mousedown", async (e) => {
                    e.stopPropagation();
                    e.preventDefault();

                    state.ignoreNextClickCell = cell;
                    setTimeout(() => {
                        if (state.ignoreNextClickCell === cell) state.ignoreNextClickCell = null;
                    }, 300);

                    if (confirm(`確定要取消「${course ? course.name : ""}」的排課嗎？`)) {
                        await deleteSchedule(sched.id);
                        renderClassroomSchedule();
                    }
                });

                div.addEventListener("contextmenu", (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const classId = sched.class_id;
                    const className = cls ? cls.name : "該班級";
                    const teacherId = course ? course.teacher_id : null;
                    const teacherName = teacher ? teacher.name : "該教師";

                    const ul = dom.contextMenu?.querySelector("ul");
                    if (ul) {
                        ul.innerHTML = `
                            <li id="menu-item-popup-class" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <i class="fa-solid fa-window-restore" style="color: var(--accent-cyan);"></i>
                                <span>彈出顯示 ${className} 的課表</span>
                            </li>
                            <li id="menu-item-popup-teacher" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <i class="fa-solid fa-window-restore" style="color: var(--accent-cyan);"></i>
                                <span>彈出顯示 ${teacherName} 的課表</span>
                            </li>
                            <li id="menu-item-goto-class" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <i class="fa-solid fa-graduation-cap"></i>
                                <span>前往 ${className} 的課表</span>
                            </li>
                            <li id="menu-item-goto-teacher" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <i class="fa-solid fa-user-tie"></i>
                                <span>前往 ${teacherName} 的課表</span>
                            </li>
                        `;

                        const itemPopupClass = ul.querySelector("#menu-item-popup-class");
                        if (itemPopupClass) {
                            itemPopupClass.onclick = () => {
                                openFloatingSchedule('class', classId);
                                dom.contextMenu.classList.add("hidden");
                            };
                        }

                        const itemPopupTeacher = ul.querySelector("#menu-item-popup-teacher");
                        if (itemPopupTeacher && teacherId) {
                            itemPopupTeacher.onclick = () => {
                                openFloatingSchedule('teacher', teacherId);
                                dom.contextMenu.classList.add("hidden");
                            };
                        }

                        const itemGotoClass = ul.querySelector("#menu-item-goto-class");
                        if (itemGotoClass) {
                            itemGotoClass.onclick = () => {
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

                        const itemGotoTeacher = ul.querySelector("#menu-item-goto-teacher");
                        if (itemGotoTeacher && teacherId) {
                            itemGotoTeacher.onclick = () => {
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

                cell.appendChild(div);
            });
        }
    }
}

// --- 教室課表事件監聽 ---
export function setupClassroomScheduleEventListeners() {
    if (dom.selectClassroomView) {
        dom.selectClassroomView.addEventListener("change", () => {
            renderClassroomSchedule();
        });
    }

    if (dom.btnRefreshClassroom) {
        dom.btnRefreshClassroom.addEventListener("click", async () => {
            const icon = dom.btnRefreshClassroom.querySelector("i");
            if (icon) {
                icon.style.animation = "spin 0.6s linear";
                setTimeout(() => { icon.style.animation = ""; }, 700);
            }
            try {
                if (refreshAllViews) await refreshAllViews();
                classroomLog("課表資料已重新整理！", "success", JSON.parse(JSON.stringify(state.schedules)), refreshAllViews);
                showToast("課表資料已重新整理！", "success");
            } catch (e) {
                classroomLog("重新整理失敗：" + e.message, "error", null, refreshAllViews);
                showToast("重新整理失敗", "error");
            }
        });
    }
}
