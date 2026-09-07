// static/js/main.js
// --- 應用程式主進入點與生命週期管理 ---

import { state, dom } from './state.js';
import { loadAllData } from './storage.js';
import { showToast, log } from './utils.js';
import { hideContextMenu } from './context-menu.js';
import { initFloatingWindowDrag, renderFloatingSchedule } from './floating-window.js';
import {
    generateGrid,
    populateSelectors,
    updateClassDisplay,
    clearSelectedCourse,
    renderCourses,
    renderSchedules,
    setupClassScheduleEventListeners,
    setClassScheduleRefreshCallback
} from './tab-class-schedule.js';
import {
    generateTeacherGrid,
    populateTeacherSelect,
    renderTeacherSchedule,
    renderTeacherCourses,
    setupTeacherScheduleEventListeners,
    setTeacherScheduleRefreshCallback
} from './tab-teacher-schedule.js';
import {
    generateClassroomGrid,
    renderClassroomSchedule,
    setupClassroomScheduleEventListeners,
    setClassroomScheduleRefreshCallback
} from './tab-classroom-schedule.js';
import {
    renderTeacherSummary,
    populateMgtSelectors,
    renderMgtCoursesList,
    setupFormAddCourseListener,
    renderCourseMatrix,
    renderMatrixTeacherList,
    setupCourseMatrixListeners,
    setTeacherSummaryRefreshCallback
} from './tab-teacher-summary.js';
import {
    populateCurriculumSelectors,
    renderCurriculumView,
    setupCurriculumFormListener,
    setCurriculumRefreshCallback
} from './tab-curriculum.js';
import {
    renderSettingsUI,
    setupSettingsListeners,
    setupConfigEditor,
    setSettingsRefreshCallback
} from './tab-settings.js';
import {
    setupCSVImports,
    openImportSystemModal,
    setImportExportRefreshCallback
} from './import-export.js';

/**
 * 重新整理所有模組視圖
 */
export async function refreshAll() {
    await loadAllData(() => {
        generateGrid();
        generateTeacherGrid();
        generateClassroomGrid();

        populateSelectors();
        updateClassDisplay();
        renderCourses();
        renderSchedules();

        populateTeacherSelect();
        renderTeacherSchedule();
        renderTeacherCourses(dom.selectTeacher?.value ? parseInt(dom.selectTeacher.value) : null);
        renderTeacherSummary();
        populateMgtSelectors();
        renderMgtCoursesList();

        renderClassroomSchedule();

        populateCurriculumSelectors();
        renderCurriculumView();

        renderSettingsUI();

        renderCourseMatrix();
        renderMatrixTeacherList();

        if (state.floatingScheduleState.isOpen) {
            renderFloatingSchedule();
        }
    });
}

// 註冊所有模組回呼
setClassScheduleRefreshCallback(refreshAll);
setTeacherScheduleRefreshCallback(refreshAll);
setClassroomScheduleRefreshCallback(refreshAll);
setTeacherSummaryRefreshCallback(refreshAll);
setCurriculumRefreshCallback(refreshAll);
setSettingsRefreshCallback(refreshAll);
setImportExportRefreshCallback(refreshAll);

// --- Tab 分頁切換監聽 ---
export function setupTabListeners() {
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

            if (dom.vsClassGroup) dom.vsClassGroup.style.display = "none";
            if (dom.vsTeacherGroup) dom.vsTeacherGroup.style.display = "none";
            if (dom.vsCurriculumGroup) dom.vsCurriculumGroup.style.display = "none";
            if (dom.vsClassroomGroup) dom.vsClassroomGroup.style.display = "none";

            if (tabId === "class-schedule-view") {
                if (dom.vsClassGroup) dom.vsClassGroup.style.display = "flex";
                clearSelectedCourse();
                renderSchedules();
                renderCourses();
            } else if (tabId === "teacher-schedule-view") {
                if (dom.vsTeacherGroup) dom.vsTeacherGroup.style.display = "flex";
                renderTeacherSchedule();
            } else if (tabId === "classroom-schedule-view") {
                if (dom.vsClassroomGroup) dom.vsClassroomGroup.style.display = "flex";
                renderClassroomSchedule();
            } else if (tabId === "teacher-summary-view") {
                renderTeacherSummary();
            } else if (tabId === "class-curriculum-view") {
                if (dom.vsCurriculumGroup) dom.vsCurriculumGroup.style.display = "flex";
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

// --- 初始化載入 ---
document.addEventListener("DOMContentLoaded", () => {
    // 檢查是否有匯入成功後需要顯示的提示
    try {
        const savedToast = localStorage.getItem("mst_import_toast");
        if (savedToast) {
            localStorage.removeItem("mst_import_toast");
            const parsed = JSON.parse(savedToast);
            showToast(parsed.message, parsed.type || "success");
        }
    } catch (e) { }

    initFloatingWindowDrag();

    // 點擊空白處隱藏右鍵選單
    document.addEventListener("click", () => {
        hideContextMenu();
    });
    document.addEventListener("contextmenu", (e) => {
        if (!e.target.closest(".placed-course") && !e.target.closest(".course-card") && !e.target.closest(".log-entry")) {
            hideContextMenu();
        }
    });

    // 全域拖放 (Drag & Drop) .json 系統備份檔支援
    window.addEventListener("dragover", (e) => {
        if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
        }
    });

    window.addEventListener("drop", async (e) => {
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.name.toLowerCase().endsWith(".json")) {
                e.preventDefault();
                e.stopPropagation();
                try {
                    const text = await file.text();
                    openImportSystemModal(text, file.name);
                    showToast(`已載入拖曳檔案【${file.name}】，請檢視預覽後點選「確認覆蓋並匯入」。`, "info");
                } catch (err) {
                    console.error("拖放讀取 JSON 失敗：", err);
                    showToast("讀取檔案失敗：" + err.message, "error");
                }
            }
        }
    });

    // 註冊所有事件監聽
    setupClassScheduleEventListeners();
    setupTeacherScheduleEventListeners();
    setupClassroomScheduleEventListeners();
    setupTabListeners();
    setupFormAddCourseListener();
    setupCurriculumFormListener();
    setupSettingsListeners();
    setupCSVImports();
    setupConfigEditor();
    setupCourseMatrixListeners();

    // 啟動資料載入
    refreshAll().then(() => {
        if (dom.statusLogger) {
            dom.statusLogger.innerHTML = "";
            log("系統就緒。請選擇班級開始排課。", "system-msg", JSON.parse(JSON.stringify(state.schedules)), refreshAll);
        }
    });
});
