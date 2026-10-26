import { useEffect } from 'react';

/**
 * Custom React hook for dynamic client-side SEO management
 * Updates page title, meta description, canonical URL, and OpenGraph/Twitter cards.
 */
export function usePageSEO({
  title = '',
  description = '',
  keywords = '',
  canonicalUrl = '',
  ogType = 'website',
  ogImage = ''
} = {}) {
  useEffect(() => {
    // 1. Update Document Title
    const baseTitle = 'Nhà Trọ Thanh Tâm';
    const fullTitle = title ? `${title} | ${baseTitle}` : `${baseTitle} - Cho Thuê Phòng Trọ Tiện Nghi, Giá Tốt & Minh Bạch`;
    document.title = fullTitle;

    // Helper to update or create meta tags
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

    // 2. Standard Meta Tags
    if (description) {
      setMetaTag('name', 'description', description);
    }
    if (keywords) {
      setMetaTag('name', 'keywords', keywords);
    }

    // 3. OpenGraph Tags
    setMetaTag('property', 'og:title', fullTitle);
    if (description) setMetaTag('property', 'og:description', description);
    setMetaTag('property', 'og:type', ogType);
    if (ogImage) setMetaTag('property', 'og:image', ogImage);

    const currentUrl = canonicalUrl || (typeof window !== 'undefined' ? window.location.href : '');
    if (currentUrl) setMetaTag('property', 'og:url', currentUrl);

    // 4. Twitter Card Tags
    setMetaTag('name', 'twitter:title', fullTitle);
    if (description) setMetaTag('name', 'twitter:description', description);
    if (ogImage) setMetaTag('name', 'twitter:image', ogImage);

    // 5. Canonical Link Tag
    if (currentUrl) {
      let canonicalEl = document.querySelector('link[rel="canonical"]');
      if (!canonicalEl) {
        canonicalEl = document.createElement('link');
        canonicalEl.setAttribute('rel', 'canonical');
        document.head.appendChild(canonicalEl);
      }
      canonicalEl.setAttribute('href', currentUrl);
    }
  }, [title, description, keywords, canonicalUrl, ogType, ogImage]);
}

export default usePageSEO;
