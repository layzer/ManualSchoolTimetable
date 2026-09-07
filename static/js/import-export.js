// static/js/import-export.js
// --- 系統匯入匯出 (JSON 備份還原、CSV/TSV/PDF 匯出、CSV 智慧匯入) ---

import { state, dom } from './state.js';
import { dbSet, getNextId } from './storage.js';
import { showToast } from './utils.js';
import { getDynamicSubjects } from './tab-teacher-summary.js';

let refreshAllViews = null;

export function setImportExportRefreshCallback(cb) {
    refreshAllViews = cb;
}

/**
 * 智慧讀取 CSV / 文本檔案內容（多重編碼偵測與 BOM 清理）
 */
export async function readCsvFileAsText(file) {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let decodedText = "";

    // 1. 檢查 BOM
    if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
        decodedText = new TextDecoder('utf-8').decode(bytes.subarray(3));
        return decodedText.replace(/^[\uFEFF\uFFFE\u200B\u0000]+/, "");
    } else if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
        decodedText = new TextDecoder('utf-16le').decode(bytes.subarray(2));
        return decodedText.replace(/^[\uFEFF\uFFFE\u200B\u0000]+/, "");
    } else if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
        decodedText = new TextDecoder('utf-16be').decode(bytes.subarray(2));
        return decodedText.replace(/^[\uFEFF\uFFFE\u200B\u0000]+/, "");
    }

    // 2. 無 BOM 時，使用品質評分機制 (UTF-8 vs Big5)
    let textUtf8 = null;
    let textBig5 = null;

    try {
        const utf8Strict = new TextDecoder('utf-8', { fatal: true });
        textUtf8 = utf8Strict.decode(bytes);
    } catch (e) {
        textUtf8 = null;
    }

    try {
        const big5Decoder = new TextDecoder('big5');
        textBig5 = big5Decoder.decode(bytes);
    } catch (e) {
        textBig5 = null;
    }

    if (textUtf8 !== null) {
        decodedText = textUtf8;
    } else if (textBig5 !== null) {
        decodedText = textBig5;
    } else {
        decodedText = new TextDecoder('utf-8').decode(bytes);
    }

    return decodedText.replace(/^[\uFEFF\uFFFE\u200B\u0000]+/, "");
}

/**
 * 清理 CSV 單元格字串
 */
export function cleanCsvCell(cell) {
    if (cell === undefined || cell === null) return "";
    let s = String(cell).trim();
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        s = s.slice(1, -1).trim();
    }
    return s.replace(/[\uFEFF\uFFFE\u200B]/g, "").trim();
}

/**
 * 設定 CSV 檔案上傳監聽
 */
export function setupCSVImports() {
    if (dom.inputImportTeachersCsv) {
        dom.inputImportTeachersCsv.addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const text = await readCsvFileAsText(file);
                await processCSVImport(text, "teachers");
            } catch (err) {
                showToast("讀取教師 CSV 失敗：" + err.message, "error");
            } finally {
                e.target.value = "";
            }
        });
    }

    if (dom.inputImportClassroomsCsv) {
        dom.inputImportClassroomsCsv.addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const text = await readCsvFileAsText(file);
                await processCSVImport(text, "classrooms");
            } catch (err) {
                showToast("讀取教室 CSV 失敗：" + err.message, "error");
            } finally {
                e.target.value = "";
            }
        });
    }

    if (dom.inputImportCoursesCsv) {
        dom.inputImportCoursesCsv.addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const text = await readCsvFileAsText(file);
                await processCSVImport(text, "courses");
            } catch (err) {
                showToast("讀取課程 CSV 失敗：" + err.message, "error");
            } finally {
                e.target.value = "";
            }
        });
    }
}

export async function processCSVImport(text, type) {
    if (!text) {
        showToast("CSV 檔案內容為空！", "error");
        return;
    }
    const clean = text.replace(/^[\uFEFF\uFFFE\u200B\u0000]+/, "").trim();

    // 智慧防呆：若使用者將 JSON 系統備份丟進 CSV 匯入按鈕
    if (clean.startsWith("{") && (clean.includes('"classes"') || clean.includes('"courses"') || clean.includes('"teachers"') || clean.includes('"periods"'))) {
        try {
            openImportSystemModal(clean, "系統備份檔 (JSON)");
            showToast("偵測到您上傳的是 JSON 系統備份檔，已為您開啟系統備份匯入視窗，請檢視預覽後點選「確認覆蓋並匯入」。", "info");
            return;
        } catch (e) {
            console.warn("嘗試自動解析 JSON 備份失敗，依一般 CSV 流程處理：", e);
        }
    }

    const lines = clean.split(/\r?\n/)
        .map(l => l.replace(/[\uFEFF\uFFFE\u200B]/g, ""))
        .filter(l => l.trim() && !l.trim().startsWith("#"));

    if (lines.length === 0) {
        showToast("CSV 檔案沒有有效資料！", "error");
        return;
    }

    const dataLines = lines.slice(1);
    let successCount = 0;

    if (type === "teachers") {
        dataLines.forEach(line => {
            const cols = line.split(",").map(cleanCsvCell);
            const name = cols[0] || "";
            if (!name) return;
            const slots = [];
            for (let day = 1; day <= 5; day++) {
                const cell = cols[day] || "";
                if (!cell) continue;
                cell.split(";").forEach(p => {
                    const period = parseInt(cleanCsvCell(p));
                    if (period > 0) slots.push(`${day}-${period}`);
                });
            }
            let teacher = state.teachers.find(t => t.name === name);
            if (teacher) {
                teacher.unavailable_slots = slots;
            } else {
                state.teachers.push({
                    id: getNextId(state.teachers),
                    name: name,
                    is_tutor: false,
                    unavailable_slots: slots
                });
            }
            successCount++;
        });
        await dbSet("mst_teachers", state.teachers);
    } else if (type === "classrooms") {
        dataLines.forEach(line => {
            const cols = line.split(",").map(cleanCsvCell);
            const name = cols[0] || "";
            if (!name) return;
            const cType = cols[1] || "普通";
            let room = state.classrooms.find(r => r.name === name);
            if (room) {
                room.type = cType;
            } else {
                state.classrooms.push({
                    id: getNextId(state.classrooms),
                    name: name,
                    type: cType
                });
            }
            successCount++;
        });
        await dbSet("mst_classrooms", state.classrooms);
    } else if (type === "courses") {
        dataLines.forEach(line => {
            const cols = line.split(",").map(cleanCsvCell);
            const classQuery = cols[0] || "";
            const subject = cols[1] || "";
            if (!classQuery || !subject) return;

            const cls = state.classes.find(c => String(c.code) === classQuery || c.name === classQuery);
            if (!cls) return;

            const teacherName = cols[3] || "";
            let teacherId = null;
            if (teacherName) {
                let teacher = state.teachers.find(t => t.name === teacherName);
                if (!teacher) {
                    teacher = {
                        id: getNextId(state.teachers),
                        name: teacherName,
                        is_tutor: false,
                        unavailable_slots: []
                    };
                    state.teachers.push(teacher);
                }
                teacherId = teacher.id;
            }

            const periodsCount = parseFloat(cols[2]) || 1;
            const roomName = cols[4] || "班級教室";

            const rawWType = cols[5] || "";
            let wType = "EVERY";
            if (rawWType.includes("單") || rawWType.toUpperCase() === "ODD") {
                wType = "ODD";
            } else if (rawWType.includes("雙") || rawWType.toUpperCase() === "EVEN") {
                wType = "EVEN";
            }

            let course = state.courses.find(c => c.class_id === cls.id && c.name === subject);
            if (course) {
                course.teacher_id = teacherId;
                course.required_periods = periodsCount;
                course.classroom_name = roomName;
                course.week_type = wType;
            } else {
                state.courses.push({
                    id: getNextId(state.courses),
                    class_id: cls.id,
                    name: subject,
                    teacher_id: teacherId,
                    required_periods: periodsCount,
                    classroom_name: roomName,
                    week_type: wType,
                    paired_course_id: null
                });
            }
            successCount++;
        });
        await dbSet("mst_teachers", state.teachers);
        await dbSet("mst_courses", state.courses);
    }

    showToast(`匯入成功！共新增/更新 ${successCount} 筆資料`, "success");
    if (refreshAllViews) await refreshAllViews();
}

/**
 * 核心共用：全站 JSON 系統備份匯入
 */
export async function importSystemJsonData(jsonPayload) {
    if (!jsonPayload || typeof jsonPayload !== "object") {
        throw new Error("無效的 JSON 格式或資料為空");
    }

    if (jsonPayload.config) {
        await dbSet("mst_config", jsonPayload.config);
    } else if (jsonPayload.periods) {
        await dbSet("mst_config", { periods: jsonPayload.periods });
    }

    let classCount = 0, roomCount = 0, teacherCount = 0, courseCount = 0, schedCount = 0;

    if (jsonPayload.classes && Array.isArray(jsonPayload.classes)) {
        await dbSet("mst_classes", jsonPayload.classes);
        classCount = jsonPayload.classes.length;
    }

    if (jsonPayload.classrooms && Array.isArray(jsonPayload.classrooms)) {
        await dbSet("mst_classrooms", jsonPayload.classrooms);
        roomCount = jsonPayload.classrooms.length;
    }

    if (jsonPayload.teachers && Array.isArray(jsonPayload.teachers)) {
        await dbSet("mst_teachers", jsonPayload.teachers);
        teacherCount = jsonPayload.teachers.length;
    }

    if (jsonPayload.courses && Array.isArray(jsonPayload.courses)) {
        await dbSet("mst_courses", jsonPayload.courses);
        courseCount = jsonPayload.courses.length;
    }

    if (jsonPayload.schedules && Array.isArray(jsonPayload.schedules)) {
        await dbSet("mst_schedules", jsonPayload.schedules);
        schedCount = jsonPayload.schedules.length;
    }

    const summaryMsg = `🎉 系統資料匯入成功！共載入 ${classCount} 個班級、${teacherCount} 位教師、${roomCount} 間教室、${courseCount} 門課程、${schedCount} 筆排課。`;
    try {
        localStorage.setItem("mst_import_toast", JSON.stringify({ message: summaryMsg, type: "success" }));
    } catch (e) { }

    showToast(summaryMsg, "success");
    setTimeout(() => window.location.reload(), 1000);
}

// --- 系統匯入 Modal 管理 ---
export function openImportSystemModal(initialText = "", fileName = "") {
    if (!dom.modalImportSystem) return;
    dom.modalImportSystem.classList.remove("hidden");

    if (initialText) {
        if (fileName) {
            switchImportTab("file");
            if (dom.selectedFileName) dom.selectedFileName.textContent = `📄 ${fileName}`;
        } else {
            switchImportTab("text");
            if (dom.importJsonTextarea) dom.importJsonTextarea.value = initialText;
        }
        parseAndPreviewJson(initialText);
    } else {
        switchImportTab("file");
        resetImportModalState();
    }
}

export function closeImportSystemModal() {
    if (!dom.modalImportSystem) return;
    dom.modalImportSystem.classList.add("hidden");
    resetImportModalState();
}

export function switchImportTab(mode) {
    if (mode === "file") {
        dom.tabBtnImportFile?.classList.add("active");
        dom.tabBtnImportText?.classList.remove("active");
        dom.importPaneFile?.classList.remove("hidden");
        dom.importPaneText?.classList.add("hidden");
    } else {
        dom.tabBtnImportFile?.classList.remove("active");
        dom.tabBtnImportText?.classList.add("active");
        dom.importPaneFile?.classList.add("hidden");
        dom.importPaneText?.classList.remove("hidden");
    }
}

export function resetImportModalState() {
    state.pendingImportPayload = null;
    if (dom.modalFileInput) dom.modalFileInput.value = "";
    if (dom.selectedFileName) dom.selectedFileName.textContent = "尚未選擇任何檔案";
    if (dom.importJsonTextarea) dom.importJsonTextarea.value = "";
    if (dom.importPreviewBox) dom.importPreviewBox.classList.add("hidden");
    if (dom.btnConfirmImportAction) dom.btnConfirmImportAction.disabled = true;
}

export function parseAndPreviewJson(rawText) {
    if (!rawText || !rawText.trim()) {
        state.pendingImportPayload = null;
        if (dom.importPreviewBox) dom.importPreviewBox.classList.add("hidden");
        if (dom.btnConfirmImportAction) dom.btnConfirmImportAction.disabled = true;
        return;
    }

    try {
        const clean = rawText.replace(/^[\uFEFF\uFFFE\u200B\u0000]+/, "").trim();
        const jsonPayload = JSON.parse(clean);

        if (!jsonPayload || typeof jsonPayload !== "object") {
            throw new Error("JSON 格式不正確或為空物件");
        }

        const classCount = Array.isArray(jsonPayload.classes) ? jsonPayload.classes.length : (jsonPayload.classes ? Object.keys(jsonPayload.classes).length : 0);
        const teacherCount = Array.isArray(jsonPayload.teachers) ? jsonPayload.teachers.length : (jsonPayload.teachers ? Object.keys(jsonPayload.teachers).length : 0);
        const roomCount = Array.isArray(jsonPayload.classrooms) ? jsonPayload.classrooms.length : (jsonPayload.classrooms ? Object.keys(jsonPayload.classrooms).length : 0);
        const courseCount = Array.isArray(jsonPayload.courses) ? jsonPayload.courses.length : (jsonPayload.courses ? Object.keys(jsonPayload.courses).length : 0);
        const schedCount = Array.isArray(jsonPayload.schedules) ? jsonPayload.schedules.length : (jsonPayload.schedules ? Object.keys(jsonPayload.schedules).length : 0);

        if (classCount === 0 && teacherCount === 0 && courseCount === 0 && !jsonPayload.config && !jsonPayload.periods) {
            throw new Error("未在 JSON 中找到班級、教師或課程等有效排課系統資料");
        }

        state.pendingImportPayload = jsonPayload;

        if (dom.previewStatsContent) {
            dom.previewStatsContent.innerHTML = `
                <div>🏫 班級資料：<strong>${classCount}</strong> 個班級</div>
                <div>👨‍🏫 教師資料：<strong>${teacherCount}</strong> 位教師</div>
                <div>🚪 教室資料：<strong>${roomCount}</strong> 間教室</div>
                <div>📚 課程科目：<strong>${courseCount}</strong> 門課程</div>
                <div>📅 已排課表：<strong>${schedCount}</strong> 節課</div>
            `;
        }

        if (dom.importPreviewBox) dom.importPreviewBox.classList.remove("hidden");
        if (dom.btnConfirmImportAction) dom.btnConfirmImportAction.disabled = false;
    } catch (e) {
        state.pendingImportPayload = null;
        if (dom.previewStatsContent) {
            dom.previewStatsContent.innerHTML = `<span style="color:#ef4444;"><i class="fa-solid fa-circle-xmark"></i> JSON 解析錯誤：${e.message}</span>`;
        }
        if (dom.importPreviewBox) dom.importPreviewBox.classList.remove("hidden");
        if (dom.btnConfirmImportAction) dom.btnConfirmImportAction.disabled = true;
    }
}

// --- 匯出全體班級與專科教室 CSV ---
export function exportAllClassesCsv() {
    if (state.classes.length === 0) {
        showToast("無班級資料可匯出", "error");
        return;
    }

    let csvContent = "\uFEFF";
    const sortedSubjects = getDynamicSubjects();

    const schedulablePeriods = (state.systemConfig && state.systemConfig.periods && state.systemConfig.periods.length > 0)
        ? state.systemConfig.periods.filter(p => p.is_schedulable).map(p => parseInt(p.id))
        : [1, 2, 3, 4, 5, 6, 7, 8];

    const weekdays = ["一", "二", "三", "四", "五"];
    let headers = ["班級名稱"];
    weekdays.forEach(w => {
        schedulablePeriods.forEach(p => {
            headers.push(`${w}${p}`);
        });
    });
    sortedSubjects.forEach(sub => {
        headers.push(sub);
    });
    csvContent += headers.join(",") + "\n";

    state.classes.forEach(cls => {
        let row = [cls.name];
        for (let d = 1; d <= 5; d++) {
            for (const p of schedulablePeriods) {
                const scheds = state.schedules
                    .filter(s => s.class_id === cls.id && s.weekday === d && s.period === p)
                    .sort((a, b) => {
                        if (a.week_type === "ODD" && b.week_type === "EVEN") return -1;
                        if (a.week_type === "EVEN" && b.week_type === "ODD") return 1;
                        return 0;
                    });
                let cellParts = [];
                scheds.forEach(s => {
                    const course = state.courses.find(c => c.id === s.course_id);
                    if (course) {
                        let text = course.name;
                        if (s.week_type === "ODD") text += "(單)";
                        else if (s.week_type === "EVEN") text += "(雙)";
                        else if (s.week_type === "GROUP") text += "(組)";
                        cellParts.push(text);
                    }
                });

                const cellText = cellParts.join(" ");
                row.push(`"${cellText}"`);
            }
        }
        sortedSubjects.forEach(sub => {
            const course = state.courses.find(c => c.class_id === cls.id && c.name === sub);
            const teacher = course ? state.teachers.find(t => t.id === course.teacher_id) : null;
            const teacherName = teacher ? teacher.name : "";
            row.push(`"${teacherName}"`);
        });
        csvContent += row.join(",") + "\n";
    });

    const specialRooms = state.classrooms.filter(cr => cr.type !== "普通" && cr.name !== "班級教室");
    specialRooms.forEach(cr => {
        let row = [cr.name];
        for (let d = 1; d <= 5; d++) {
            for (const p of schedulablePeriods) {
                const scheds = state.schedules
                    .filter(s => s.classroom_id === cr.id && s.weekday === d && s.period === p)
                    .sort((a, b) => {
                        if (a.week_type === "ODD" && b.week_type === "EVEN") return -1;
                        if (a.week_type === "EVEN" && b.week_type === "ODD") return 1;
                        return 0;
                    });
                let cellParts = [];
                scheds.forEach(s => {
                    const course = state.courses.find(c => c.id === s.course_id);
                    const cls = state.classes.find(c => c.id === s.class_id);
                    if (course && cls) {
                        let text = `${course.name}(${cls.name})`;
                        if (s.week_type === "ODD") text += "(單)";
                        else if (s.week_type === "EVEN") text += "(雙)";
                        else if (s.week_type === "GROUP") text += "(組)";
                        cellParts.push(text);
                    }
                });

                const cellText = cellParts.join(" ");
                row.push(`"${cellText}"`);
            }
        }
        sortedSubjects.forEach(() => {
            row.push('""');
        });
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

// --- 匯出全體教師總課表 CSV ---
export function exportAllTeachersCsv() {
    if (state.teachers.length === 0) {
        showToast("無教師資料可匯出", "error");
        return;
    }

    let csvContent = "\uFEFF";

    const schedulablePeriods = (state.systemConfig && state.systemConfig.periods && state.systemConfig.periods.length > 0)
        ? state.systemConfig.periods.filter(p => p.is_schedulable).map(p => parseInt(p.id))
        : [1, 2, 3, 4, 5, 6, 7, 8];

    const weekdays = ["一", "二", "三", "四", "五"];
    let headers = ["教師姓名"];
    weekdays.forEach(w => {
        schedulablePeriods.forEach(p => {
            headers.push(`${w}${p}`);
        });
    });
    headers.push("授課總節數");
    csvContent += headers.join(",") + "\n";

    state.teachers.forEach(t => {
        let row = [t.name];
        let totalPeriods = 0;

        const teacherCourses = state.courses.filter(c => c.teacher_id === t.id);
        const teacherCourseIds = new Set(teacherCourses.map(c => c.id));

        for (let d = 1; d <= 5; d++) {
            for (const p of schedulablePeriods) {
                const scheds = state.schedules
                    .filter(s => teacherCourseIds.has(s.course_id) && s.weekday === d && s.period === p)
                    .sort((a, b) => {
                        if (a.week_type === "ODD" && b.week_type === "EVEN") return -1;
                        if (a.week_type === "EVEN" && b.week_type === "ODD") return 1;
                        return 0;
                    });

                let cellParts = [];
                scheds.forEach(s => {
                    const course = state.courses.find(c => c.id === s.course_id);
                    const cls = state.classes.find(c => c.id === s.class_id);
                    if (course && cls) {
                        const classCode = (cls.code !== undefined && cls.code !== null && cls.code !== "") ? cls.code : cls.name;
                        let text = `${course.name}(${classCode})`;
                        if (s.week_type === "ODD") {
                            text += "(單)";
                            totalPeriods += 0.5;
                        } else if (s.week_type === "EVEN") {
                            text += "(雙)";
                            totalPeriods += 0.5;
                        } else {
                            totalPeriods += 1;
                        }
                        cellParts.push(text);
                    }
                });

                const cellText = cellParts.join(" ");
                row.push(`"${cellText}"`);
            }
        }
        row.push(totalPeriods);
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

// --- 匯出調代課教師課表 (TSV) ---
export function exportTeacherScheduleTsv() {
    if (state.teachers.length === 0) {
        showToast("無教師資料可匯出", "error");
        return;
    }

    const weekdaysMap = { 1: "一", 2: "二", 3: "三", 4: "四", 5: "五" };
    let lines = [];

    let headerParts = ["科目", "教師名稱"];
    for (let wd = 1; wd <= 5; wd++) {
        for (let pd = 1; pd <= 8; pd++) {
            const wdName = weekdaysMap[wd];
            headerParts.push(`${wdName}${pd}課程`);
            headerParts.push(`${wdName}${pd}班級`);
        }
    }
    lines.push(headerParts.join("\t"));

    state.teachers.forEach(teacher => {
        const teacherCourses = state.courses.filter(c => c.teacher_id === teacher.id);
        if (teacherCourses.length === 0) return;

        const subjectSet = {};
        teacherCourses.forEach(c => {
            if (!subjectSet[c.name]) {
                subjectSet[c.name] = [];
            }
            subjectSet[c.name].push(c);
        });

        const sortedSubjectNames = Object.keys(subjectSet).sort();
        sortedSubjectNames.forEach(subjectName => {
            const subjectCourses = subjectSet[subjectName];

            const slotMap = {};
            subjectCourses.forEach(c => {
                const cls = state.classes.find(item => item.id === c.class_id);
                const className = cls ? cls.name : "";

                const cSchedules = state.schedules.filter(s => s.course_id === c.id);
                cSchedules.forEach(s => {
                    const key = `${s.weekday}_${s.period}`;
                    if (!slotMap[key]) {
                        slotMap[key] = [];
                    }

                    let cName = c.name;
                    const wType = s.week_type || c.week_type;
                    if (wType === "ODD") {
                        cName += "(單)";
                    } else if (wType === "EVEN") {
                        cName += "(雙)";
                    }

                    slotMap[key].push({ courseName: cName, className: className, weekType: wType });
                });
            });

            let row = [subjectName, teacher.name];
            for (let wd = 1; wd <= 5; wd++) {
                for (let pd = 1; pd <= 8; pd++) {
                    const key = `${wd}_${pd}`;
                    const entries = slotMap[key] || [];
                    if (entries.length > 0) {
                        entries.sort((a, b) => {
                            if (a.weekType === "ODD" && b.weekType === "EVEN") return -1;
                            if (a.weekType === "EVEN" && b.weekType === "ODD") return 1;
                            return 0;
                        });
                        const courseNamesStr = entries.map(e => e.courseName).join("/");
                        const classNamesStr = entries.map(e => e.className).join("/");
                        row.push(courseNamesStr);
                        row.push(classNamesStr);
                    } else {
                        row.push("");
                        row.push("");
                    }
                }
            }
            lines.push(row.join("\t"));
        });
    });

    const tsvContent = lines.join("\n");
    const blob = new Blob([tsvContent], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `teacher_schedule.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

// --- 匯出調代課課程資料庫 (TSV) ---
export function exportCourseDatabaseTsv() {
    if (state.schedules.length === 0) {
        showToast("無排課資料可匯出", "error");
        return;
    }

    const weekdaysMap = { 1: "一", 2: "二", 3: "三", 4: "四", 5: "五" };
    let lines = ["班級\t星期\t節次\t課程名稱\t教師名稱"];

    const sortedSchedules = [...state.schedules].sort((a, b) => {
        if (a.class_id !== b.class_id) return a.class_id > b.class_id ? 1 : -1;
        if (a.weekday !== b.weekday) return a.weekday - b.weekday;
        return a.period - b.period;
    });

    sortedSchedules.forEach(sched => {
        const cls = state.classes.find(c => c.id === sched.class_id);
        const className = cls ? cls.name : String(sched.class_id);

        const course = state.courses.find(c => c.id === sched.course_id);
        if (!course) return;
        let courseName = course.name;
        const wType = sched.week_type || course.week_type;
        if (wType === "ODD") {
            courseName += "(單)";
        } else if (wType === "EVEN") {
            courseName += "(雙)";
        }

        const teacher = state.teachers.find(t => t.id === course.teacher_id);
        const teacherName = teacher ? teacher.name : "";

        const classroom = state.classrooms.find(cr => cr.id === sched.classroom_id);
        const classroomName = (classroom && classroom.name !== "班級教室" && classroom.type !== "普通") ? classroom.name : "";

        const teacherField = classroomName ? `${teacherName}&${classroomName}` : teacherName;

        const weekdayStr = weekdaysMap[sched.weekday] || String(sched.weekday);
        const periodStr = String(sched.period);

        lines.push([className, weekdayStr, periodStr, courseName, teacherField].join("\t"));
    });

    const tsvContent = lines.join("\n");
    const blob = new Blob([tsvContent], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `course_database.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

// --- PDF 生成輔助函式 ---
export function generateClassGridHtml(classId, className, subtitle) {
    const classSchedules = state.schedules.filter(s => String(s.class_id) === String(classId));

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

    const periods = (state.systemConfig && state.systemConfig.periods && state.systemConfig.periods.length > 0)
        ? state.systemConfig.periods
        : [
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

    periods.forEach(p => {
        if (!p.is_schedulable) {
            const restText = p.type === "LUNCH" ? "☕ 午餐時間" : (p.type === "NAP" ? "💤 午休時間" : "休息時間");
            tableHtml += `
                <tr class="rest-row">
                    <td>${p.name}</td>
                    <td colspan="5">${restText}</td>
                </tr>
            `;
        } else {
            tableHtml += `<tr><td>${p.name}</td>`;
            for (let d = 1; d <= 5; d++) {
                const scheds = classSchedules
                    .filter(s => s.weekday === d && String(s.period) === String(p.id))
                    .sort((a, b) => {
                        if (a.week_type === "ODD" && b.week_type === "EVEN") return -1;
                        if (a.week_type === "EVEN" && b.week_type === "ODD") return 1;
                        return 0;
                    });
                let cellContent = "";
                if (scheds.length > 0) {
                    let itemsHtml = "";
                    scheds.forEach(s => {
                        const course = state.courses.find(c => String(c.id) === String(s.course_id));
                        const teacher = course ? state.teachers.find(t => String(t.id) === String(course.teacher_id)) : null;
                        const classroom = state.classrooms.find(cr => String(cr.id) === String(s.classroom_id));
                        if (course) {
                            const weekTag = s.week_type === "ODD" ? '[單] ' : s.week_type === "EVEN" ? '[雙] ' : '';
                            const roomName = classroom ? classroom.name : '班級教室';
                            const weekClass = (s.week_type === "ODD" || s.week_type === "EVEN") ? 'alternate-week' : 'every-week';
                            itemsHtml += `
                                <div class="placed-course ${weekClass}">
                                    <div class="placed-name">${weekTag}${course.name}</div>
                                    <div class="placed-footer">
                                        <span>${roomName}</span>
                                        <span>${teacher ? teacher.name : ''}</span>
                                    </div>
                                </div>
                            `;
                        }
                    });
                    cellContent = `<div class="pdf-cell-container">${itemsHtml}</div>`;
                }
                tableHtml += `<td>${cellContent}</td>`;
            }
            tableHtml += `</tr>`;
        }
    });

    tableHtml += `</tbody></table>`;

    return `
        <div class="pdf-page">
            <div class="pdf-page-header">
                <h1>${className} 課表</h1>
                <p>${subtitle}</p>
            </div>
            <div class="pdf-page-body">
                ${tableHtml}
            </div>
        </div>
    `;
}

export function generateRoomGridHtml(roomId, roomName, subtitle) {
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

    const periods = (state.systemConfig && state.systemConfig.periods && state.systemConfig.periods.length > 0)
        ? state.systemConfig.periods
        : [
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

    periods.forEach(p => {
        if (!p.is_schedulable) {
            const restText = p.type === "LUNCH" ? "☕ 午餐時間" : (p.type === "NAP" ? "💤 午休時間" : "休息時間");
            tableHtml += `
                <tr class="rest-row">
                    <td>${p.name}</td>
                    <td colspan="5">${restText}</td>
                </tr>
            `;
        } else {
            tableHtml += `<tr><td>${p.name}</td>`;
            for (let d = 1; d <= 5; d++) {
                const scheds = state.schedules
                    .filter(s => String(s.classroom_id) === String(roomId) && s.weekday === d && String(s.period) === String(p.id))
                    .sort((a, b) => {
                        if (a.week_type === "ODD" && b.week_type === "EVEN") return -1;
                        if (a.week_type === "EVEN" && b.week_type === "ODD") return 1;
                        return 0;
                    });

                let cellContent = "";
                if (scheds.length > 0) {
                    let itemsHtml = "";
                    scheds.forEach(s => {
                        const course = state.courses.find(c => String(c.id) === String(s.course_id));
                        const cls = state.classes.find(c => String(c.id) === String(s.class_id));
                        const teacher = course ? state.teachers.find(t => String(t.id) === String(course.teacher_id)) : null;
                        if (course) {
                            const weekTag = s.week_type === "ODD" ? '[單] ' : s.week_type === "EVEN" ? '[雙] ' : '';
                            const weekClass = (s.week_type === "ODD" || s.week_type === "EVEN") ? 'alternate-week' : 'every-week';
                            itemsHtml += `
                                <div class="placed-course ${weekClass}">
                                    <div class="placed-name">${weekTag}${course.name}</div>
                                    <div class="placed-footer">
                                        <span>${cls ? cls.name : ''}</span>
                                        <span>${teacher ? teacher.name : ''}</span>
                                    </div>
                                </div>
                            `;
                        }
                    });
                    cellContent = `<div class="pdf-cell-container">${itemsHtml}</div>`;
                }
                tableHtml += `<td>${cellContent}</td>`;
            }
            tableHtml += `</tr>`;
        }
    });

    tableHtml += `</tbody></table>`;

    return `
        <div class="pdf-page">
            <div class="pdf-page-header">
                <h1>${roomName} 課表</h1>
                <p>${subtitle}</p>
            </div>
            <div class="pdf-page-body">
                ${tableHtml}
            </div>
        </div>
    `;
}

export function generateTeacherGridHtml(teacherId, teacherName, subtitle, teacherObj) {
    const teacherCourses = state.courses.filter(c => String(c.teacher_id) === String(teacherId));
    const teacherCourseIds = teacherCourses.map(c => String(c.id));
    const teacherSchedules = state.schedules.filter(s => teacherCourseIds.includes(String(s.course_id)));
    const unavailableSlots = (teacherObj && teacherObj.unavailable_slots) || [];

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

    const periods = (state.systemConfig && state.systemConfig.periods && state.systemConfig.periods.length > 0)
        ? state.systemConfig.periods
        : [
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

    periods.forEach(p => {
        if (!p.is_schedulable) {
            const restText = p.type === "LUNCH" ? "☕ 午餐時間" : (p.type === "NAP" ? "💤 午休時間" : "休息時間");
            tableHtml += `
                <tr class="rest-row">
                    <td>${p.name}</td>
                    <td colspan="5">${restText}</td>
                </tr>
            `;
        } else {
            tableHtml += `<tr><td>${p.name}</td>`;
            for (let d = 1; d <= 5; d++) {
                const slotKey = `${d}-${p.id}`;
                const isUnavailable = unavailableSlots.includes(slotKey);

                if (isUnavailable) {
                    tableHtml += `<td class="unavailable-cell">不排課</td>`;
                } else {
                    const scheds = teacherSchedules
                        .filter(s => s.weekday === d && String(s.period) === String(p.id))
                        .sort((a, b) => {
                            if (a.week_type === "ODD" && b.week_type === "EVEN") return -1;
                            if (a.week_type === "EVEN" && b.week_type === "ODD") return 1;
                            return 0;
                        });

                    let cellContent = "";
                    if (scheds.length > 0) {
                        let itemsHtml = "";
                        scheds.forEach(s => {
                            const course = state.courses.find(c => String(c.id) === String(s.course_id));
                            const cls = state.classes.find(c => String(c.id) === String(s.class_id));
                            const classroom = state.classrooms.find(cr => String(cr.id) === String(s.classroom_id));
                            if (course) {
                                const weekTag = s.week_type === "ODD" ? '[單] ' : s.week_type === "EVEN" ? '[雙] ' : '';
                                const roomText = classroom && classroom.name !== "班級教室" ? ` (${classroom.name})` : '';
                                const weekClass = (s.week_type === "ODD" || s.week_type === "EVEN") ? 'alternate-week' : 'every-week';
                                itemsHtml += `
                                    <div class="placed-course ${weekClass}">
                                        <div class="placed-name">${weekTag}${course.name}${roomText}</div>
                                        <div class="placed-footer">
                                            <span>${cls ? cls.name : ''}</span>
                                            <span>${teacherName}</span>
                                        </div>
                                    </div>
                                `;
                            }
                        });
                        cellContent = `<div class="pdf-cell-container">${itemsHtml}</div>`;
                    }
                    tableHtml += `<td>${cellContent}</td>`;
                }
            }
            tableHtml += `</tr>`;
        }
    });

    tableHtml += `</tbody></table>`;

    return `
        <div class="pdf-page">
            <div class="pdf-page-header">
                <h1>${teacherName} 老師個人課表</h1>
                <p>${subtitle}</p>
            </div>
            <div class="pdf-page-body">
                ${tableHtml}
            </div>
        </div>
    `;
}

// --- PDF 匯出執行 ---
export async function exportAllClassesPdf() {
    if (!state.classes || state.classes.length === 0) {
        showToast("目前無班級資料可供匯出", "warning");
        return;
    }

    showToast("正在建立班級與專科教室 PDF（共多頁），請稍候...", "info");

    const pagesData = [];

    // 1. 班級頁面
    state.classes.forEach(c => {
        const tutor = state.teachers.find(t => String(t.id) === String(c.tutor_id))?.name || "無";
        const subtitle = `導師：${tutor}`;
        pagesData.push({
            title: `${c.name} 課表`,
            html: generateClassGridHtml(c.id, c.name, subtitle)
        });
    });

    // 2. 專科教室頁面
    const specialRooms = state.classrooms.filter(cr => cr.type !== "普通" && cr.name !== "班級教室");
    specialRooms.forEach(cr => {
        const subtitle = `教室類型：${cr.type} 專用教室`;
        pagesData.push({
            title: `${cr.name} 課表`,
            html: generateRoomGridHtml(cr.id, cr.name, subtitle)
        });
    });

    if (pagesData.length === 0) {
        showToast("無可供匯出的課表內容", "warning");
        return;
    }

    const wrapper = document.createElement("div");
    wrapper.style.cssText = "position: fixed; top: 0; left: 0; width: 794px; min-height: 1110px; z-index: -9999; opacity: 0; pointer-events: none; background: #ffffff;";
    document.body.appendChild(wrapper);

    try {
        const pdf = new window.jspdf.jsPDF("p", "mm", "a4");

        for (let i = 0; i < pagesData.length; i++) {
            showToast(`正在渲染第 ${i + 1}/${pagesData.length} 頁 (${pagesData[i].title})...`, "info");
            wrapper.innerHTML = pagesData[i].html;
            const pageEl = wrapper.firstElementChild;

            await new Promise(r => requestAnimationFrame(r));

            const canvas = await window.html2canvas(pageEl, {
                scale: 2,
                useCORS: true,
                logging: false,
                scrollX: 0,
                scrollY: 0,
                windowWidth: 794,
                windowHeight: 1110
            });
            const imgData = canvas.toDataURL("image/jpeg", 0.98);
            if (i > 0) pdf.addPage();
            pdf.addImage(imgData, "JPEG", 0, 0, 210, 297);
        }

        showToast("正在產生 PDF 檔案...", "info");
        pdf.save("全體班級與專科教室總課表.pdf");
        showToast("全體班級與專科教室 PDF 匯出完成！", "success");
    } catch (e) {
        console.error("PDF 匯出失敗：", e);
        showToast("PDF 匯出失敗：" + e.message, "error");
    } finally {
        if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
    }
}

export async function exportAllTeachersPdf() {
    if (!state.teachers || state.teachers.length === 0) {
        showToast("目前無教師資料可供匯出", "warning");
        return;
    }

    showToast("正在建立教師個人課表 PDF（共多頁），請稍候...", "info");

    const pagesData = [];

    state.teachers.forEach(t => {
        const tutorInfo = t.is_tutor ? "導師" : "專任教師";
        const sub = `身份：${tutorInfo}`;
        pagesData.push({
            title: `${t.name} 老師課表`,
            html: generateTeacherGridHtml(t.id, t.name, sub, t)
        });
    });

    if (pagesData.length === 0) {
        showToast("無可供匯出的教師課表內容", "warning");
        return;
    }

    const wrapper = document.createElement("div");
    wrapper.style.cssText = "position: fixed; top: 0; left: 0; width: 794px; min-height: 1110px; z-index: -9999; opacity: 0; pointer-events: none; background: #ffffff;";
    document.body.appendChild(wrapper);

    try {
        const pdf = new window.jspdf.jsPDF("p", "mm", "a4");

        for (let i = 0; i < pagesData.length; i++) {
            showToast(`正在渲染第 ${i + 1}/${pagesData.length} 頁 (${pagesData[i].title})...`, "info");
            wrapper.innerHTML = pagesData[i].html;
            const pageEl = wrapper.firstElementChild;

            await new Promise(r => requestAnimationFrame(r));

            const canvas = await window.html2canvas(pageEl, {
                scale: 2,
                useCORS: true,
                logging: false,
                scrollX: 0,
                scrollY: 0,
                windowWidth: 794,
                windowHeight: 1110
            });
            const imgData = canvas.toDataURL("image/jpeg", 0.98);
            if (i > 0) pdf.addPage();
            pdf.addImage(imgData, "JPEG", 0, 0, 210, 297);
        }

        showToast("正在產生 PDF 檔案...", "info");
        pdf.save("全體教師總課表.pdf");
        showToast("全體教師 PDF 匯出完成！", "success");
    } catch (e) {
        console.error("PDF 匯出失敗：", e);
        showToast("PDF 匯出失敗：" + e.message, "error");
    } finally {
        if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
    }
}
