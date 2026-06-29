import { useState } from 'react';
import { 
  Search, 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  X, 
  ChevronUp, 
  ChevronDown, 
  Download, 
  Copy, 
  AlertCircle,
  MapPin,
  Truck
} from 'lucide-react';
import type { DeliveryItem } from '../types';

interface AddressTableProps {
  items: DeliveryItem[];
  onUpdateItem: (id: string, updated: Partial<DeliveryItem>) => void;
  onDeleteItem: (id: string) => void;
  onDeleteMultipleItems: (ids: string[]) => void;
  onAddItem: (newItem: Omit<DeliveryItem, 'id' | 'status' | 'seq'>) => void;
  onReorderItems: (date: string, reordered: DeliveryItem[]) => void;
}

export default function AddressTable({
  items,
  onUpdateItem,
  onDeleteItem,
  onDeleteMultipleItems,
  onAddItem,
  onReorderItems
}: AddressTableProps) {
  type DeliveryStatus = DeliveryItem['status'];

  // Search and Filtering State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Date-based segmentation
  const uniqueDates = Array.from(new Set(items.map(item => item.deliveryDate))).filter(Boolean).sort();
  const [selectedDate, setSelectedDate] = useState<string>(uniqueDates[0] || new Date().toISOString().split('T')[0]);

  // Form expansion states
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [batchNewDate, setBatchNewDate] = useState('');

  // Inline edit state
  const [editForm, setEditForm] = useState<Partial<DeliveryItem>>({});

  // Manual Add Form State
  const [addForm, setAddForm] = useState({
    orderId: '',
    channel: 'PCH',
    address: '',
    recipient: '',
    phone: '',
    items: '',
    serviceType: '1-1.基本安裝',
    deliveryDate: selectedDate,
    deliveryTime: '0900~1200',
    sku: '',
    remarks: ''
  });

  // Filter items based on selected tab and search terms
  const filteredItems = items
    .filter(item => {
      // Date filter
      if (selectedDate && item.deliveryDate !== selectedDate) return false;
      
      // Status filter
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      
      // Search term filter
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        return (
          item.address.toLowerCase().includes(query) ||
          item.recipient.toLowerCase().includes(query) ||
          item.phone.toLowerCase().includes(query) ||
          item.items.toLowerCase().includes(query) ||
          item.orderId.toLowerCase().includes(query) ||
          item.remarks.toLowerCase().includes(query)
        );
      }
      return true;
    })
    .sort((a, b) => a.seq - b.seq);

  // Manual Adjust Stop Sequence (Up/Down)
  const moveItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= filteredItems.length) return;

    const reordered = [...filteredItems];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    // Recalculate sequences
    const updated = reordered.map((item, idx) => ({
      ...item,
      seq: idx + 1
    }));

    onReorderItems(selectedDate, updated);
  };

  // Inline Edit Row Handlers
  const startEditing = (item: DeliveryItem) => {
    setEditingId(item.id);
    setEditForm(item);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = () => {
    if (editingId && editForm) {
      onUpdateItem(editingId, editForm);
      setEditingId(null);
      setEditForm({});
    }
  };

  // Add Item Handler
  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.address) {
      alert('請填寫配送地址！');
      return;
    }

    onAddItem({
      ...addForm,
      deliveryDate: addForm.deliveryDate || selectedDate
    });

    // Reset Form
    setAddForm({
      orderId: '',
      channel: 'PCH',
      address: '',
      recipient: '',
      phone: '',
      items: '',
      serviceType: '1-1.基本安裝',
      deliveryDate: selectedDate,
      deliveryTime: '0900~1200',
      sku: '',
      remarks: ''
    });
    setShowAddForm(false);
  };

  // Batch actions
  const toggleSelectRow = (id: string) => {
    if (selectedRowIds.includes(id)) {
      setSelectedRowIds(selectedRowIds.filter(x => x !== id));
    } else {
      setSelectedRowIds([...selectedRowIds, id]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedRowIds.length === filteredItems.length) {
      setSelectedRowIds([]);
    } else {
      setSelectedRowIds(filteredItems.map(x => x.id));
    }
  };

  const handleBatchDelete = () => {
    if (selectedRowIds.length === 0) return;
    if (window.confirm(`確定要刪除選取的 ${selectedRowIds.length} 筆地址嗎？`)) {
      onDeleteMultipleItems(selectedRowIds);
      setSelectedRowIds([]);
    }
  };

  const handleBatchDateUpdate = () => {
    if (selectedRowIds.length === 0 || !batchNewDate) return;
    if (window.confirm(`確定要將選取的 ${selectedRowIds.length} 筆地址的配送日期改為 ${batchNewDate} 嗎？`)) {
      selectedRowIds.forEach(id => {
        onUpdateItem(id, { deliveryDate: batchNewDate });
      });
      setSelectedRowIds([]);
      setBatchNewDate('');
      setSelectedDate(batchNewDate);
    }
  };

  // Export features
  const exportToCSV = () => {
    if (filteredItems.length === 0) {
      alert('沒有配送地址可以導出！');
      return;
    }

    const headers = '順序,訂單編號,來源,地址,收件人,電話,品名,服務類型,指配時段,SKU,客戶備註,狀態\n';
    const rows = filteredItems.map(item => {
      return [
        item.seq,
        `"${item.orderId}"`,
        `"${item.channel}"`,
        `"${item.address}"`,
        `"${item.recipient}"`,
        `"${item.phone}"`,
        `"${item.items}"`,
        `"${item.serviceType}"`,
        `"${item.deliveryTime}"`,
        `"${item.sku}"`,
        `"${item.remarks.replace(/"/g, '""')}"`,
        `"${item.status}"`
      ].join(',');
    }).join('\n');

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(headers + rows);
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `配送清單_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyAddressesToClipboard = () => {
    if (filteredItems.length === 0) return;
    const addressList = filteredItems.map(item => item.address).join('\n');
    navigator.clipboard.writeText(addressList);
    alert('已成功將所有配送地址複製到剪貼簿，可直接貼到 Google Maps 批量查詢！');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Date-tab navigation selectors */}
      <div 
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px', flex: 1 }}>
          {uniqueDates.map(date => (
            <button
              key={date}
              onClick={() => { setSelectedDate(date); setSelectedRowIds([]); }}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: selectedDate === date ? 'rgba(6, 182, 212, 0.15)' : 'var(--bg-tertiary)',
                color: selectedDate === date ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                border: '1px solid',
                borderColor: selectedDate === date ? 'var(--accent-cyan)' : 'var(--card-border)',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'var(--transition-smooth)'
              }}
            >
              📅 {date} ({items.filter(x => x.deliveryDate === date).length} 站)
            </button>
          ))}
          
          {uniqueDates.length === 0 && (
            <div style={{ padding: '8px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>
              資料庫目前沒有地址，請先從「智慧辨識」導入或手動新增。
            </div>
          )}
        </div>

        {/* Manual Add Button */}
        <button 
          className="btn btn-primary"
          onClick={() => setShowAddForm(!showAddForm)}
          style={{ height: '38px', fontSize: '13px' }}
        >
          {showAddForm ? <X size={14} /> : <Plus size={14} />}
          {showAddForm ? '取消手動新增' : '手動新增地址'}
        </button>
      </div>

      {/* Manual Insertion Card */}
      {showAddForm && (
        <form 
          className="glass-panel" 
          onSubmit={handleAddItem}
          style={{
            padding: '20px',
            background: 'var(--bg-tertiary)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            border: '1px solid var(--accent-cyan)',
            boxShadow: '0 0 15px rgba(6, 182, 212, 0.1)'
          }}
        >
          <div style={{ gridColumn: 'span 2' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={16} color="var(--accent-cyan)" /> 手動新增配送站點
            </h4>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">配送日期</label>
            <input 
              type="date" 
              className="form-input" 
              value={addForm.deliveryDate} 
              onChange={e => setAddForm({...addForm, deliveryDate: e.target.value})}
              required
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">配送時段</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="如 0900~1200" 
              value={addForm.deliveryTime} 
              onChange={e => setAddForm({...addForm, deliveryTime: e.target.value})}
            />
          </div>

          <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
            <label className="form-label">完整配送地址 (台灣)</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="台北市信義區信義路五段7號" 
              value={addForm.address} 
              onChange={e => setAddForm({...addForm, address: e.target.value})}
              required
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">收件人姓名</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="張先生" 
              value={addForm.recipient} 
              onChange={e => setAddForm({...addForm, recipient: e.target.value})}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">聯絡電話</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="0912345678" 
              value={addForm.phone} 
              onChange={e => setAddForm({...addForm, phone: e.target.value})}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">品名描述</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="例: 洗衣機" 
              value={addForm.items} 
              onChange={e => setAddForm({...addForm, items: e.target.value})}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">服務安裝類型</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="例: 1-1.基本安裝" 
              value={addForm.serviceType} 
              onChange={e => setAddForm({...addForm, serviceType: e.target.value})}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">訂單編號 / 託運單號</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="N/A" 
              value={addForm.orderId} 
              onChange={e => setAddForm({...addForm, orderId: e.target.value})}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">來源管道</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="例: PCH" 
              value={addForm.channel} 
              onChange={e => setAddForm({...addForm, channel: e.target.value})}
            />
          </div>

          <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
            <label className="form-label">客戶備註 / 注意事項</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="例: 送達前先電聯" 
              value={addForm.remarks} 
              onChange={e => setAddForm({...addForm, remarks: e.target.value})}
            />
          </div>

          <div style={{ gridColumn: 'span 2', display: 'flex', justifySelf: 'end', gap: '12px', marginTop: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)}>取消</button>
            <button type="submit" className="btn btn-primary">確認新增</button>
          </div>
        </form>
      )}

      {/* Database Filters Dashboard */}
      <div 
        className="glass-panel"
        style={{
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
          background: 'rgba(15, 22, 42, 0.4)'
        }}
      >
        {/* Search & Status Filters */}
        <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '280px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search 
              size={16} 
              color="var(--text-muted)" 
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} 
            />
            <input
              type="text"
              placeholder="搜尋地址、收件人、品名或單號..."
              className="form-input"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '38px', fontSize: '13px' }}
            />
          </div>

          <select
            className="form-input"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ width: '130px', fontSize: '13px', cursor: 'pointer' }}
          >
            <option value="all">配送狀態 (全部)</option>
            <option value="pending">待配送</option>
            <option value="processing">配送中</option>
            <option value="completed">已送達</option>
          </select>
        </div>

        {/* Database Export actions */}
        {filteredItems.length > 0 && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-secondary" onClick={copyAddressesToClipboard} style={{ fontSize: '12px', padding: '8px 14px' }}>
              <Copy size={14} />
              複製地址
            </button>
            <button className="btn btn-secondary" onClick={exportToCSV} style={{ fontSize: '12px', padding: '8px 14px' }}>
              <Download size={14} />
              導出 CSV
            </button>
          </div>
        )}
      </div>

      {/* Batch Processing Bar */}
      {selectedRowIds.length > 0 && (
        <div 
          className="glass-panel"
          style={{
            padding: '12px 20px',
            background: 'rgba(139, 92, 246, 0.1)',
            border: '1px solid rgba(139, 92, 246, 0.25)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertCircle size={16} color="var(--accent-violet)" />
            <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600' }}>
              已選取 {selectedRowIds.length} 筆配送項目
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Batch Change Date form */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>移至日期:</span>
              <input 
                type="date" 
                className="form-input" 
                value={batchNewDate} 
                onChange={e => setBatchNewDate(e.target.value)}
                style={{ padding: '4px 8px', fontSize: '12px', width: '130px' }}
              />
              <button 
                className="btn btn-secondary" 
                onClick={handleBatchDateUpdate}
                disabled={!batchNewDate}
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                變更
              </button>
            </div>
            
            <div style={{ width: '1px', height: '20px', background: 'var(--card-border)' }} />

            <button 
              className="btn btn-danger" 
              onClick={handleBatchDelete}
              style={{ padding: '6px 12px', fontSize: '12px', background: 'rgba(244,63,94,0.2)' }}
            >
              <Trash2 size={14} />
              批次刪除
            </button>
          </div>
        </div>
      )}

      {/* Main Addresses Interactive Table */}
      <div className="table-container glass-panel" style={{ border: '1px solid var(--card-border)', background: 'var(--bg-secondary)' }}>
        <table className="custom-table">
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}>
                <input 
                  type="checkbox" 
                  checked={filteredItems.length > 0 && selectedRowIds.length === filteredItems.length}
                  onChange={toggleSelectAll}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th style={{ width: '70px', textAlign: 'center' }}>順序</th>
              <th style={{ width: '100px' }}>管道/單號</th>
              <th>配送地址 (台灣)</th>
              <th style={{ width: '110px' }}>收件人</th>
              <th style={{ width: '120px' }}>商品名 & 時段</th>
              <th style={{ width: '150px' }}>備註 / 安裝</th>
              <th style={{ width: '110px' }}>狀態</th>
              <th style={{ width: '100px', textAlign: 'right' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item, idx) => {
              const isEditing = editingId === item.id;
              
              return (
                <tr key={item.id} style={{ opacity: item.status === 'completed' ? 0.65 : 1 }}>
                  {/* Row selector checkmark */}
                  <td style={{ textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedRowIds.includes(item.id)}
                      onChange={() => toggleSelectRow(item.id)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  
                  {/* Seq and Reorder buttons */}
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      {!searchTerm && statusFilter === 'all' && (
                        <button 
                          onClick={() => moveItem(idx, 'up')} 
                          disabled={idx === 0}
                          style={{ background: 'transparent', border: 'none', color: idx === 0 ? 'var(--text-muted)' : 'var(--accent-cyan)', cursor: 'pointer', padding: 0 }}
                        >
                          <ChevronUp size={14} />
                        </button>
                      )}
                      
                      <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--accent-cyan)', margin: '2px 0' }}>
                        {item.seq}
                      </span>
                      
                      {!searchTerm && statusFilter === 'all' && (
                        <button 
                          onClick={() => moveItem(idx, 'down')} 
                          disabled={idx === filteredItems.length - 1}
                          style={{ background: 'transparent', border: 'none', color: idx === filteredItems.length - 1 ? 'var(--text-muted)' : 'var(--accent-cyan)', cursor: 'pointer', padding: 0 }}
                        >
                          <ChevronDown size={14} />
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Order detail */}
                  <td>
                    {isEditing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <input 
                          type="text" 
                          className="form-input" 
                          value={editForm.channel || ''} 
                          onChange={e => setEditForm({...editForm, channel: e.target.value})}
                          style={{ padding: '4px', fontSize: '12px' }}
                        />
                        <input 
                          type="text" 
                          className="form-input" 
                          value={editForm.orderId || ''} 
                          onChange={e => setEditForm({...editForm, orderId: e.target.value})}
                          style={{ padding: '4px', fontSize: '12px' }}
                        />
                      </div>
                    ) : (
                      <div>
                        <span className="badge badge-pending" style={{ fontSize: '9px', padding: '2px 5px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                          {item.channel}
                        </span>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80px' }}>
                          {item.orderId}
                        </div>
                      </div>
                    )}
                  </td>

                  {/* Address column */}
                  <td>
                    {isEditing ? (
                      <input 
                        type="text" 
                        className="form-input" 
                        value={editForm.address || ''} 
                        onChange={e => setEditForm({...editForm, address: e.target.value})}
                        style={{ padding: '6px', fontSize: '13px' }}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                        <MapPin size={14} color="var(--accent-cyan)" style={{ marginTop: '2px', flexShrink: 0 }} />
                        <div>
                          <div style={{ fontWeight: '500', fontSize: '13.5px', color: '#ffffff', lineHeight: 1.3 }}>
                            {item.address}
                          </div>
                          {item.latitude && item.longitude ? (
                            <span style={{ fontSize: '10px', color: 'var(--accent-emerald)', display: 'block', marginTop: '3px' }}>
                              ● GPS 已定位 ({item.latitude.toFixed(4)}, {item.longitude.toFixed(4)})
                            </span>
                          ) : (
                            <span style={{ fontSize: '10px', color: 'var(--accent-amber)', display: 'block', marginTop: '3px' }}>
                              ○ GPS 未定位 (地圖載入時會自動配對)
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </td>

                  {/* Recipient Name and Phone */}
                  <td>
                    {isEditing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <input 
                          type="text" 
                          className="form-input" 
                          value={editForm.recipient || ''} 
                          onChange={e => setEditForm({...editForm, recipient: e.target.value})}
                          style={{ padding: '4px', fontSize: '12px' }}
                        />
                        <input 
                          type="text" 
                          className="form-input" 
                          value={editForm.phone || ''} 
                          onChange={e => setEditForm({...editForm, phone: e.target.value})}
                          style={{ padding: '4px', fontSize: '12px' }}
                        />
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontWeight: '600', fontSize: '13px' }}>
                          {item.recipient === 'N/A' ? '未載明' : item.recipient}
                        </span>
                        {item.phone && item.phone !== 'N/A' && (
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            📞 {item.phone}
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Item Description & Service details */}
                  <td>
                    {isEditing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <input 
                          type="text" 
                          className="form-input" 
                          value={editForm.items || ''} 
                          onChange={e => setEditForm({...editForm, items: e.target.value})}
                          style={{ padding: '4px', fontSize: '12px' }}
                        />
                        <input 
                          type="text" 
                          className="form-input" 
                          value={editForm.deliveryTime || ''} 
                          onChange={e => setEditForm({...editForm, deliveryTime: e.target.value})}
                          style={{ padding: '4px', fontSize: '12px' }}
                        />
                      </div>
                    ) : (
                      <div>
                        <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                          {item.items}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--accent-indigo)', display: 'block', marginTop: '2px' }}>
                          🕒 {item.deliveryTime}
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Remarks details */}
                  <td>
                    {isEditing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <input 
                          type="text" 
                          className="form-input" 
                          value={editForm.serviceType || ''} 
                          onChange={e => setEditForm({...editForm, serviceType: e.target.value})}
                          style={{ padding: '4px', fontSize: '12px' }}
                        />
                        <input 
                          type="text" 
                          className="form-input" 
                          value={editForm.remarks || ''} 
                          onChange={e => setEditForm({...editForm, remarks: e.target.value})}
                          style={{ padding: '4px', fontSize: '12px' }}
                        />
                      </div>
                    ) : (
                      <div style={{ fontSize: '11.5px', lineHeight: 1.3 }}>
                        <span style={{ color: 'var(--text-secondary)', display: 'block', fontWeight: '600' }}>
                          {item.serviceType === 'N/A' ? '' : item.serviceType}
                        </span>
                        <span style={{ color: 'var(--text-muted)', display: 'block', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }} title={item.remarks}>
                          {item.remarks === 'N/A' ? '' : item.remarks}
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Status selection dropdown */}
                  <td>
                    {isEditing ? (
                      <select
                        className="form-input"
                        value={editForm.status || 'pending'}
                        onChange={e => setEditForm({...editForm, status: e.target.value as DeliveryStatus})}
                        style={{ padding: '4px', fontSize: '12px', cursor: 'pointer' }}
                      >
                        <option value="pending">待配送</option>
                        <option value="processing">配送中</option>
                        <option value="completed">已送達</option>
                      </select>
                    ) : (
                      <select
                        value={item.status}
                        onChange={e => onUpdateItem(item.id, { status: e.target.value as DeliveryStatus })}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '700',
                          border: 'none',
                          cursor: 'pointer',
                          background: item.status === 'completed' ? 'rgba(16, 185, 129, 0.1)' : item.status === 'processing' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                          color: item.status === 'completed' ? '#34d399' : item.status === 'processing' ? '#a78bfa' : '#fbbf24',
                          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)',
                          outline: 'none'
                        }}
                      >
                        <option value="pending" style={{ background: 'var(--bg-secondary)', color: '#fbbf24' }}>待配送</option>
                        <option value="processing" style={{ background: 'var(--bg-secondary)', color: '#a78bfa' }}>配送中</option>
                        <option value="completed" style={{ background: 'var(--bg-secondary)', color: '#34d399' }}>已送達</option>
                      </select>
                    )}
                  </td>

                  {/* Actions buttons */}
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      {isEditing ? (
                        <>
                          <button 
                            onClick={saveEdit}
                            style={{ background: 'transparent', border: 'none', color: 'var(--accent-emerald)', cursor: 'pointer' }}
                          >
                            <Save size={16} />
                          </button>
                          <button 
                            onClick={cancelEditing}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                          >
                            <X size={16} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button 
                            onClick={() => startEditing(item)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-cyan)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                          >
                            <Edit2 size={15} />
                          </button>
                          <button 
                            onClick={() => {
                              if (window.confirm('確定要刪除此配送地址嗎？')) {
                                onDeleteItem(item.id);
                              }
                            }}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-rose)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <Truck size={32} style={{ display: 'block', margin: '0 auto 12px', opacity: 0.3 }} />
                  沒有符合當前篩選條件的配送站點。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
    </div>
  );
}
