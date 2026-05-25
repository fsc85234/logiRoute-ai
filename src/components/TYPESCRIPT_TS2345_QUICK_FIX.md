# 🔄 TS2345 sku 欄位修復 - 快速參考

## 🐛 問題

```
❌ error TS2345: Property 'sku' is missing
```

## ✅ 解決方案（4 步）

### 1️⃣ 更新介面
```typescript
interface ParsedDeliveryData {
  sku?: string;  // ✅ 新增
  items: string;
  // ...
}
```

### 2️⃣ 更新 AI 解析
```typescript
sku: item.sku ? String(item.sku).trim() : undefined,
```

### 3️⃣ 智能映射（防呆）
```typescript
const sku = item.sku || item.items || '';

return {
  sku: sku,  // ✅ 確保有值
  // ...
};
```

### 4️⃣ 更新 Gemini 提示詞
```
"sku": "商品編碼/SKU (可選，如有請填入)"
```

---

## 📊 sku 優先順序

```
item.sku → item.items → '' (空字符串)
```

---

## 🚀 部署

```bash
cp OCRScanner_FIXED_WITH_SKU.tsx src/components/OCRScanner.tsx
npm run build  # ✅ 應編譯成功
git commit -m "fix: TS2345 - sku 欄位映射"
git push
```

---

## ✅ 驗證

- [ ] `npm run build` 成功
- [ ] 無 TS2345 錯誤
- [ ] 上傳派單 → 所有項目有 sku
- [ ] Console 顯示「包含 sku: 10/10」

---

**修復完成！✨**
