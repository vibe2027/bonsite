/**
 * Compatibility loader for the singular vibe-fix entrypoint.
 */
(function () {
  'use strict';

  if (document.querySelector('script[src*="/js/vibe-fixes.js"]')) return;

  var script = document.createElement('script');
  script.src = '/js/vibe-fixes.js';
  document.head.appendChild(script);
})();
