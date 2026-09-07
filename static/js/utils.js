// static/js/utils.js
// --- 通用工具函式、Toast、日誌與快照還原 ---

import { state, dom } from './state.js';
import { dbSet } from './storage.js';
import { showContextMenu } from './context-menu.js';

/**
 * Toast 彈出通知提示
 */
export function showToast(msg, type = "info") {
    if (!dom.toastContainer) return;
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    let icon = "fa-circle-info";
    if (type === "success") icon = "fa-circle-check";
    if (type === "error") icon = "fa-circle-exclamation";
    if (type === "warning") icon = "fa-triangle-exclamation";

    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${msg}</span>`;
    dom.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = "toastOut 0.3s forwards";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * 班級課表動作日誌
 */
export function log(msg, type = "system-msg", snapshot = null, onRollbackRefresh = null) {
    if (!dom.statusLogger) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const div = document.createElement("div");
    div.className = `log-entry ${type}`;
    div.innerHTML = `[${time}] ${msg}`;
    if (snapshot) {
        attachSnapshotToLogEntry(div, snapshot, time, msg, onRollbackRefresh);
    }
    dom.statusLogger.appendChild(div);
    dom.statusLogger.scrollTop = dom.statusLogger.scrollHeight;
}

/**
 * 教師課表動作日誌
 */
export function teacherLog(msg, type = "system-msg", snapshot = null, onRollbackRefresh = null) {
    if (!dom.teacherStatusLogger) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const div = document.createElement("div");
    div.className = `log-entry ${type}`;
    div.innerHTML = `[${time}] ${msg}`;
    if (snapshot) {
        attachSnapshotToLogEntry(div, snapshot, time, msg, onRollbackRefresh);
    }
    dom.teacherStatusLogger.appendChild(div);
    dom.teacherStatusLogger.scrollTop = dom.teacherStatusLogger.scrollHeight;
}

/**
 * 教室課表動作日誌
 */
export function classroomLog(msg, type = "system-msg", snapshot = null, onRollbackRefresh = null) {
    if (!dom.classroomStatusLogger) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const div = document.createElement("div");
    div.className = `log-entry ${type}`;
    div.innerHTML = `[${time}] ${msg}`;
    if (snapshot) {
        attachSnapshotToLogEntry(div, snapshot, time, msg, onRollbackRefresh);
    }
    dom.classroomStatusLogger.appendChild(div);
    dom.classroomStatusLogger.scrollTop = dom.classroomStatusLogger.scrollHeight;
}

/**
 * 輔助函式：為日誌項目綁定課表快照與右鍵選單
 */
export function attachSnapshotToLogEntry(div, snapshot, timeStr, msg, onRollbackRefresh = null) {
    if (!snapshot || !Array.isArray(snapshot)) return;

    div.classList.add("has-snapshot");
    div.setAttribute("title", `點擊滑鼠右鍵可還原至 [${timeStr}] 的課表狀態`);

    div.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const ul = dom.contextMenu?.querySelector("ul");
        if (!ul || !dom.contextMenu) return;

        ul.innerHTML = `
            <li id="menu-item-rollback" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <i class="fa-solid fa-rotate-left" style="color: #60a5fa;"></i>
                <span>還原到這一步驟 (${timeStr})</span>
            </li>
        `;

        const menuItemRollback = document.getElementById("menu-item-rollback");
        if (menuItemRollback) {
            menuItemRollback.onclick = async () => {
                dom.contextMenu.classList.add("hidden");
                await rollbackToSnapshot(snapshot, timeStr, onRollbackRefresh);
            };
        }

        showContextMenu(e);
    });
}

/**
 * 動作還原 (Rollback) 核心機制
 */
export async function rollbackToSnapshot(snapshot, timeStr, onRollbackRefresh = null) {
    if (!snapshot || !Array.isArray(snapshot)) {
        showToast("該紀錄沒有可還原的課表資料！", "error");
        return;
    }

    try {
        state.schedules = JSON.parse(JSON.stringify(snapshot));
        await dbSet("mst_schedules", state.schedules);

        if (typeof onRollbackRefresh === "function") {
            await onRollbackRefresh();
        }

        showToast(`已成功還原至 [${timeStr}] 的排課狀態！`, "success");
        const currentSnapshot = JSON.parse(JSON.stringify(state.schedules));
        log(`已還原至 [${timeStr}] 的課表狀態。`, "system-msg", currentSnapshot, onRollbackRefresh);
        if (dom.teacherStatusLogger) {
            teacherLog(`已還原至 [${timeStr}] 的課表狀態。`, "system-msg", currentSnapshot, onRollbackRefresh);
        }
        if (dom.classroomStatusLogger) {
            classroomLog(`已還原至 [${timeStr}] 的課表狀態。`, "system-msg", currentSnapshot, onRollbackRefresh);
        }
    } catch (err) {
        console.error("還原動作失敗：", err);
        showToast("還原失敗：" + err.message, "error");
    }
}

/**
 * 智慧教室切換：自動將授課教室切換為該科目設定的預設教室類型
 */
export function autoSwitchClassroomForCourse(course, isTeacherTab = false) {
    const targetSelect = isTeacherTab ? dom.teacherSelectClassroom : dom.selectClassroom;
    if (!targetSelect || !course) return;

    let targetRoomName = course.classroom_name;
    const targetClassId = isTeacherTab ? course.class_id : state.selectedClassId;
    const currentClass = state.classes.find(c => c.id === targetClassId);

    if (!targetRoomName || targetRoomName === "班級教室" || targetRoomName === "普通") {
        if (currentClass && currentClass.default_classroom_id) {
            targetSelect.value = currentClass.default_classroom_id;
            return;
        }
        targetRoomName = "班級教室";
    }

    const matchedRoom = state.classrooms.find(cr => cr.name === targetRoomName);
    if (matchedRoom) {
        targetSelect.value = matchedRoom.id;
    } else {
        const typeRoom = state.classrooms.find(cr => cr.type === targetRoomName);
        if (typeRoom) {
            targetSelect.value = typeRoom.id;
        } else if (currentClass && currentClass.default_classroom_id) {
            targetSelect.value = currentClass.default_classroom_id;
        }
    }
}
