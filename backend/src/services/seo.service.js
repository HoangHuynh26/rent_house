import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPostgresActive, memoryStore, query } from '../config/db.js';
import * as roomRepo from '../repositories/room.repo.js';
import * as auditService from './audit.service.js';

const SEO_SETTINGS_ACTION = 'SEO_SETTINGS';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_GSC_VERIFICATION_FILE = 'googlece2476463a9f3baa.html';
export const DEFAULT_GSC_VERIFICATION_CONTENT = 'google-site-verification: googlece2476463a9f3baa.html';

export const DEFAULT_SEO_SETTINGS = {
  siteTitle: 'Nhà Trọ Thanh Tâm - Cho Thuê Phòng Trọ Tiện Nghi, Giá Tốt & Minh Bạch',
  siteDescription:
    'Hệ thống phòng trọ Nhà Trọ Thanh Tâm: Cho thuê phòng trọ cao cấp, gác lửng, máy lạnh, camera an ninh 24/7, tra cứu chỉ số điện nước minh bạch bằng hình ảnh công tơ thực tế.',
  siteKeywords:
    'nhà trọ thanh tâm, thuê phòng trọ, phòng trọ giá rẻ, phòng trọ tân triệu, phòng trọ đồng nai, phòng trọ có gác lửng, phòng trọ máy lạnh, tra cứu tiền trọ',
  canonicalBaseUrl: 'https://nhatrothanhtam.netlify.app',
  ogImageUrl: 'https://nhatrothanhtam.netlify.app/og-image.png',
  logoUrl: 'https://nhatrothanhtam.netlify.app/logo.png',
  businessName: 'Nhà Trọ Thanh Tâm',
  businessPhone: '0909256680',
  businessAddress: 'Trục 16, Phường Tân Triệu',
  businessLocality: 'Đồng Nai',
  priceRange: '800.000 đ - 3.000.000 đ',
  gscVerificationFile: DEFAULT_GSC_VERIFICATION_FILE,
  gscMetaToken: '',
  gscPropertyUrl: 'https://search.google.com/search-console',
  updatedAt: null,
};

const safeJsonParse = (val, fallback = null) => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
};

const normalizeBaseUrl = (input) => {
  const fallback = DEFAULT_SEO_SETTINGS.canonicalBaseUrl;
  if (!input) return fallback;
  const cleaned = String(input).trim().replace(/\/+$/, '');
  if (!/^https?:\/\/.+/i.test(cleaned)) return fallback;
  return cleaned;
};

const normalizePhoneE164 = (phone) => {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  if (!digits) return '+84909256680';
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('0')) return `+84${digits.slice(1)}`;
  return `+${digits}`;
};

const resolvePublicFileCandidates = (filename) => [
  path.resolve(__dirname, '../../../frontend/public', filename),
  path.resolve(process.cwd(), 'frontend/public', filename),
  path.resolve(process.cwd(), '../frontend/public', filename),
  path.resolve(process.cwd(), 'frontend/dist', filename),
];

const readPublicFileBytes = async (filename) => {
  for (const candidate of resolvePublicFileCandidates(filename)) {
    try {
      const buf = await fs.readFile(candidate);
      return { exists: true, path: candidate, buffer: buf };
    } catch {
      // Try next path
    }
  }
  return { exists: false, path: null, buffer: null };
};

export const getSeoSettings = async () => {
  const defaults = {
    ...DEFAULT_SEO_SETTINGS,
    canonicalBaseUrl: normalizeBaseUrl(
      process.env.FRONTEND_URL || process.env.URL || DEFAULT_SEO_SETTINGS.canonicalBaseUrl
    ),
  };
  defaults.ogImageUrl = `${defaults.canonicalBaseUrl}/og-image.png`;
  defaults.logoUrl = `${defaults.canonicalBaseUrl}/logo.png`;

  try {
    let saved = null;
    let updatedAt = null;

    if (isPostgresActive()) {
      const res = await query(
        `SELECT new_data, created_at FROM audit_logs
         WHERE action = $1
         ORDER BY created_at DESC LIMIT 1`,
        [SEO_SETTINGS_ACTION]
      );
      if (res.rows.length > 0) {
        saved = safeJsonParse(res.rows[0].new_data, null);
        updatedAt = res.rows[0].created_at;
      }
    } else {
      const row = memoryStore.audit_logs.find((log) => log.action === SEO_SETTINGS_ACTION);
      if (row) {
        saved = safeJsonParse(row.new_data, null);
        updatedAt = row.created_at;
      }
    }

    if (saved && typeof saved === 'object') {
      const baseUrl = normalizeBaseUrl(saved.canonicalBaseUrl || defaults.canonicalBaseUrl);
      return {
        ...defaults,
        ...saved,
        canonicalBaseUrl: baseUrl,
        ogImageUrl: saved.ogImageUrl ? String(saved.ogImageUrl).trim() : `${baseUrl}/og-image.png`,
        logoUrl: saved.logoUrl ? String(saved.logoUrl).trim() : `${baseUrl}/logo.png`,
        gscVerificationFile: DEFAULT_GSC_VERIFICATION_FILE,
        updatedAt: saved.updatedAt || updatedAt,
      };
    }
  } catch (err) {
    console.warn('[SEO Service] Không thể đọc cấu hình SEO tùy chỉnh:', err.message);
  }

  return defaults;
};

export const saveSeoSettings = async (
  input = {},
  { actorId = null, ip = null, userAgent = null } = {}
) => {
  const current = await getSeoSettings();

  const siteTitle = String(input.siteTitle ?? current.siteTitle).trim();
  const siteDescription = String(input.siteDescription ?? current.siteDescription).trim();
  if (!siteTitle) {
    const err = new Error('Tiêu đề SEO không được để trống.');
    err.status = 400;
    throw err;
  }
  if (!siteDescription) {
    const err = new Error('Mô tả Meta Description không được để trống.');
    err.status = 400;
    throw err;
  }

  const rawBaseUrl = String(input.canonicalBaseUrl ?? current.canonicalBaseUrl).trim();
  if (rawBaseUrl && !/^https?:\/\/.+/i.test(rawBaseUrl)) {
    const err = new Error('Domain Canonical phải bắt đầu bằng https:// hoặc http://');
    err.status = 400;
    throw err;
  }

  const canonicalBaseUrl = normalizeBaseUrl(rawBaseUrl || current.canonicalBaseUrl);
  const extractMetaToken = (raw) => {
    const val = String(raw ?? '').trim();
    if (!val) return '';
    const match = val.match(/content=["']([^"']+)["']/i);
    return match?.[1] ? match[1].trim() : val;
  };

  const nextSettings = {
    siteTitle,
    siteDescription,
    siteKeywords: String(input.siteKeywords ?? current.siteKeywords).trim(),
    canonicalBaseUrl,
    ogImageUrl: String(input.ogImageUrl ?? `${canonicalBaseUrl}/og-image.png`).trim(),
    logoUrl: String(input.logoUrl ?? `${canonicalBaseUrl}/logo.png`).trim(),
    businessName: String(input.businessName ?? current.businessName).trim() || current.businessName,
    businessPhone: String(input.businessPhone ?? current.businessPhone).trim() || current.businessPhone,
    businessAddress: String(input.businessAddress ?? current.businessAddress).trim() || current.businessAddress,
    businessLocality: String(input.businessLocality ?? current.businessLocality).trim() || current.businessLocality,
    priceRange: String(input.priceRange ?? current.priceRange).trim() || current.priceRange,
    gscVerificationFile: DEFAULT_GSC_VERIFICATION_FILE,
    gscMetaToken: extractMetaToken(input.gscMetaToken ?? current.gscMetaToken),
    gscPropertyUrl: String(input.gscPropertyUrl ?? current.gscPropertyUrl).trim() || DEFAULT_SEO_SETTINGS.gscPropertyUrl,
    updatedAt: new Date().toISOString(),
  };

  await auditService.logAction({
    actorId,
    actorType: 'admin',
    action: SEO_SETTINGS_ACTION,
    entityType: 'seo',
    entityId: 'site_seo_config',
    oldData: current,
    newData: nextSettings,
    ip,
    userAgent,
  });

  return nextSettings;
};

export const buildStructuredDataJsonLd = (settings) => {
  const baseUrl = normalizeBaseUrl(settings.canonicalBaseUrl);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${baseUrl}/#website`,
        name: settings.businessName,
        alternateName: `Hệ Thống ${settings.businessName}`,
        url: `${baseUrl}/`,
      },
      {
        '@type': ['ApartmentComplex', 'LocalBusiness'],
        '@id': `${baseUrl}/#business`,
        name: settings.businessName,
        description: settings.siteDescription,
        url: `${baseUrl}/`,
        logo: {
          '@type': 'ImageObject',
          url: settings.logoUrl || `${baseUrl}/logo.png`,
          width: 512,
          height: 512,
        },
        image: [
          settings.ogImageUrl || `${baseUrl}/og-image.png`,
          settings.logoUrl || `${baseUrl}/logo.png`,
        ],
        telephone: normalizePhoneE164(settings.businessPhone),
        priceRange: settings.priceRange,
        currenciesAccepted: 'VND',
        paymentAccepted: 'Tiền mặt, Chuyển khoản ngân hàng',
        address: {
          '@type': 'PostalAddress',
          streetAddress: settings.businessAddress,
          addressLocality: settings.businessLocality,
          addressCountry: 'VN',
        },
      },
    ],
  };
};

const escapeXml = (str) =>
  String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export const generateRobotsTxt = (settings) => {
  const baseUrl = normalizeBaseUrl(settings.canonicalBaseUrl);
  return [
    `# robots.txt for ${settings.businessName}`,
    'User-agent: *',
    'Allow: /',
    `Allow: /${DEFAULT_GSC_VERIFICATION_FILE}`,
    'Allow: /sitemap.xml',
    'Allow: /logo.png',
    'Allow: /og-image.png',
    'Allow: /favicon.ico',
    'Allow: /favicon-48x48.png',
    'Allow: /images/',
    '',
    'Disallow: /tenant/',
    'Disallow: /admin/',
    'Disallow: /api/',
    '',
    `Sitemap: ${baseUrl}/sitemap.xml`,
    '',
  ].join('\n');
};

export const generateDynamicSitemapXml = async (settings) => {
  const baseUrl = normalizeBaseUrl(settings.canonicalBaseUrl);
  const today = new Date().toISOString().slice(0, 10);
  let roomSummary = 'Phòng trọ tiện nghi, sạch sẽ, an ninh 24/7';
  try {
    const rooms = await roomRepo.findAll(false);
    if (rooms.length > 0) {
      const availableCount = rooms.filter((r) => r.status === 'available').length;
      roomSummary = `Hiện có ${rooms.length} phòng (${availableCount} phòng trống) - ${settings.businessAddress}, ${settings.businessLocality}`;
    }
  } catch {
    // Fallback summary
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${escapeXml(`${baseUrl}/`)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
    <image:image>
      <image:loc>${escapeXml(settings.ogImageUrl || `${baseUrl}/og-image.png`)}</image:loc>
      <image:title>${escapeXml(settings.siteTitle)}</image:title>
      <image:caption>${escapeXml(roomSummary)}</image:caption>
    </image:image>
    <image:image>
      <image:loc>${escapeXml(settings.logoUrl || `${baseUrl}/logo.png`)}</image:loc>
      <image:title>${escapeXml(`Logo ${settings.businessName}`)}</image:title>
    </image:image>
  </url>
</urlset>
`;
};

const isPngBuffer = (buf) =>
  Boolean(buf && buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47);

export const getSeoHealthReport = async (settings) => {
  const [gscFile, robotsFile, sitemapFile, logoFile, favicon48File, faviconIcoFile, ogImageFile] =
    await Promise.all([
      readPublicFileBytes(DEFAULT_GSC_VERIFICATION_FILE),
      readPublicFileBytes('robots.txt'),
      readPublicFileBytes('sitemap.xml'),
      readPublicFileBytes('logo.png'),
      readPublicFileBytes('favicon-48x48.png'),
      readPublicFileBytes('favicon.ico'),
      readPublicFileBytes('og-image.png'),
    ]);

  const gscContent = gscFile.buffer ? gscFile.buffer.toString('utf8').trim() : '';
  const gscFileValid = gscFile.exists && gscContent === DEFAULT_GSC_VERIFICATION_CONTENT;

  const checks = [
    {
      id: 'gsc_file',
      label: 'Tệp xác minh Google Search Console (HTML File)',
      passed: gscFileValid,
      detail: gscFileValid
        ? `Đã có tệp /${DEFAULT_GSC_VERIFICATION_FILE} đúng chuẩn Google.`
        : `Thiếu hoặc sai nội dung tệp /${DEFAULT_GSC_VERIFICATION_FILE}.`,
      weight: 20,
    },
    {
      id: 'logo_png',
      label: 'Logo thương hiệu & Favicon 48x48 chuẩn PNG cho Google Search',
      passed: isPngBuffer(logoFile.buffer) && isPngBuffer(favicon48File.buffer) && faviconIcoFile.exists,
      detail:
        isPngBuffer(logoFile.buffer) && isPngBuffer(favicon48File.buffer)
          ? 'logo.png, favicon-48x48.png đạt chuẩn định dạng PNG thật và đã có favicon.ico.'
          : 'Tệp logo hoặc favicon 48x48 chưa đúng chuẩn PNG.',
      weight: 20,
    },
    {
      id: 'og_image',
      label: 'Ảnh chia sẻ mạng xã hội (Open Graph 1200x630)',
      passed: isPngBuffer(ogImageFile.buffer),
      detail: isPngBuffer(ogImageFile.buffer)
        ? 'Đã có ảnh /og-image.png gắn thương hiệu Nhà Trọ Thanh Tâm.'
        : 'Chưa tìm thấy /og-image.png chuẩn PNG.',
      weight: 10,
    },
    {
      id: 'robots_txt',
      label: 'Tệp robots.txt điều hướng Googlebot',
      passed: robotsFile.exists && robotsFile.buffer.toString('utf8').includes('Sitemap:'),
      detail: robotsFile.exists ? 'Đã cấu hình robots.txt hợp lệ và trỏ về sitemap.xml.' : 'Thiếu tệp robots.txt.',
      weight: 15,
    },
    {
      id: 'sitemap_xml',
      label: 'Sơ đồ trang Sitemap XML (Google Search Console)',
      passed: sitemapFile.exists && sitemapFile.buffer.toString('utf8').includes('<urlset'),
      detail: sitemapFile.exists ? 'Đã có tệp sitemap.xml hợp lệ để gửi lên GSC.' : 'Thiếu tệp sitemap.xml.',
      weight: 15,
    },
    {
      id: 'title_length',
      label: 'Độ dài Title SEO (tối ưu 30 - 75 ký tự)',
      passed: settings.siteTitle.length >= 20 && settings.siteTitle.length <= 75,
      detail: `Hiện tại: ${settings.siteTitle.length} ký tự.`,
      weight: 10,
    },
    {
      id: 'desc_length',
      label: 'Độ dài Meta Description (tối ưu 70 - 180 ký tự)',
      passed: settings.siteDescription.length >= 50 && settings.siteDescription.length <= 185,
      detail: `Hiện tại: ${settings.siteDescription.length} ký tự.`,
      weight: 10,
    },
  ];

  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const earnedWeight = checks.reduce((sum, c) => sum + (c.passed ? c.weight : 0), 0);
  const score = Math.round((earnedWeight / totalWeight) * 100);

  return {
    score,
    passedCount: checks.filter((c) => c.passed).length,
    totalChecks: checks.length,
    checks,
  };
};

export const getPublicSeoPayload = async () => {
  const settings = await getSeoSettings();
  return {
    settings: {
      siteTitle: settings.siteTitle,
      siteDescription: settings.siteDescription,
      siteKeywords: settings.siteKeywords,
      canonicalBaseUrl: settings.canonicalBaseUrl,
      ogImageUrl: settings.ogImageUrl,
      logoUrl: settings.logoUrl,
      businessName: settings.businessName,
      businessPhone: settings.businessPhone,
      businessAddress: settings.businessAddress,
      businessLocality: settings.businessLocality,
      priceRange: settings.priceRange,
      gscMetaToken: settings.gscMetaToken,
    },
    jsonLd: buildStructuredDataJsonLd(settings),
  };
};

export const getAdminSeoDashboard = async () => {
  const settings = await getSeoSettings();
  const baseUrl = normalizeBaseUrl(settings.canonicalBaseUrl);
  const [healthReport, sitemapPreview] = await Promise.all([
    getSeoHealthReport(settings),
    generateDynamicSitemapXml(settings),
  ]);

  return {
    settings,
    healthReport,
    gscInfo: {
      verificationFileName: DEFAULT_GSC_VERIFICATION_FILE,
      verificationFileContent: DEFAULT_GSC_VERIFICATION_CONTENT,
      verificationFileUrl: `${baseUrl}/${DEFAULT_GSC_VERIFICATION_FILE}`,
      sitemapUrl: `${baseUrl}/sitemap.xml`,
      dynamicSitemapApiUrl: `${baseUrl}/api/seo/sitemap.xml`,
      robotsUrl: `${baseUrl}/robots.txt`,
      logoUrl: `${baseUrl}/logo.png`,
      ogImageUrl: settings.ogImageUrl || `${baseUrl}/og-image.png`,
      gscConsoleUrl: settings.gscPropertyUrl || DEFAULT_SEO_SETTINGS.gscPropertyUrl,
    },
    robotsPreview: generateRobotsTxt(settings),
    sitemapPreview,
    jsonLdPreview: buildStructuredDataJsonLd(settings),
  };
};
