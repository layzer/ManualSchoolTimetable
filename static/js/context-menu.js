// static/js/context-menu.js
// --- 自訂右鍵選單定位與顯示控制 ---

import { dom } from './state.js';

/**
 * 顯示並精確定位自訂右鍵選單（防邊界溢出）
 */
export function showContextMenu(e) {
    if (!dom.contextMenu) return;
    dom.contextMenu.classList.remove("hidden");

    // 取得選單當前尺寸
    const rect = dom.contextMenu.getBoundingClientRect();
    const menuWidth = rect.width || 220;
    const menuHeight = rect.height || 60;

    // 以視窗 (viewport) clientX / clientY 為基準，精準定位在滑鼠游標旁且不受捲軸影響
    let x = e.clientX;
    let y = e.clientY;

    // 防止右側超出視窗邊界
    if (x + menuWidth > window.innerWidth) {
        x = Math.max(10, window.innerWidth - menuWidth - 10);
    }
    // 防止下方超出視窗邊界
    if (y + menuHeight > window.innerHeight) {
        y = Math.max(10, window.innerHeight - menuHeight - 10);
    }

    dom.contextMenu.style.left = `${x}px`;
    dom.contextMenu.style.top = `${y}px`;
}

/**
 * 隱藏自訂右鍵選單
 */
export function hideContextMenu() {
    if (dom.contextMenu) {
        dom.contextMenu.classList.add("hidden");
    }
}
