import re

with open("c:/web/STC/static/app.js", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Global variables
content = content.replace(
    "// --- 全域變數定義 ---\nlet classes = [];",
    "// --- 全域變數定義 ---\nlet systemConfig = null;\nlet classes = [];"
)

# 2. DOMContentLoaded & loadAllData
content = re.sub(
    r'// --- 初始化載入 ---\ndocument\.addEventListener\("DOMContentLoaded", \(\) => \{[\s\S]*?\}\);\n\n// --- 建立 8 節課的課表網格',
    '''// --- 初始化載入 ---
document.addEventListener("DOMContentLoaded", () => {
    loadAllData().then(() => {
        setupEventListeners();
        setupTabListeners();
        setupFormAddCourseListener();
        setupCurriculumFormListener();
        setupSettingsListeners();
        setupCSVImports(); // CSV 批次匯入整合功能
        setupConfigEditor();
    });
});

// --- 建立動態課表網格 ---''', content)

# 3. loadAllData
content = re.sub(
    r'// --- 載入所有基礎資料 ---\nasync function loadAllData\(\) \{[\s\S]*?fetch\("/api/schedules"\)\n        \]\);\n\n        classes = await resClasses\.json\(\);[\s\S]*?schedules = await resSchedules\.json\(\);\n\n        populateSelectors\(\);',
    '''// --- 載入所有基礎資料 ---
async function loadAllData() {
    try {
        const [resConfig, resClasses, resClassrooms, resTeachers, resCourses, resSchedules] = await Promise.all([
            fetch("/api/config"),
            fetch("/api/classes"),
            fetch("/api/classrooms"),
            fetch("/api/teachers"),
            fetch("/api/courses"),
            fetch("/api/schedules")
        ]);

        systemConfig = await resConfig.json();
        classes = await resClasses.json();
        classrooms = await resClassrooms.json();
        teachers = await resTeachers.json();
        courses = await resCourses.json();
        schedules = await resSchedules.json();

        generateGrid();
        generateTeacherGrid();

        populateSelectors();''', content)

# 4. generateGrid
content = re.sub(
    r'function generateGrid\(\) \{[\s\S]*?\}\n\n// --- 事件綁定 ---',
    '''function generateGrid() {
    if (!gridBody) return;
    gridBody.innerHTML = "";
    
    if (!systemConfig || !systemConfig.periods) return;
    
    systemConfig.periods.forEach((p) => {
        const tr = document.createElement("tr");
        
        const tdPeriod = document.createElement("td");
        tdPeriod.className = "period-num";
        
        if (!p.is_schedulable) {
            tdPeriod.innerHTML = p.name;
            tr.appendChild(tdPeriod);
            
            const tdRest = document.createElement("td");
            tdRest.colSpan = 5;
            tdRest.style.textAlign = "center";
            tdRest.style.color = "var(--text-muted)";
            tdRest.style.fontSize = "12px";
            tdRest.style.background = "rgba(15, 23, 42, 0.4)";
            tdRest.innerText = p.type === "LUNCH" ? "☕ 午餐時間" : (p.type === "NAP" ? "💤 午休時間" : "休息時間");
            tr.appendChild(tdRest);
            gridBody.appendChild(tr);
            return; // equivalent to continue in forEach
        }
        
        tdPeriod.innerHTML = `${p.name}<span>第 ${p.id} 節</span>`;
        tr.appendChild(tdPeriod);
        
        for (let d = 1; d <= 5; d++) {
            const td = document.createElement("td");
            td.className = "dropzone";
            td.dataset.weekday = d;
            td.dataset.period = p.id;
            
            td.addEventListener("click", async (e) => {
                if (e.target.closest(".btn-delete-placed") || e.target.closest(".placed-course")) return;
                if (td.classList.contains("not-available")) return;
                
                if (selectedCourseId) {
                    const weekday = parseInt(td.dataset.weekday);
                    const period = parseInt(td.dataset.period);
                    const classroomId = parseInt(selectClassroom.value);
                    
                    if (!selectedClassId) { showToast("請先選擇班級！", "error"); return; }
                    if (!classroomId) { showToast("請選擇授課教室！", "error"); return; }
                    
                    await handleCourseClickPlace(selectedCourseId, weekday, period, classroomId, td);
                }
            });
            tr.appendChild(td);
        }
        gridBody.appendChild(tr);
    });
}

// --- 事件綁定 ---''', content)

# 5. generateTeacherGrid
content = re.sub(
    r'function generateTeacherGrid\(\) \{[\s\S]*?\}\n\n// --- 實作 Tab 分頁切換行為 ---',
    '''function generateTeacherGrid() {
    if (!teacherGridBody) return;
    teacherGridBody.innerHTML = "";
    
    if (!systemConfig || !systemConfig.periods) return;
    
    systemConfig.periods.forEach((p) => {
        const tr = document.createElement("tr");
        
        const tdPeriod = document.createElement("td");
        tdPeriod.className = "period-num";
        
        if (!p.is_schedulable) {
            tdPeriod.innerHTML = p.name;
            tr.appendChild(tdPeriod);
            
            const tdRest = document.createElement("td");
            tdRest.colSpan = 5;
            tdRest.style.textAlign = "center";
            tdRest.style.color = "var(--text-muted)";
            tdRest.style.fontSize = "12px";
            tdRest.style.background = "rgba(15, 23, 42, 0.4)";
            tdRest.innerText = p.type === "LUNCH" ? "☕ 午餐時間" : (p.type === "NAP" ? "💤 午休時間" : "休息時間");
            tr.appendChild(tdRest);
            teacherGridBody.appendChild(tr);
            return;
        }
        
        tdPeriod.innerHTML = `${p.name}<span>第 ${p.id} 節</span>`;
        tr.appendChild(tdPeriod);
        
        for (let d = 1; d <= 5; d++) {
            const td = document.createElement("td");
            td.className = "dropzone";
            td.dataset.weekday = d;
            td.dataset.period = p.id;
            
            td.addEventListener("click", () => {
                handleTeacherSlotClick(d, parseInt(p.id), td);
            });
            tr.appendChild(td);
        }
        teacherGridBody.appendChild(tr);
    });
}

// --- 實作 Tab 分頁切換行為 ---''', content)

# 6. CSV imports
content = re.sub(
    r'// =========================================================================\n// ==================== CSV 批次匯入教師空堂功能 ===========================\n// =========================================================================[\s\S]*?// --- 渲染教師統計總表 \(Tab 3\) ---',
    '''// =========================================================================
// ==================== CSV 批次匯入整合功能 ===============================
// =========================================================================

function setupCSVImports() {
    // 1. 教師與空堂
    const inputTeachers = document.getElementById("input-import-teachers-csv");
    if (inputTeachers) {
        inputTeachers.addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const text = await file.text();
            await processCSVImport(text, "teachers");
            e.target.value = "";
        });
    }

    // 2. 專科教室
    const inputClassrooms = document.getElementById("input-import-classrooms-csv");
    if (inputClassrooms) {
        inputClassrooms.addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const text = await file.text();
            await processCSVImport(text, "classrooms");
            e.target.value = "";
        });
    }

    // 3. 班級科目
    const inputCourses = document.getElementById("input-import-courses-csv");
    if (inputCourses) {
        inputCourses.addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const text = await file.text();
            await processCSVImport(text, "courses");
            e.target.value = "";
        });
    }
}

async function processCSVImport(text, type) {
    const clean = text.replace(/^\uFEFF/, "");
    const lines = clean.split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith("#"));
    if (lines.length === 0) {
        showToast("CSV 檔案沒有有效資料！", "error");
        return;
    }

    const dataLines = lines.slice(1); // skip header
    const entries = [];

    if (type === "teachers") {
        dataLines.forEach(line => {
            const cols = line.split(",");
            const name = (cols[0] || "").trim();
            if (!name) return;
            const slots = [];
            for (let day = 1; day <= 5; day++) {
                const cell = (cols[day] || "").trim();
                if (!cell) continue;
                cell.split(";").forEach(p => {
                    const period = parseInt(p.trim());
                    if (period > 0) slots.push(`${day}-${period}`);
                });
            }
            entries.push({ teacher_name: name, unavailable_slots: slots });
        });
        await uploadCSVData("/api/teachers/import-with-slots", { entries });
    } else if (type === "classrooms") {
        dataLines.forEach(line => {
            const cols = line.split(",");
            const name = (cols[0] || "").trim();
            if (!name) return;
            entries.push({
                name: name,
                type: (cols[1] || "").trim() || "NORMAL",
                capacity: parseInt(cols[2]) || 30
            });
        });
        await uploadCSVData("/api/classrooms/import-csv", { entries });
    } else if (type === "courses") {
        dataLines.forEach(line => {
            const cols = line.split(",");
            const className = (cols[0] || "").trim();
            const subject = (cols[1] || "").trim();
            if (!className || !subject) return;
            entries.push({
                class_name: className,
                subject: subject,
                periods: parseInt(cols[2]) || 1,
                teacher_name: (cols[3] || "").trim(),
                classroom_name: (cols[4] || "").trim() || null
            });
        });
        await uploadCSVData("/api/courses/import-csv", { entries });
    }
}

async function uploadCSVData(url, payload) {
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (res.ok) {
            showToast(`匯入成功！共新增/更新 ${result.success_count} 筆資料`, "success");
            if (result.failed_entries && result.failed_entries.length > 0) {
                console.warn("部分匯入失敗:", result.failed_entries);
                showToast(`有 ${result.failed_entries.length} 筆資料匯入失敗，請查看控制台`, "error");
            }
            await loadAllData();
        } else {
            showToast("匯入失敗：" + (result.detail || "伺服器錯誤"), "error");
        }
    } catch (err) {
        showToast("網路錯誤：" + err.message, "error");
    }
}

// --- 渲染教師統計總表 (Tab 3) ---''', content)


# 7. Config Editor
content += '''
function setupConfigEditor() {
    const editor = document.getElementById("setting-config-editor");
    const btnSave = document.getElementById("btn-save-config");
    
    if (editor && btnSave) {
        editor.value = JSON.stringify(systemConfig, null, 2);
        
        btnSave.addEventListener("click", async () => {
            try {
                const newConfig = JSON.parse(editor.value);
                const res = await fetch("/api/config", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(newConfig)
                });
                
                if (res.ok) {
                    showToast("設定檔儲存成功，即將重整", "success");
                    setTimeout(() => window.location.reload(), 1000);
                } else {
                    const err = await res.json();
                    showToast("儲存失敗：" + err.detail, "error");
                }
            } catch (err) {
                showToast("JSON 格式錯誤或網路錯誤: " + err.message, "error");
            }
        });
    }
}
'''

with open("c:/web/STC/static/app.js", "w", encoding="utf-8") as f:
    f.write(content)
