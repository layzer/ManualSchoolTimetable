# 國小單雙週排課系統 - 安裝與啟動指引 (Windows 平台)

本指南將引導您從零開始安裝 Python、配置高效專案環境工具 `uv`，並啟動排課系統沙盒。

---

## 🛠️ 步驟 1. 安裝 Python 3.11 或 3.12

本專案建議使用 **Python 3.11** 或 **Python 3.12** 環境。

1. **下載官方安裝檔**：
   - 前往 [Python 官方下載頁面](https://www.python.org/downloads/)。
   - 下載適用於 Windows 的 `Windows installer (64-bit)`。

2. **執行安裝程式**：
   - 雙擊執行下載的 `.exe` 安裝檔。
   - ⚠️ **重要限制（必做）**：在安裝視窗最下方，務必**勾選「Add Python to PATH」**（將 Python 加入系統環境變數）。
   - 點擊 **Customize installation** 或 **Install Now** 開始安裝。
   - 安裝完成後，點擊「Close」。

3. **驗證 Python 安裝**：
   - 打開您的命令提示字元 (Command Prompt) 或 **PowerShell**。
   - 輸入以下指令，確認可正確顯示版本號：
     ```powershell
     python --version
     ```

---

## ⚡ 步驟 2. 安裝 Python 環境管理工具 `uv`

為了避免弄髒您電腦中的 Python 全域環境 (base)，本專案強制使用 **Astral `uv`** 進行專案依賴與虛擬環境管理。

1. **安裝 `uv`**：
   - 打開 **PowerShell**，執行以下官方安裝腳本指令：
     ```powershell
     powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
     ```
   - *（安裝完成後，建議重新開啟 PowerShell 視窗以套用新路徑環境變數）*

2. **驗證 `uv` 安裝**：
   - 於終端機輸入：
     ```powershell
     uv --version
     ```

---

## 📂 步驟 3. 下載與建立專案環境

1. **進入專案根目錄**：
   - 打開 PowerShell，切換至您的專案路徑：
     ```powershell
     cd c:\web\STC
     ```

2. **建立專案專屬虛擬環境 (`.venv`)**：
   - 執行以下指令，`uv` 會自動讀取專案的 `pyproject.toml` 並在專案目錄下生成專屬虛擬環境：
     ```powershell
     python -m uv venv
     ```

3. **同步並安裝專案相依套件**：
   - 依據專案鎖定檔 `uv.lock` 精確同步套件：
     ```powershell
     python -m uv pip sync
     ```
   - 系統會自動安裝 `fastapi`、`uvicorn`、`sqlalchemy`、`pytest` 等排課系統執行所需的必要套件。

---

## 🚀 步驟 4. 啟動排課系統

1. **啟動開發伺服器 (FastAPI / Uvicorn)**：
   - 於專案目錄下執行以下啟動指令：
     ```powershell
     python -m uv run python -m uvicorn main:app --port 8000 --reload
     ```
   - 終端機若顯示 `INFO:     Uvicorn server running on http://127.0.0.1:8000` 即代表啟動成功。
   - *備註：首次啟動時，系統會自動在目錄下建立 SQLite 資料庫檔案 `scheduler.db`，並自動寫入預置的課程、教師、班級與教室等測試排課資料。*

2. **訪問排課系統網頁**：
   - 打開您的 Chrome 或 Edge 瀏覽器。
   - 訪問以下網址即可開始進行排課沙盒操作：
     ```
     http://localhost:8000/static/index.html
     ```

---

## 🧪 步驟 5. 執行單元測試 (選填)

如果您修改了排課系統的核心衝突偵測引擎 (`scheduler.py`)，可使用以下指令執行自動化單元測試，確保邏輯未受損：
```powershell
python -m uv run python -m pytest
```
