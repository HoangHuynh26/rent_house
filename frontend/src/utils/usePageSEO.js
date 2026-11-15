import { useEffect } from 'react';
import api from '../services/api';

let cachedRemoteSeo = null;
let pendingRemoteSeoPromise = null;

const getNormalizedCurrentUrl = () => {
  if (typeof window === 'undefined') return '';
  const path = window.location.pathname === '/' ? '/' : window.location.pathname.replace(/\/+$/, '');
  return `${window.location.origin}${path}`;
};

const applySeoTags = ({
  title,
  description,
  keywords,
  canonicalUrl,
  ogType,
  ogImage,
  noIndex,
  businessName,
  gscMetaToken,
  jsonLd,
}) => {
  const brand = businessName || 'Nhà Trọ Thanh Tâm';
  const fullTitle = title
    ? title.includes(brand)
      ? title
      : `${title} | ${brand}`
    : `${brand} - Cho Thuê Phòng Trọ Tiện Nghi, Giá Tốt & Minh Bạch`;

  document.title = fullTitle;

  const setMetaTag = (attribute, attributeValue, content) => {
    if (!content) return;
    let el = document.querySelector(`meta[${attribute}="${attributeValue}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attribute, attributeValue);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  setMetaTag(
    'name',
    'robots',
    noIndex
      ? 'noindex, nofollow'
      : 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1'
  );

  if (description) {
    setMetaTag('name', 'description', description);
    setMetaTag('property', 'og:description', description);
    setMetaTag('name', 'twitter:description', description);
  }
  if (keywords) {
    setMetaTag('name', 'keywords', keywords);
  }

  setMetaTag('property', 'og:title', fullTitle);
  setMetaTag('property', 'og:type', ogType || 'website');
  setMetaTag('name', 'twitter:title', fullTitle);

  const resolvedOgImage = ogImage || (typeof window !== 'undefined' ? `${window.location.origin}/og-image.png` : '');
  if (resolvedOgImage) {
    setMetaTag('property', 'og:image', resolvedOgImage);
    setMetaTag('name', 'twitter:image', resolvedOgImage);
  }

  const currentUrl = canonicalUrl || getNormalizedCurrentUrl();
  if (currentUrl) {
    setMetaTag('property', 'og:url', currentUrl);
    let canonicalEl = document.querySelector('link[rel="canonical"]');
    if (!canonicalEl) {
      canonicalEl = document.createElement('link');
      canonicalEl.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalEl);
    }
    canonicalEl.setAttribute('href', currentUrl);
  }

  if (gscMetaToken) {
    setMetaTag('name', 'google-site-verification', gscMetaToken);
  }

  if (jsonLd && typeof jsonLd === 'object') {
    let scriptEl = document.querySelector('script[type="application/ld+json"]');
    if (!scriptEl) {
      scriptEl = document.createElement('script');
      scriptEl.setAttribute('type', 'application/ld+json');
      document.head.appendChild(scriptEl);
    }
    scriptEl.textContent = JSON.stringify(jsonLd);
  }
};

/**
 * Custom React hook for dynamic SEO, Google Search Console verification, and JSON-LD Schema management.
 */
export function usePageSEO({
  title = '',
  description = '',
  keywords = '',
  canonicalUrl = '',
  ogType = 'website',
  ogImage = '',
  noIndex = false,
  useRemoteConfig = false,
} = {}) {
  useEffect(() => {
    let cancelled = false;

    applySeoTags({
      title,
      description,
      keywords,
      canonicalUrl,
      ogType,
      ogImage,
      noIndex,
    });

    if (useRemoteConfig && !noIndex) {
      const applyRemote = (remote) => {
        if (cancelled || !remote?.settings) return;
        const s = remote.settings;
        applySeoTags({
          title: s.siteTitle || title,
          description: s.siteDescription || description,
          keywords: s.siteKeywords || keywords,
          canonicalUrl: canonicalUrl || (s.canonicalBaseUrl ? `${s.canonicalBaseUrl}/` : ''),
          ogType,
          ogImage: ogImage || s.ogImageUrl,
          noIndex: false,
          businessName: s.businessName,
          gscMetaToken: s.gscMetaToken,
          jsonLd: remote.jsonLd,
        });
      };

      if (cachedRemoteSeo) {
        applyRemote(cachedRemoteSeo);
      } else {
        if (!pendingRemoteSeoPromise) {
          pendingRemoteSeoPromise = api
            .get('/seo/public')
            .then((res) => {
              cachedRemoteSeo = res?.data || null;
              return cachedRemoteSeo;
            })
            .catch(() => null)
            .finally(() => {
              pendingRemoteSeoPromise = null;
            });
        }
        pendingRemoteSeoPromise.then(applyRemote);
      }
    }

    return () => {
      cancelled = true;
    };
  }, [title, description, keywords, canonicalUrl, ogType, ogImage, noIndex, useRemoteConfig]);
}

export const invalidateSeoCache = () => {
  cachedRemoteSeo = null;
};

export default usePageSEO;
