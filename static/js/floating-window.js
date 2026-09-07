// static/js/floating-window.js
// --- 浮動可拖曳課表視窗邏輯 ---

import { state, dom } from './state.js';

export function initFloatingWindowDrag() {
    if (!dom.floatingWindow || !dom.floatingWindowHeader) return;
    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;

    dom.floatingWindowHeader.addEventListener("mousedown", (e) => {
        if (e.target.closest(".btn-floating-action")) return;
        isDragging = true;
        dom.floatingWindow.classList.add("is-dragging");

        const rect = dom.floatingWindow.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        initialLeft = rect.left;
        initialTop = rect.top;

        dom.floatingWindow.style.right = "auto";
        dom.floatingWindow.style.bottom = "auto";
        dom.floatingWindow.style.left = `${initialLeft}px`;
        dom.floatingWindow.style.top = `${initialTop}px`;

        e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        let newLeft = initialLeft + dx;
        let newTop = initialTop + dy;

        const winW = window.innerWidth;
        const winH = window.innerHeight;
        const rect = dom.floatingWindow.getBoundingClientRect();

        newLeft = Math.max(10, Math.min(newLeft, winW - rect.width - 10));
        newTop = Math.max(10, Math.min(newTop, winH - 40));

        dom.floatingWindow.style.left = `${newLeft}px`;
        dom.floatingWindow.style.top = `${newTop}px`;
    });

    document.addEventListener("mouseup", () => {
        if (isDragging) {
            isDragging = false;
            dom.floatingWindow.classList.remove("is-dragging");
        }
    });

    if (dom.btnCollapseFloating) {
        dom.btnCollapseFloating.addEventListener("click", () => {
            state.floatingScheduleState.isCollapsed = !state.floatingScheduleState.isCollapsed;
            dom.floatingWindow.classList.toggle("collapsed", state.floatingScheduleState.isCollapsed);
            dom.btnCollapseFloating.innerHTML = state.floatingScheduleState.isCollapsed
                ? '<i class="fa-solid fa-plus"></i>'
                : '<i class="fa-solid fa-minus"></i>';
        });
    }

    if (dom.btnCloseFloating) {
        dom.btnCloseFloating.addEventListener("click", () => {
            closeFloatingSchedule();
        });
    }
}

export function openFloatingSchedule(type, id) {
    if (!type || !id) return;
    state.floatingScheduleState.isOpen = true;
    state.floatingScheduleState.type = type;
    state.floatingScheduleState.id = parseInt(id);

    if (dom.floatingWindow) {
        dom.floatingWindow.classList.remove("hidden");
    }
    renderFloatingSchedule();
}

export function closeFloatingSchedule() {
    state.floatingScheduleState.isOpen = false;
    state.floatingScheduleState.type = null;
    state.floatingScheduleState.id = null;
    if (dom.floatingWindow) {
        dom.floatingWindow.classList.add("hidden");
    }
}

export function renderFloatingSchedule() {
    if (!state.floatingScheduleState.isOpen || !dom.floatingGridBody) return;

    const { type, id } = state.floatingScheduleState;
    dom.floatingGridBody.innerHTML = "";

    if (type === "teacher") {
        const teacher = state.teachers.find(t => String(t.id) === String(id));
        if (!teacher) return;

        if (dom.floatingWindowTitleText) {
            dom.floatingWindowTitleText.textContent = `${teacher.name} 個人課表`;
        }

        const teacherSchedules = state.schedules.filter(s => {
            const c = state.courses.find(course => String(course.id) === String(s.course_id));
            return c && String(c.teacher_id) === String(id);
        });
        const totalPeriods = teacherSchedules.reduce((sum, s) => sum + (s.week_type === "ODD" || s.week_type === "EVEN" ? 0.5 : 1.0), 0);

        if (dom.floatingWindowInfo) {
            dom.floatingWindowInfo.innerHTML = `
                <span><i class="fa-solid fa-user-tie"></i> ${teacher.name} ${teacher.is_tutor ? '(導師)' : ''}</span>
                <span class="floating-badge"><i class="fa-solid fa-clock"></i> 已排 ${totalPeriods} 節</span>
            `;
        }

        const unavailableSlots = teacher.unavailable_slots || [];

        for (let p = 1; p <= 8; p++) {
            if (p === 6) {
                const lunchTr = document.createElement("tr");
                lunchTr.className = "lunch-row";
                lunchTr.innerHTML = `<td>午</td><td colspan="5">午　休</td>`;
                dom.floatingGridBody.appendChild(lunchTr);
            }

            const tr = document.createElement("tr");
            tr.innerHTML = `<td>${p}</td>`;

            for (let d = 1; d <= 5; d++) {
                const td = document.createElement("td");
                td.className = "floating-cell";
                const slotKey = `${d}-${p}`;

                if (unavailableSlots.includes(slotKey)) {
                    td.classList.add("unavailable");
                    td.title = "不可排課時段";
                }

                const cellScheds = teacherSchedules
                    .filter(s => s.weekday === d && s.period === p)
                    .sort((a, b) => {
                        if (a.week_type === "ODD" && b.week_type === "EVEN") return -1;
                        if (a.week_type === "EVEN" && b.week_type === "ODD") return 1;
                        return 0;
                    });

                if (cellScheds.length > 0) {
                    td.classList.remove("unavailable");
                    if (cellScheds.length > 1) {
                        td.classList.add("has-group-split");
                    }
                    cellScheds.forEach(s => {
                        const c = state.courses.find(course => String(course.id) === String(s.course_id));
                        const cls = state.classes.find(classItem => String(classItem.id) === String(s.class_id));
                        const room = state.classrooms.find(r => String(r.id) === String(s.classroom_id));

                        const weekType = (s.week_type || 'EVERY').toLowerCase();
                        const weekBadge = s.week_type === 'ODD' ? '[單]' : s.week_type === 'EVEN' ? '[雙]' : s.week_type === 'GROUP' ? '[組]' : '';

                        const chip = document.createElement("div");
                        chip.className = `floating-course-chip week-${weekType}`;
                        chip.innerHTML = `
                            <div class="course-name">${weekBadge}${c ? c.name : '課程'}</div>
                            <div class="course-sub">${cls ? cls.name : ''} ${room ? room.name : ''}</div>
                        `;
                        td.appendChild(chip);
                    });
                }

                tr.appendChild(td);
            }
            dom.floatingGridBody.appendChild(tr);
        }

    } else if (type === "class") {
        const cls = state.classes.find(c => String(c.id) === String(id));
        if (!cls) return;

        if (dom.floatingWindowTitleText) {
            dom.floatingWindowTitleText.textContent = `${cls.name} 班級課表`;
        }

        const classSchedules = state.schedules
            .filter(s => String(s.class_id) === String(id))
            .sort((a, b) => {
                if (a.week_type === "ODD" && b.week_type === "EVEN") return -1;
                if (a.week_type === "EVEN" && b.week_type === "ODD") return 1;
                return 0;
            });
        const totalPeriods = classSchedules.reduce((sum, s) => sum + (s.week_type === "ODD" || s.week_type === "EVEN" ? 0.5 : 1.0), 0);

        if (dom.floatingWindowInfo) {
            dom.floatingWindowInfo.innerHTML = `
                <span><i class="fa-solid fa-graduation-cap"></i> ${cls.name} (${cls.grade}年級)</span>
                <span class="floating-badge"><i class="fa-solid fa-clock"></i> 已排 ${totalPeriods} 節</span>
            `;
        }

        for (let p = 1; p <= 8; p++) {
            if (p === 6) {
                const lunchTr = document.createElement("tr");
                lunchTr.className = "lunch-row";
                lunchTr.innerHTML = `<td>午</td><td colspan="5">午　休</td>`;
                dom.floatingGridBody.appendChild(lunchTr);
            }

            const tr = document.createElement("tr");
            tr.innerHTML = `<td>${p}</td>`;

            for (let d = 1; d <= 5; d++) {
                const td = document.createElement("td");
                td.className = "floating-cell";

                const cellScheds = classSchedules.filter(s => s.weekday === d && s.period === p);
                if (cellScheds.length > 0) {
                    if (cellScheds.length > 1) {
                        td.classList.add("has-group-split");
                    }
                    cellScheds.forEach(s => {
                        const c = state.courses.find(course => String(course.id) === String(s.course_id));
                        const teacher = c ? state.teachers.find(t => String(t.id) === String(c.teacher_id)) : null;
                        const room = state.classrooms.find(r => String(r.id) === String(s.classroom_id));

                        const weekType = (s.week_type || 'EVERY').toLowerCase();
                        const weekBadge = s.week_type === 'ODD' ? '[單]' : s.week_type === 'EVEN' ? '[雙]' : s.week_type === 'GROUP' ? '[組]' : '';

                        const chip = document.createElement("div");
                        chip.className = `floating-course-chip week-${weekType}`;
                        chip.innerHTML = `
                            <div class="course-name">${weekBadge}${c ? c.name : '課程'}</div>
                            <div class="course-sub">${teacher ? teacher.name.split(' ')[0] : ''} ${room ? room.name : ''}</div>
                        `;
                        td.appendChild(chip);
                    });
                }

                tr.appendChild(td);
            }
            dom.floatingGridBody.appendChild(tr);
        }
    }
}
