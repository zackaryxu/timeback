const menu = document.querySelector('.mobile-menu');
const contactPanel = document.querySelector('#contact-panel');
const groups = [...document.querySelectorAll('.nav-group')];
const closeGroup = (group, restoreFocus = false) => {
  group.open = false;
  if (restoreFocus) group.querySelector('summary').focus();
};
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (contactPanel?.open) return; // Native dialog dismissal keeps focus on its opener.
  const openGroup = groups.find(group => group.open && group.contains(document.activeElement));
  if (openGroup) {
    closeGroup(openGroup, true);
    event.preventDefault();
    return;
  }
  groups.forEach(group => closeGroup(group));
  if (menu?.open) {
    menu.open = false;
    menu.querySelector('summary').focus();
  }
});

// Keep mailto as the no-JavaScript fallback; offer an explicit route in browsers
// without a mail handler. Nothing is submitted or sent from this site.
if (contactPanel && typeof contactPanel.showModal === 'function') {
  const address = contactPanel.querySelector('.contact-address');
  const copy = contactPanel.querySelector('.contact-copy');
  const status = contactPanel.querySelector('.contact-status');
  const gmail = contactPanel.querySelector('.contact-gmail');
  const mailApp = contactPanel.querySelector('.contact-mail-app');
  let opener;
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="mailto:"]');
    if (!link || contactPanel.contains(link) || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const email = new URL(link.href);
    const recipient = decodeURIComponent(email.pathname);
    // Other members' personal email links keep their own destination.
    if (recipient.toLowerCase() !== address.textContent.trim().toLowerCase()) return;
    const compose = new URL('https://mail.google.com/mail/');
    compose.searchParams.set('view', 'cm');
    compose.searchParams.set('fs', '1');
    compose.searchParams.set('to', recipient);
    if (email.searchParams.has('subject')) compose.searchParams.set('su', email.searchParams.get('subject'));
    if (email.searchParams.has('body')) compose.searchParams.set('body', email.searchParams.get('body'));
    event.preventDefault();
    opener = link;
    gmail.href = compose.href;
    mailApp.href = link.href;
    status.textContent = '';
    copy.textContent = 'Copy email';
    contactPanel.showModal();
  });
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(address.textContent.trim());
      if (!contactPanel.open) return;
      copy.textContent = 'Copied';
      status.textContent = 'Email address copied.';
    } catch {
      if (!contactPanel.open) return;
      const range = document.createRange();
      range.selectNodeContents(address);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      status.textContent = 'Select and copy the address above, or open Gmail.';
    }
  });
  contactPanel.querySelector('.contact-close').addEventListener('click', () => contactPanel.close());
  contactPanel.addEventListener('click', event => {
    if (event.target !== contactPanel) return;
    const box = contactPanel.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) contactPanel.close();
  });
  contactPanel.addEventListener('close', () => opener?.focus());
}
document.addEventListener('click', event => {
  groups.forEach(group => {
    if (group.open && !group.contains(event.target)) closeGroup(group);
  });
  if (menu?.open && (!menu.contains(event.target) || event.target.closest('a'))) menu.open = false;
});
groups.forEach(group => {
  group.addEventListener('focusout', event => {
    if (!group.contains(event.relatedTarget)) closeGroup(group);
  });
});
window.matchMedia('(max-width: 1000px)').addEventListener('change', () => {
  groups.forEach(group => closeGroup(group));
  if (menu) menu.open = false;
});
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('arrive');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: .15 });
  document.querySelectorAll('.shared-copy, .home-photo').forEach(element => observer.observe(element));
}
