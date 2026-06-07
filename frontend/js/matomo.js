function setupMatomo() {
  const config = window.APP_CONFIG || {};
  const u = config.matomoUrl || '//10.0.10.201/';
  const siteId = config.matomoSiteId || '1';

  var _paq = (window._paq = window._paq || []);
  _paq.push(['trackPageView']);
  _paq.push(['enableLinkTracking']);
  (function() {
    var base = u.endsWith('/') ? u : `${u}/`;
    _paq.push(['setTrackerUrl', base + 'matomo.php']);
    _paq.push(['setSiteId', siteId]);
    var d = document, g = d.createElement('script'), s = d.getElementsByTagName('script')[0];
    g.async = true;
    g.src = base + 'matomo.js';
    s.parentNode.insertBefore(g, s);
  })();
}

export { setupMatomo };
