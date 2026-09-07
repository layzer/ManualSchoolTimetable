// static/js/conflict-engine.js
// --- 核心排課衝突偵測引擎 ---

import { state } from './state.js';

/**
 * 檢查兩個週次類型是否存在時段重疊衝突
 * @param {string} week1 - "EVERY" | "ODD" | "EVEN" | "GROUP"
 * @param {string} week2 - "EVERY" | "ODD" | "EVEN" | "GROUP"
 * @returns {boolean} true: 衝突/重疊; false: 無衝突(如單雙週錯開)
 */
export function checkWeekTypeConflict(week1, week2) {
    if ((week1 === "ODD" && week2 === "EVEN") || (week1 === "EVEN" && week2 === "ODD")) {
        return false; // 無衝突
    }
    return true; // 衝突 (含 EVERY 或 同為 ODD/EVEN)
}

/**
 * 檢查排課衝突：包含教師不排課時段、教師衝堂、專科教室佔用
 */
export function checkScheduleConflict(classId, courseId, classroomId, weekday, period, weekType = "EVERY", excludeScheduleId = null) {
    const conflicts = [];

    const targetClass = state.classes.find(c => c.id === classId);
    const targetCourse = state.courses.find(c => c.id === courseId);

    if (!targetClass || !targetCourse) {
        return ["無效的班級或課程資料"];
    }

    const targetClassroom = classroomId ? state.classrooms.find(cr => cr.id === classroomId) : null;
    if (classroomId && !targetClassroom) {
        return [`找不到 ID=${classroomId} 的教室資料`];
    }

    const teacherId = targetCourse.teacher_id;
    const targetTeacher = state.teachers.find(t => t.id === teacherId);

    // 1. 教師不可排課時間偵測
    if (targetTeacher) {
        const slotKey = `${weekday}-${period}`;
        const unavailableSlots = targetTeacher.unavailable_slots || [];
        if (unavailableSlots.includes(slotKey)) {
            conflicts.push(`${targetTeacher.name} 老師在此時段（週${weekday}第${period}節）設定為不排課時間`);
        }
    }

    // 2. 檢索該時段既存的排課紀錄
    const existingSchedules = state.schedules.filter(s => s.weekday === weekday && s.period === period && s.id !== excludeScheduleId);

    for (const s of existingSchedules) {
        // 同班級同時段的既有課表，預期覆蓋或分組，故不視為全域衝突來源
        if (s.class_id === classId) continue;

        const existingCourse = state.courses.find(c => c.id === s.course_id);
        if (!existingCourse) continue;

        // 週次重疊判斷
        const isWeekOverlap = checkWeekTypeConflict(weekType, s.week_type || "EVERY");
        if (!isWeekOverlap) continue; // 單雙週錯開

        // A. 教師衝突檢測
        if (existingCourse.teacher_id === teacherId) {
            const teacherName = targetTeacher ? targetTeacher.name : "未知教師";
            const existingClass = state.classes.find(c => c.id === s.class_id);
            const className = existingClass ? existingClass.name : "其他班級";
            conflicts.push(`${teacherName} 老師此時段已在「${className}」授課 (${s.week_type || 'EVERY'}週)`);
        }

        // B. 教室衝突檢測 (排除普通/班級教室)
        if (targetClassroom && classroomId && s.classroom_id === classroomId && targetClassroom.name !== "班級教室" && targetClassroom.type !== "普通") {
            const existingClass = state.classes.find(c => c.id === s.class_id);
            const className = existingClass ? existingClass.name : "其他班級";
            conflicts.push(`教室「${targetClassroom.name}」此時段已被「${className}」佔用 (${s.week_type || 'EVERY'}週)`);
        }
    }

    return conflicts;
}
