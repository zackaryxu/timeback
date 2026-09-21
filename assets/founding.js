// A scheduled gathering creates an Upcoming chapter, never an Official chapter.
// Official recognition is a later, explicit transition after the gathering happened.
(() => {
  const $ = (id) => document.getElementById(id);
  const form = $('chapter-form');
  if (!form) return;

  const local = ['127.0.0.1', 'localhost'].includes(location.hostname);
  const params = new URLSearchParams(location.search);
  const testMode = params.has('test') || (local && params.has('preview'));
  const requestedFlow = params.get('flow') === 'chapter-only' ? 'chapter-only' : 'new-lead';
  document.title = `${testMode ? 'Test · ' : ''}${requestedFlow === 'chapter-only' ? 'Chapter Only' : 'New Chapter Lead'} · TimeBack`;
  let chapterOnly = false;
  let existingIdentity = null;
  const invitationKey = `timeback-invitation:${testMode ? 'test' : 'real'}:${requestedFlow}`;
  const configuredApi = (document.querySelector('meta[name="founding-api"]')?.content || '').trim().replace(/\/$/,'');
  const api = local ? (testMode ? '/api/test-chapters' : '/api/chapters') : configuredApi ? configuredApi + (testMode ? '/test' : '') : '';
  const kitUrl = (document.querySelector('meta[name="kit-url"]')?.content || '').trim();
  const preview = testMode;
  let invitation = new URLSearchParams(location.hash.slice(1)).get('invite') || '';
  if (invitation) {
    history.replaceState(null, '', location.pathname + location.search);
    try { sessionStorage.setItem(invitationKey, invitation); } catch { /* Link can be reopened. */ }
  } else {
    try { invitation = sessionStorage.getItem(invitationKey) || ''; } catch { /* Storage optional. */ }
  }
  const f = {
    name: $('lead-name'), school: $('school'), city: $('city'), chapter: $('chapter-name'),
    email: $('email'), bio: $('bio'), message: $('message'), projects: $('projects'),
  };
  const chosen = { date: '', format: '' };

  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const addDays = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
  const dateFromIso = (value) => { const [y, m, d] = value.split('-').map(Number); return new Date(y, m - 1, d); };
  const pretty = (value) => value ? dateFromIso(value).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : '';
  const shortPretty = (value) => value ? dateFromIso(value).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : '';
  let deadline = iso(addDays(14));
  const policyText = `* Hold and report the first meeting by ${pretty(deadline)} to become official. Upcoming status expires after this two-week deadline. Photos encouraged, not required.`;
  $('meeting-policy').textContent = policyText;
  $('review-policy').textContent = policyText;

  const dates = $('dates');
  const rangeLabel = document.createElement('p');
  rangeLabel.className = 'date-range';
  rangeLabel.textContent = `${shortPretty(iso(addDays(1)))} – ${shortPretty(iso(addDays(14)))}`;
  dates.before(rangeLabel);
  for (let n = 1; n <= 14; n++) {
    const day = addDays(n);
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.date = iso(day); button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', pretty(iso(day)));
    button.innerHTML = `<i>${day.toLocaleDateString('en-US', { weekday: 'short' })}</i><b>${day.getDate()}</b>`;
    dates.appendChild(button);
  }

  function setText(id, value, fallback = '') { const el = $(id); if (el) el.textContent = value || fallback; }
  function setOptional(id, value) { const el = $(id); if (!el) return; el.textContent = value; el.hidden = !value; }
  const chapterName = () => f.chapter.value.trim() || (f.school.value.trim() ? `TimeBack at ${f.school.value.trim()}` : 'Your chapter');
  const placeLine = () => f.city.value.trim();
  const defaultBio = () => f.name.value.trim() ? `${f.name.value.trim()} leads ${f.school.value.trim() ? chapterName() : 'a local TimeBack chapter'}.` : 'Leading a local TimeBack chapter.';
  const defaultMessage = () => 'Our chapter brings students together to explore time management and make time for what matters.';
  let bioEdited = false, messageEdited = false;
  function syncDefaults() {
    f.bio.placeholder = f.name.value.trim() ? defaultBio() : 'Optional';
    f.message.placeholder = f.school.value.trim() ? defaultMessage() : 'Optional';
  }
  const bioText = () => chapterOnly ? (existingIdentity?.bio || '') : f.bio.value.trim() || defaultBio();
  const messageText = () => chapterOnly ? (existingIdentity?.message || '') : f.message.value.trim() || defaultMessage();
  const initials = () => {
    const parts = f.name.value.trim().split(/\s+/).filter(Boolean);
    return parts.length ? parts.slice(0, 2).map((part) => part[0].toUpperCase()).join('') : '—';
  };

  function paint(prefix) {
    setText(`${prefix}-name`, chapterName());
    setText(`${prefix}-place`, placeLine(), prefix === 'card' ? 'Your city' : '');
    setText(`${prefix}-status`, chosen.date ? `First gathering · ${shortPretty(chosen.date)}` : 'First gathering to be scheduled');
    setText(`${prefix}-lead`, f.name.value.trim(), prefix === 'card' ? 'Your name' : '');
    setText(`${prefix}-initials`, initials());
    setText(`${prefix}-role`, f.school.value.trim() ? `Chapter Lead · ${f.school.value.trim()}` : 'Chapter Lead');
    setOptional(`${prefix}-bio`, f.name.value.trim() ? bioText() : '');
    setOptional(`${prefix}-message`, f.school.value.trim() ? messageText() : '');
    if (prefix === 'card') setOptional('card-projects', f.projects.value.trim());
    const chapter = { name: f.chapter.value.trim() || (f.school.value.trim() ? chapterName() : ''), location: placeLine(), lead: f.name.value.trim(), initials: initials(), bio: f.name.value.trim() ? bioText() : '', message: f.school.value.trim() ? messageText() : '', projects: f.projects.value.trim(), date: chosen.date ? new Date(`${chosen.date}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) + (chosen.format ? ` · ${chosen.format}` : '') : '' };
    chapter.role = 'Chapter Lead';
    for (const id of ['chapter-frame', 'full-chapter-frame']) $(id)?.contentWindow?.postMessage({ type:'timeback-chapter-preview', chapter }, location.origin);
  }

  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.data?.type !== 'timeback-chapter-preview-ready') return;
    if (['chapter-frame','full-chapter-frame'].some(id => $(id)?.contentWindow === event.source)) paint('card');
  });
  $('expand-preview').addEventListener('click', () => { $('full-preview').showModal(); paint('card'); });
  $('close-preview').addEventListener('click', () => $('full-preview').close());

  let renamed = false;
  f.chapter.addEventListener('input', () => { renamed = Boolean(f.chapter.value.trim()); });
  f.school.addEventListener('input', () => { if (!renamed) f.chapter.value = f.school.value.trim() ? `TimeBack at ${f.school.value.trim()}` : ''; });
  f.bio.addEventListener('input', () => { bioEdited = Boolean(f.bio.value.trim()); });
  f.message.addEventListener('input', () => { messageEdited = Boolean(f.message.value.trim()); });
  form.addEventListener('input', (event) => {
    event.target.classList.remove('bad');
    if (![f.bio, f.message].includes(event.target)) syncDefaults();
    paint('card');
  });
  paint('card');

  function markDate(value) {
    chosen.date = value;
    for (const button of dates.querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.date === value));
    dates.classList.remove('bad'); $('date-error').hidden = true; paint('card');
  }
  dates.addEventListener('click', (event) => { const button = event.target.closest('button[data-date]'); if (!button) return; markDate(button.dataset.date); $('date').value = ''; });
  $('date').min = iso(addDays(1));
  $('date').max = deadline;
  $('other-day').addEventListener('click', () => { const field = $('other-day-field'); field.hidden = !field.hidden; if (!field.hidden) $('date').focus(); });
  $('date').addEventListener('change', (event) => { markDate(event.target.value); });

  const formats = $('formats');
  formats.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-format]'); if (!button) return;
    chosen.format = chosen.format === button.dataset.format ? '' : button.dataset.format;
    for (const candidate of formats.querySelectorAll('button')) candidate.setAttribute('aria-pressed', String(candidate.dataset.format === chosen.format));
    paint('card');
  });

  const steps = [...form.querySelectorAll('.step')];
  const crumbs = [...form.querySelectorAll('.steps li')];
  function show(n) {
    syncDefaults(); paint('card');
    steps.forEach((step) => { const active = Number(step.dataset.step) === n; step.hidden = !active; step.classList.toggle('on', active); });
    crumbs.forEach((crumb) => { const i = Number(crumb.dataset.step); crumb.classList.toggle('on', i === n); crumb.classList.toggle('done', i < n); });
    if (n === 3) {
      setText('rev-chapter', chapterName()); setText('rev-community', [f.school.value.trim(), placeLine()].filter(Boolean).join(' · '));
      setText('rev-lead', f.name.value.trim()); setText('rev-when', [pretty(chosen.date), chosen.format].filter(Boolean).join(' · '));
      setText('rev-bio', bioText()); setText('rev-message', messageText());
    }
    const heading = form.querySelector('.step.on h1'); if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function valid(n) {
    if (n === 1) {
      let firstInvalid = null;
      for (const input of form.querySelectorAll('.step[data-step="1"] [required]')) {
        const good = Boolean(input.value.trim()) && input.checkValidity(); input.classList.toggle('bad', !good); if (!good && !firstInvalid) firstInvalid = input;
      }
      $('details-error').hidden = !firstInvalid;
      if (firstInvalid) { $('details-error').textContent = 'Complete the chapter details and enter a valid email address.'; firstInvalid.focus(); }
      return !firstInvalid;
    }
    if (n === 2) {
      const good = /^\d{4}-\d{2}-\d{2}$/.test(chosen.date) && iso(dateFromIso(chosen.date)) === chosen.date && chosen.date >= iso(addDays(1)) && chosen.date <= deadline;
      dates.classList.toggle('bad', !good); $('date-error').hidden = good;
      if (!good) { $('date-error').textContent = `Select a date between ${shortPretty(iso(addDays(1)))} and ${shortPretty(deadline)}.`; dates.querySelector('button').focus(); }
      return good;
    }
    const consent = $('listing-consent'); consent.closest('.check').classList.toggle('bad', !consent.checked);
    if (!consent.checked) { $('form-error').hidden = false; $('form-error').textContent = 'Confirm permission to publish the chapter details.'; consent.focus(); }
    return consent.checked;
  }
  form.addEventListener('click', (event) => {
    const next = event.target.closest('[data-next]'); const back = event.target.closest('[data-back]');
    if (next && valid(Number(next.dataset.next) - 1)) show(Number(next.dataset.next));
    if (back) show(Number(back.dataset.back));
  });
  $('begin').addEventListener('click', () => { $('welcome').hidden = true; $('build').hidden = false; show(1); });

  // Preserve this tab's draft through an accidental refresh, without transmitting
  // personal fields or inserting them into a shareable URL.
  const draftKey = `timeback-chapter-draft-v2:${invitation || 'preview'}`;
  const saveDraft = () => {
    if (preview) return;
    try { sessionStorage.setItem(draftKey, JSON.stringify({ fields: Object.fromEntries(Object.entries(f).map(([key, input]) => [key, input.value])), date: chosen.date, format: chosen.format, renamed, bioEdited, messageEdited })); } catch { /* Storage may be unavailable in an embedded browser. */ }
  };
  try {
    const draft = preview ? null : JSON.parse(sessionStorage.getItem(draftKey) || 'null');
    if (draft?.fields) {
      for (const [key, input] of Object.entries(f)) if (typeof draft.fields[key] === 'string') input.value = draft.fields[key];
      renamed = draft.renamed === true;
      bioEdited = draft.bioEdited ?? Boolean(draft.fields.bio);
      messageEdited = draft.messageEdited ?? Boolean(draft.fields.message);
      if (!bioEdited) f.bio.value = '';
      if (!messageEdited) f.message.value = '';
      syncDefaults();
      if (typeof draft.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(draft.date) && draft.date >= iso(addDays(1)) && draft.date <= deadline) { markDate(draft.date); $('date').value = draft.date; }
      if (['In person', 'Online'].includes(draft.format)) chosen.format = draft.format;
      for (const button of formats.querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.format === chosen.format));
      if (Object.values(f).some(input => input.value.trim())) $('begin').textContent = 'Continue chapter setup →';
      paint('card');
    }
  } catch { /* Ignore an unavailable or malformed local draft. */ }
  form.addEventListener('input', saveDraft);
  form.addEventListener('change', saveDraft);
  form.addEventListener('click', saveDraft);

  // Suggestions are optional. Search only directory names; never send lead or contact fields.
  const directoryUrl = 'https://services1.arcgis.com/Ua5sjt3LWTPigjyD/ArcGIS/rest/services/Public_School_Locations_Current/FeatureServer/0/query';
  const sqlText = value => value.trim().toUpperCase().replace(/[%_]/g, '').replace(/'/g, "''");
  const jobs = {};
  function cancelSuggestions(kind) {
    const job = jobs[kind];
    if (job) { clearTimeout(job.timer); job.controller.abort(); }
    jobs[kind] = null;
    $(`${kind}-suggestions`).hidden = true;
  }
  function suggest(kind) {
    cancelSuggestions(kind);
    const value = f[kind].value.trim();
    if (value.length < 2) return;
    const job = { controller: new AbortController(), timer: null }; jobs[kind] = job;
    job.timer = setTimeout(async () => {
      const panel = $(`${kind}-suggestions`);
      let timeout;
      try {
        const cityParts = f.city.value.split(',').map(part => part.trim());
        const schoolWhere = `UPPER(NAME) LIKE '%${sqlText(value)}%'`;
        let where = kind === 'city' ? `UPPER(CITY) LIKE '${sqlText(value.split(',')[0])}%'` : schoolWhere;
        if (kind === 'school' && cityParts[0]) {
          where += ` AND UPPER(CITY) = '${sqlText(cityParts[0])}'`;
          if (/^[A-Za-z]{2}$/.test(cityParts[1] || '')) where += ` AND STATE = '${sqlText(cityParts[1])}'`;
        }
        const params = new URLSearchParams({ f: 'json', where, outFields: kind === 'city' ? 'CITY,STATE' : 'NAME,CITY,STATE', returnGeometry: 'false', returnDistinctValues: 'true', orderByFields: kind === 'city' ? 'CITY,STATE' : 'NAME', resultRecordCount: '6' });
        timeout = setTimeout(() => job.controller.abort(), 6000);
        const response = await fetch(`${directoryUrl}?${params}`, { signal: job.controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
        if (!response.ok) throw new Error('directory-unavailable');
        const result = await response.json();
        if (result.error || !Array.isArray(result.features)) throw new Error('directory-unavailable');
        if (jobs[kind] !== job || f[kind].value.trim() !== value) return;
        panel.replaceChildren();
        const heading = document.createElement('p'); heading.textContent = result.features.length ? 'Did you mean…' : 'No matching suggestion. Keep the name as entered.'; panel.append(heading);
        for (const { attributes: item } of result.features) {
          const city = `${item.CITY}, ${item.STATE}`;
          const button = document.createElement('button'); button.type = 'button';
          button.textContent = kind === 'city' ? city : `${item.NAME} · ${city}`;
          button.addEventListener('click', () => {
            f[kind].value = kind === 'city' ? city : item.NAME;
            if (kind === 'school') f.city.value = city;
            cancelSuggestions('city'); cancelSuggestions('school');
            f[kind].dispatchEvent(new Event('input', { bubbles: true }));
            cancelSuggestions(kind); saveDraft(); f[kind].focus();
          });
          panel.append(button);
        }
        const keep = document.createElement('button'); keep.type = 'button'; keep.className = 'keep-entry'; keep.textContent = `Keep “${value}”`;
        keep.addEventListener('click', () => { cancelSuggestions(kind); f[kind].focus(); }); panel.append(keep);
        panel.hidden = false;
      } catch {
        if (jobs[kind] !== job) return;
        panel.replaceChildren(); const message = document.createElement('p'); message.textContent = 'Suggestions are unavailable. Continue with the name as entered.'; panel.append(message); panel.hidden = false;
      } finally { clearTimeout(timeout); }
    }, 350);
  }
  for (const kind of ['city', 'school']) {
    f[kind].addEventListener('input', () => { if (kind === 'city') cancelSuggestions('school'); suggest(kind); });
    f[kind].addEventListener('keydown', event => { if (event.key === 'Escape') cancelSuggestions(kind); });
  }

  const slugify = (value) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 70);
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); const error = $('form-error'); error.hidden = true;
    const current = Number(form.querySelector('.step.on').dataset.step);
    if (current < 3) { if (valid(current)) show(current + 1); return; }
    if (!valid(1)) { show(1); return; }
    if (!valid(2)) { show(2); return; }
    if (!valid(3)) return;
    const payload = {
      status: 'upcoming', chapter: chapterName(), school: f.school.value.trim(), city: f.city.value.trim(),
      lead: { name: f.name.value.trim(), privateContact: f.email.value.trim(), bio: bioText(), message: messageText(), projects: f.projects.value.trim() },
      firstGathering: { date: chosen.date, format: chosen.format || null }, recognitionDeadline: deadline, listingConsent: true, submittedAt: new Date().toISOString(), previewSlug: slugify(chapterName()),
    };
    const button = form.querySelector('button[type="submit"]'); button.disabled = true;
    try {
      if (preview && local && !invitation) {
        const issued = await fetch(`/api/test-chapters/invitation?flow=${requestedFlow}`, { method: 'POST' });
        if (!issued.ok) throw new Error('setup-save-failed');
        invitation = (await issued.json()).invitation;
        try { sessionStorage.setItem(invitationKey, invitation); } catch { /* In-memory retry remains available. */ }
      }
      if (!api || !invitation) throw new Error('setup-not-live');
      let created = null;
      if (api) {
        const response = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${invitation}` }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error('setup-save-failed');
        created = await response.json();
        if (typeof created?.chapterUrl !== 'string' || !created.chapterUrl) throw new Error('setup-save-failed');
      }
      if (created?.chapter) restoreClaim(created);
      else finish(payload, created);
    } catch (cause) {
      button.disabled = false; error.hidden = false;
      error.textContent = cause?.message === 'setup-not-live' ? 'Open your invitation link to create a chapter. Your details have not been sent.' : 'Creation could not be confirmed. Your details are still here; contact zackaryxu@jointimeback.org before submitting again.';
    }
  });

  function enableLink(id, url) {
    const link = $(id); if (!link || !url) return false;
    let destination; try { destination = new URL(url, location.href); } catch { return; }
    if (destination.protocol !== 'https:' && destination.origin !== location.origin) return;
    if (!['https:', 'http:'].includes(destination.protocol)) return;
    link.href = destination.href; link.classList.remove('disabled-link'); link.removeAttribute('aria-disabled'); link.removeAttribute('tabindex');
    return true;
  }
  document.querySelectorAll('a[aria-disabled="true"]').forEach(link => { link.tabIndex = -1; link.addEventListener('click', event => { if (link.getAttribute('aria-disabled') === 'true') event.preventDefault(); }); });
  function finish(payload, created = null) {
    try { if (!preview) sessionStorage.removeItem(draftKey); } catch { /* Draft storage is optional. */ }
    $('done-sub').textContent = payload.chapter;
    $('next-meeting').textContent = `Scheduled for ${pretty(payload.firstGathering.date)}`;
    $('hold-note').textContent = `Your place in the Fall cohort is reserved through ${pretty(deadline)}. Hold and report your first meeting by then to retain your place.`;
    if (created?.chapter?.status === 'official') {
      $('next-meeting').textContent = `First meeting reported for ${pretty(payload.firstGathering.date)}`;
      $('hold-note').textContent = 'Your first meeting has been reported. Your chapter is official.';
    }
    $('preview-note').hidden = Boolean(created?.chapterUrl) || !preview;
    const slidesReady = enableLink('intro-slides', created?.kitUrl || kitUrl);
    $('slides-unavailable').hidden = Boolean(slidesReady);
    const confirmation = $('email-confirmation');
    confirmation.hidden = false;
    if (!preview && created?.ownerLinkEmailStatus === 'sent') {
      confirmation.textContent = 'We have emailed you your private chapter owner link. Use it to edit your chapter and report your first meeting. Keep it private. Anyone with this link can manage your chapter.';
    } else if (preview) {
      confirmation.textContent = 'Test mode. No private owner link has been emailed.';
    } else if (local) {
      confirmation.textContent = 'Email delivery is not connected in this local version. No private owner link has been emailed.';
    } else {
      confirmation.textContent = 'Your chapter is saved, but your private owner link email has not been confirmed. Contact TimeBack if it does not arrive.';
    }
    if (created?.chapterUrl) {
      enableLink('chapter-page', created.chapterUrl);
    }
    $('test-owner-access').hidden = !(preview && created?.chapterUrl);
    $('welcome').hidden = true; $('build').hidden = true; $('done').hidden = false;
    window.scrollTo({ top: 0 }); $('done-title').tabIndex = -1; $('done-title').focus({ preventScroll: true });
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const burst = $('celebration'); burst.replaceChildren();
      for (let n = 0; n < 28; n++) {
        const piece = document.createElement('i');
        piece.style.setProperty('--x', `${(Math.random() - .5) * 650}px`);
        piece.style.setProperty('--turn', `${Math.random() * 600 - 300}deg`);
        piece.style.setProperty('--delay', `${Math.random() * .2}s`);
        burst.append(piece);
      }
      setTimeout(() => burst.replaceChildren(), 2200);
    }
  }
  $('open-test-owner').addEventListener('click', async () => {
    const button = $('open-test-owner'); button.disabled = true;
    try {
      const response = await fetch(api + '/owner-link', {method:'POST', headers:{Authorization:`Bearer ${invitation}`}});
      if (!response.ok) throw new Error();
      const result = await response.json();
      location.assign(result.ownerUrl);
    } catch { button.textContent = 'Could not open owner page. Try again.'; button.disabled = false; }
  });
  function restoreClaim(receipt) {
    const chapter = receipt.chapter;
    if (chapter.flow === 'chapter-only') applyIdentity(chapter.lead);
    deadline = chapter.recognitionDeadline;
    f.name.value = chapter.lead.name; f.chapter.value = chapter.name;
    f.city.value = chapter.location; f.school.value = chapter.school;
    f.bio.value = chapter.lead.bio; f.message.value = chapter.lead.message; f.projects.value = chapter.lead.projects;
    chosen.date = chapter.firstGathering.date; chosen.format = chapter.firstGathering.format || '';
    finish({ chapter: chapter.name, firstGathering: chapter.firstGathering }, receipt);
    if (chapter.status !== 'official' && deadline < iso(new Date())) $('hold-note').textContent = 'The Upcoming reservation has expired. Contact TimeBack about next steps.';
  }
  function applyIdentity(identity, requiresEmail = false) {
    chapterOnly = true; existingIdentity = identity;
    f.name.value = identity.name; f.name.required = false;
    f.name.closest('p').hidden = true;
    f.email.required = requiresEmail; f.email.closest('label').hidden = !requiresEmail;
    document.querySelector('.bio-section').hidden = true;
    $('rev-bio').closest('div').hidden = true;
    $('rev-message').closest('div').hidden = true;
    $('rev-lead').previousElementSibling.textContent = 'Chapter Lead';
    document.querySelector('[data-step="3"] [data-back="1"]').textContent = 'Edit chapter details';
    f.bio.value = identity.bio || ''; f.message.value = identity.message || ''; f.projects.value = identity.projects || '';
    document.querySelector('.recognition-rewards>div:last-child').hidden = true;
    document.querySelector('.recognition-rewards').style.gridTemplateColumns = '1fr';
    $('welcome-title').textContent = identity.name?.trim() ? `Welcome, ${identity.name.trim()}.` : 'Set up your chapter.';
    $('welcome').querySelectorAll('p, .letter-signature').forEach(el => el.hidden = true);
    document.querySelector('.declaration p:nth-child(2)').firstChild.textContent = 'Starting a TimeBack chapter in ';
    paint('card');
  }
  async function loadInvitation() {
    $('begin').disabled = true;
    await fetch(api, { headers: { Authorization: `Bearer ${invitation}` }, cache: 'no-store' })
      .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(receipt => {
        if (receipt.identity) applyIdentity(receipt.identity, receipt.requiresEmail === true);
        if (receipt.claimed) restoreClaim(receipt);
        else { $('begin').disabled = false; $('welcome').hidden = false; }
        $('invitation-loading').hidden = true;
      })
      .catch(() => { $('invitation-loading').textContent = 'Invitation unavailable. Reopen your link to retry.'; });
  }
  if (testMode) {
    const bar = document.createElement('div'); bar.className = 'test-controls';
    bar.innerHTML = '<span>Test mode · ' + (requestedFlow === 'chapter-only' ? 'Chapter Only' : 'New Chapter Lead') + '</span><button type="button">Start a new test</button>';
    bar.querySelector('button').hidden = !local;
    document.querySelector('main').before(bar);
    bar.querySelector('button').onclick = async () => {
      if (invitation) {
        const response = await fetch('/api/test-chapters/reset', { method:'POST', headers:{Authorization:`Bearer ${invitation}`} });
        if (!response.ok && response.status !== 401) { bar.querySelector('button').textContent = 'Reset failed. Retry'; return; }
      }
      try { sessionStorage.removeItem(invitationKey); } catch {} location.reload();
    };
    $('begin').disabled = true;
    (async () => {
      if (!invitation) {
        if (!local) throw new Error('A private test invitation is required');
        const response = await fetch(`/api/test-chapters/invitation?flow=${requestedFlow}`, { method:'POST' });
        if (!response.ok) throw new Error();
        invitation = (await response.json()).invitation;
        try { sessionStorage.setItem(invitationKey, invitation); } catch {}
      }
      await loadInvitation();
    })().catch(() => { $('invitation-loading').textContent = 'Test setup unavailable. Refresh to retry.'; });
  } else if (api && invitation) loadInvitation();
  else $('invitation-loading').textContent = 'Open your private invitation link to set up a chapter.';
})();
