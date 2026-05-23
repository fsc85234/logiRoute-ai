import type { DeliveryItem } from '../types';

export interface SampleSlip {
  id: string;
  name: string;
  description: string;
  type: 'excel' | 'shipping_label';
  svgString: string;
  mockData: {
    deliveryDate: string;
    items: Omit<DeliveryItem, 'id' | 'status' | 'latitude' | 'longitude' | 'geocoded'>[];
  };
}

export const SAMPLES: SampleSlip[] = [
  {
    id: 'pchome_excel_screenshot',
    name: 'PChome & 各平台配送日報表 (使用者上傳格式)',
    description: '整合 PChome、ASUS 等電商平台的大型家電/傢俱配送排程表，包含多站點與多項安裝備註。',
    type: 'excel',
    svgString: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="100%" height="100%">
      <rect width="800" height="450" fill="#1e293b"/>
      <rect width="800" height="40" fill="#0f172a"/>
      <text x="20" y="25" fill="#e2e8f0" font-family="monospace" font-size="14" font-weight="bold">📊 配送排程表_20260523.xlsx - 預覽</text>
      
      <!-- Table Header -->
      <rect x="10" y="50" width="780" height="30" fill="#334155" rx="3"/>
      <text x="20" y="70" fill="#94a3b8" font-family="sans-serif" font-size="11" font-weight="bold">來源</text>
      <text x="60" y="70" fill="#94a3b8" font-family="sans-serif" font-size="11" font-weight="bold">訂單編號</text>
      <text x="170" y="70" fill="#94a3b8" font-family="sans-serif" font-size="11" font-weight="bold">配送地址</text>
      <text x="360" y="70" fill="#94a3b8" font-family="sans-serif" font-size="11" font-weight="bold">收件人</text>
      <text x="410" y="70" fill="#94a3b8" font-family="sans-serif" font-size="11" font-weight="bold">商品名稱</text>
      <text x="510" y="70" fill="#94a3b8" font-family="sans-serif" font-size="11" font-weight="bold">配送日期</text>
      <text x="580" y="70" fill="#94a3b8" font-family="sans-serif" font-size="11" font-weight="bold">時段</text>
      <text x="640" y="70" fill="#94a3b8" font-family="sans-serif" font-size="11" font-weight="bold">客戶備註</text>
      
      <!-- Table Rows -->
      <!-- Row 1 -->
      <rect x="10" y="85" width="780" height="32" fill="#ef4444" fill-opacity="0.1" rx="3"/>
      <text x="20" y="105" fill="#f87171" font-family="sans-serif" font-size="10">PCH</text>
      <text x="60" y="105" fill="#f87171" font-family="sans-serif" font-size="10">PI2605210015828</text>
      <text x="170" y="105" fill="#e2e8f0" font-family="sans-serif" font-size="10">台北市大同區承德路三段136號2樓</text>
      <text x="360" y="105" fill="#f87171" font-family="sans-serif" font-size="10">林敏</text>
      <text x="410" y="105" fill="#e2e8f0" font-family="sans-serif" font-size="10">冰箱&gt;350公升 + 贈品</text>
      <text x="510" y="105" fill="#e2e8f0" font-family="sans-serif" font-size="10">2026/05/23</text>
      <text x="580" y="105" fill="#e2e8f0" font-family="sans-serif" font-size="10">0900~1200</text>
      <text x="640" y="105" fill="#94a3b8" font-family="sans-serif" font-size="8">/2F(X).舊機回收.到前電聯</text>

      <!-- Row 2 -->
      <rect x="10" y="122" width="780" height="32" fill="#1e293b" rx="3"/>
      <text x="20" y="142" fill="#94a3b8" font-family="sans-serif" font-size="10">PCH</text>
      <text x="60" y="142" fill="#cbd5e1" font-family="sans-serif" font-size="10">PI2605210023334</text>
      <text x="170" y="142" fill="#e2e8f0" font-family="sans-serif" font-size="10">台北市大同區南京西路155巷8號1樓</text>
      <text x="360" y="142" fill="#cbd5e1" font-family="sans-serif" font-size="10">林清網</text>
      <text x="410" y="142" fill="#e2e8f0" font-family="sans-serif" font-size="10">直立洗衣機&lt;16公斤(含)</text>
      <text x="510" y="142" fill="#e2e8f0" font-family="sans-serif" font-size="10">2026/05/23</text>
      <text x="580" y="142" fill="#e2e8f0" font-family="sans-serif" font-size="10">0900~1200</text>
      <text x="640" y="142" fill="#94a3b8" font-family="sans-serif" font-size="8">/到前電聯.舊機回收</text>

      <!-- Row 3 -->
      <rect x="10" y="159" width="780" height="32" fill="#ef4444" fill-opacity="0.1" rx="3"/>
      <text x="20" y="179" fill="#f87171" font-family="sans-serif" font-size="10">PCH</text>
      <text x="60" y="179" fill="#f87171" font-family="sans-serif" font-size="10">PI2604140005645</text>
      <text x="170" y="179" fill="#e2e8f0" font-family="sans-serif" font-size="10">台北市內湖區行善路111巷1號11樓</text>
      <text x="360" y="179" fill="#f87171" font-family="sans-serif" font-size="10">陳聖凱</text>
      <text x="410" y="179" fill="#e2e8f0" font-family="sans-serif" font-size="10">智控洗乾衣機 + 贈品*2</text>
      <text x="510" y="179" fill="#e2e8f0" font-family="sans-serif" font-size="10">2026/05/23</text>
      <text x="580" y="179" fill="#e2e8f0" font-family="sans-serif" font-size="10">1200~1500</text>
      <text x="640" y="179" fill="#94a3b8" font-family="sans-serif" font-size="8">/裝潢延宕.客戶改約5/23</text>

      <!-- Row 4 -->
      <rect x="10" y="196" width="780" height="32" fill="#1e293b" rx="3"/>
      <text x="20" y="216" fill="#94a3b8" font-family="sans-serif" font-size="10">20</text>
      <text x="60" y="216" fill="#cbd5e1" font-family="sans-serif" font-size="10">GGAE696889</text>
      <text x="170" y="216" fill="#e2e8f0" font-family="sans-serif" font-size="10">台北市松山區復興南路一段1號6樓之1</text>
      <text x="360" y="216" fill="#cbd5e1" font-family="sans-serif" font-size="10">林華珠</text>
      <text x="410" y="216" fill="#e2e8f0" font-family="sans-serif" font-size="10">電競椅_白</text>
      <text x="510" y="216" fill="#e2e8f0" font-family="sans-serif" font-size="10">2026/05/23</text>
      <text x="580" y="216" fill="#e2e8f0" font-family="sans-serif" font-size="10">1200~1500</text>
      <text x="640" y="216" fill="#94a3b8" font-family="sans-serif" font-size="8">/到前電聯.客戶指定</text>

      <!-- Row 5 -->
      <rect x="10" y="233" width="780" height="32" fill="#1e293b" rx="3"/>
      <text x="20" y="253" fill="#94a3b8" font-family="sans-serif" font-size="10">486</text>
      <text x="60" y="253" fill="#cbd5e1" font-family="sans-serif" font-size="10">2026050920140011801</text>
      <text x="170" y="253" fill="#e2e8f0" font-family="sans-serif" font-size="10">台北市南港區興中路80巷9號2樓</text>
      <text x="360" y="253" fill="#cbd5e1" font-family="sans-serif" font-size="10">蘇敏慧</text>
      <text x="410" y="253" fill="#e2e8f0" font-family="sans-serif" font-size="10">滾筒乾衣機</text>
      <text x="510" y="253" fill="#e2e8f0" font-family="sans-serif" font-size="10">2026/05/23</text>
      <text x="580" y="253" fill="#e2e8f0" font-family="sans-serif" font-size="10">1200~1500</text>
      <text x="640" y="253" fill="#94a3b8" font-family="sans-serif" font-size="8">1-1.基本安裝</text>

      <!-- Row 6 -->
      <rect x="10" y="270" width="780" height="32" fill="#ef4444" fill-opacity="0.1" rx="3"/>
      <text x="20" y="290" fill="#f87171" font-family="sans-serif" font-size="10">PCH</text>
      <text x="60" y="290" fill="#f87171" font-family="sans-serif" font-size="10">PI2605210013442</text>
      <text x="170" y="290" fill="#e2e8f0" font-family="sans-serif" font-size="10">台北市南港區忠孝東路七段10號15樓之43</text>
      <text x="360" y="290" fill="#f87171" font-family="sans-serif" font-size="10">鄭慧妮</text>
      <text x="410" y="290" fill="#e2e8f0" font-family="sans-serif" font-size="10">冰箱&lt;350公升 + 贈品</text>
      <text x="510" y="290" fill="#e2e8f0" font-family="sans-serif" font-size="10">2026/05/23</text>
      <text x="580" y="290" fill="#e2e8f0" font-family="sans-serif" font-size="10">1200~1500</text>
      <text x="640" y="290" fill="#94a3b8" font-family="sans-serif" font-size="8">/到前電聯.客戶指定</text>

      <!-- Row 7 -->
      <rect x="10" y="307" width="780" height="32" fill="#1e293b" rx="3"/>
      <text x="20" y="327" fill="#94a3b8" font-family="sans-serif" font-size="10">CHE</text>
      <text x="60" y="327" fill="#cbd5e1" font-family="sans-serif" font-size="10">T896510004</text>
      <text x="170" y="327" fill="#e2e8f0" font-family="sans-serif" font-size="10">台北市南港區向陽路162巷66號11樓</text>
      <text x="360" y="327" fill="#cbd5e1" font-family="sans-serif" font-size="10">傅淑婷</text>
      <text x="410" y="327" fill="#e2e8f0" font-family="sans-serif" font-size="10">按摩椅_一般</text>
      <text x="510" y="327" fill="#e2e8f0" font-family="sans-serif" font-size="10">2026/05/23</text>
      <text x="580" y="327" fill="#e2e8f0" font-family="sans-serif" font-size="10">1500~1800</text>
      <text x="640" y="327" fill="#94a3b8" font-family="sans-serif" font-size="8">FG-936 AI愛沙發</text>

      <!-- Row 8 -->
      <rect x="10" y="344" width="780" height="32" fill="#ef4444" fill-opacity="0.1" rx="3"/>
      <text x="20" y="364" fill="#f87171" font-family="sans-serif" font-size="10">PCH</text>
      <text x="60" y="364" fill="#f87171" font-family="sans-serif" font-size="10">PI2605120014308</text>
      <text x="170" y="364" fill="#e2e8f0" font-family="sans-serif" font-size="10">台北市南港區忠孝東路七段10號11樓之一</text>
      <text x="360" y="364" fill="#f87171" font-family="sans-serif" font-size="10">杜丞希</text>
      <text x="410" y="364" fill="#e2e8f0" font-family="sans-serif" font-size="10">冰箱&lt;350公升 + 電視&lt;50吋</text>
      <text x="510" y="364" fill="#e2e8f0" font-family="sans-serif" font-size="10">2026/05/23</text>
      <text x="580" y="364" fill="#e2e8f0" font-family="sans-serif" font-size="10">1500~1800</text>
      <text x="640" y="364" fill="#94a3b8" font-family="sans-serif" font-size="8">/電視上電檢測.自行壁掛</text>

      <!-- Row 9 -->
      <rect x="10" y="381" width="780" height="32" fill="#ef4444" fill-opacity="0.1" rx="3"/>
      <text x="20" y="401" fill="#f87171" font-family="sans-serif" font-size="10">PCH</text>
      <text x="60" y="401" fill="#f87171" font-family="sans-serif" font-size="10">PI2605170014034</text>
      <text x="170" y="401" fill="#e2e8f0" font-family="sans-serif" font-size="10">台北市南港區忠孝東路七段10號16樓之25</text>
      <text x="360" y="401" fill="#f87171" font-family="sans-serif" font-size="10">林韋志</text>
      <text x="410" y="401" fill="#e2e8f0" font-family="sans-serif" font-size="10">冰箱&lt;350 + 電視&gt;50吋 + 贈品</text>
      <text x="510" y="401" fill="#e2e8f0" font-family="sans-serif" font-size="10">2026/05/23</text>
      <text x="580" y="401" fill="#e2e8f0" font-family="sans-serif" font-size="10">1500~1800</text>
      <text x="640" y="401" fill="#94a3b8" font-family="sans-serif" font-size="8">/5-1.純配送(不安裝)</text>

      <!-- Row 10 -->
      <rect x="10" y="418" width="780" height="28" fill="#ef4444" fill-opacity="0.1" rx="3"/>
      <text x="20" y="434" fill="#f87171" font-family="sans-serif" font-size="10">PCH</text>
      <text x="60" y="434" fill="#f87171" font-family="sans-serif" font-size="10">PI2605210012398</text>
      <text x="170" y="434" fill="#e2e8f0" font-family="sans-serif" font-size="10">台北市內湖區康樂街72巷17弄28-1號3樓</text>
      <text x="360" y="434" fill="#f87171" font-family="sans-serif" font-size="10">許珮紋</text>
      <text x="410" y="434" fill="#e2e8f0" font-family="sans-serif" font-size="10">直立洗衣機&lt;16公斤(含)</text>
      <text x="510" y="434" fill="#e2e8f0" font-family="sans-serif" font-size="10">2026/05/23</text>
      <text x="580" y="434" fill="#e2e8f0" font-family="sans-serif" font-size="10">1500~1800</text>
      <text x="640" y="434" fill="#94a3b8" font-family="sans-serif" font-size="8">/1-1.基本安裝.舊機回收</text>
    </svg>`,
    mockData: {
      deliveryDate: '2026-05-23',
      items: [
        {
          seq: 1,
          orderId: 'PI2605210015828',
          channel: 'PCH',
          address: '台北市大同區承德路三段136號2樓',
          recipient: '林敏',
          phone: '0912-345-678',
          items: '冰箱>350公升 + 贈品',
          serviceType: '基本安裝 & 純配送',
          deliveryDate: '2026-05-23',
          deliveryTime: '0900~1200',
          sku: 'DPAC1T-A900FLZQU-000',
          remarks: '/2F(X).舊機回收.到前電聯/23-May-26【A】0900~1200'
        },
        {
          seq: 2,
          orderId: 'PI2605210023334',
          channel: 'PCH',
          address: '台北市大同區南京西路155巷8號1樓',
          recipient: '林清網',
          phone: '0922-111-222',
          items: '直立洗衣機<16公斤(含)',
          serviceType: '1-1.基本安裝',
          deliveryDate: '2026-05-23',
          deliveryTime: '0900~1200',
          sku: 'DPAI1I-A900GHIKD-000',
          remarks: '/到前電聯.舊機回收/23-May-26【A】0900~1200'
        },
        {
          seq: 3,
          orderId: 'PI2604140005645',
          channel: 'PCH',
          address: '台北市內湖區行善路111巷1號11樓',
          recipient: '陳聖凱',
          phone: '0933-987-654',
          items: '智控洗乾衣機 + 贈品*2',
          serviceType: '基本安裝 & 純配送',
          deliveryDate: '2026-05-23',
          deliveryTime: '1200~1500',
          sku: 'DPAI1L-A900GKFHW-000',
          remarks: '/裝潢延宕.客戶改約5/23 >30天 已填表/23-May-26【B】1200~1500'
        },
        {
          seq: 4,
          orderId: 'GGAE696889',
          channel: 'ASUS',
          address: '台北市松山區復興南路一段1號6樓之1',
          recipient: '林華珠',
          phone: '0988-123-456',
          items: '電競椅',
          serviceType: '1-1.基本安裝',
          deliveryDate: '2026-05-23',
          deliveryTime: '1200~1500',
          sku: 'SL400C ROG DESTRIER CORE 白',
          remarks: '/到前電聯.N-客戶指定/N/23-May-26【B】1200~1500'
        },
        {
          seq: 5,
          orderId: '2026050920140011801',
          channel: '486',
          address: '台北市南港區興中路80巷9號2樓',
          recipient: '蘇敏慧',
          phone: '0955-456-789',
          items: '滾筒乾衣機',
          serviceType: '1-1.基本安裝',
          deliveryDate: '2026-05-23',
          deliveryTime: '1200~1500',
          sku: 'GM-LG-WR20DW',
          remarks: 'N/A'
        },
        {
          seq: 6,
          orderId: 'PI2605210013442',
          channel: 'PCH',
          address: '台北市南港區忠孝東路七段10號15樓之43',
          recipient: '鄭慧妮',
          phone: '0977-654-321',
          items: '冰箱<350公升 + 贈品',
          serviceType: '基本安裝 & 純配送',
          deliveryDate: '2026-05-23',
          deliveryTime: '1200~1500',
          sku: 'DPAC1T-A900GQ6AD-000',
          remarks: '/到前電聯.N-客戶指定/N/23-May-26【B】1200~1500'
        },
        {
          seq: 7,
          orderId: 'T896510004',
          channel: 'CHE',
          address: '台北市南港區向陽路162巷66號11樓',
          recipient: '傅淑婷',
          phone: '0966-222-333',
          items: '按摩椅_一般',
          serviceType: '1-1.基本安裝',
          deliveryDate: '2026-05-23',
          deliveryTime: '1500~1800',
          sku: 'FG-936 AI愛沙發-萬永祿',
          remarks: 'FG-936 AI愛沙發-萬永祿'
        },
        {
          seq: 8,
          orderId: 'PI2605120014308',
          channel: 'PCH',
          address: '台北市南港區忠孝東路七段10號11樓之一',
          recipient: '杜丞希',
          phone: '0911-555-888',
          items: '冰箱<350公升(含) + 電視<50吋(含)',
          serviceType: '1-1.基本安裝',
          deliveryDate: '2026-05-23',
          deliveryTime: '1500~1800',
          sku: 'DPAC05-A900ICZ35-000',
          remarks: '/到前電聯.電視上電檢測.客戶會自行壁掛.N-客戶指定/N/23-May-26【C】1500~1800'
        },
        {
          seq: 9,
          orderId: 'PI2605170014034',
          channel: 'PCH',
          address: '台北市南港區忠孝東路七段10號16樓之25',
          recipient: '林韋志',
          phone: '0922-333-444',
          items: '冰箱<350公升(含) + 電視>50吋 + 贈品',
          serviceType: '5-1.純配送(不安裝)',
          deliveryDate: '2026-05-23',
          deliveryTime: '1500~1800',
          sku: 'DPACCI-A900G27DP-000',
          remarks: 'N/A'
        },
        {
          seq: 10,
          orderId: 'PI2605210012398',
          channel: 'PCH',
          address: '台北市內湖區康樂街72巷17弄28-1號3樓',
          recipient: '許珮紋',
          phone: '0933-444-555',
          items: '直立洗衣機<16公斤(含)',
          serviceType: '1-1.基本安裝',
          deliveryDate: '2026-05-23',
          deliveryTime: '1500~1800',
          sku: 'DPAIGJ-A900FAN3B-000',
          remarks: 'N/A'
        }
      ]
    }
  },
  {
    id: 'single_delivery_label',
    name: '新竹物流 配送簽收單 (單張格式)',
    description: '標準單站紙本託運單/配送簽收單，包含收件人詳細地址、電話及商品明細。',
    type: 'shipping_label',
    svgString: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="100%" height="100%">
      <rect width="800" height="450" fill="#f8fafc"/>
      <rect x="20" y="20" width="760" height="410" fill="#ffffff" stroke="#94a3b8" stroke-width="2" rx="6"/>
      
      <!-- HCT Header -->
      <rect x="20" y="20" width="760" height="60" fill="#0369a1" rx="4"/>
      <text x="40" y="58" fill="#ffffff" font-family="sans-serif" font-size="24" font-weight="bold">HCT 新竹物流 託運單</text>
      <text x="600" y="55" fill="#f0f9ff" font-family="monospace" font-size="16">編號: 853-2947-194</text>
      
      <!-- Barcode -->
      <rect x="40" y="100" width="300" height="50" fill="#0f172a"/>
      <rect x="45" y="100" width="4" height="50" fill="#ffffff"/>
      <rect x="55" y="100" width="6" height="50" fill="#ffffff"/>
      <rect x="70" y="100" width="8" height="50" fill="#ffffff"/>
      <rect x="85" y="100" width="3" height="50" fill="#ffffff"/>
      <rect x="100" y="100" width="12" height="50" fill="#ffffff"/>
      <rect x="120" y="100" width="5" height="50" fill="#ffffff"/>
      <rect x="140" y="100" width="9" height="50" fill="#ffffff"/>
      <rect x="160" y="100" width="4" height="50" fill="#ffffff"/>
      <rect x="180" y="100" width="7" height="50" fill="#ffffff"/>
      <rect x="200" y="100" width="10" height="50" fill="#ffffff"/>
      <rect x="220" y="100" width="3" height="50" fill="#ffffff"/>
      <text x="120" y="170" fill="#334155" font-family="monospace" font-size="12" text-anchor="middle">*8532947194*</text>
      
      <!-- Ship To Info -->
      <rect x="40" y="190" width="340" height="210" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1" rx="4"/>
      <text x="55" y="215" fill="#64748b" font-family="sans-serif" font-size="12" font-weight="bold">【收件人資訊】</text>
      <text x="55" y="245" fill="#0f172a" font-family="sans-serif" font-size="15" font-weight="bold">姓名: 張小明 先生</text>
      <text x="55" y="275" fill="#0f172a" font-family="sans-serif" font-size="15" font-weight="bold">電話: 0988-555-666</text>
      <text x="55" y="310" fill="#0f172a" font-family="sans-serif" font-size="14" font-weight="bold">地址: 台北市信義區信義路五段7號84樓</text>
      <text x="55" y="340" fill="#64748b" font-family="sans-serif" font-size="12">(台北101辦公大樓 - 請送至大廳收發室)</text>

      <!-- Ship From & Package Details -->
      <rect x="420" y="100" width="340" height="300" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1" rx="4"/>
      <text x="435" y="125" fill="#64748b" font-family="sans-serif" font-size="12" font-weight="bold">【寄件與貨件明細】</text>
      <text x="435" y="155" fill="#334155" font-family="sans-serif" font-size="14">寄件人: 鼎極智能家電有限公司</text>
      <line x1="435" y1="175" x2="745" y2="175" stroke="#e2e8f0" stroke-width="1"/>
      <text x="435" y="200" fill="#334155" font-family="sans-serif" font-size="14">指配日期: 2026/05/23</text>
      <text x="435" y="225" fill="#334155" font-family="sans-serif" font-size="14">指配時段: 1200~1500 (下午)</text>
      <text x="435" y="250" fill="#334155" font-family="sans-serif" font-size="14">品名: 智能掃地機器人 V12 Pro</text>
      <text x="435" y="275" fill="#334155" font-family="sans-serif" font-size="14">規格: 曜石黑 / 附贈清潔配件包</text>
      <text x="435" y="300" fill="#0284c7" font-family="sans-serif" font-size="14" font-weight="bold">服務類型: 送貨上樓 + 現場開箱測試</text>
      <rect x="435" y="325" width="310" height="60" fill="#f0f9ff" stroke="#e0f2fe" rx="3"/>
      <text x="445" y="345" fill="#0369a1" font-family="sans-serif" font-size="12" font-weight="bold">備註: 到達前請先電聯，收件人正在開會，</text>
      <text x="445" y="365" fill="#0369a1" font-family="sans-serif" font-size="12" font-weight="bold">若電話未接請聯繫大樓管理處代收。</text>
    </svg>`,
    mockData: {
      deliveryDate: '2026-05-23',
      items: [
        {
          seq: 1,
          orderId: '853-2947-194',
          channel: 'HCT',
          address: '台北市信義區信義路五段7號84樓',
          recipient: '張小明',
          phone: '0988-555-666',
          items: '智能掃地機器人 V12 Pro',
          serviceType: '送貨上樓 + 現場開箱測試',
          deliveryDate: '2026-05-23',
          deliveryTime: '1200~1500',
          sku: 'HCT-ROBO-V12P-BLK',
          remarks: '到達前請先電聯，收件人正在開會，若電話未接請聯繫大樓管理處代收。'
        }
      ]
    }
  }
];
