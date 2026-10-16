(() => {
  const figure = document.querySelector('[data-chapter-rotation]');
  if (!figure || figure.dataset.ready === 'true') return;
  const slides = [...figure.querySelectorAll('[data-chapter-slide]')];
  const caption = figure.querySelector('.network-photo-caption');
  const controls = figure.querySelector('.network-photo-controls');
  const toggle = figure.querySelector('[data-rotation-toggle]');
  const next = figure.querySelector('[data-rotation-next]');
  if (slides.length < 2 || !caption || !controls || !toggle || !next) return;
  figure.dataset.ready = 'true';
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0, paused = motion.matches, timer;
  function show(nextIndex) {
    index = nextIndex % slides.length;
    slides.forEach((slide, i) => {
      slide.classList.toggle('is-active', i === index);
      slide.setAttribute('aria-hidden', String(i !== index));
    });
    caption.textContent = slides[index].dataset.caption;
  }
  function schedule() {
    clearInterval(timer);
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.setAttribute('aria-label', paused ? 'Play chapter photos' : 'Pause chapter photos');
    toggle.innerHTML = paused ? '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m8 5 11 7-11 7z"/></svg>' : '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>';
    if (!paused && !document.hidden) timer = setInterval(() => {
      if (!figure.matches(':hover, :focus-within')) show(index + 1);
    }, 12000);
  }
  toggle.addEventListener('click', () => { paused = !paused; schedule(); });
  next.addEventListener('click', () => { show(index + 1); schedule(); });
  document.addEventListener('visibilitychange', schedule);
  motion.addEventListener('change', event => { paused = event.matches; schedule(); });
  controls.hidden = false;
  show(0); schedule();
})();
