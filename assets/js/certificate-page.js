/* Certificate pages: "Copy link" button (shown only when the Clipboard API
   is available). Copies the page's canonical URL. */
(() => {
  const btn = document.querySelector('[data-copy-link]');
  if (!btn || !navigator.clipboard) return;
  const canonical = document.querySelector('link[rel="canonical"]');
  const url = canonical ? canonical.href : location.href;
  const label = btn.textContent;
  btn.hidden = false;
  btn.setAttribute('aria-live', 'polite');
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url);
      btn.textContent = btn.dataset.copied || label;
      setTimeout(() => { btn.textContent = label; }, 2000);
    } catch {
      window.prompt(label, url);
    }
  });
})();
