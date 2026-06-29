import type { OCRResult } from '../types';
import { SAMPLES } from './samples';

/**
 * 簡易的延遲工具函數 (毫秒)
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Parses and extracts delivery information from an image using the Google Gemini 2.5 Flash API.
 */
export async function analyzeDeliverySlipImage(
  base64Data: string,
  apiKey: string,
  defaultRegion: string = '台灣',
  mimeType: string = 'image/png'
): Promise<OCRResult> {
  if (!apiKey) {
    throw new Error('請先在設定中配置您的 Gemini API Key！');
  }

  // --- 新增：節流機制 ---
  // 強制每次請求前等待 3.5 秒，確保一分鐘不會超過 20 次限制
  await sleep(3500);

  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const prompt = `
你是一位專業的物流配送單數據解析助理。請仔細分析所上傳的「物流配送單圖片」或「Excel/表格截圖」。
你的任務是從中辨識並精準提取「配送日期」與所有「配送地址資訊」，並以下列 JSON 格式輸出：

\`\`\`json
{
  "deliveryDate": "YYYY-MM-DD",
  "items": [
    {
      "seq": 1,
      "orderId": "訂單編號/託運單號 (若沒有請填 N/A)",
      "channel": "來源管道如 PCH, HCT, CHE, 486 等 (若沒有請填 N/A)",
      "address": "完整配送地址 (必須包含完整縣市、行政區、路街、巷弄、門牌，並排除拼音/亂碼，地址預設在 ${defaultRegion})",
      "recipient": "收件人姓名 (若沒有請填 N/A)",
      "phone": "聯絡電話 (若沒有請填 N/A)",
      "items": "配送商品名稱/品名 (若有多個請用 + 串接)",
      "serviceType": "服務/安裝類型，例如基本安裝、純配送、送貨上樓 (若沒有請填 N/A)",
      "deliveryDate": "該項目的配送日期 (格式為 YYYY-MM-DD，若沒有特指則使用整體配送日期)",
      "deliveryTime": "該項目的指配時段 (格式為 HHMM~HHMM 如 0900~1200，若沒有請填 N/A)",
      "sku": "商品料號/SKU (若沒有請填 N/A)",
      "remarks": "客戶備註/配送注意事項 (若沒有請填 N/A)"
    }
  ]
}
\`\`\`

【嚴格規則】：
1. 僅輸出符合上述 Schema 的合法 JSON 物件。
2. 對於地址，必須保持其原貌，並確保它是一個可以被 Google Maps 搜尋的合法地址。
3. 如果圖片為 Excel 截圖，請完整提取每一行代表的配送項目。
4. 預設地址所屬地區為：”${defaultRegion}”。
`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType, data: cleanBase64 } }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });

    // --- 新增：處理 429 錯誤重試 ---
    if (response.status === 429) {
      console.warn('觸發 429 限制，等待 10 秒後重試...');
      await sleep(10000);
      return analyzeDeliverySlipImage(base64Data, apiKey, defaultRegion, mimeType);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(errorData.error?.message || `HTTP 錯誤 ${response.status}`);
    }

    const data = await response.json();
    const textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textOutput) throw new Error('Gemini API 未返回有效文字。');

    const sanitizedText = textOutput.trim().replace(/^```json/i, '').replace(/```$/, '').trim();
    const parsedResult: OCRResult = JSON.parse(sanitizedText);
    
    if (!parsedResult.deliveryDate) parsedResult.deliveryDate = new Date().toISOString().split('T')[0];
    parsedResult.items = parsedResult.items.map((item, idx) => ({
      ...item,
      seq: item.seq || idx + 1,
      deliveryDate: item.deliveryDate || parsedResult.deliveryDate,
    }));

    return parsedResult;
  } catch (error: unknown) {
    console.error('OCR Parsing Error:', error);
    throw new Error(error instanceof Error ? error.message : '解析圖片時發生錯誤。');
  }
}

export function getSampleMockData(sampleId: string): OCRResult {
  const sample = SAMPLES.find((s) => s.id === sampleId);
  if (!sample) throw new Error(`找不到 ID 為 ${sampleId} 的範例資料。`);
  return {
    deliveryDate: sample.mockData.deliveryDate,
    items: sample.mockData.items.map((item) => ({ ...item })),
  };
}