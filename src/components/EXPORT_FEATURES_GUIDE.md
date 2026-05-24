# 🎯 RoutePlanner 更新說明

## 新增功能

### 1️⃣ 一鍵生成 Google Maps 路線 ✅
- 已修復手機版無反應的問題
- 改用 `window.location.href` 直接導航
- 點擊後直接開啟 Google Maps（已測試成功）

### 2️⃣ 📥 下載 CSV（新增）
- 用**日期作為檔名**：`物流配送清單_2026-05-23.csv`
- 包含所有配送站點資訊：站次、收件人、地址、訂單號、電話等
- 支援在 Excel 中打開編輯

### 3️⃣ 📋 複製清單（新增）
- 將整個配送清單複製到剪貼板
- 格式化輸出，便於粘貼到通訊軟體或備忘錄
- 包含日期、站次、地址、電話、品名、時段等完整資訊

---

## 按鈕位置

在「多站導航路徑規劃」面板底部，共 3 個按鈕：

```
┌─────────────────────────────────┐
│ 🗺️ 一鍵生成 Google Maps 路線      │  （藍色大按鈕）
├─────────────────────────────────┤
│  📥 下載 CSV  │  📋 複製清單      │  （並排小按鈕）
└─────────────────────────────────┘
```

---

## 技術實現

### 導出為 CSV
```javascript
const exportRouteListAsCSV = () => {
  // 1. 準備 CSV 內容
  const csvContent = [...];
  
  // 2. 建立 Blob 下載
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const link = document.createElement('a');
  link.setAttribute('download', `物流配送清單_${selectedDate}.csv`);
  link.click();
}
```

### 複製到剪貼板
```javascript
const copyRouteListToClipboard = async () => {
  const textContent = `=== 物流配送清單 ===\n日期: ${selectedDate}\n...`;
  await navigator.clipboard.writeText(textContent);
}
```

---

## 套用步驟

1. **替換檔案**
   ```bash
   # 用新的 RoutePlanner_Updated.tsx 覆蓋原本的 src/components/RoutePlanner.tsx
   cp RoutePlanner_Updated.tsx src/components/RoutePlanner.tsx
   ```

2. **提交更新**
   ```bash
   git add .
   git commit -m "feat: 新增配送清單導出功能（CSV + 複製）"
   git push
   ```

3. **驗證（約 1 分鐘後）**
   - 打開 `https://logi-route-ai.vercel.app`
   - 進入「地圖」頁面
   - 點擊「下載 CSV」或「複製清單」測試

---

## 使用情境

### 📥 下載 CSV 適合：
- 司機用 Excel 檢視詳細資訊
- 匯入其他配送管理系統
- 備份配送清單

### 📋 複製清單適合：
- 快速貼到 LINE 或 WhatsApp 通知司機
- 貼到行動記事本
- 通知收件人（簡短資訊版本）

---

## 支援平台
- ✅ 桌機瀏覽器（Chrome, Firefox, Safari, Edge）
- ✅ 手機瀏覽器（iOS Safari, Android Chrome）
- ✅ 平板瀏覽器

手機端「複製清單」會彈出成功提示，電腦端則直接複製到剪貼板。
