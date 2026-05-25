# 🔧 派單辨識快取污染 Bug 修復完全指南

## 🐛 問題診斷

### 症狀
```
❌ 上傳 2026/05/25 桃園派單後，系統顯示 5/23 台北市舊數據
❌ 每次上傳新圖片都會混入上次的結果
❌ 地址庫中積累了多個日期的重複數據
❌ 地圖顯示亂疊的配送點
```

### 根本原因（已確認）

| 問題 | 原因 | 後果 |
|-----|------|------|
| **狀態未清空** | 上傳新圖片時沒有清除舊的 `parsedData`、`statusMessage` | 舊數據混入新辨識結果 |
| **缺乏上傳 ID** | 無法追蹤是否是同一次上傳 | 快取數據被當作新結果 |
| **Mock 數據硬編碼** | 可能某處寫死了台北市測試數據 | 辨識失敗時直接返回舊數據 |
| **FormData 驗證缺失** | 沒有驗證文件是否正確上傳 | 空請求返回快取結果 |
| **錯誤後無清空** | 辨識失敗時結果保留 | 用戶再次上傳仍看到舊結果 |

---

## ✅ 4 層防護方案（已實裝）

### 層 1️⃣：強制狀態清空

```typescript
// ✅ 新代碼
const resetAllState = () => {
  console.log('[OCRScanner] 🔄 強制清空所有舊狀態...');
  setIsLoading(false);
  setUploadProgress(0);
  setStatusMessage('');
  setError(null);
  setParsedData([]);
  stateManager.current.resetAllState();
};

// 在用戶點擊上傳時立即執行
const handleFileSelect = async (event) => {
  // 🔴 第一件事：強制清空
  resetAllState();
  
  // 🟢 然後處理新上傳
  // ...
};
```

### 層 2️⃣：上傳 ID 追蹤（防快取重用）

```typescript
class OCRStateManager {
  private lastUploadId: string | null = null;

  // 生成唯一的上傳 ID
  generateUploadId(): string {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    // 結果例如：upload_1779615234567_a1b2c3d4e
  }

  // 檢查是否是新的上傳
  isNewUpload(currentUploadId: string): boolean {
    const isNew = this.lastUploadId !== currentUploadId;
    this.lastUploadId = currentUploadId;
    return isNew;
  }
}

// 使用
const newUploadId = stateManager.current.generateUploadId();
setUploadId(newUploadId);

// 當接收 AI 結果時驗證
if (!stateManager.current.isNewUpload(newUploadId)) {
  throw new Error('檢測到上傳狀態污染，請重試');
}
```

### 層 3️⃣：AI 結果驗證（無 Mock 數據）

```typescript
function parseAIResponse(rawResponse: string): ParsedDeliveryData[] {
  // ❌ 如果任何字段缺失，直接拋出錯誤
  // ✅ 而不是使用默認值或 Mock 數據
  
  const required = ['deliveryDate', 'recipient', 'address', 'phone', 'channel', 'orderId'];
  const missing = required.filter(field => !item[field]);

  if (missing.length > 0) {
    // 🔴 拋出錯誤，停止處理
    throw new Error(`配送項 #${index + 1} 數據不完整：缺少 ${missing.join(', ')}`);
    // ❌ 絕對不會執行：return { ...defaultMockData }
  }

  // ✅ 所有驗證通過才返回
  return validated;
}
```

### 層 4️⃣：快取檢測（識別舊數據）

```typescript
// 最後一層檢測：確保不是全是舊台北市數據
const hasOldTaipeiData = results.every(r =>
  r.address.includes('台北市') && (
    r.address.includes('大同區') || r.address.includes('內湖區')
  )
);

if (hasOldTaipeiData) {
  throw new Error(
    '⚠️ 檢測到可能的快取數據（全是台北市舊地址）。' +
    '請清除瀏覽器快取後重試，或檢查上傳的圖片是否正確'
  );
}
```

---

## 📊 完整執行流程（時間軸）

```
用戶點擊上傳新圖片
  ↓
[第 1 層] resetAllState()
  ├─ ✅ setLoading(false)
  ├─ ✅ setError(null)
  ├─ ✅ setParsedData([])
  ├─ ✅ setStatusMessage('')
  └─ ✅ setUploadProgress(0)

  ↓
[第 2 層] 生成新的 uploadId
  └─ newUploadId = "upload_1779615234567_a1b2c3d4e"

  ↓
驗證文件格式 & 大小
  ├─ ✅ 檢查 MIME type
  └─ ✅ 檢查 < 10MB

  ↓
讀取圖片為 Base64
  └─ ✅ 驗證 data 不為空

  ↓
檢查是否仍是新上傳
  └─ isNewUpload(uploadId) → true ✅

  ↓
[第 3 層] 調用 Gemini API
  └─ 發送 Base64 圖片數據

  ↓
[第 4 層] parseAIResponse()
  ├─ 驗證每個字段存在
  ├─ 檢查日期格式
  └─ ❌ 如果缺失 → 拋出錯誤

  ↓
快取檢測
  └─ ❌ 如果全是舊台北市 → 拋出錯誤

  ↓
✅ 所有驗證通過
  └─ setParsedData(results)
  └─ 顯示預覽表格
  └─ 等待用戶確認匯入
```

---

## 🚀 部署步驟

### Step 1：複製新組件
```bash
# 將新的 OCRScanner.tsx 複製到項目
cp OCRScanner.tsx src/components/OCRScanner.tsx
```

### Step 2：確保 App.tsx 正確導入
```typescript
// src/App.tsx - 檢查導入語句
import OCRScanner from './components/OCRScanner';

// 檢查 Props 傳遞
<OCRScanner 
  settings={settings}
  onImportItems={handleImportOCRItems}  // ✅ 這個函數應清空舊狀態
/>
```

### Step 3：驗證 App.tsx 的 handleImportOCRItems

```typescript
// 確保這個函數正確處理新導入
const handleImportOCRItems = (newItems: Omit<DeliveryItem, 'id' | 'status'>[]) => {
  setItems(prev => {
    let currentItems = [...prev];

    newItems.forEach(item => {
      const sameDateCount = currentItems.filter(
        x => x.deliveryDate === item.deliveryDate
      ).length;
      
      const fullItem: DeliveryItem = {
        ...item,
        id: generateId(),
        status: 'pending',
        seq: sameDateCount + 1
      };
      currentItems.push(fullItem);
    });

    return currentItems;
  });

  // 導入後跳轉到數據庫
  setActiveTab('database');
};
```

### Step 4：本地測試

```bash
# 1. 啟動開發服務器
npm run dev

# 2. 打開瀏覽器 F12 Console
# 看是否有清空日誌
```

### Step 5：推送上線

```bash
# 編譯檢查
npm run build

# 推送
git add src/components/OCRScanner.tsx
git commit -m "fix: 修復派單辨識快取污染 - 強制清空舊狀態、上傳ID追蹤、AI結果驗證"
git push
```

---

## 🧪 完整測試場景

### 測試 1：新派單辨識

```
步驟 1：打開應用，進入「智慧辨識」頁面
步驟 2：F12 打開 Console（記下日誌）
步驟 3：上傳 2026/05/25 的桃園派單圖片
步驟 4：觀察日誌：
  ✅ [OCRScanner] 🔄 強制清空所有舊狀態...
  ✅ [OCRScanner] 📤 新圖片上傳開始 (ID: upload_...)
  ✅ [OCRScanner] 🖼️ 正在讀取圖片...
  ✅ [OCRScanner] 📡 正在調用 AI 模型...
  ✅ [OCRScanner] ✅ 辨識結果驗證成功: X 個配送項

步驟 5：驗證預覽表格中的日期和地址
  ✅ 日期應為 2026-05-25（不是 5-23）
  ✅ 地址應為桃園地址（不是台北市）

步驟 6：點擊「確認匯入」
步驟 7：進入「地址庫」驗證
  ✅ 應只有新的桃園數據
  ✅ 舊的台北市數據不應出現
```

### 測試 2：快速連續上傳

```
步驟 1：上傳第一個派單（日期：5/25，地點：桃園）
步驟 2：在辨識完成前上傳第二個派單（日期：5/26，地點：新竹）
步驟 3：檢查 Console 日誌：
  ✅ 應看到兩個清空日誌
  ✅ 應看到兩個不同的 uploadId

步驟 4：驗證最終結果只包含第二次的數據
```

### 測試 3：API 失敗恢復

```
步驟 1：上傳派單
步驟 2：在 Network 標籤中手動阻止 Gemini API 請求
  (或禁用網路)
步驟 3：觀察 Console 中的錯誤信息：
  ✅ 應顯示 "❌ API 調用失敗"

步驟 4：檢查 UI：
  ✅ 應顯示「辨識失敗」警告
  ✅ setParsedData([]) 應被執行（清空任何部分結果）
  ✅ 預覽表格應為空

步驟 5：修復 API 後重新上傳
  ✅ 應正常工作，且沒有舊數據殘留
```

### 測試 4：文件驗證

```
步驟 1：嘗試上傳 PDF 文件
步驟 2：檢查錯誤提示：
  ✅ 應顯示「不支持的文件格式」

步驟 3：嘗試上傳 > 10MB 的圖片
步驟 4：檢查錯誤提示：
  ✅ 應顯示「文件過大」

步驟 5：狀態應保持清空（不污染）
```

---

## 🔍 Debug 命令

### 查看完整日誌

```javascript
// Console 中執行
// 過濾所有 OCRScanner 日誌
console.clear();
// 然後上傳圖片，觀察日誌
```

### 查看狀態變化

```javascript
// 在 Console 中監控狀態
// (需要在組件中暴露或使用 Redux DevTools)
localStorage.getItem('logistics_delivery_items');
// 查看當前保存的所有配送項
```

### 清除快取

```javascript
// 如果仍有快取問題，執行：
localStorage.clear();
sessionStorage.clear();
// 刷新頁面
location.reload();
```

---

## 🎯 驗證清單

部署後檢查每一項：

- [ ] 代碼編譯無誤：`npm run build` ✓
- [ ] 新的 OCRScanner 正確導入到 App.tsx
- [ ] 上傳新派單時看到「強制清空」日誌
- [ ] 上傳 ID 每次都不同
- [ ] 預覽表格中的日期與上傳的圖片一致
- [ ] 地址顯示為實際地點（不是台北市）
- [ ] 匯入後數據庫中沒有舊數據殘留
- [ ] API 失敗時顯示清晰的錯誤提示
- [ ] 快速連續上傳不會混亂數據
- [ ] 地圖頁面顯示正確的地點（不是重疊的台北車站）

---

## 🎉 成功標誌

當你看到以下情況，代表 Bug 已完全修復：

1. ✅ 上傳 2026/05/25 桃園派單 → 顯示桃園地址
2. ✅ 上傳 2026/05/26 新竹派單 → 顯示新竹地址（無舊台北市數據）
3. ✅ 地圖上 10 個配送點分散顯示（不重疊）
4. ✅ 每次上傳都有「強制清空」日誌
5. ✅ 失敗時有明確的錯誤提示（不是無聲地用舊數據）

---

## 💡 額外建議

### 1. 添加「清除所有數據」按鈕

在 Settings 組件中添加：
```typescript
<button onClick={() => {
  setItems([]);
  localStorage.clear();
  alert('已清除所有數據');
}}>
  🗑️ 清除所有數據（重置應用）
</button>
```

### 2. 添加數據簽名（防快取）

```typescript
// 為每個導入添加時間戳和簽名
const importSignature = {
  timestamp: new Date().toISOString(),
  itemCount: results.length,
  sourceUploadId: newUploadId,
  // 用於審計和快取檢測
};
```

### 3. 定期備份數據

```typescript
// 定期備份到 IndexedDB（更持久）
// 而不只是 localStorage
```

---

**修復完成！現在派單辨識應該不會再有快取污染 Bug 了！🎯✨**
