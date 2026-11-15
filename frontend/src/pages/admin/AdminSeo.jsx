import React, { useState, useEffect } from 'react';
import {
  Search,
  Globe,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  BarChart3,
  FileCode,
  Save,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import api from '../../services/api';
import BrandLogo from '../../components/BrandLogo';
import usePageSEO, { invalidateSeoCache } from '../../utils/usePageSEO';

export default function AdminSeo() {
  usePageSEO({
    title: 'Quản Lý SEO & Google Search Console',
    noIndex: true,
    useRemoteConfig: false,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState(null);

  const [healthReport, setHealthReport] = useState({ score: 0, passedCount: 0, totalChecks: 0, checks: [] });
  const [gscInfo, setGscInfo] = useState({});
  const [robotsPreview, setRobotsPreview] = useState('');
  const [sitemapPreview, setSitemapPreview] = useState('');
  const [copiedKey, setCopiedKey] = useState('');

  const [form, setForm] = useState({
    siteTitle: '',
    siteDescription: '',
    siteKeywords: '',
    canonicalBaseUrl: 'https://nhatrothanhtam.netlify.app',
    ogImageUrl: '',
    logoUrl: '',
    businessName: 'Nhà Trọ Thanh Tâm',
    businessPhone: '0909256680',
    businessAddress: 'Trục 16, Phường Tân Triệu',
    businessLocality: 'Đồng Nai',
    priceRange: '800.000 đ - 3.000.000 đ',
    gscMetaToken: '',
  });

  const fetchSeoDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.get('/seo/admin');
      const data = res?.data || {};
      if (data.settings) {
        setForm({
          siteTitle: data.settings.siteTitle || '',
          siteDescription: data.settings.siteDescription || '',
          siteKeywords: data.settings.siteKeywords || '',
          canonicalBaseUrl: data.settings.canonicalBaseUrl || 'https://nhatrothanhtam.netlify.app',
          ogImageUrl: data.settings.ogImageUrl || '',
          logoUrl: data.settings.logoUrl || '',
          businessName: data.settings.businessName || 'Nhà Trọ Thanh Tâm',
          businessPhone: data.settings.businessPhone || '0909256680',
          businessAddress: data.settings.businessAddress || 'Trục 16, Phường Tân Triệu',
          businessLocality: data.settings.businessLocality || 'Đồng Nai',
          priceRange: data.settings.priceRange || '800.000 đ - 3.000.000 đ',
          gscMetaToken: data.settings.gscMetaToken || '',
        });
      }
      if (data.healthReport) setHealthReport(data.healthReport);
      if (data.gscInfo) setGscInfo(data.gscInfo);
      if (data.robotsPreview) setRobotsPreview(data.robotsPreview);
      if (data.sitemapPreview) setSitemapPreview(data.sitemapPreview);
    } catch (err) {
      setBanner({
        type: 'error',
        text: err?.message || 'Không thể tải bảng điều khiển SEO & Google Search Console.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSeoDashboard();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setBanner(null);
      const res = await api.put('/seo/admin', form);
      invalidateSeoCache();
      const data = res?.data || {};
      if (data.healthReport) setHealthReport(data.healthReport);
      if (data.gscInfo) setGscInfo(data.gscInfo);
      if (data.robotsPreview) setRobotsPreview(data.robotsPreview);
      if (data.sitemapPreview) setSitemapPreview(data.sitemapPreview);
      setBanner({
        type: 'success',
        text: res?.message || 'Đã cập nhật cấu hình SEO & Google Search Console thành công!',
      });
    } catch (err) {
      setBanner({
        type: 'error',
        text: err?.message || 'Lỗi khi lưu cấu hình SEO.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async (key, text) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(''), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const titleLen = form.siteTitle.length;
  const descLen = form.siteDescription.length;
  const displayDomain = (form.canonicalBaseUrl || 'https://nhatrothanhtam.netlify.app').replace(/^https?:\/\//, '');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '48px' }}>
      {/* Hero Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e40af 100%)',
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
        <div style={{ maxWidth: '660px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <Globe size={24} color="#60a5fa" />
            <h1 style={{ fontSize: '22px', fontWeight: '800', margin: 0 }}>
              Quản Trị SEO & Google Search Console
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: '14px', color: '#cbd5e1', lineHeight: '1.55' }}>
            Tối ưu hiển thị trên Google Tìm Kiếm (Logo PNG chuẩn Google, Open Graph, Schema.org ApartmentComplex, Sitemap XML, Robots.txt) và quản lý xác minh sở hữu trên Google Search Console.
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          <a
            href={gscInfo.gscConsoleUrl || 'https://search.google.com/search-console'}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '11px 18px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              borderRadius: '12px',
              fontSize: '13.5px',
              fontWeight: '700',
              textDecoration: 'none',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
            }}
          >
            <Search size={17} />
            Mở Google Search Console
            <ExternalLink size={14} />
          </a>

          <a
            href={`/${gscInfo.verificationFileName || 'googlece2476463a9f3baa.html'}`}
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
            <ShieldCheck size={16} />
            Kiểm tra file xác minh GSC
            <ExternalLink size={13} />
          </a>
        </div>
      </div>

      {banner && (
        <div style={{
          borderRadius: '14px',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: banner.type === 'error' ? '#fef2f2' : '#ecfdf5',
          border: `1px solid ${banner.type === 'error' ? '#fecaca' : '#a7f3d0'}`,
          color: banner.type === 'error' ? '#991b1b' : '#065f46',
          fontSize: '14px',
          fontWeight: '600',
        }}>
          {banner.type === 'error' ? <AlertTriangle size={19} /> : <CheckCircle2 size={19} />}
          <span>{banner.text}</span>
        </div>
      )}

      {/* SEO Health Score + Live Google SERP Preview */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '20px',
      }}>
        {/* SEO Score Checklist */}
        <div style={{
          background: '#ffffff',
          borderRadius: '18px',
          padding: '22px 24px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart3 size={19} color="#1e40af" />
              <h2 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: '#0f172a' }}>
                Điểm Chuẩn SEO & Google Search
              </h2>
            </div>
            <span style={{
              padding: '4px 12px',
              borderRadius: '999px',
              fontSize: '14px',
              fontWeight: '800',
              background: healthReport.score >= 85 ? '#dcfce7' : '#fef3c7',
              color: healthReport.score >= 85 ? '#15803d' : '#b45309',
            }}>
              {loading ? '...' : `${healthReport.score}/100 (${healthReport.passedCount}/${healthReport.totalChecks})`}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(healthReport.checks || []).map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  background: item.passed ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${item.passed ? '#bbf7d0' : '#fecaca'}`,
                }}
              >
                {item.passed ? (
                  <CheckCircle2 size={18} color="#16a34a" style={{ flexShrink: 0, marginTop: '2px' }} />
                ) : (
                  <AlertTriangle size={18} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
                )}
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>{item.label}</div>
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>{item.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Google Search Snippet Preview + GSC Quick URLs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '18px',
            padding: '22px 24px',
            border: '1px solid #e2e8f0',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Sparkles size={18} color="#2563eb" />
              <h2 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: '#0f172a' }}>
                Xem Trước Kết Quả Trên Google Tìm Kiếm
              </h2>
            </div>

            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '16px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <BrandLogo size={26} rounded={6} style={{ boxShadow: 'none' }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#202124', lineHeight: 1.2 }}>
                    {form.businessName || 'Nhà Trọ Thanh Tâm'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#4d5156' }}>
                    {form.canonicalBaseUrl || 'https://nhatrothanhtam.netlify.app'}
                  </div>
                </div>
              </div>
              <div style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#1a0dab',
                lineHeight: 1.35,
                marginBottom: '6px',
              }}>
                {form.siteTitle || 'Nhà Trọ Thanh Tâm - Cho Thuê Phòng Trọ Tiện Nghi'}
              </div>
              <div style={{ fontSize: '13px', color: '#4d5156', lineHeight: 1.5 }}>
                {form.siteDescription || 'Mô tả hiển thị trên Google...'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '12px', fontSize: '12px', color: '#475569', flexWrap: 'wrap' }}>
              <span>
                Độ dài Title: <strong style={{ color: titleLen <= 75 ? '#15803d' : '#dc2626' }}>{titleLen}</strong> ký tự
              </span>
              <span>•</span>
              <span>
                Độ dài Description: <strong style={{ color: descLen <= 185 ? '#15803d' : '#dc2626' }}>{descLen}</strong> ký tự
              </span>
            </div>
          </div>

          {/* GSC Verification & Sitemap URLs */}
          <div style={{
            background: '#ffffff',
            borderRadius: '18px',
            padding: '20px 24px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} color="#059669" />
              <h2 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: '#0f172a' }}>
                Liên Kết Google Search Console
              </h2>
            </div>

            {[
              {
                key: 'gscFile',
                label: 'File xác minh HTML Google Search Console',
                value: `${form.canonicalBaseUrl}/${gscInfo.verificationFileName || 'googlece2476463a9f3baa.html'}`,
              },
              {
                key: 'sitemap',
                label: 'Sitemap XML gửi Google Search Console',
                value: `${form.canonicalBaseUrl}/sitemap.xml`,
              },
              {
                key: 'sitemapApi',
                label: 'Sitemap động (từ Backend API)',
                value: `${form.canonicalBaseUrl}/api/seo/sitemap.xml`,
              },
              {
                key: 'robots',
                label: 'Robots.txt',
                value: `${form.canonicalBaseUrl}/robots.txt`,
              },
            ].map((row) => (
              <div
                key={row.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569' }}>{row.label}</div>
                  <div style={{
                    fontSize: '12.5px',
                    color: '#2563eb',
                    fontWeight: '600',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {row.value}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => handleCopy(row.key, row.value)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    {copiedKey === row.key ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                    {copiedKey === row.key ? 'Đã chép' : 'Chép'}
                  </button>
                  <a
                    href={row.value}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '6px 8px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#0f172a',
                    }}
                    title="Mở thử trong tab mới"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            ))}

            <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.55, background: '#eff6ff', padding: '10px 12px', borderRadius: '10px' }}>
              <strong>Hướng dẫn nhanh trên GSC:</strong> Sau khi Netlify deploy bản mới, vào Google Search Console → nhấn <strong>Xác minh</strong> tệp <code>googlece2476463a9f3baa.html</code> → vào mục <strong>Sơ đồ trang web (Sitemaps)</strong> và gửi <code>sitemap.xml</code> → kiểm tra URL <code>https://{displayDomain}/</code> để Google lập chỉ mục và cập nhật logo mới nhanh hơn.
            </div>
          </div>
        </div>
      </div>

      {/* SEO & Schema.org Settings Form */}
      <form
        onSubmit={handleSave}
        style={{
          background: '#ffffff',
          borderRadius: '18px',
          padding: '24px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <h2 style={{ fontSize: '17px', fontWeight: '800', margin: 0, color: '#0f172a' }}>
            Chỉnh Sửa Thẻ Meta SEO & Dữ Liệu Có Cấu Trúc (Schema.org)
          </h2>
          <button
            type="submit"
            disabled={saving || loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '10px 20px',
              borderRadius: '11px',
              background: saving ? '#64748b' : '#1e40af',
              color: '#ffffff',
              border: 'none',
              fontSize: '13.5px',
              fontWeight: '700',
              cursor: saving ? 'wait' : 'pointer',
            }}
          >
            <Save size={16} />
            {saving ? 'Đang lưu cấu hình...' : 'Lưu Cấu Hình SEO'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Tiêu đề trang (Title SEO)
            </label>
            <input
              type="text"
              required
              value={form.siteTitle}
              onChange={(e) => setForm({ ...form, siteTitle: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Mô tả trang (Meta Description)
            </label>
            <textarea
              required
              rows={3}
              value={form.siteDescription}
              onChange={(e) => setForm({ ...form, siteDescription: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Từ khóa SEO (Meta Keywords, cách nhau bằng dấu phẩy)
            </label>
            <input
              type="text"
              value={form.siteKeywords}
              onChange={(e) => setForm({ ...form, siteKeywords: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Domain chính thức (Canonical URL)
            </label>
            <input
              type="url"
              required
              value={form.canonicalBaseUrl}
              onChange={(e) => setForm({ ...form, canonicalBaseUrl: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Tên cơ sở / Thương hiệu
            </label>
            <input
              type="text"
              value={form.businessName}
              onChange={(e) => setForm({ ...form, businessName: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Số điện thoại liên hệ (Schema)
            </label>
            <input
              type="text"
              value={form.businessPhone}
              onChange={(e) => setForm({ ...form, businessPhone: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Địa chỉ (Đường / Phường)
            </label>
            <input
              type="text"
              value={form.businessAddress}
              onChange={(e) => setForm({ ...form, businessAddress: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Tỉnh / Thành phố
            </label>
            <input
              type="text"
              value={form.businessLocality}
              onChange={(e) => setForm({ ...form, businessLocality: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Mã thẻ HTML Meta GSC (tùy chọn bổ sung)
            </label>
            <input
              type="text"
              value={form.gscMetaToken}
              onChange={(e) => setForm({ ...form, gscMetaToken: e.target.value })}
              placeholder="Ví dụ: chuỗi token hoặc thẻ <meta ...> từ GSC"
              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}
            />
          </div>
        </div>
      </form>

      {/* Sitemap & Robots.txt Previews */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '20px',
      }}>
        <div style={{
          background: '#0f172a',
          borderRadius: '18px',
          padding: '18px 20px',
          color: '#e2e8f0',
          border: '1px solid #334155',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <FileCode size={17} color="#38bdf8" />
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '700' }}>Nội dung Sitemap XML hiện tại</h3>
          </div>
          <pre style={{
            margin: 0,
            background: '#020617',
            padding: '12px',
            borderRadius: '10px',
            fontSize: '11.5px',
            lineHeight: 1.5,
            color: '#a5f3fc',
            overflow: 'auto',
            maxHeight: '220px',
          }}>
            {sitemapPreview || 'Đang tải...'}
          </pre>
        </div>

        <div style={{
          background: '#0f172a',
          borderRadius: '18px',
          padding: '18px 20px',
          color: '#e2e8f0',
          border: '1px solid #334155',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <FileCode size={17} color="#34d399" />
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '700' }}>Nội dung Robots.txt</h3>
          </div>
          <pre style={{
            margin: 0,
            background: '#020617',
            padding: '12px',
            borderRadius: '10px',
            fontSize: '11.5px',
            lineHeight: 1.5,
            color: '#86efac',
            overflow: 'auto',
            maxHeight: '220px',
          }}>
            {robotsPreview || 'Đang tải...'}
          </pre>
        </div>
      </div>
    </div>
  );
}
