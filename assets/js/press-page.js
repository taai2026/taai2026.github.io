/* Press release page: print / save as PDF, copy the canonical link, and
   collapse the table of contents on narrow screens. Buttons stay hidden
   when the browser cannot support them. */
(() => {
  const printBtn = document.querySelector('[data-press-print]');
  if (printBtn && typeof window.print === 'function') {
    printBtn.hidden = false;
    printBtn.addEventListener('click', () => window.print());
  }

  const copyBtn = document.querySelector('[data-copy-link]');
  if (copyBtn && navigator.clipboard) {
    const canonical = document.querySelector('link[rel="canonical"]');
    const url = canonical ? canonical.href : location.href;
    const label = copyBtn.textContent;
    copyBtn.hidden = false;
    copyBtn.setAttribute('aria-live', 'polite');
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(url);
        copyBtn.textContent = copyBtn.dataset.copied || label;
        setTimeout(() => { copyBtn.textContent = label; }, 2000);
      } catch {
        window.prompt(label, url);
      }
    });
  }

  const toc = document.querySelector('[data-press-toc]');
  if (toc && window.matchMedia('(max-width: 999px)').matches) toc.open = false;
})();
