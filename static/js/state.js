// static/js/state.js
// --- 全域資料狀態與 DOM 節點引用 ---

export const state = {
    // 系統與業務資料
    systemConfig: null,
    classes: [],
    classrooms: [],
    teachers: [],
    courses: [],
    schedules: [],

    // 互動選取狀態
    selectedClassId: null,
    draggedCourseId: null,      // 當前拖曳的課程定義 ID
    draggedScheduleId: null,    // 當前拖曳的既有課表 ID
    selectedCourseId: null,     // 當前點選的課程定義 ID (點選排課模式)
    teacherSelectedCourseId: null, // 教師課表介面當前選取的課程 ID
    matrixSelectedTeacherId: null, // 課程總表選取的教師 ID
    ignoreNextClickCell: null,   // 防止刪除排課後的 click 事件穿透
    pendingImportPayload: null,  // 匯入預覽暫存

    // 浮動可拖曳課表狀態
    floatingScheduleState: {
        isOpen: false,
        type: null, // 'teacher' | 'class'
        id: null,
        isCollapsed: false
    }
};

// --- DOM 元素集中快取 ---
export const dom = {
    // 右鍵選單
    contextMenu: document.getElementById("custom-context-menu"),
    menuItemGoto: document.getElementById("menu-item-goto"),

    // 浮動視窗
    floatingWindow: document.getElementById("floating-schedule-window"),
    floatingWindowHeader: document.getElementById("floating-window-header"),
    floatingWindowTitleText: document.getElementById("floating-window-title-text"),
    floatingWindowInfo: document.getElementById("floating-window-info"),
    floatingGridBody: document.getElementById("floating-grid-body"),
    btnCollapseFloating: document.getElementById("btn-collapse-floating-window"),
    btnCloseFloating: document.getElementById("btn-close-floating-window"),

    // Tab 1: 班級課表
    selectClass: document.getElementById("select-class"),
    selectClassroom: document.getElementById("select-classroom"),
    coursePool: document.getElementById("course-pool"),
    unscheduledCount: document.getElementById("unscheduled-count"),
    currentClassDisplay: document.getElementById("current-class-display"),
    classGradeBadge: document.getElementById("class-grade-badge"),
    gridBody: document.getElementById("schedule-grid-body"),
    statusLogger: document.getElementById("status-logger"),
    toastContainer: document.getElementById("toast-container"),
    btnNextClass: document.getElementById("btn-next-class"),
    btnRefreshClass: document.getElementById("btn-refresh-class"),

    // Tab 2: 教師課表
    selectTeacher: document.getElementById("select-teacher"),
    teacherGridBody: document.getElementById("teacher-grid-body"),
    teacherStatPeriods: document.getElementById("teacher-stat-periods"),
    teacherStatGrades: document.getElementById("teacher-stat-grades"),
    currentTeacherDisplay: document.getElementById("current-teacher-display"),
    teacherTutorBadge: document.getElementById("teacher-tutor-badge"),
    teacherStatusLogger: document.getElementById("teacher-status-logger"),
    btnToggleAddTeacher: document.getElementById("btn-toggle-add-teacher"),
    formAddTeacher: document.getElementById("form-add-teacher"),
    inputNewTeacherName: document.getElementById("input-new-teacher-name"),
    inputNewTeacherTutor: document.getElementById("input-new-teacher-tutor"),
    teacherSelectClassroom: document.getElementById("teacher-select-classroom"),
    teacherClassroomSelectSection: document.getElementById("teacher-classroom-select-section"),
    teacherCoursePool: document.getElementById("teacher-course-pool"),
    teacherCoursePoolSection: document.getElementById("teacher-course-pool-section"),
    btnRefreshTeacher: document.getElementById("btn-refresh-teacher"),

    // Tab 2.5: 教室課表
    selectClassroomView: document.getElementById("select-classroom-view"),
    classroomGridBody: document.getElementById("classroom-grid-body"),
    classroomStatPeriods: document.getElementById("classroom-stat-periods"),
    currentClassroomDisplay: document.getElementById("current-classroom-display"),
    classroomTypeBadge: document.getElementById("classroom-type-badge"),
    classroomStatusLogger: document.getElementById("classroom-status-logger"),
    btnRefreshClassroom: document.getElementById("btn-refresh-classroom"),

    // Tab 3: 教師總表 & 課程指派
    teacherSummaryTableBody: document.getElementById("teacher-summary-table-body"),
    mgtSelectClass: document.getElementById("mgt-select-class"),
    mgtSelectTeacher: document.getElementById("mgt-select-teacher"),
    mgtCoursesListBody: document.getElementById("mgt-courses-list-body"),
    formAddCourse: document.getElementById("form-add-course"),
    mgtInputCourseName: document.getElementById("mgt-input-course-name"),
    mgtSelectClassroomName: document.getElementById("mgt-select-classroom-name"),

    // Tab 4: 班級課程設定
    currSelectClass: document.getElementById("curr-select-class"),
    curriculumTableBody: document.getElementById("curriculum-table-body"),
    currStatSubjects: document.getElementById("curr-stat-subjects"),
    currStatTotal: document.getElementById("curr-stat-total"),
    currStatRemaining: document.getElementById("curr-stat-remaining"),
    formCurrAddCourse: document.getElementById("form-curr-add-course"),
    currInputName: document.getElementById("curr-input-name"),
    currSelectTeacher: document.getElementById("curr-select-teacher"),
    currSelectClassroomName: document.getElementById("curr-select-classroom-name"),
    currInputPeriods: document.getElementById("curr-input-periods"),

    // 右上角 view-selector 群組
    vsClassGroup: document.getElementById("vs-class-group"),
    vsTeacherGroup: document.getElementById("vs-teacher-group"),
    vsCurriculumGroup: document.getElementById("vs-curriculum-group"),
    vsClassroomGroup: document.getElementById("vs-classroom-group"),

    // Tab 5: 系統設定
    formSettingAddClass: document.getElementById("form-setting-add-class"),
    settingInputClassName: document.getElementById("setting-input-class-name"),
    settingInputClassGrade: document.getElementById("setting-input-class-grade"),
    settingSelectClassTutor: document.getElementById("setting-select-class-tutor"),
    settingSelectClassRoom: document.getElementById("setting-select-class-room"),
    settingClassesListBody: document.getElementById("setting-classes-list-body"),
    btnExportSystem: document.getElementById("btn-export-system"),
    btnImportSystem: document.getElementById("btn-import-system"),
    modalImportSystem: document.getElementById("modal-import-system"),
    btnCloseImportModal: document.getElementById("btn-close-import-modal"),
    btnCancelImportModal: document.getElementById("btn-cancel-import-modal"),
    btnConfirmImportAction: document.getElementById("btn-confirm-import-action"),
    tabBtnImportFile: document.getElementById("tab-btn-import-file"),
    tabBtnImportText: document.getElementById("tab-btn-import-text"),
    importPaneFile: document.getElementById("import-pane-file"),
    importPaneText: document.getElementById("import-pane-text"),
    fileDropArea: document.getElementById("file-drop-area"),
    modalFileInput: document.getElementById("modal-file-input"),
    selectedFileName: document.getElementById("selected-file-name"),
    importJsonTextarea: document.getElementById("import-json-textarea"),
    importPreviewBox: document.getElementById("import-preview-box"),
    previewStatsContent: document.getElementById("preview-stats-content"),
    settingExportClass: document.getElementById("setting-export-class"),
    settingExportTeacher: document.getElementById("setting-export-teacher"),
    btnExportClassCsv: document.getElementById("btn-export-class-csv"),
    btnExportTeacherCsv: document.getElementById("btn-export-teacher-csv"),
    btnExportClassPdf: document.getElementById("btn-export-class-pdf"),
    btnExportTeacherPdf: document.getElementById("btn-export-teacher-pdf"),
    btnExportTeacherScheduleTsv: document.getElementById("btn-export-teacher-schedule-tsv"),
    btnExportCourseDatabaseTsv: document.getElementById("btn-export-course-database-tsv"),
    btnClearDatabase: document.getElementById("btn-clear-database"),
    settingConfigEditor: document.getElementById("setting-config-editor"),
    btnSaveConfig: document.getElementById("btn-save-config"),

    // CSV 匯入按鈕
    inputImportTeachersCsv: document.getElementById("input-import-teachers-csv"),
    inputImportClassroomsCsv: document.getElementById("input-import-classrooms-csv"),
    inputImportCoursesCsv: document.getElementById("input-import-courses-csv"),

    // 系統說明 Modal
    btnOpenSystemHelp: document.getElementById("btn-open-system-help"),
    modalSystemHelp: document.getElementById("modal-system-help"),
    btnCloseHelpModal: document.getElementById("btn-close-help-modal"),
    btnConfirmHelpModal: document.getElementById("btn-confirm-help-modal"),

    // Tab 6: 課程總表 (Matrix)
    courseMatrixBody: document.getElementById("course-matrix-body"),
    courseMatrixTable: document.getElementById("course-matrix-table"),
    matrixTeacherSearch: document.getElementById("matrix-teacher-search"),
    matrixTeacherList: document.getElementById("matrix-teacher-list"),
    matrixSelectedInfo: document.getElementById("matrix-selected-info"),
    matrixSelectedName: document.getElementById("matrix-selected-name"),
    matrixDeselectBtn: document.getElementById("matrix-deselect-btn")
};
