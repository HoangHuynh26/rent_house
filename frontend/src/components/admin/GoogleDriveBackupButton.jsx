import React, { useState } from 'react';
import { CloudUpload, CheckCircle2, RefreshCw, ExternalLink } from 'lucide-react';
import api from '../../services/api';

export default function GoogleDriveBackupButton({
  month = null,
  year = null,
  label = 'Lưu bản sao Google Drive',
  style = {},
}) {
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const handleQuickBackup = async () => {
    try {
      setSyncing(true);
      setLastResult(null);
      const reason =
        month && year
          ? `Admin bấm lưu bản sao Excel dự phòng từ giao diện quản trị (Tháng ${month}/${year})`
          : 'Admin chủ động lưu bản sao toàn bộ dữ liệu Excel lên Google Drive';

      const res = await api.post('/backup/sync', {
        month,
        year,
        createDriveExcelCopy: true,
        replaceSameMonthFile: false,
        reason,
      }, { timeout: 30000 });

      const data = res?.data;
      if (data?.simulated) {
        alert('Lần sao lưu đang chạy mô phỏng. Dữ liệu trên Google Sheets và Drive chưa được cập nhật.');
        return;
      }
      if (
        !data?.ok || !['success', 'warning'].includes(data.status)
        || data.clientSyncPayload || data.backgroundDispatched || data.requiresBrowserAuth
        || !Number.isInteger(data.totalRowsSynced) || data.totalRowsSynced <= 0
      ) {
        throw new Error('Google Apps Script chưa xác nhận đã ghi dữ liệu. Kiểm tra lịch sử sao lưu và cấu hình Web App.');
      }

      const driveFileUrl = data.driveExcelCreated ? data.driveFileUrl : null;
      const driveDatabaseFileUrl = data.driveDatabaseFileUrl;
      const url = driveFileUrl || driveDatabaseFileUrl || data.spreadsheetUrl;
      const label = driveFileUrl ? 'Mở file Excel vừa lưu'
        : driveDatabaseFileUrl ? 'Mở file dữ liệu (.json)' : 'Mở dữ liệu trên Google Sheets';
      if (url) setLastResult({ url, label });

      alert(data.warning || (driveFileUrl && driveDatabaseFileUrl
        ? res.message
        : `Đã ghi ${data.totalRowsSynced} dòng vào Google Sheets. Chưa xác nhận đủ file Excel và JSON trên Drive.`));
    } catch (err) {
      alert(err?.message || 'Không thể lưu bản sao lên Google Drive. Vui lòng kiểm tra cấu hình trong mục Sao lưu Google Drive.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <button
        type="button"
        onClick={handleQuickBackup}
        disabled={syncing}
        title="Đồng bộ dữ liệu lên Google Sheets và lưu file Excel, JSON trên Google Drive"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
          padding: '9px 14px',
          background: syncing ? '#64748b' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
          color: '#ffffff',
          border: 'none',
          borderRadius: '10px',
          fontSize: '13px',
          fontWeight: '700',
          cursor: syncing ? 'wait' : 'pointer',
          boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
          transition: 'all 0.15s',
          ...style,
        }}
      >
        {syncing ? <RefreshCw size={16} className="animate-spin" /> : <CloudUpload size={16} />}
        {syncing ? 'Đang lưu lên Drive...' : label}
      </button>

      {lastResult && (
        <a
          href={lastResult.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 10px',
            borderRadius: '8px',
            background: '#dcfce7',
            color: '#15803d',
            fontSize: '12px',
            fontWeight: '700',
            textDecoration: 'none',
            border: '1px solid #86efac',
          }}
        >
          <CheckCircle2 size={14} />
          {lastResult.label}
          <ExternalLink size={12} />
        </a>
      )}
    </div>
  );
}
