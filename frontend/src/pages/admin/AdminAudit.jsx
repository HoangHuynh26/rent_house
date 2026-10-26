import React, { useState, useEffect } from 'react';
import { ShieldAlert, RefreshCw, Clock } from 'lucide-react';
import api from '../../services/api';
import { formatDate } from '../../utils/formatters';

export default function AdminAudit() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/analytics/audit-logs');
      setLogs(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>Nhật Ký Kiểm Toán Hệ Thống</h1>
          <p style={{ fontSize: '14px', color: '#64748b' }}>
            Theo dõi chi tiết: Ai đã làm gì? Vào lúc nào? Dữ liệu cũ và mới? Địa chỉ IP truy cập?
          </p>
        </div>

        <button
          onClick={fetchLogs}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            background: '#f1f5f9',
            color: '#334155',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: '600'
          }}
        >
          <RefreshCw size={16} />
          Làm mới
        </button>
      </div>

      <div className="table-responsive">
        <table className="admin-table">
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700' }}>
              <th style={{ padding: '14px 18px' }}>Thời gian</th>
              <th style={{ padding: '14px 18px' }}>Người thực hiện</th>
              <th style={{ padding: '14px 18px' }}>Hành động</th>
              <th style={{ padding: '14px 18px' }}>Đối tượng</th>
              <th style={{ padding: '14px 18px' }}>IP / Thiết bị</th>
              <th style={{ padding: '14px 18px' }}>Chi tiết thay đổi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(6)].map((_, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {[...Array(6)].map((_, cIdx) => (
                    <td key={cIdx} style={{ padding: '14px 18px' }}>
                      <div
                        className="skeleton-box"
                        style={{
                          height: '16px',
                          width: cIdx === 0 ? '110px' : cIdx === 2 ? '70px' : cIdx === 5 ? '180px' : '90px',
                          borderRadius: '4px'
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : logs.length > 0 ? (
              logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '14px 18px', color: '#64748b', whiteSpace: 'nowrap' }}>
                    {formatDate(log.created_at)} {new Date(log.created_at).toLocaleTimeString('vi-VN')}
                  </td>
                  <td style={{ padding: '14px 18px', fontWeight: '700', color: '#0f172a' }}>
                    {log.actor_name || log.actor_type}
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <span style={{
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontWeight: '600',
                      fontSize: '12px'
                    }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ padding: '14px 18px', color: '#334155' }}>
                    {log.entity_type} {log.entity_id ? `(#${log.entity_id.slice(-6)})` : ''}
                  </td>
                  <td style={{ padding: '14px 18px', color: '#64748b' }}>
                    {log.ip || '127.0.0.1'}
                  </td>
                  <td style={{ padding: '14px 18px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <code style={{ fontSize: '11px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                      {log.new_data ? (typeof log.new_data === 'object' ? JSON.stringify(log.new_data) : log.new_data) : 'N/A'}
                    </code>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                  Chưa có nhật ký kiểm toán nào được ghi nhận.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
