function normalizeBaseUrl(url) {
  if (!url) return '';
  return url.endsWith('/') ? url : `${url}/`;
}

function setupMatomo() {
  const config = window.APP_CONFIG || {};
  const baseUrl = normalizeBaseUrl(config.matomoUrl);
  const siteId = config.matomoSiteId;

  if (!baseUrl || !siteId) return;

  window._paq = window._paq || [];
  window._paq.push(['setTrackerUrl', `${baseUrl}matomo.php`]);
  window._paq.push(['setSiteId', siteId]);
  window._paq.push(['enableLinkTracking']);
  window._paq.push(['trackPageView']);
  window._paq.push(['enableHeartBeatTimer', 15]);

  const script = document.createElement('script');
  script.async = true;
  script.src = `${baseUrl}matomo.js`;
  document.head.appendChild(script);
}

export { setupMatomo };
