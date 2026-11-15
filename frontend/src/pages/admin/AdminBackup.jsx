import React, { useState, useEffect } from 'react';
import {
  CloudUpload,
  FileSpreadsheet,
  Download,
  ExternalLink,
  Database,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  HardDrive,
  Clock,
  Settings,
} from 'lucide-react';
import api from '../../services/api';

const DEFAULT_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/13oK6Jo1zQvKYuEhBU6tsDfNgl84lJjZePkNRYe-rotk/edit?usp=sharing';
const DEFAULT_WEBHOOK_URL =
  'https://script.google.com/macros/s/AKfycbz3gJhQ2khFr8UqoYCcGYGtyIUI6w5fN6ksfwKPjQmHD8F4Jy7qBE4mY9g7Sfuqdiew/exec';

export default function AdminBackup() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);

  const [counts, setCounts] = useState({});
  const [totalRows, setTotalRows] = useState(0);
  const [periodMonth, setPeriodMonth] = useState(new Date().getMonth() + 1);
  const [periodYear, setPeriodYear] = useState(new Date().getFullYear());
  const [lastBackup, setLastBackup] = useState(null);
  const [history, setHistory] = useState([]);

  const [sheetUrl, setSheetUrl] = useState(DEFAULT_SHEET_URL);
  const [webhookUrl, setWebhookUrl] = useState(DEFAULT_WEBHOOK_URL);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(true);

  const [banner, setBanner] = useState(null); // { type: 'success' | 'error', text, driveFileUrl, driveFolderUrl }
  const [appsScriptCode, setAppsScriptCode] = useState('');
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await api.get('/backup/status');
      const data = res?.data || {};
      setCounts(data.counts || {});
      setTotalRows(data.totalRows || 0);
      if (data.periodMonth) setPeriodMonth(data.periodMonth);
      if (data.periodYear) setPeriodYear(data.periodYear);
      setLastBackup(data.lastBackup || null);
      setHistory(data.history || []);
      if (data.settings) {
        setSheetUrl(data.settings.sheetUrl || DEFAULT_SHEET_URL);
        setWebhookUrl(data.settings.webhookUrl || DEFAULT_WEBHOOK_URL);
        setAutoBackupEnabled(data.settings.autoBackupEnabled !== false);
      }
    } catch (err) {
      setBanner({
        type: 'error',
        text: err?.message || 'Không thể tải thông tin sao lưu Google Drive.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      setSavingSettings(true);
      setBanner(null);
      const res = await api.put('/backup/settings', {
        sheetUrl,
        webhookUrl,
        autoBackupEnabled,
      });
      if (res?.data) {
        setSheetUrl(res.data.sheetUrl || sheetUrl);
        setWebhookUrl(res.data.webhookUrl || webhookUrl);
        setAutoBackupEnabled(res.data.autoBackupEnabled !== false);
      }
      setBanner({
        type: 'success',
        text: res?.message || 'Đã lưu cấu hình sao lưu Google Drive & Google Sheets thành công.',
      });
    } catch (err) {
      setBanner({
        type: 'error',
        text: err?.message || 'Lỗi khi lưu cấu hình sao lưu.',
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSyncToGoogleDrive = async (replaceSameMonthFile = false) => {
    try {
      setSyncing(true);
      setBanner(null);
      const res = await api.post('/backup/sync', {
        month: periodMonth,
        year: periodYear,
        createDriveExcelCopy: true,
        replaceSameMonthFile,
        sheetUrl,
        webhookUrl,
        reason: replaceSameMonthFile
          ? `Admin cập nhật bản Excel tháng ${periodMonth}/${periodYear} trên Google Drive`
          : `Admin chủ động lưu bản sao Excel dự phòng (T${periodMonth}/${periodYear})`,
      });

      const result = res?.data || {};
      setBanner({
        type: result.warning ? 'warning' : 'success',
        text: res?.message || 'Đã sao lưu toàn bộ dữ liệu lên Google Drive thành công!',
        driveFileUrl: result.driveFileUrl,
        driveFolderUrl: result.driveFolderUrl,
        spreadsheetUrl: result.spreadsheetUrl || sheetUrl,
      });
      await fetchStatus();
    } catch (err) {
      setBanner({
        type: 'error',
        text: err?.message || 'Không thể sao lưu lên Google Drive. Vui lòng kiểm tra mã Code.gs trong Apps Script.',
      });
      await fetchStatus();
    } finally {
      setSyncing(false);
    }
  };

  const handleDownloadOfflineExcel = async () => {
    try {
      setDownloadingExcel(true);
      const res = await api.get(`/backup/export-excel?mode=json&month=${periodMonth}&year=${periodYear}`);
      const payload = res?.data;
      if (!payload?.content) {
        throw new Error('Không nhận được dữ liệu file Excel từ máy chủ.');
      }

      const blob = new Blob([payload.content], {
        type: payload.mimeType || 'application/vnd.ms-excel;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = payload.filename || 'NhaTroThanhTam_SaoLuu.xls';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setBanner({
        type: 'error',
        text: err?.message || 'Không thể tải file Excel dự phòng.',
      });
    } finally {
      setDownloadingExcel(false);
    }
  };

  const handleLoadAppsScript = async () => {
    setShowScriptModal((prev) => !prev);
    if (appsScriptCode) return;
    try {
      const res = await api.get('/backup/apps-script');
      setAppsScriptCode(res?.data?.code || '');
    } catch {
      setAppsScriptCode('// Không tải được file google-apps-script/Code.gs từ backend.');
    }
  };

  const handleCopyCode = async () => {
    if (!appsScriptCode) return;
    try {
      await navigator.clipboard.writeText(appsScriptCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      // Fallback
    }
  };

  const summaryStats = [
    { label: 'Phòng trọ', value: counts.rooms ?? 0, color: '#2563eb', bg: '#eff6ff' },
    { label: 'Người thuê', value: counts.tenants ?? 0, color: '#7c3aed', bg: '#f5f3ff' },
    { label: 'Hợp đồng', value: counts.contracts ?? 0, color: '#059669', bg: '#ecfdf5' },
    { label: 'Chỉ số điện', value: counts.electricityReadings ?? 0, color: '#d97706', bg: '#fffbeb' },
    { label: 'Chỉ số nước', value: counts.waterReadings ?? 0, color: '#0284c7', bg: '#f0f9ff' },
    { label: 'Hóa đơn', value: counts.bills ?? 0, color: '#dc2626', bg: '#fef2f2' },
    { label: 'Thông báo', value: counts.notifications ?? 0, color: '#4f46e5', bg: '#eef2ff' },
    { label: 'Nhật ký', value: counts.auditLogs ?? 0, color: '#475569', bg: '#f8fafc' },
  ];

  const triggerLabels = {
    admin_manual: 'Admin bấm lưu bản sao',
    auto_billing_day10: 'Cron tự động ngày 10',
    electricity_reading_create: 'Ghi chỉ số điện mới',
    electricity_reading_verify: 'Duyệt chỉ số điện',
    water_reading_create: 'Ghi chỉ số nước mới',
    water_reading_verify: 'Duyệt chỉ số nước',
    monthly_bills_generate: 'Lập hóa đơn tháng',
    bill_status_update: 'Cập nhật thanh toán',
    bill_delete: 'Xóa hóa đơn',
    contract_create: 'Tạo hợp đồng mới',
    contract_update: 'Sửa hợp đồng',
    contract_admin_sign_final: 'Hoàn tất ký hợp đồng',
    contract_admin_sign_pending: 'Admin ký hợp đồng',
    room_create: 'Thêm phòng mới',
    room_update: 'Cập nhật phòng',
    room_delete: 'Xóa phòng',
    tenant_create: 'Thêm người thuê',
    tenant_update: 'Cập nhật người thuê',
    tenant_delete: 'Xóa người thuê',
    notification_create: 'Tạo thông báo mới',
    notification_update: 'Cập nhật thông báo',
    notification_delete: 'Xóa thông báo',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
        borderRadius: '20px',
        padding: '24px 28px',
        color: '#ffffff',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '18px',
        boxShadow: '0 10px 25px rgba(15, 23, 42, 0.14)',
      }}>
        <div style={{ maxWidth: '640px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <HardDrive size={24} color="#60a5fa" />
            <h1 style={{ fontSize: '22px', fontWeight: '800', margin: 0 }}>
              Sao Lưu Dữ Liệu Excel Lên Google Drive & Google Sheets
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: '14px', color: '#cbd5e1', lineHeight: '1.55' }}>
            Tự động đồng bộ toàn bộ dữ liệu hệ thống lên Google Sheets và tạo file Excel (<code>.xlsx</code>) trong thư mục{' '}
            <strong>Sao_Luu_Nha_Tro_Thanh_Tam</strong> trên Google Drive mỗi tháng khi có dữ liệu mới, hoặc chủ động lưu bản sao bất kỳ lúc nào.
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => handleSyncToGoogleDrive(false)}
            disabled={syncing || loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              background: syncing ? '#64748b' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '700',
              cursor: syncing ? 'wait' : 'pointer',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
            }}
          >
            {syncing ? <RefreshCw size={18} className="animate-spin" /> : <CloudUpload size={18} />}
            {syncing ? 'Đang sao lưu Excel lên Drive...' : 'Lưu bản sao lên Google Drive'}
          </button>

          <a
            href={sheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '11px 16px',
              background: 'rgba(255, 255, 255, 0.14)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.28)',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: '600',
              textDecoration: 'none',
            }}
          >
            <FileSpreadsheet size={16} />
            Mở Google Sheet
            <ExternalLink size={14} />
          </a>

          <button
            type="button"
            onClick={handleDownloadOfflineExcel}
            disabled={downloadingExcel}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '11px 16px',
              background: '#ffffff',
              color: '#0f172a',
              border: 'none',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: downloadingExcel ? 'wait' : 'pointer',
            }}
          >
            <Download size={16} />
            {downloadingExcel ? 'Đang tạo Excel...' : 'Tải Excel (.xls) về máy'}
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {banner && (
        <div style={{
          borderRadius: '14px',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
          background:
            banner.type === 'error'
              ? '#fef2f2'
              : banner.type === 'warning'
                ? '#fffbeb'
                : '#ecfdf5',
          border: `1px solid ${
            banner.type === 'error'
              ? '#fecaca'
              : banner.type === 'warning'
                ? '#fde68a'
                : '#a7f3d0'
          }`,
          color:
            banner.type === 'error'
              ? '#991b1b'
              : banner.type === 'warning'
                ? '#92400e'
                : '#065f46',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1 }}>
            {banner.type === 'error' || banner.type === 'warning' ? (
              <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
            ) : (
              <CheckCircle2 size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
            )}
            <div style={{ fontSize: '14px', fontWeight: '600', lineHeight: '1.5' }}>
              {banner.text}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '6px' }}>
                {banner.driveFileUrl && (
                  <a
                    href={banner.driveFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#047857', textDecoration: 'underline', fontWeight: '700', fontSize: '13px' }}
                  >
                    Mở file Excel (.xlsx) vừa tạo trên Google Drive →
                  </a>
                )}
                {banner.driveFolderUrl && (
                  <a
                    href={banner.driveFolderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#0369a1', textDecoration: 'underline', fontWeight: '700', fontSize: '13px' }}
                  >
                    Mở thư mục Drive sao lưu →
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Database Inventory Stats */}
      <div style={{
        background: '#ffffff',
        borderRadius: '18px',
        padding: '20px 24px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={18} color="#1e40af" />
            <h2 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: '#0f172a' }}>
              Toàn Bộ Dữ Liệu Sẽ Được Sao Lưu (9 Sheet Excel • Tổng {totalRows} dòng)
            </h2>
          </div>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>
            Kỳ hiện tại: Tháng {periodMonth}/{periodYear}
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))',
          gap: '12px',
        }}>
          {summaryStats.map((stat) => (
            <div
              key={stat.label}
              style={{
                background: stat.bg,
                borderRadius: '12px',
                padding: '12px 14px',
                border: '1px solid rgba(15, 23, 42, 0.06)',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>{stat.label}</div>
              <div style={{ fontSize: '22px', fontWeight: '800', color: stat.color, marginTop: '4px' }}>
                {loading ? '...' : stat.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Settings Form + Apps Script Drawer */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '20px',
      }}>
        <form
          onSubmit={handleSaveSettings}
          style={{
            background: '#ffffff',
            borderRadius: '18px',
            padding: '22px 24px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={18} color="#0f172a" />
            <h2 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: '#0f172a' }}>
              Cấu Hình Link Google Sheet & Apps Script
            </h2>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Link Google Sheet lưu dữ liệu
            </label>
            <input
              type="url"
              required
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/.../edit"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                color: '#0f172a',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Link Web App Google Apps Script (/exec)
            </label>
            <input
              type="url"
              required
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                color: '#0f172a',
              }}
            />
          </div>

          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 12px',
            borderRadius: '10px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '600',
            color: '#1e293b',
          }}>
            <input
              type="checkbox"
              checked={autoBackupEnabled}
              onChange={(e) => setAutoBackupEnabled(e.target.checked)}
              style={{ width: '16px', height: '16px' }}
            />
            Tự động sao lưu Google Sheet & file Excel (.xlsx) theo tháng khi có dữ liệu mới
          </label>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
            <button
              type="submit"
              disabled={savingSettings}
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                background: '#1e40af',
                color: '#ffffff',
                border: 'none',
                fontWeight: '700',
                fontSize: '13px',
                cursor: savingSettings ? 'wait' : 'pointer',
              }}
            >
              {savingSettings ? 'Đang lưu...' : 'Lưu cấu hình liên kết'}
            </button>

            <button
              type="button"
              onClick={handleLoadAppsScript}
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                background: '#f1f5f9',
                color: '#0f172a',
                border: '1px solid #cbd5e1',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {showScriptModal ? 'Ẩn code Google Apps Script' : 'Xem & Sao chép Code.gs'}
            </button>
          </div>
        </form>

        {/* Last Backup Summary */}
        <div style={{
          background: '#ffffff',
          borderRadius: '18px',
          padding: '22px 24px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '14px',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Clock size={18} color="#059669" />
              <h2 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: '#0f172a' }}>
                Trạng Thái Bản Sao Lưu Gần Nhất
              </h2>
            </div>

            {lastBackup ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13.5px', color: '#334155' }}>
                <div>
                  <strong>Thời gian:</strong>{' '}
                  {new Date(lastBackup.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
                </div>
                <div>
                  <strong>Nguồn:</strong> {triggerLabels[lastBackup.triggerSource] || lastBackup.triggerSource}
                </div>
                <div>
                  <strong>Lý do:</strong> {lastBackup.reason}
                </div>
                <div>
                  <strong>Số dòng đã đồng bộ:</strong> {lastBackup.totalRowsSynced} dòng
                </div>
                <div>
                  <strong>Trạng thái:</strong>{' '}
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: '700',
                    background: lastBackup.status === 'error' ? '#fee2e2' : '#dcfce7',
                    color: lastBackup.status === 'error' ? '#b91c1c' : '#15803d',
                  }}>
                    {lastBackup.status === 'error' ? 'Lỗi kết nối' : lastBackup.simulated ? 'Mô phỏng (Test)' : 'Thành công'}
                  </span>
                </div>
                {lastBackup.driveFileUrl && (
                  <div style={{ marginTop: '4px' }}>
                    <a
                      href={lastBackup.driveFileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#2563eb', fontWeight: '700', textDecoration: 'underline' }}
                    >
                      Tải / Xem file {lastBackup.driveFileName || 'Excel Drive'} →
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ fontSize: '13.5px', color: '#64748b', lineHeight: '1.6' }}>
                Chưa có bản ghi sao lưu nào từ hệ thống hiện tại. Nhấn{' '}
                <strong>"Lưu bản sao lên Google Drive"</strong> ở trên để đẩy toàn bộ dữ liệu và tạo file Excel đầu tiên.
              </p>
            )}
          </div>

          <div style={{
            padding: '10px 12px',
            borderRadius: '10px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            fontSize: '12.5px',
            color: '#475569',
            lineHeight: '1.5',
          }}>
            <strong>Cơ chế tự động theo tháng:</strong> Khi Admin nhập chỉ số điện/nước, lập hóa đơn tháng, chạy cron ngày 10 hoặc thêm phòng/khách/hợp đồng, dữ liệu mới tự động đồng bộ vào Google Sheet và cập nhật file Excel tháng (<code>.xlsx</code>) trong Google Drive.
          </div>
        </div>
      </div>

      {/* Collapsible Apps Script Source Viewer */}
      {showScriptModal && (
        <div style={{
          background: '#0f172a',
          borderRadius: '18px',
          padding: '20px 24px',
          color: '#e2e8f0',
          border: '1px solid #334155',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#ffffff' }}>
                Mã Nguồn Google Apps Script (google-apps-script/Code.gs)
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#94a3b8' }}>
                Dán vào Google Apps Script → Chạy hàm <code>testSetupPermissions</code> 1 lần để cấp quyền → Triển khai Phiên bản mới (Anyone).
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyCode}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '10px',
                background: copiedCode ? '#059669' : '#2563eb',
                color: '#ffffff',
                border: 'none',
                fontWeight: '700',
                fontSize: '12.5px',
                cursor: 'pointer',
              }}
            >
              {copiedCode ? <Check size={15} /> : <Copy size={15} />}
              {copiedCode ? 'Đã sao chép Code.gs' : 'Sao chép toàn bộ'}
            </button>
          </div>
          <pre style={{
            maxHeight: '360px',
            overflow: 'auto',
            background: '#020617',
            padding: '14px',
            borderRadius: '12px',
            fontSize: '12px',
            lineHeight: '1.5',
            color: '#a5f3fc',
            margin: 0,
          }}>
            {appsScriptCode || 'Đang tải mã nguồn...'}
          </pre>
        </div>
      )}

      {/* Backup History Table */}
      <div style={{
        background: '#ffffff',
        borderRadius: '18px',
        padding: '22px 24px',
        border: '1px solid #e2e8f0',
        overflowX: 'auto',
      }}>
        <h2 style={{ fontSize: '16px', fontWeight: '800', margin: '0 0 14px', color: '#0f172a' }}>
          Lịch Sử Sao Lưu Gần Đây
        </h2>
        {history.length === 0 ? (
          <p style={{ margin: 0, fontSize: '13.5px', color: '#64748b' }}>Chưa có lịch sử sao lưu nào.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px', fontWeight: '700', color: '#475569' }}>Thời gian</th>
                <th style={{ padding: '10px 12px', fontWeight: '700', color: '#475569' }}>Nguồn</th>
                <th style={{ padding: '10px 12px', fontWeight: '700', color: '#475569' }}>Kỳ</th>
                <th style={{ padding: '10px 12px', fontWeight: '700', color: '#475569' }}>Lý do / File Excel Drive</th>
                <th style={{ padding: '10px 12px', fontWeight: '700', color: '#475569' }}>Số dòng</th>
                <th style={{ padding: '10px 12px', fontWeight: '700', color: '#475569' }}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#334155' }}>
                    {new Date(item.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: '600', color: '#0f172a' }}>
                    {triggerLabels[item.triggerSource] || item.triggerSource}
                  </td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#334155' }}>
                    {item.periodMonth && item.periodYear ? `T${item.periodMonth}/${item.periodYear}` : 'Tất cả'}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#475569' }}>
                    <div>{item.reason}</div>
                    {item.driveFileUrl && (
                      <a
                        href={item.driveFileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '12px', color: '#2563eb', fontWeight: '600' }}
                      >
                        📄 {item.driveFileName || 'Xem file Excel trên Drive'}
                      </a>
                    )}
                    {item.error && (
                      <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '2px' }}>{item.error}</div>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: '700', color: '#0f172a' }}>
                    {item.totalRowsSynced}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 9px',
                      borderRadius: '999px',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      background: item.status === 'error' ? '#fee2e2' : '#dcfce7',
                      color: item.status === 'error' ? '#b91c1c' : '#15803d',
                    }}>
                      {item.status === 'error' ? 'Thất bại' : item.simulated ? 'Test' : 'Hoàn tất'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
