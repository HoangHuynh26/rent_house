import React, { useState, useEffect, useRef } from 'react';
import {
  Camera, Zap, ZapOff, Upload, CheckCircle2, AlertTriangle,
  Droplet, Eye, Check, X, RefreshCw, Image, FileText,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Calendar, Filter, RotateCcw, Trash2
} from 'lucide-react';
import api, { getFullApiUrl } from '../../services/api';
import { formatCurrency, formatNumber, parseNumber, formatDateTime } from '../../utils/formatters';

export default function AdminMeters() {
  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [readingType, setReadingType] = useState('electricity'); // 'electricity' | 'water'
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  // History table filters
  const [historyMonth, setHistoryMonth] = useState('all');
  const [historyYear, setHistoryYear] = useState('all');

  // Image upload state
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadedImageId, setUploadedImageId] = useState(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState(null);

  // Camera & Flash state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [showGalleryUpload, setShowGalleryUpload] = useState(false);

  // Manual reading inputs (entered by admin)
  const [previousValue, setPreviousValue] = useState(1250);
  const [officialValue, setOfficialValue] = useState('');
  const [isMeterReset, setIsMeterReset] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // History list
  const [recentReadings, setRecentReadings] = useState([]);
  const [masterBreakdown, setMasterBreakdown] = useState(null);

  // Late image attachment modal
  const [attachModalOpen, setAttachModalOpen] = useState(false);
  const [targetReading, setTargetReading] = useState(null);
  const [attachFile, setAttachFile] = useState(null);
  const [attachPreviewUrl, setAttachPreviewUrl] = useState(null);
  const [attaching, setAttaching] = useState(false);

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const nativeCameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const attachNativeCameraRef = useRef(null);
  const attachGalleryInputRef = useRef(null);

  useEffect(() => {
    fetchRooms();
  }, []);

  useEffect(() => {
    if (selectedRoomId) {
      fetchHistory();
    }
  }, [selectedRoomId, readingType]);

  // Attach media stream to <video> once the viewfinder element mounts
  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraActive]);

  // Cleanup camera stream when component unmounts
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const fetchRooms = async () => {
    try {
      const res = await api.get('/rooms');
      // Include all non-inactive rooms (active building rooms: occupied, with tenant, or available)
      const activeRooms = (res.data || []).filter(r => r.status !== 'inactive');
      setRooms(activeRooms);
      if (activeRooms.length > 0) {
        setSelectedRoomId(prev => prev || activeRooms[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const updatePreviousValueForPeriod = (history, targetMonth, targetYear) => {
    if (!history || history.length === 0) {
      setPreviousValue(readingType === 'electricity' ? 1250 : 64);
      return;
    }
    const m = Number(targetMonth);
    const y = Number(targetYear);

    // Sort descending: year then month
    const sorted = [...history].sort((a, b) => 
      Number(b.reading_year) - Number(a.reading_year) || 
      Number(b.reading_month) - Number(a.reading_month)
    );

    // Check if this month & year already recorded
    const exact = sorted.find(r => Number(r.reading_month) === m && Number(r.reading_year) === y);
    if (exact) {
      const prevValStr = exact.previous_value !== null && exact.previous_value !== undefined ? String(exact.previous_value) : '0';
      const currValStr = exact.current_value !== null && exact.current_value !== undefined ? String(exact.current_value) : '';
      setPreviousValue(prevValStr);
      setOfficialValue(currValStr);
      const prevNum = parseNumber(prevValStr);
      const currNum = parseNumber(currValStr);
      setIsMeterReset(Boolean(exact.is_meter_reset && currNum < prevNum));
      return;
    }

    // Find closest recorded reading prior to target period
    const prior = sorted.find(r => 
      Number(r.reading_year) < y || 
      (Number(r.reading_year) === y && Number(r.reading_month) < m)
    );

    if (prior) {
      setPreviousValue(prior.current_value !== null && prior.current_value !== undefined ? String(prior.current_value) : '0');
    } else {
      const earliest = sorted[sorted.length - 1];
      setPreviousValue(earliest ? String(earliest.previous_value) : (readingType === 'electricity' ? '1250' : '64'));
    }
    setOfficialValue('');
    setIsMeterReset(false);
  };

  useEffect(() => {
    if (recentReadings.length > 0) {
      updatePreviousValueForPeriod(recentReadings, month, year);
    }
  }, [month, year, readingType]);

  const fetchMasterBreakdown = async (targetMonth = month, targetYear = year) => {
    try {
      const res = await api.get(`/readings/water/master-breakdown?month=${targetMonth}&year=${targetYear}`);
      setMasterBreakdown(res.data);
    } catch (e) {
      console.warn('Could not fetch master water breakdown:', e);
      setMasterBreakdown(null);
    }
  };

  useEffect(() => {
    if (readingType === 'water') {
      fetchMasterBreakdown(month, year);
    } else {
      setMasterBreakdown(null);
    }
  }, [month, year, readingType, selectedRoomId]);

  const fetchHistory = async () => {
    try {
      const endpoint = readingType === 'electricity' ? '/readings/electricity/history' : '/readings/water/history';
      const res = await api.get(`${endpoint}?roomId=${selectedRoomId}`);
      const history = res.data || [];
      setRecentReadings(history);
      updatePreviousValueForPeriod(history, month, year);
      if (readingType === 'water') {
        fetchMasterBreakdown(month, year);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteReading = async (reading) => {
    const typeLabel = readingType === 'electricity' ? 'Điện' : 'Nước';
    const unitLabel = readingType === 'electricity' ? 'kWh' : 'm³';
    const confirmMsg = `Bạn có chắc chắn muốn XÓA chỉ số ${typeLabel} Tháng ${reading.reading_month}/${reading.reading_year} của phòng này không?\n\n- Chỉ số cũ: ${formatNumber(reading.previous_value)}\n- Chỉ số mới: ${formatNumber(reading.current_value)} (${formatNumber(reading.consumption)} ${unitLabel})\n- Số tiền: ${formatCurrency(reading.amount)}\n\nSau khi xóa, bạn có thể chụp ảnh hoặc nhập lại chỉ số mới cho tháng này.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const endpoint = readingType === 'electricity'
        ? `/readings/electricity/${reading.id}`
        : `/readings/water/${reading.id}`;
      await api.delete(endpoint);
      setSuccessMsg(`Đã xóa chỉ số ${typeLabel} Tháng ${reading.reading_month}/${reading.reading_year} thành công!`);
      await fetchHistory();
    } catch (err) {
      alert(err.response?.data?.message || err.message || `Lỗi khi xóa chỉ số ${typeLabel}.`);
    }
  };

  // ==========================================================================
  // DIRECT CAMERA & FLASH CONTROLS (OPTIMIZED FOR MOBILE)
  // ==========================================================================

  const startCamera = async () => {
    setCameraError('');
    setSuccessMsg('');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Trình duyệt không hỗ trợ trực tiếp camera. Vui lòng dùng nút Chụp Camera hệ thống.');
      }

      // Stop any existing stream
      stopCamera();

      // Request rear camera with ideal high resolution
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Check hardware torch support
      const track = stream.getVideoTracks()[0];
      if (track) {
        const capabilities = track.getCapabilities ? track.getCapabilities() : {};
        const supportsTorch = !!capabilities.torch;
        setTorchSupported(supportsTorch);

        // Turn on flash by default for optimal meter detail if supported
        if (supportsTorch) {
          try {
            await track.applyConstraints({ advanced: [{ torch: true }] });
            setTorchOn(true);
          } catch (tErr) {
            console.warn('Auto torch on error:', tErr);
          }
        }
      }

      setCameraActive(true);
    } catch (err) {
      console.error('[Start Camera Error]:', err);
      setCameraError(err.message || 'Không thể truy cập máy ảnh. Vui lòng cấp quyền hoặc dùng Camera hệ thống.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks();
      tracks.forEach(track => {
        if (track.readyState === 'live') {
          // Turn off torch before stopping
          try {
            track.applyConstraints({ advanced: [{ torch: false }] });
          } catch (e) {}
          track.stop();
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setTorchOn(false);
  };

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    const nextState = !torchOn;
    try {
      if ('applyConstraints' in track) {
        await track.applyConstraints({
          advanced: [{ torch: nextState }]
        });
      }
      setTorchOn(nextState);
    } catch (err) {
      console.warn('Toggle torch failed:', err);
      // Still toggle local state as software indicator
      setTorchOn(nextState);
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Use actual video source dimensions for high-res crisp OCR
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    // Convert canvas to blob
    canvas.toBlob((blob) => {
      if (!blob) return;
      const capturedFile = new File([blob], `meter_${Date.now()}.jpg`, { type: 'image/jpeg' });
      setFile(capturedFile);
      setPreviewUrl(URL.createObjectURL(blob));
      
      // Stop live stream after photo taken to save battery & device heat
      stopCamera();

      // Trigger photo upload immediately while admin reads & writes the meter number
      handleUploadPhoto(capturedFile);
    }, 'image/jpeg', 0.92);
  };

  const handleClearPhoto = () => {
    setFile(null);
    setPreviewUrl(null);
    setUploadedImageId(null);
    setUploadedImageUrl(null);
  };

  // ==========================================================================
  // METER PHOTO UPLOAD (PERSISTED TO DATABASE)
  // ==========================================================================

  const handleUploadPhoto = async (fileToProcess) => {
    const targetFile = fileToProcess || file;
    if (!targetFile || !selectedRoomId) {
      alert('Vui lòng chọn phòng và tệp ảnh đồng hồ.');
      return;
    }

    setUploadingPhoto(true);
    setSuccessMsg('');

    try {
      const formData = new FormData();
      formData.append('meter', targetFile);
      formData.append('room_id', selectedRoomId);
      formData.append('reading_type', readingType);

      const uploadRes = await api.post('/meter-images/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const responseData = uploadRes.data;
      setUploadedImageId(responseData.id);
      setUploadedImageUrl(getFullApiUrl(responseData.image_url || `/api/meter-images/${responseData.id}/image`));
    } catch (err) {
      console.error('[Upload Photo Error]:', err);
      alert(err.message || 'Lỗi khi tải ảnh đồng hồ.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
      stopCamera();
      handleUploadPhoto(selected);
    }
  };

  // ==========================================================================
  // APPROVE READING (ADMIN ENTERS NUMBER WITH OPTIONAL METER PHOTO)
  // ==========================================================================

  const handleApproveReading = async () => {
    if (officialValue === '' || officialValue === null || officialValue === undefined) {
      alert('Vui lòng nhập chỉ số chính thức.');
      return;
    }

    const prevNum = parseNumber(previousValue);
    const currNum = parseNumber(officialValue);

    if (currNum < prevNum && !isMeterReset) {
      alert(`Chỉ số mới (${currNum}) nhỏ hơn chỉ số cũ (${prevNum}). Vui lòng kiểm tra lại hoặc tích chọn "Xác nhận đồng hồ quay vòng về 0 hoặc đã thay mới".`);
      return;
    }

    const effectiveIsReset = Boolean(isMeterReset && currNum < prevNum);
    const selectedRoom = rooms.find(r => r.id === selectedRoomId);
    const roomElecPrice = selectedRoom?.electricity_price ? Number(selectedRoom.electricity_price) : 3000;
    const roomWaterPrice = selectedRoom?.water_price ? Number(selectedRoom.water_price) : 12000;
    const activeUnitPrice = readingType === 'electricity' ? roomElecPrice : roomWaterPrice;

    setSubmitting(true);
    try {
      const persistentImageUrl = uploadedImageUrl || (uploadedImageId ? `/api/meter-images/${uploadedImageId}/image` : null);

      const payload = {
        room_id: selectedRoomId,
        tenant_id: selectedRoom?.current_tenant_id || null,
        meter_image_id: uploadedImageId || null,
        reading_month: month,
        reading_year: year,
        previous_value: prevNum,
        current_value: currNum,
        unit_price: activeUnitPrice,
        image_url: persistentImageUrl,
        is_meter_reset: effectiveIsReset
      };

      const endpoint = readingType === 'electricity' ? '/readings/electricity' : '/readings/water';
      const res = await api.post(endpoint, payload);

      // Immediately verify it as admin
      const verifyEndpoint = readingType === 'electricity'
        ? `/readings/electricity/${res.data.id}/verify`
        : `/readings/water/${res.data.id}/verify`;

      await api.post(verifyEndpoint, {
        current_value: currNum,
        previous_value: prevNum,
        unit_price: activeUnitPrice,
        is_meter_reset: effectiveIsReset
      });

      const imageNote = persistentImageUrl ? 'kèm ảnh đồng hồ' : '(Chưa có ảnh - có thể bổ sung sau)';
      setSuccessMsg(`Đã lưu và phê duyệt chỉ số ${readingType === 'electricity' ? 'Điện' : 'Nước'} kỳ Tháng ${month}/${year} thành công ${imageNote}!`);

      // Reset photo state for next reading
      setFile(null);
      setPreviewUrl(null);
      setUploadedImageId(null);
      setUploadedImageUrl(null);
      fetchHistory();
    } catch (err) {
      alert(err.message || 'Lỗi lưu chỉ số.');
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================================================
  // LATE IMAGE ATTACHMENT FLOW
  // ==========================================================================

  const openAttachModal = (reading) => {
    setTargetReading(reading);
    setAttachFile(null);
    setAttachPreviewUrl(null);
    setAttachModalOpen(true);
  };

  const handleAttachFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setAttachFile(selected);
      setAttachPreviewUrl(URL.createObjectURL(selected));
    }
  };

  const submitAttachImage = async () => {
    if (!attachFile || !targetReading) {
      alert('Vui lòng chọn hoặc chụp ảnh để bổ sung.');
      return;
    }

    setAttaching(true);
    try {
      const formData = new FormData();
      formData.append('meter', attachFile);
      formData.append('room_id', targetReading.room_id);
      formData.append('reading_type', readingType);
      formData.append('reading_id', targetReading.id);

      await api.post('/meter-images/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setSuccessMsg('Đã bổ sung ảnh vào kỳ đo thành công!');
      setAttachModalOpen(false);
      setTargetReading(null);
      setAttachFile(null);
      setAttachPreviewUrl(null);
      fetchHistory();
    } catch (err) {
      alert(err.message || 'Không thể bổ sung ảnh.');
    } finally {
      setAttaching(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Hidden canvas for video stream snapshot */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Hidden inputs for direct native camera & gallery */}
      <input
        type="file"
        ref={nativeCameraInputRef}
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <input
        type="file"
        ref={galleryInputRef}
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>
              Chụp Ảnh &amp; Ghi Chỉ Số Điện Nước
            </h1>
            <p style={{ fontSize: '14px', color: '#64748b' }}>
              Chủ nhà chụp ảnh đồng hồ trực tiếp (hỗ trợ đèn Flash) và tự nhập chỉ số đối chiếu minh bạch
            </p>
          </div>
        </div>
      </div>

      {successMsg && (
        <div style={{ padding: '16px', background: '#dcfce7', border: '1px solid #86efac', borderRadius: '14px', color: '#15803d', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CheckCircle2 size={24} />
          <span style={{ fontWeight: '700', fontSize: '15px' }}>{successMsg}</span>
        </div>
      )}

      {/* Main Grid: Mobile-First Direct Camera & Photo Capture | Side-by-Side Review */}
      <div className="admin-grid-2col">
        {/* Left Column: Direct Camera Capture & Controls */}
        <div style={{ background: '#ffffff', borderRadius: '18px', border: '1px solid #e2e8f0', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Camera size={22} color="#2563eb" />
              1. Chụp ảnh đồng hồ trực tiếp
            </h2>

            {/* Flash/Torch status pill */}
            {cameraActive && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`camera-torch-btn ${torchOn ? 'active' : ''}`}
                title="Bật/tắt đèn Flash"
              >
                {torchOn ? <Zap size={16} fill="#000" /> : <ZapOff size={16} />}
                <span>{torchOn ? 'Đèn Flash: BẬT' : 'Đèn Flash: TẮT'}</span>
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Reading Type Toggle */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setReadingType('electricity')}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px',
                  borderRadius: '12px',
                  background: readingType === 'electricity' ? '#fef3c7' : '#f8fafc',
                  border: readingType === 'electricity' ? '2px solid #f59e0b' : '1px solid #e2e8f0',
                  color: readingType === 'electricity' ? '#b45309' : '#64748b',
                  fontWeight: '700'
                }}
              >
                <Zap size={20} />
                Đồng hồ Điện (kWh)
              </button>

              <button
                type="button"
                onClick={() => setReadingType('water')}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px',
                  borderRadius: '12px',
                  background: readingType === 'water' ? '#e0f2fe' : '#f8fafc',
                  border: readingType === 'water' ? '2px solid #0284c7' : '1px solid #e2e8f0',
                  color: readingType === 'water' ? '#0369a1' : '#64748b',
                  fontWeight: '700'
                }}
              >
                <Droplet size={20} />
                Đồng hồ Nước (m³)
              </button>
            </div>

            {/* Room & Period Selection */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.2fr 1fr', gap: '10px', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Chọn phòng:</label>
                <select
                  value={selectedRoomId}
                  onChange={(e) => setSelectedRoomId(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#fff' }}
                >
                  {rooms.map((r) => {
                    const tenantInfo = r.current_tenant_name
                      ? r.current_tenant_name
                      : (r.status === 'occupied' ? 'Đang thuê' : 'Trống');
                    return (
                      <option key={r.id} value={r.id}>
                        Phòng {r.room_number} ({tenantInfo})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Tháng:</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    type="button"
                    className="hide-on-mobile"
                    onClick={() => {
                      if (month === 1) {
                        setMonth(12);
                        setYear((y) => y - 1);
                      } else {
                        setMonth((m) => m - 1);
                      }
                    }}
                    style={{
                      padding: '10px 8px',
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Tháng trước"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <select
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                    style={{ flex: 1, minWidth: '85px', padding: '10px 8px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: '600' }}
                  >
                    {[...Array(12)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="hide-on-mobile"
                    onClick={() => {
                      if (month === 12) {
                        setMonth(1);
                        setYear((y) => y + 1);
                      } else {
                        setMonth((m) => m + 1);
                      }
                    }}
                    style={{
                      padding: '10px 8px',
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Tháng sau"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Năm:</label>
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: '600' }}
                >
                  {[2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                    <option key={y} value={y}>Năm {y}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Notice if reading already recorded for this month/year */}
            {(() => {
              const existingPeriodReading = recentReadings.find(
                (r) => Number(r.reading_month) === month && Number(r.reading_year) === year
              );
              if (existingPeriodReading) {
                const capturedTime = existingPeriodReading.photo_captured_at || existingPeriodReading.created_at;
                return (
                  <div style={{
                    padding: '10px 14px',
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '10px',
                    fontSize: '13px',
                    color: '#1d4ed8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={16} />
                      <span>
                        Kỳ Tháng {month}/{year} đã có số đo: <strong>{formatNumber(existingPeriodReading.current_value)} {readingType === 'electricity' ? 'kWh' : 'm³'}</strong>. Ghi lại sẽ cập nhật số mới.
                      </span>
                    </div>
                    {capturedTime && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        background: '#dbeafe',
                        color: '#1e40af',
                        padding: '4px 10px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '700'
                      }}>
                        <Camera size={14} />
                        Chụp hình vào: {formatDateTime(capturedTime)}
                      </span>
                    )}
                  </div>
                );
              }
              return null;
            })()}

            {/* Editable Readings & Live Decimal Calculation Card */}
            <div style={{
              padding: '16px',
              background: '#f8fafc',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                    ⚡ Số đo chỉ số ({readingType === 'electricity' ? 'Điện - kWh' : 'Nước - m³'})
                  </span>
                  {(() => {
                    const existing = recentReadings.find(
                      (r) => Number(r.reading_month) === month && Number(r.reading_year) === year
                    );
                    const t = existing?.photo_captured_at || existing?.created_at;
                    if (t) {
                      return (
                        <span style={{
                          fontSize: '12px',
                          color: '#059669',
                          background: '#dcfce7',
                          border: '1px solid #bbf7d0',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontWeight: '700',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <Camera size={12} />
                          Chụp lúc: {formatDateTime(t)}
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>
                <span style={{
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: '700',
                  borderRadius: '8px',
                  background: '#e0f2fe',
                  color: '#0284c7'
                }}>
                  ✍️ Chủ nhà tự nhập số
                </span>
              </div>

              {/* Old and New reading input fields */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px'
              }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    Chỉ số kỳ trước (Chỉ số cũ):
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      step="any"
                      value={previousValue}
                      onChange={(e) => setPreviousValue(e.target.value)}
                      placeholder="0"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        fontSize: '16px',
                        fontWeight: '700',
                        color: '#0f172a',
                        background: '#ffffff',
                        border: '1.5px solid #cbd5e1',
                        borderRadius: '8px'
                      }}
                    />
                    <span style={{ position: 'absolute', right: '12px', top: '11px', fontSize: '13px', fontWeight: '700', color: '#64748b' }}>
                      {readingType === 'electricity' ? 'kWh' : 'm³'}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                    💡 Cho phép sửa tự do khi nhập dữ liệu tháng/năm cũ.
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    Chỉ số kỳ này (Chỉ số mới):
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      step="any"
                      value={officialValue}
                      onChange={(e) => setOfficialValue(e.target.value)}
                      placeholder={readingType === 'electricity' ? 'VD: 1380' : 'VD: 70'}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        fontSize: '16px',
                        fontWeight: '800',
                        color: '#1e3a8a',
                        background: '#ffffff',
                        border: '1.5px solid #2563eb',
                        borderRadius: '8px'
                      }}
                    />
                    <span style={{ position: 'absolute', right: '12px', top: '11px', fontSize: '13px', fontWeight: '700', color: '#2563eb' }}>
                      {readingType === 'electricity' ? 'kWh' : 'm³'}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                    Chủ nhà xem mặt đồng hồ từ ảnh chụp (hoặc thực tế) rồi nhập số vào đây.
                  </div>
                </div>
              </div>

              {/* Live Calculation Preview Banner */}
              {(() => {
                const curr = parseNumber(officialValue);
                const prev = parseNumber(previousValue);
                const isReset = Boolean(isMeterReset && curr < prev);
                const rawDiff = isReset ? curr : (curr - prev);
                const rawConsumption = Math.max(0, Math.round(rawDiff * 1000) / 1000);
                const selectedRoom = rooms.find(r => r.id === selectedRoomId);
                const isMasterWater = readingType === 'water' && selectedRoom?.room_number === '1';

                const subRoomsList = (isMasterWater && masterBreakdown?.sub_rooms) || [];
                const subTotal = (isMasterWater && masterBreakdown?.total_sub_consumption) ? Number(masterBreakdown.total_sub_consumption) : 0;
                
                const effectiveConsumption = isMasterWater
                  ? Math.max(0, Math.round((rawConsumption - subTotal) * 1000) / 1000)
                  : rawConsumption;

                const roomElecPrice = selectedRoom?.electricity_price ? Number(selectedRoom.electricity_price) : 3000;
                const roomWaterPrice = selectedRoom?.water_price ? Number(selectedRoom.water_price) : 12000;
                const unitPrice = readingType === 'electricity' ? roomElecPrice : roomWaterPrice;
                const estAmount = Math.round(effectiveConsumption * unitPrice);

                const isSuspicious = curr < prev && !isMeterReset && officialValue !== '';
                const isSubExceeds = isMasterWater && officialValue !== '' && (rawConsumption < subTotal);

                return (
                  <div style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: (isSuspicious || isSubExceeds) ? '#fffbeb' : '#f0fdf4',
                    border: (isSuspicious || isSubExceeds) ? '1px solid #fef3c7' : '1px solid #bbf7d0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    {isMasterWater && (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: '#dbeafe',
                        color: '#1e40af',
                        padding: '4px 10px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '700',
                        width: 'fit-content'
                      }}>
                        🚰 Đồng hồ nước tổng Phòng 1 (Tự động trừ số nước Phòng 2 và Phòng 3)
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: (isSuspicious || isSubExceeds) ? '#b45309' : '#166534', fontWeight: '700' }}>
                        <div>
                          <span>📊 {isMasterWater ? 'Trên công tơ P1: ' : 'Tính toán: '}</span>
                          {isReset ? (
                            <span>Đồng hồ quay vòng về 0: <span style={{ textDecoration: 'underline', color: '#15803d' }}>{formatNumber(rawConsumption)} {readingType === 'electricity' ? 'kWh' : 'm³'}</span></span>
                          ) : (
                            <span>{formatNumber(curr)} - {formatNumber(prev)} = <span style={{ textDecoration: 'underline', color: (isSuspicious || isSubExceeds) ? '#b45309' : '#15803d' }}>{formatNumber(rawConsumption)} {readingType === 'electricity' ? 'kWh' : 'm³'}</span></span>
                          )}
                        </div>

                        {isMasterWater && (
                          <div style={{ fontSize: '12px', color: '#1e40af', fontWeight: '600' }}>
                            <span>➖ Trừ nước P2 & P3: </span>
                            {subRoomsList.map((sub, idx) => (
                              <span key={sub.room_id}>
                                {idx > 0 ? ' + ' : ''}
                                P{sub.room_number}: <strong>{formatNumber(sub.consumption)} m³</strong>
                                {!sub.has_reading ? ' (chưa có số)' : ''}
                              </span>
                            ))}
                            <span> = <strong>{formatNumber(subTotal)} m³</strong></span>
                          </div>
                        )}

                        {isMasterWater && (
                          <div style={{ fontSize: '13px', color: '#15803d', fontWeight: '800', marginTop: '2px' }}>
                            <span>👉 Tiêu thụ thực tế Phòng 1: </span>
                            <span>{formatNumber(rawConsumption)} - {formatNumber(subTotal)} = <span style={{ textDecoration: 'underline', fontSize: '15px' }}>{formatNumber(effectiveConsumption)} m³</span></span>
                          </div>
                        )}
                      </div>

                      <div style={{ fontSize: '14px', fontWeight: '800', color: (isSuspicious || isSubExceeds) ? '#b45309' : '#15803d' }}>
                        Thành tiền tạm tính: {formatCurrency(estAmount)} <span style={{ fontSize: '12px', fontWeight: 'normal', opacity: 0.85 }}>({formatCurrency(unitPrice)}/{readingType === 'electricity' ? 'kWh' : 'm³'})</span>
                      </div>
                    </div>

                    {isSuspicious && (
                      <div style={{ fontSize: '12px', color: '#b45309', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={14} />
                        <span>Chỉ số mới đang nhỏ hơn chỉ số cũ ({formatNumber(curr)} &lt; {formatNumber(prev)}). Tích chọn "Đồng hồ quay vòng" nếu vừa thay mới hoặc đồng hồ về 0.</span>
                      </div>
                    )}

                    {isSubExceeds && (
                      <div style={{ fontSize: '12px', color: '#b45309', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={14} />
                        <span>Tổng nước của P2 và P3 ({formatNumber(subTotal)} m³) đang lớn hơn số khối trên công tơ P1 ({formatNumber(rawConsumption)} m³). Hệ thống tạm tính tiêu thụ P1 = 0 m³. Vui lòng kiểm tra lại số đo.</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* DIRECT CAMERA VIEWFINDER (Mobile Admin Priority) */}
            {cameraActive ? (
              <div className="camera-viewfinder-wrapper">
                <video ref={videoRef} autoPlay playsInline muted className="camera-video-element" />

                {/* HUD Overlay with Guidance Reticle */}
                <div className="camera-hud-overlay">
                  <div className="camera-hud-top">
                    <div style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: '700' }}>
                      🔴 Camera Trực Tiếp
                    </div>

                    <button
                      type="button"
                      onClick={toggleTorch}
                      className={`camera-torch-btn ${torchOn ? 'active' : ''}`}
                    >
                      {torchOn ? <Zap size={14} fill="#000" /> : <ZapOff size={14} />}
                      <span>{torchOn ? 'Flash BẬT' : 'Bật Flash'}</span>
                    </button>
                  </div>

                  {/* Meter dials alignment guide reticle */}
                  <div className="camera-hud-guide">
                    <div className="camera-hud-corner tl" />
                    <div className="camera-hud-corner tr" />
                    <div className="camera-hud-corner bl" />
                    <div className="camera-hud-corner br" />
                    <div className="camera-hud-guide-text">
                      {readingType === 'electricity' 
                        ? 'CĂN CHỈNH MẶT SỐ VÀO KHUNG NÀY\n(Bỏ qua số ô đỏ ở cuối)'
                        : 'CĂN CHỈNH DÃY SỐ VÀO KHUNG NÀY'}
                    </div>
                  </div>

                  {/* Shutter Button & Close */}
                  <div className="camera-hud-bottom">
                    <button
                      type="button"
                      onClick={stopCamera}
                      style={{
                        padding: '10px 14px',
                        background: 'rgba(0,0,0,0.6)',
                        color: '#fff',
                        borderRadius: '10px',
                        fontSize: '13px'
                      }}
                    >
                      Đóng
                    </button>

                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="camera-shutter-btn"
                      title="Chụp ảnh ngay"
                    >
                      <div className="camera-shutter-inner">
                        <Camera size={26} />
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={toggleTorch}
                      style={{
                        padding: '10px 14px',
                        background: torchOn ? '#f59e0b' : 'rgba(0,0,0,0.6)',
                        color: torchOn ? '#000' : '#fff',
                        borderRadius: '10px',
                        fontSize: '13px',
                        fontWeight: '700'
                      }}
                    >
                      {torchOn ? '⚡ Flash' : '💡 Flash'}
                    </button>
                  </div>
                </div>
              </div>
            ) : previewUrl ? (
              <div style={{ textAlign: 'center', position: 'relative', background: '#0f172a', borderRadius: '16px', overflow: 'hidden', padding: '12px' }}>
                <img
                  src={previewUrl}
                  alt="Xem trước ảnh đồng hồ"
                  style={{ maxHeight: '240px', maxWidth: '100%', borderRadius: '10px', objectFit: 'contain' }}
                />
                <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={startCamera}
                    style={{
                      padding: '8px 16px',
                      background: '#334155',
                      color: '#ffffff',
                      borderRadius: '8px',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <RefreshCw size={14} /> Chụp lại ảnh khác
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUploadPhoto()}
                    disabled={uploadingPhoto}
                    style={{
                      padding: '8px 16px',
                      background: '#2563eb',
                      color: '#ffffff',
                      borderRadius: '8px',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Upload size={14} /> {uploadingPhoto ? 'Đang tải...' : 'Tải ảnh lại'}
                  </button>

                  <button
                    type="button"
                    onClick={handleClearPhoto}
                    disabled={uploadingPhoto}
                    style={{
                      padding: '8px 14px',
                      background: '#dc2626',
                      color: '#ffffff',
                      borderRadius: '8px',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <X size={14} /> Xóa ảnh
                  </button>
                </div>
              </div>
            ) : (
              /* PRIMARY ACTION: DIRECT PHOTO CAPTURE BUTTONS (MOBILE OPTIMIZED) */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button
                  type="button"
                  onClick={startCamera}
                  style={{
                    padding: '18px 20px',
                    background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                    color: '#ffffff',
                    borderRadius: '14px',
                    fontSize: '16px',
                    fontWeight: '800',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    boxShadow: '0 6px 16px -2px rgba(37, 99, 235, 0.35)',
                    transition: 'all 0.15s'
                  }}
                >
                  <Camera size={24} />
                  <span>Chụp trực tiếp trên màn hình (Bật Flash)</span>
                </button>

                {/* Secondary camera fallback for native camera app on mobile */}
                <button
                  type="button"
                  onClick={() => nativeCameraInputRef.current?.click()}
                  style={{
                    padding: '14px 18px',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <Zap size={18} color="#f59e0b" />
                  <span>Mở Camera hệ thống chụp ảnh với đèn Flash</span>
                </button>

                {/* Secondary Option: Upload Existing Images */}
                <div style={{ marginTop: '6px', borderTop: '1px dashed #e2e8f0', paddingTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowGalleryUpload(!showGalleryUpload)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#64748b',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      padding: '4px 0'
                    }}
                  >
                    <span>Hoặc chọn ảnh có sẵn từ máy</span>
                    {showGalleryUpload ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {showGalleryUpload && (
                    <div style={{ marginTop: '8px' }}>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          background: '#f8fafc',
                          border: '1px dashed #cbd5e1',
                          borderRadius: '10px',
                          fontSize: '13px'
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {cameraError && (
              <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', color: '#b91c1c', fontSize: '13px' }}>
                {cameraError}
              </div>
            )}

            <div style={{ marginTop: '4px', fontSize: '12px', color: '#64748b' }}>
              {readingType === 'electricity'
                ? '💡 Lưu ý: Bật Flash nếu tủ điện tối; khi ghi số chỉ lấy các chữ số trong ô trắng (bỏ qua ô đỏ cuối).'
                : '💡 Lưu ý: Chụp rõ mặt số đồng hồ nước để khách thuê dễ đối chiếu (hoặc nhập số ngay rồi bổ sung ảnh sau).'}
            </div>
          </div>
        </div>

        {/* Right Column: Photo Preview & Admin Manual Entry Approval */}
        <div style={{ background: '#ffffff', borderRadius: '18px', border: '1px solid #e2e8f0', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={22} color="#059669" />
              2. Ảnh đồng hồ &amp; Nhập chỉ số
            </h2>

            {uploadingPhoto && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#2563eb', fontWeight: '700' }}>
                <RefreshCw size={16} className="spin-smooth" />
                <span>Đang tải ảnh lên...</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Captured / Uploaded Photo Review */}
            {previewUrl || uploadedImageUrl ? (
              <div style={{
                background: '#0f172a',
                borderRadius: '14px',
                padding: '12px',
                textAlign: 'center',
                border: '1px solid #334155'
              }}>
                <img
                  src={previewUrl || uploadedImageUrl}
                  alt="Ảnh đồng hồ vừa chụp"
                  style={{ maxHeight: '260px', maxWidth: '100%', borderRadius: '10px', objectFit: 'contain', margin: '0 auto' }}
                />
                <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '700',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    background: uploadedImageId ? '#dcfce7' : '#fef3c7',
                    color: uploadedImageId ? '#15803d' : '#b45309'
                  }}>
                    {uploadingPhoto
                      ? '⏳ Đang lưu ảnh lên máy chủ...'
                      : uploadedImageId
                        ? '✓ Đã lưu ảnh công tơ lên hệ thống'
                        : 'Ảnh xem trước'}
                  </span>
                  <button
                    type="button"
                    onClick={handleClearPhoto}
                    style={{
                      padding: '5px 10px',
                      background: '#334155',
                      color: '#f8fafc',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Bỏ ảnh này
                  </button>
                </div>
              </div>
            ) : (
              <div style={{
                padding: '22px 16px',
                background: '#f8fafc',
                border: '2px dashed #cbd5e1',
                borderRadius: '14px',
                textAlign: 'center',
                color: '#64748b'
              }}>
                <Image size={34} style={{ margin: '0 auto 8px', opacity: 0.55 }} />
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#334155' }}>
                  Chưa có ảnh công tơ cho lần nhập này
                </div>
                <div style={{ fontSize: '12px', marginTop: '4px', lineHeight: '1.5' }}>
                  Bạn có thể bấm chụp/chọn ảnh ở cột bên trái để lưu chứng từ đối chiếu, hoặc nhập thẳng chỉ số bên dưới rồi bổ sung ảnh sau.
                </div>
              </div>
            )}

            {/* Reading Guide Banner */}
            {readingType === 'electricity' ? (
              <div style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '12px',
                padding: '12px 14px'
              }}>
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', marginBottom: '6px' }}>
                  📌 Cách đọc mặt số công tơ điện cơ:
                </div>
                <div className="meter-dial-container" style={{ padding: '10px 12px', gap: '4px', justifyContent: 'center' }}>
                  {['0', '1', '2', '5', '0'].map((d, i) => (
                    <div key={i} className="meter-digit-box white" style={{ width: '28px', height: '38px', fontSize: '18px' }}>{d}</div>
                  ))}
                  <div className="meter-digit-box red" style={{ width: '28px', height: '38px', fontSize: '18px' }}>4</div>
                </div>
                <div style={{ fontSize: '12px', color: '#475569', marginTop: '8px', textAlign: 'center' }}>
                  Chỉ nhập các chữ số <strong>Ô TRẮNG</strong> (VD: <strong>1250</strong> kWh) — <strong>bỏ qua số Ô ĐỎ</strong> ở cuối cùng.
                </div>
              </div>
            ) : (
              <div style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '12px',
                padding: '12px 14px',
                fontSize: '13px',
                color: '#1e40af'
              }}>
                🚰 <strong>Lưu ý ghi số nước:</strong> Đối chiếu mặt số đồng hồ nước thực tế và nhập chính xác số <strong>m³</strong> (hỗ trợ cả số thập phân nếu cần).
              </div>
            )}

            {/* Admin Manual Entry Official Input */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>
                  Chỉ số {readingType === 'electricity' ? 'Điện (kWh)' : 'Nước (m³)'} chính thức (Chủ nhà nhập):
                </label>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                  Kỳ trước: <strong>{formatNumber(parseNumber(previousValue))}</strong>
                </span>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  step="any"
                  value={officialValue}
                  placeholder={readingType === 'electricity' ? 'VD: 1380' : 'VD: 70'}
                  onChange={(e) => setOfficialValue(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '14px 60px 14px 16px',
                    fontSize: '24px',
                    fontWeight: '800',
                    color: '#0f172a',
                    borderRadius: '10px',
                    border: '2px solid #2563eb',
                    background: '#ffffff'
                  }}
                />
                <span style={{ position: 'absolute', right: '16px', top: '17px', fontSize: '16px', fontWeight: '800', color: '#64748b' }}>
                  {readingType === 'electricity' ? 'kWh' : 'm³'}
                </span>
              </div>
            </div>

            {/* Meter Reset Checkbox - Only show when current reading is less than previous */}
            {officialValue !== '' && parseNumber(officialValue) < parseNumber(previousValue) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fef3c7' }}>
                <input
                  type="checkbox"
                  id="meterReset"
                  checked={isMeterReset}
                  onChange={(e) => setIsMeterReset(e.target.checked)}
                />
                <label htmlFor="meterReset" style={{ fontSize: '13px', color: '#b45309', fontWeight: '600', cursor: 'pointer' }}>
                  Chỉ số mới ({formatNumber(parseNumber(officialValue))}) nhỏ hơn cũ ({formatNumber(parseNumber(previousValue))}): Xác nhận đồng hồ quay vòng về 0 hoặc đã thay mới.
                </label>
              </div>
            )}

            {/* Approve Button */}
            <button
              type="button"
              disabled={submitting || uploadingPhoto || officialValue === ''}
              onClick={handleApproveReading}
              style={{
                padding: '16px',
                background: (submitting || uploadingPhoto || officialValue === '') ? '#94a3b8' : '#059669',
                color: '#ffffff',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '800',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '4px',
                cursor: (submitting || uploadingPhoto || officialValue === '') ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 6px -1px rgba(5, 150, 105, 0.3)'
              }}
            >
              <Check size={20} />
              {submitting
                ? 'Đang lưu...'
                : uploadingPhoto
                  ? 'Đang tải ảnh...'
                  : uploadedImageId
                    ? 'Lưu ảnh & Phê duyệt chỉ số'
                    : 'Phê duyệt & Lưu vào sổ chỉ số'}
            </button>
          </div>
        </div>
      </div>

      {/* History of Readings Table & Late Image Attachment */}
      <div style={{ background: '#ffffff', borderRadius: '18px', border: '1px solid #e2e8f0', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
              Lịch sử các kỳ đo gần đây ({readingType === 'electricity' ? 'Điện' : 'Nước'})
            </h3>
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
              Kỳ đo thiếu ảnh có thể chụp/bổ sung bất kỳ lúc nào
            </div>
          </div>
        </div>

        {/* Month & Year Filter Bar for History */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '14px',
          padding: '12px 16px',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={18} color="#2563eb" />
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>
              Chọn Tháng & Năm tra cứu:
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Filter Month */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Tháng:</span>
              <select
                value={historyMonth}
                onChange={(e) => setHistoryMonth(e.target.value)}
                style={{
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#0f172a'
                }}
              >
                <option value="all">Tất cả các tháng</option>
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>
                ))}
              </select>
            </div>

            {/* Filter Year */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Năm:</span>
              <select
                value={historyYear}
                onChange={(e) => setHistoryYear(e.target.value)}
                style={{
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#0f172a'
                }}
              >
                <option value="all">Tất cả các năm</option>
                {[2030, 2029, 2028, 2027, 2026, 2025, 2024, 2023, 2022, 2021, 2020].map(y => (
                  <option key={y} value={y}>Năm {y}</option>
                ))}
              </select>
            </div>

            {/* Reset Filters */}
            {(historyMonth !== 'all' || historyYear !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setHistoryMonth('all');
                  setHistoryYear('all');
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '7px 12px',
                  background: '#e2e8f0',
                  color: '#334155',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                <RotateCcw size={13} />
                Xem tất cả
              </button>
            )}

            {/* Count Badge */}
            {(() => {
              const filteredList = recentReadings.filter((r) => {
                const matchM = historyMonth === 'all' || Number(r.reading_month) === Number(historyMonth);
                const matchY = historyYear === 'all' || Number(r.reading_year) === Number(historyYear);
                return matchM && matchY;
              });
              return (
                <span style={{
                  background: '#e0f2fe',
                  color: '#0284c7',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '700'
                }}>
                  {filteredList.length} kỳ đo
                </span>
              );
            })()}
          </div>
        </div>

        <div className="table-responsive" style={{ border: 'none', boxShadow: 'none' }}>
          <table className="admin-table">
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                <th style={{ padding: '12px' }}>Kỳ đo</th>
                <th style={{ padding: '12px' }}>Chỉ số cũ</th>
                <th style={{ padding: '12px' }}>Chỉ số mới</th>
                <th style={{ padding: '12px' }}>Tiêu thụ</th>
                <th style={{ padding: '12px' }}>Thành tiền</th>
                <th style={{ padding: '12px' }}>Ảnh chứng từ</th>
                <th style={{ padding: '12px' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const filtered = recentReadings.filter((r) => {
                  const matchM = historyMonth === 'all' || Number(r.reading_month) === Number(historyMonth);
                  const matchY = historyYear === 'all' || Number(r.reading_year) === Number(historyYear);
                  return matchM && matchY;
                });

                if (filtered.length === 0) {
                  return (
                    <tr>
                      <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                        Không có dữ liệu đo nào khớp với {historyMonth !== 'all' ? `Tháng ${historyMonth}` : ''} {historyYear !== 'all' ? `Năm ${historyYear}` : ''}.
                        <div style={{ marginTop: '8px' }}>
                          <button
                            type="button"
                            onClick={() => { setHistoryMonth('all'); setHistoryYear('all'); }}
                            style={{ padding: '6px 14px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
                          >
                            Đặt lại bộ lọc
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return filtered.map((r) => {
                const hasImage = !!r.image_url || !!r.meter_image_id;
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px', fontWeight: '700' }}>
                      <div>Tháng {r.reading_month}/{r.reading_year}</div>
                      {(r.photo_captured_at || r.created_at) && (
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500', marginTop: '2px' }}>
                          📸 {formatDateTime(r.photo_captured_at || r.created_at)}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px' }}>{formatNumber(r.previous_value)}</td>
                    <td style={{ padding: '12px', fontWeight: '700', color: '#1e3a8a' }}>{formatNumber(r.current_value)}</td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: '700', color: '#059669' }}>
                        {formatNumber(r.consumption)} {readingType === 'electricity' ? 'kWh' : 'm³'}
                      </div>
                      {r.is_master && r.sub_consumption !== undefined ? (
                        <div style={{ fontSize: '11px', color: '#1e40af', marginTop: '2px', fontWeight: '500' }}>
                          (Đồng hồ: {formatNumber(r.raw_consumption)} m³ - Trừ P2, P3: {formatNumber(r.sub_consumption)} m³)
                        </div>
                      ) : null}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: '700', color: '#0f172a' }}>{formatCurrency(r.amount)}</div>
                      {r.unit_price ? (
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          Đơn giá: {formatCurrency(r.unit_price)}/{readingType === 'electricity' ? 'kWh' : 'm³'}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ padding: '12px' }}>
                      {hasImage ? (
                        <div>
                          <a
                            href={getFullApiUrl(r.image_url || `/api/meter-images/${r.meter_image_id}/image`)}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              color: '#2563eb',
                              textDecoration: 'none',
                              fontWeight: '700',
                              fontSize: '13px'
                            }}
                          >
                            <Eye size={15} /> Xem ảnh
                          </a>
                          {(r.photo_captured_at || r.created_at) && (
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                              {formatDateTime(r.photo_captured_at || r.created_at)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{
                          background: '#fef3c7',
                          color: '#b45309',
                          padding: '3px 8px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '700'
                        }}>
                          ⚠️ Chưa có ảnh (Nhập tay)
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {!hasImage ? (
                          <button
                            type="button"
                            onClick={() => openAttachModal(r)}
                            style={{
                              padding: '6px 12px',
                              background: '#2563eb',
                              color: '#ffffff',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: '700',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              border: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            <Camera size={14} /> Bổ sung ảnh
                          </button>
                        ) : (
                          <span style={{ color: '#059669', fontSize: '12px', fontWeight: '700' }}>
                            ✓ Đầy đủ chứng từ
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeleteReading(r)}
                          title={`Xóa chỉ số ${readingType === 'electricity' ? 'Điện' : 'Nước'} Tháng ${r.reading_month}/${r.reading_year}`}
                          style={{
                            padding: '6px 10px',
                            background: '#fff1f2',
                            color: '#e11d48',
                            border: '1px solid #fecdd3',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '700',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={13} /> Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              });
            })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* LATE IMAGE ATTACHMENT MODAL */}
      {attachModalOpen && targetReading && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            padding: '24px',
            maxWidth: '460px',
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                Bổ sung ảnh đồng hồ ({readingType === 'electricity' ? 'Điện' : 'Nước'})
              </h3>
              <button
                type="button"
                onClick={() => setAttachModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: '10px', fontSize: '13px', color: '#334155', marginBottom: '14px' }}>
              Kỳ đo: <strong>Tháng {targetReading.reading_month}/{targetReading.reading_year}</strong> • Chỉ số: <strong>{targetReading.current_value}</strong>
            </div>

            {attachPreviewUrl ? (
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <img src={attachPreviewUrl} alt="Preview" style={{ maxHeight: '180px', borderRadius: '10px', objectFit: 'contain' }} />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={() => attachNativeCameraRef.current?.click()}
                  style={{
                    padding: '14px',
                    background: '#2563eb',
                    color: '#ffffff',
                    borderRadius: '12px',
                    fontSize: '15px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <Camera size={20} /> Chụp trực tiếp với Flash
                </button>

                <button
                  type="button"
                  onClick={() => attachGalleryInputRef.current?.click()}
                  style={{
                    padding: '12px',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <Upload size={18} /> Tải ảnh từ thiết bị
                </button>
              </div>
            )}

            <input
              type="file"
              ref={attachNativeCameraRef}
              accept="image/*"
              capture="environment"
              onChange={handleAttachFileChange}
              style={{ display: 'none' }}
            />
            <input
              type="file"
              ref={attachGalleryInputRef}
              accept="image/*"
              onChange={handleAttachFileChange}
              style={{ display: 'none' }}
            />

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setAttachModalOpen(false)}
                style={{ padding: '10px 18px', background: '#e2e8f0', color: '#334155', borderRadius: '10px', fontWeight: '600' }}
              >
                Hủy
              </button>

              <button
                type="button"
                disabled={!attachFile || attaching}
                onClick={submitAttachImage}
                style={{
                  padding: '10px 18px',
                  background: '#059669',
                  color: '#ffffff',
                  borderRadius: '10px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Check size={18} /> {attaching ? 'Đang tải...' : 'Xác nhận bổ sung ảnh'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


