(() => {
  let current = null;
  const defaults = {name:'',location:'',message:'',date:'',lead:'',initials:'',bio:'',projects:''};
  let ready = false;
  function render() {
    if (!ready) return;
    for (const element of document.querySelectorAll('[data-chapter]')) {
      const key = element.dataset.chapter;
      element.textContent = typeof current?.[key] === 'string' ? current[key] : defaults[key] || '';
    }
    const has = key => Boolean(document.querySelector(`[data-chapter="${key}"]`)?.textContent.trim());
    document.querySelector('.cp-status').hidden = true;
    document.querySelector('.cp-heading').hidden = !has('name') && !has('location');
    document.querySelector('.cp-preview-photos').hidden = !has('name');
    document.querySelector('.cp-message').hidden = !has('message');
    document.querySelector('.cp-introduction').hidden = !has('message');
    document.querySelector('.cp-lead').hidden = !has('lead');
    document.querySelector('#cp-lead-heading').textContent = current?.role || 'Chapter Lead';
  }
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== parent || event.data?.type !== 'timeback-chapter-preview') return;
    current = event.data.chapter; render();
  });
  fetch('../assets/chapter-page.html').then(response => {if(!response.ok) throw new Error(); return response.text();}).then(template => {
    document.getElementById('chapter-preview').innerHTML = template;
    // Illustrative photo slots belong only to setup, never to published chapters.
    const placeholders = document.createElement('div');
    placeholders.className = 'cp-preview-photos';
    placeholders.setAttribute('role', 'img');
    placeholders.setAttribute('aria-label', 'Photo placeholders');
    placeholders.innerHTML = '<div class="cp-photo-placeholder"><div class="cp-photo-shapes" aria-hidden="true"><i></i><i></i></div></div><div class="cp-photo-placeholder"><div class="cp-photo-shapes" aria-hidden="true"><i></i><i></i></div></div>';
    document.querySelector('.chapter-document').append(placeholders);
    ready = true; render(); parent.postMessage({type:'timeback-chapter-preview-ready'},location.origin);
  }).catch(() => { document.getElementById('chapter-preview').textContent = 'Chapter preview unavailable. Setup details are preserved.'; });
})();
