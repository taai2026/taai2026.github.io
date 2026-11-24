/* Press pages: click-to-play YouTube videos. Each [data-yt] link shows a
   self-hosted thumbnail and points to YouTube, so it works without JavaScript.
   On click it is replaced by a youtube-nocookie.com player, so no YouTube
   content or cookies load until the reader asks to play. Modifier clicks
   (new tab/window) are left to the browser. */
(() => {
  const ID = /^[\w-]{11}$/;
  document.addEventListener('click', event => {
    const link = event.target.closest('a[data-yt]');
    if (!link || event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const id = link.dataset.yt;
    if (!ID.test(id)) return;
    event.preventDefault();
    const params = new URLSearchParams({ autoplay: '1', rel: '0', playsinline: '1' });
    const frame = document.createElement('iframe');
    frame.src = `https://www.youtube-nocookie.com/embed/${id}?${params}`;
    frame.title = link.dataset.ytTitle || 'YouTube video';
    frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.allowFullscreen = true;
    const box = document.createElement('div');
    box.className = link.className;
    if (link.lang) box.lang = link.lang;
    box.append(frame);
    link.replaceWith(box);
    frame.focus();
  });
})();
