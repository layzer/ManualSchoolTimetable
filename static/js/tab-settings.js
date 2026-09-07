// static/js/tab-settings.js
// --- Tab 5: 系統設定、班級管理、設定檔編輯與系統說明 Modal ---

import { state, dom } from './state.js';
import { dbSet, getNextId } from './storage.js';
import { showToast } from './utils.js';
import { hideContextMenu } from './context-menu.js';
import {
    openImportSystemModal,
    closeImportSystemModal,
    switchImportTab,
    parseAndPreviewJson,
    exportAllClassesCsv,
    exportAllTeachersCsv,
    exportAllClassesPdf,
    exportAllTeachersPdf,
    exportTeacherScheduleTsv,
    exportCourseDatabaseTsv
} from './import-export.js';

let refreshAllViews = null;

export function setSettingsRefreshCallback(cb) {
    refreshAllViews = cb;
}

// --- Tab 5 系統設定與維護 UI 渲染 ---
export function renderSettingsUI() {
    if (dom.settingSelectClassTutor) {
        dom.settingSelectClassTutor.innerHTML = '<option value="">無導師</option>';
        state.teachers.forEach(t => {
            if (t.is_tutor) {
                dom.settingSelectClassTutor.innerHTML += `<option value="${t.id}">${t.name}</option>`;
            }
        });
    }

    if (dom.settingSelectClassRoom) {
        dom.settingSelectClassRoom.innerHTML = '<option value="">無預設教室</option>';
        state.classrooms.forEach(r => {
            if (r.type === '普通') {
                dom.settingSelectClassRoom.innerHTML += `<option value="${r.id}">${r.name}</option>`;
            }
        });
    }

    if (dom.settingClassesListBody) {
        dom.settingClassesListBody.innerHTML = '';
        state.classes.forEach(c => {
            const tutor = state.teachers.find(t => t.id === c.tutor_id)?.name || '無';
            const room = state.classrooms.find(r => r.id === c.default_classroom_id)?.name || '無';
            const tr = document.createElement("tr");
            const codeDisplay = c.code ? c.code : '<span class="text-muted">-</span>';
            tr.innerHTML = `
                <td>${codeDisplay}</td>
                <td>${c.name}</td>
                <td>${c.grade}</td>
                <td>${tutor}</td>
                <td>${room}</td>
                <td>
                    <button class="btn btn-secondary btn-sm btn-delete-class" data-class-id="${c.id}" style="color: var(--accent-pink);">
                        <i class="fa-solid fa-trash"></i> 刪除
                    </button>
                </td>
            `;
            tr.querySelector(".btn-delete-class")?.addEventListener("click", () => deleteClass(c.id));
            dom.settingClassesListBody.appendChild(tr);
        });
    }

    if (dom.settingExportClass) {
        dom.settingExportClass.innerHTML = '<option value="">選擇班級...</option>';
        state.classes.forEach(c => {
            dom.settingExportClass.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        });
    }
    if (dom.settingExportTeacher) {
        dom.settingExportTeacher.innerHTML = '<option value="">選擇教師...</option>';
        state.teachers.forEach(t => {
            dom.settingExportTeacher.innerHTML += `<option value="${t.id}">${t.name}</option>`;
        });
    }

    if (dom.settingConfigEditor) {
        const fullConfigDisplay = {
            periods: state.systemConfig ? (state.systemConfig.periods || state.systemConfig) : [],
            classes: state.classes.map(c => ({ code: c.code, name: c.name, grade: c.grade }))
        };
        dom.settingConfigEditor.value = JSON.stringify(fullConfigDisplay, null, 2);
    }
}

export async function deleteClass(classId) {
    if (!confirm("確定要刪除此班級嗎？若該班級尚有課程或課表將無法刪除。")) return;
    const hasCourse = state.courses.some(c => c.class_id === classId);
    const hasSchedule = state.schedules.some(s => s.class_id === classId);
    if (hasCourse || hasSchedule) {
        showToast("此班級尚有課程或課表，請先刪除相關資料", "error");
        return;
    }
    state.classes = state.classes.filter(c => c.id !== classId);
    await dbSet("mst_classes", state.classes);
    showToast("班級已刪除", "success");
    if (refreshAllViews) await refreshAllViews();
}
window.deleteClass = deleteClass;

// --- 系統說明 Modal 操作函式 ---
export function openSystemHelpModal() {
    if (!dom.modalSystemHelp) return;
    dom.modalSystemHelp.classList.remove("hidden");
    switchHelpTab("help-pane-overview");
}

export function closeSystemHelpModal() {
    if (!dom.modalSystemHelp) return;
    dom.modalSystemHelp.classList.add("hidden");
}

export function switchHelpTab(targetPaneId) {
    if (!dom.modalSystemHelp) return;
    const tabBtns = dom.modalSystemHelp.querySelectorAll(".help-tab-btn");
    const panes = dom.modalSystemHelp.querySelectorAll(".help-pane");

    tabBtns.forEach(btn => {
        if (btn.dataset.helpTarget === targetPaneId) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });

    panes.forEach(pane => {
        if (pane.id === targetPaneId) {
            pane.classList.remove("hidden");
        } else {
            pane.classList.add("hidden");
        }
    });
}

// --- 系統設定分頁事件綁定 ---
export function setupSettingsListeners() {
    if (dom.formSettingAddClass) {
        dom.formSettingAddClass.addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = dom.settingInputClassName.value.trim();
            const grade = parseInt(dom.settingInputClassGrade.value);

            if (!name || !grade) {
                showToast("請輸入班級名稱與年級", "error");
                return;
            }

            const newClass = {
                id: getNextId(state.classes),
                name: name,
                grade: grade,
                tutor_id: dom.settingSelectClassTutor.value ? parseInt(dom.settingSelectClassTutor.value) : null,
                default_classroom_id: dom.settingSelectClassRoom.value ? parseInt(dom.settingSelectClassRoom.value) : null
            };

            state.classes.push(newClass);
            await dbSet("mst_classes", state.classes);
            showToast("班級新增成功", "success");
            dom.formSettingAddClass.reset();
            if (refreshAllViews) await refreshAllViews();
        });
    }

    // 匯出全站 JSON
    if (dom.btnExportSystem) {
        dom.btnExportSystem.addEventListener("click", async () => {
            try {
                const data = {
                    config: state.systemConfig,
                    classes: state.classes,
                    classrooms: state.classrooms,
                    teachers: state.teachers,
                    courses: state.courses,
                    schedules: state.schedules
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

    // 匯入全站 JSON（點選開啟專屬 Modal 彈窗）
    if (dom.btnImportSystem) {
        dom.btnImportSystem.addEventListener("click", () => {
            openImportSystemModal();
        });
    }

    // Modal 內部按鈕綁定
    if (dom.btnCloseImportModal) {
        dom.btnCloseImportModal.addEventListener("click", closeImportSystemModal);
    }
    if (dom.btnCancelImportModal) {
        dom.btnCancelImportModal.addEventListener("click", closeImportSystemModal);
    }

    // Modal 背景點擊關閉
    if (dom.modalImportSystem) {
        dom.modalImportSystem.addEventListener("click", (e) => {
            if (e.target === dom.modalImportSystem) {
                closeImportSystemModal();
            }
        });
    }

    // 分頁切換
    if (dom.tabBtnImportFile) {
        dom.tabBtnImportFile.addEventListener("click", () => switchImportTab("file"));
    }
    if (dom.tabBtnImportText) {
        dom.tabBtnImportText.addEventListener("click", () => switchImportTab("text"));
    }

    // 檔案選取區點擊
    if (dom.fileDropArea && dom.modalFileInput) {
        dom.fileDropArea.addEventListener("click", () => {
            dom.modalFileInput.click();
        });

        dom.modalFileInput.addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (dom.selectedFileName) dom.selectedFileName.textContent = `📄 ${file.name}`;
            try {
                let text = await file.text();
                parseAndPreviewJson(text);
            } catch (err) {
                showToast("讀取檔案失敗：" + err.message, "error");
            }
        });

        // 檔案拖曳進 Drop Area
        dom.fileDropArea.addEventListener("dragover", (e) => {
            e.preventDefault();
            dom.fileDropArea.classList.add("drag-over");
        });
        dom.fileDropArea.addEventListener("dragleave", () => {
            dom.fileDropArea.classList.remove("drag-over");
        });
        dom.fileDropArea.addEventListener("drop", async (e) => {
            e.preventDefault();
            dom.fileDropArea.classList.remove("drag-over");
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                if (dom.selectedFileName) dom.selectedFileName.textContent = `📄 ${file.name}`;
                try {
                    let text = await file.text();
                    parseAndPreviewJson(text);
                } catch (err) {
                    showToast("讀取檔案失敗：" + err.message, "error");
                }
            }
        });
    }

    // 文字框即時輸入解析
    if (dom.importJsonTextarea) {
        dom.importJsonTextarea.addEventListener("input", (e) => {
            parseAndPreviewJson(e.target.value);
        });
    }

    // CSV / TSV / PDF 匯出按鈕綁定
    if (dom.btnExportClassCsv) {
        dom.btnExportClassCsv.addEventListener("click", () => exportAllClassesCsv());
    }
    if (dom.btnExportTeacherCsv) {
        dom.btnExportTeacherCsv.addEventListener("click", () => exportAllTeachersCsv());
    }
    if (dom.btnExportClassPdf) {
        dom.btnExportClassPdf.addEventListener("click", () => exportAllClassesPdf());
    }
    if (dom.btnExportTeacherPdf) {
        dom.btnExportTeacherPdf.addEventListener("click", () => exportAllTeachersPdf());
    }
    if (dom.btnExportTeacherScheduleTsv) {
        dom.btnExportTeacherScheduleTsv.addEventListener("click", () => exportTeacherScheduleTsv());
    }
    if (dom.btnExportCourseDatabaseTsv) {
        dom.btnExportCourseDatabaseTsv.addEventListener("click", () => exportCourseDatabaseTsv());
    }

    // 清空系統資料庫
    if (dom.btnClearDatabase) {
        dom.btnClearDatabase.addEventListener("click", async () => {
            if (!confirm("⚠️ 警告：此操作將會清空系統中所有的班級、教師、教室、課程與排課資料！\n\n您確定要清空資料庫嗎？")) {
                return;
            }
            if (!confirm("這是一項不可逆的操作！資料清空後將無法復原，確定要繼續嗎？")) {
                return;
            }
            try {
                if (window.localforage) await window.localforage.clear();
                showToast("系統資料庫已成功清空，即將重新載入頁面...", "success");
                setTimeout(() => window.location.reload(), 1500);
            } catch (error) {
                showToast("清空資料庫失敗：" + error.message, "error");
            }
        });
    }

    // 系統說明 Modal
    if (dom.btnOpenSystemHelp) {
        dom.btnOpenSystemHelp.addEventListener("click", () => openSystemHelpModal());
    }
    if (dom.btnCloseHelpModal) {
        dom.btnCloseHelpModal.addEventListener("click", closeSystemHelpModal);
    }
    if (dom.btnConfirmHelpModal) {
        dom.btnConfirmHelpModal.addEventListener("click", closeSystemHelpModal);
    }

    if (dom.modalSystemHelp) {
        dom.modalSystemHelp.addEventListener("click", (e) => {
            if (e.target === dom.modalSystemHelp) {
                closeSystemHelpModal();
            }
        });

        const helpTabBtns = dom.modalSystemHelp.querySelectorAll(".help-tab-btn");
        helpTabBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const targetPane = btn.dataset.helpTarget;
                if (targetPane) switchHelpTab(targetPane);
            });
        });
    }

    // 全域鍵盤 ESC 鍵關閉所有彈窗
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            if (dom.modalSystemHelp && !dom.modalSystemHelp.classList.contains("hidden")) {
                closeSystemHelpModal();
            }
            if (dom.modalImportSystem && !dom.modalImportSystem.classList.contains("hidden")) {
                closeImportSystemModal();
            }
            hideContextMenu();
        }
    });
}

// --- 設定檔線上編輯器 ---
export function setupConfigEditor() {
    if (dom.settingConfigEditor && dom.btnSaveConfig) {
        if (state.systemConfig) {
            dom.settingConfigEditor.value = JSON.stringify(state.systemConfig, null, 2);
        }

        dom.btnSaveConfig.addEventListener("click", async () => {
            try {
                const parsed = JSON.parse(dom.settingConfigEditor.value);

                if (parsed.periods) {
                    state.systemConfig = { periods: parsed.periods };
                } else if (Array.isArray(parsed)) {
                    state.systemConfig = { periods: parsed };
                } else {
                    state.systemConfig = parsed;
                }
                await dbSet("mst_config", state.systemConfig);

                if (parsed.classes && Array.isArray(parsed.classes)) {
                    const newClasses = parsed.classes.map((c, idx) => ({
                        id: c.id || (idx + 1),
                        code: c.code || (idx + 101),
                        name: c.name || `${c.grade || 1}年級班`,
                        grade: c.grade || 1,
                        tutor_id: c.tutor_id || null,
                        default_classroom_id: c.default_classroom_id || null
                    }));
                    state.classes = newClasses;
                    await dbSet("mst_classes", state.classes);
                }

                showToast("設定檔儲存成功，即將重整", "success");
                setTimeout(() => window.location.reload(), 1000);
            } catch (err) {
                showToast("JSON 格式錯誤: " + err.message, "error");
            }
        });
    }
}
