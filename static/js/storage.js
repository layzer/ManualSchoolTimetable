// static/js/storage.js
// --- localForage / localStorage 儲存層與資料載入 ---

import { state } from './state.js';

// localForage 配置（含 localStorage 雙重自動備援）
if (window.localforage) {
    window.localforage.config({
        driver: [window.localforage.INDEXEDDB, window.localforage.WEBSQL, window.localforage.LOCALSTORAGE],
        name: 'ManualSchoolTimetableDB',
        storeName: 'mst_store'
    });
}

export async function dbGet(key, defaultVal) {
    try {
        if (window.localforage) {
            const val = await window.localforage.getItem(key);
            if (val !== null && val !== undefined) return val;
        }
    } catch (e) {
        console.warn(`localForage getItem fallback to localStorage [${key}]:`, e);
    }
    try {
        const lsVal = localStorage.getItem(key);
        if (lsVal !== null) return JSON.parse(lsVal);
    } catch (e) { }
    return defaultVal;
}

export async function dbSet(key, val) {
    try {
        if (window.localforage) {
            await window.localforage.setItem(key, val);
        }
    } catch (e) {
        console.warn(`localForage setItem error, fallback to localStorage [${key}]:`, e);
    }
    try {
        localStorage.setItem(key, JSON.stringify(val));
    } catch (e) { }
}

// 產生遞增與唯一 ID Helper
export function getNextId(list) {
    if (!list || list.length === 0) return 1;
    return Math.max(...list.map(item => parseInt(item.id) || 0)) + 1;
}

// 同步班級導師：班級導師即為教國語的老師
export function syncClassTutors() {
    let changed = false;
    state.classes.forEach(c => {
        const mandarinCourse = state.courses.find(crs => crs.class_id === c.id && crs.name === "國語");
        const newTutorId = (mandarinCourse && mandarinCourse.teacher_id) ? mandarinCourse.teacher_id : null;
        if (c.tutor_id !== newTutorId) {
            c.tutor_id = newTutorId;
            changed = true;
        }
    });
    if (changed) {
        dbSet("mst_classes", state.classes);
    }
}

// 確保預設教室與自動綁定存在
export function ensureDefaultClassrooms() {
    let defaultCr = state.classrooms.find(cr => cr.name === "班級教室");
    if (!defaultCr) {
        defaultCr = { id: getNextId(state.classrooms), name: "班級教室", type: "普通" };
        state.classrooms.push(defaultCr);
        dbSet("mst_classrooms", state.classrooms);
    }
    let classChanged = false;
    state.classes.forEach(c => {
        if (!c.default_classroom_id || !state.classrooms.some(cr => cr.id === c.default_classroom_id)) {
            c.default_classroom_id = defaultCr.id;
            classChanged = true;
        }
    });
    if (classChanged) {
        dbSet("mst_classes", state.classes);
    }
}

// 預設教室自動補齊 Helper
export function getOrFixClassroomId(courseId, targetClassroomId) {
    if (targetClassroomId) return targetClassroomId;
    const course = state.courses.find(c => c.id === courseId);
    const targetName = course ? course.classroom_name : "班級教室";
    let defaultCr = state.classrooms.find(cr => cr.name === targetName);
    if (!defaultCr) defaultCr = state.classrooms.find(cr => cr.name === "班級教室");
    if (!defaultCr) {
        defaultCr = { id: getNextId(state.classrooms), name: "班級教室", type: "普通" };
        state.classrooms.push(defaultCr);
        dbSet("mst_classrooms", state.classrooms);
    }
    return defaultCr.id;
}

// 載入所有基礎資料
export async function loadAllData(renderCallback) {
    try {
        state.systemConfig = await dbGet("mst_config", null);
        state.classes = await dbGet("mst_classes", []);
        state.classrooms = await dbGet("mst_classrooms", []);
        state.teachers = await dbGet("mst_teachers", []);
        state.courses = await dbGet("mst_courses", []);
        state.schedules = await dbGet("mst_schedules", []);

        if (!state.systemConfig || !state.systemConfig.periods || (state.classes.length === 0 && state.teachers.length === 0)) {
            let loadedConfig = null;
            try {
                const confRes = await fetch("config.json");
                if (confRes.ok) {
                    loadedConfig = await confRes.json();
                }
            } catch (e) {
                console.warn("直接點擊開啟 HTML (file:// 協定) 無法直接 fetch('config.json')，啟動內建預設設定。");
            }

            // 內建備用預設 config
            if (!loadedConfig) {
                loadedConfig = {
                    periods: [
                        { id: "1", name: "第 1 節", type: "NORMAL", is_schedulable: true },
                        { id: "2", name: "第 2 節", type: "NORMAL", is_schedulable: true },
                        { id: "3", name: "第 3 節", type: "NORMAL", is_schedulable: true },
                        { id: "4", name: "第 4 節", type: "NORMAL", is_schedulable: true },
                        { id: "5", name: "第 5 節", type: "NORMAL", is_schedulable: true },
                        { id: "nap", name: "午休", type: "NAP", is_schedulable: false },
                        { id: "6", name: "第 6 節", type: "NORMAL", is_schedulable: true },
                        { id: "7", name: "第 7 節", type: "NORMAL", is_schedulable: true },
                        { id: "8", name: "第 8 節", type: "NORMAL", is_schedulable: true }
                    ],
                    classes: [
                        { code: 101, name: "一年忠班", grade: 1 },
                        { code: 102, name: "一年孝班", grade: 1 },
                        { code: 103, name: "一年仁班", grade: 1 },
                        { code: 104, name: "一年愛班", grade: 1 },
                        { code: 105, name: "一年信班", grade: 1 },
                        { code: 106, name: "一年義班", grade: 1 },
                        { code: 201, name: "二年忠班", grade: 2 },
                        { code: 202, name: "二年孝班", grade: 2 },
                        { code: 203, name: "二年仁班", grade: 2 },
                        { code: 204, name: "二年愛班", grade: 2 },
                        { code: 205, name: "二年信班", grade: 2 },
                        { code: 206, name: "二年義班", grade: 2 },
                        { code: 301, name: "三年忠班", grade: 3 },
                        { code: 302, name: "三年孝班", grade: 3 },
                        { code: 303, name: "三年仁班", grade: 3 },
                        { code: 304, name: "三年愛班", grade: 3 },
                        { code: 305, name: "三年信班", grade: 3 },
                        { code: 306, name: "三年義班", grade: 3 },
                        { code: 401, name: "四年忠班", grade: 4 },
                        { code: 402, name: "四年孝班", grade: 4 },
                        { code: 403, name: "四年仁班", grade: 4 },
                        { code: 404, name: "四年愛班", grade: 4 },
                        { code: 405, name: "四年信班", grade: 4 },
                        { code: 406, name: "四年義班", grade: 4 },
                        { code: 501, name: "五年忠班", grade: 5 },
                        { code: 502, name: "五年孝班", grade: 5 },
                        { code: 503, name: "五年仁班", grade: 5 },
                        { code: 504, name: "五年愛班", grade: 5 },
                        { code: 505, name: "五年信班", grade: 5 },
                        { code: 506, name: "五年義班", grade: 5 },
                        { code: 601, name: "六年忠班", grade: 6 },
                        { code: 602, name: "六年孝班", grade: 6 },
                        { code: 603, name: "六年仁班", grade: 6 },
                        { code: 604, name: "六年愛班", grade: 6 },
                        { code: 605, name: "六年信班", grade: 6 },
                        { code: 606, name: "六年義班", grade: 6 }
                    ]
                };
            }

            state.systemConfig = { periods: loadedConfig.periods };
            if (state.classes.length === 0 && loadedConfig.classes) {
                state.classes = loadedConfig.classes.map((c, idx) => ({
                    id: idx + 1,
                    code: c.code,
                    name: c.name,
                    grade: c.grade,
                    tutor_id: null,
                    default_classroom_id: null
                }));
            }

            await dbSet("mst_config", state.systemConfig);
            await dbSet("mst_classes", state.classes);
        }

        ensureDefaultClassrooms();
        syncClassTutors();

        if (typeof renderCallback === "function") {
            renderCallback();
        }
    } catch (err) {
        console.error("資料載入失敗: ", err);
    }
}
