import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.DATABASE_URL = '';
process.env.DISABLE_EXTERNAL_BACKUP = 'true';
process.env.NODE_ENV = 'test';

const { memoryStore } = await import('../src/config/db.js');
const seoService = await import('../src/services/seo.service.js');
const { handler: apiHandler } = await import('../netlify/functions/api.mjs');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../../frontend/public');

const ensureSeoTestAdmin = () => {
  const adminId = 'test-admin-seo-id';
  if (!memoryStore.admins.some((a) => a.id === adminId)) {
    memoryStore.admins.push({
      id: adminId,
      username: 'admin_seo_test',
      full_name: 'Admin Test SEO',
      phone: '0900000001',
      role: 'super_admin',
      status: 'active',
    });
  }
  return adminId;
};

test('Public branding logos, favicons, OG image, and Google Search Console verification file are valid', async () => {
  const gscText = (await fs.readFile(path.join(publicDir, 'googlece2476463a9f3baa.html'), 'utf8')).trim();
  assert.strictEqual(gscText, 'google-site-verification: googlece2476463a9f3baa.html');

  const pngFiles = ['logo.png', 'favicon-16x16.png', 'favicon-32x32.png', 'favicon-48x48.png', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'og-image.png'];
  for (const fname of pngFiles) {
    const buf = await fs.readFile(path.join(publicDir, fname));
    assert.strictEqual(
      buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47,
      true,
      `${fname} must be a valid PNG image`
    );
  }

  const icoBuf = await fs.readFile(path.join(publicDir, 'favicon.ico'));
  assert.strictEqual(icoBuf[0] === 0 && icoBuf[1] === 0 && icoBuf[2] === 1 && icoBuf[3] === 0, true);

  const sitemapXml = await fs.readFile(path.join(publicDir, 'sitemap.xml'), 'utf8');
  assert.ok(sitemapXml.includes('<urlset'));
  assert.ok(!sitemapXml.includes('#rooms'), 'sitemap.xml must not use fragment URLs ignored by Google');

  const robotsTxt = await fs.readFile(path.join(publicDir, 'robots.txt'), 'utf8');
  assert.ok(robotsTxt.includes('googlece2476463a9f3baa.html'));
  assert.ok(robotsTxt.includes('Sitemap: https://nhatrothanhtam.netlify.app/sitemap.xml'));
});

test('SEO Service health check scores 100% and persists custom GSC meta token cleanly', async () => {
  const defaults = await seoService.getSeoSettings();
  const report = await seoService.getSeoHealthReport(defaults);

  assert.strictEqual(report.score, 100);
  assert.strictEqual(report.passedCount, report.totalChecks);

  const saved = await seoService.saveSeoSettings({
    siteTitle: 'Nhà Trọ Thanh Tâm - Phòng Trọ Đẹp Tân Triệu',
    siteDescription: 'Cho thuê phòng trọ tiện nghi tại Phường Tân Triệu, Đồng Nai với công tơ điện nước minh bạch.',
    gscMetaToken: '<meta name="google-site-verification" content="abcXYZ_token_123" />',
  });

  assert.strictEqual(saved.gscMetaToken, 'abcXYZ_token_123');
  const reloaded = await seoService.getSeoSettings();
  assert.strictEqual(reloaded.siteTitle, 'Nhà Trọ Thanh Tâm - Phòng Trọ Đẹp Tân Triệu');
  assert.strictEqual(reloaded.gscMetaToken, 'abcXYZ_token_123');

  const schema = seoService.buildStructuredDataJsonLd(reloaded);
  assert.strictEqual(schema['@graph'][1].logo.url, 'https://nhatrothanhtam.netlify.app/logo.png');
  assert.strictEqual(schema['@graph'][1].telephone, '+84909256680');
});

test('Netlify apiHandler serves public /api/seo endpoints and enforces requireAdmin on /api/seo/admin', async () => {
  const adminId = ensureSeoTestAdmin();

  const publicRes = await apiHandler(
    { httpMethod: 'GET', path: '/.netlify/functions/api/seo/public', headers: {} },
    {}
  );
  assert.strictEqual(publicRes.statusCode, 200);
  const publicJson = JSON.parse(publicRes.body);
  assert.strictEqual(publicJson.success, true);
  assert.ok(publicJson.data.jsonLd['@graph']);

  const sitemapRes = await apiHandler(
    { httpMethod: 'GET', path: '/.netlify/functions/api/seo/sitemap.xml', headers: {} },
    {}
  );
  assert.strictEqual(sitemapRes.statusCode, 200);
  assert.ok(sitemapRes.body.includes('<urlset'));

  const robotsRes = await apiHandler(
    { httpMethod: 'GET', path: '/.netlify/functions/api/seo/robots.txt', headers: {} },
    {}
  );
  assert.strictEqual(robotsRes.statusCode, 200);
  assert.ok(robotsRes.body.includes('Disallow: /admin/'));

  const unauthRes = await apiHandler(
    { httpMethod: 'GET', path: '/.netlify/functions/api/seo/admin', headers: {} },
    {}
  );
  assert.strictEqual(unauthRes.statusCode, 401);

  const authHeaders = { 'x-admin-session': adminId, 'content-type': 'application/json' };
  const adminRes = await apiHandler(
    { httpMethod: 'GET', path: '/.netlify/functions/api/seo/admin', headers: authHeaders },
    {}
  );
  assert.strictEqual(adminRes.statusCode, 200);
  const adminJson = JSON.parse(adminRes.body);
  assert.strictEqual(adminJson.data.healthReport.score, 100);
  assert.strictEqual(adminJson.data.gscInfo.verificationFileName, 'googlece2476463a9f3baa.html');
});
