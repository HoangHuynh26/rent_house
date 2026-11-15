import React, { useState } from 'react';
import { CloudUpload, CheckCircle2, RefreshCw, ExternalLink } from 'lucide-react';
import api from '../../services/api';

const DEFAULT_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/13oK6Jo1zQvKYuEhBU6tsDfNgl84lJjZePkNRYe-rotk/edit?usp=sharing';

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
      });

      const data = res?.data || {};
      if (data.clientSyncPayload && data.webhookUrl) {
        try {
          await fetch(data.webhookUrl, {
            method: 'POST',
            mode: 'no-cors',
            credentials: 'include',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(data.clientSyncPayload),
          });
        } catch (browserErr) {
          console.warn('[Browser Apps Script Sync Fallback]:', browserErr);
        }
      }

      setLastResult({
        ok: true,
        url: data.driveFileUrl || data.spreadsheetUrl || DEFAULT_SHEET_URL,
        fileName: data.driveFileName,
      });
      alert(res?.message || 'Đã lưu bản sao dữ liệu Excel lên Google Drive thành công!');
    } catch (err) {
      if (err?.details?.clientSyncPayload && err?.details?.webhookUrl) {
        try {
          await fetch(err.details.webhookUrl, {
            method: 'POST',
            mode: 'no-cors',
            credentials: 'include',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(err.details.clientSyncPayload),
          });
        } catch (browserErr) {
          console.warn('[Browser Apps Script Sync Fallback]:', browserErr);
        }
      }
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
        title="Đồng bộ toàn bộ dữ liệu lên Google Sheets & lưu file Excel (.xlsx) lên Google Drive"
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

      {lastResult?.ok && (
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
          Mở bản sao vừa lưu
          <ExternalLink size={12} />
        </a>
      )}
    </div>
  );
}
