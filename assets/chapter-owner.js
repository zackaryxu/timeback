(() => {
  'use strict';
  const heicModuleUrl=new URL('./vendor/heic-to-1.5.2.js',document.currentScript.src).href;
  let heicDecoder;
  const $ = id => document.getElementById(id);
  const test = new URLSearchParams(location.search).get('test') === '1';
  const local = ['127.0.0.1', 'localhost'].includes(location.hostname);
  const configuredApi = (document.querySelector('meta[name="chapter-api"]')?.content || '').replace(/\/$/,'');
  const api = local ? (test ? '/api/test-chapters/owner' : '/api/chapters/owner') : configuredApi ? `${configuredApi}${test ? '/test' : ''}/owner` : '';
  const key = `timeback-owner-${test ? 'test' : 'local'}`;
  let token = new URLSearchParams(location.hash.slice(1)).get('owner') || '';
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  try { if (token) sessionStorage.setItem(key, token); else token = sessionStorage.getItem(key) || ''; } catch { /* Access survives this page only. */ }
  let record;
  let emailBusy = false, emailAttempted = false, emailRetryAt = 0, emailTimer;
  const needsEmailVerification = () => record?.profileEmailVerificationRequired === true && record.emailVerified !== true;
  function emailControls() {
    const remaining = Math.max(0, Math.ceil((emailRetryAt - Date.now()) / 1000));
    $('profile-email-send').disabled = emailBusy || remaining > 0 || !needsEmailVerification();
    $('profile-email-send').textContent = remaining ? `Resend in ${remaining}s` : emailAttempted ? 'Resend' : 'Send code';
    $('profile-email-verify').disabled = emailBusy || !needsEmailVerification();
    $('profile-email-code').disabled = emailBusy || !needsEmailVerification();
  }
  function paintEmail(data) {
    const verified = data.emailVerified === true;
    const required = data.profileEmailVerificationRequired === true;
    $('profile-email-section').hidden = !required || verified;
    $('profile-email-address').textContent = data.maskedEmail ? `Saved email: ${data.maskedEmail}` : '';
    $('profile-email-address').hidden = !data.maskedEmail;
    const messages = {
      'not-enabled': 'Email verification saved. Profile access email is not enabled yet.',
      'awaiting-verification': 'Email verification saved. Profile access email has not been sent.',
      pending: 'Email verification saved. Profile access email is pending.',
      sent: 'Email verification saved. Your private profile-editing link has been emailed.',
      unknown: 'Email verification saved. Profile access email delivery could not be confirmed.',
      failed: 'Email verification saved. Profile access email could not be sent. Contact TimeBack for help.'
    };
    const showStatus = verified && (required || (data.recognitionEmailStatus && data.recognitionEmailStatus !== 'not-enabled'));
    $('profile-email-status').hidden = !showStatus;
    $('profile-email-status').textContent = showStatus ? messages[data.recognitionEmailStatus] || 'Email verification saved. Your profile-editing link will be sent after your chapter becomes official and its page is published.' : '';
    if (!needsEmailVerification()) {
      clearInterval(emailTimer);
      $('profile-email-code').value = '';
      $('profile-email-feedback').textContent = '';
      $('profile-email-test-code').textContent = '';
      $('profile-email-test-code').hidden = true;
    }
    emailControls();
  }
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const pretty = value => new Date(value + 'T12:00:00').toLocaleDateString('en-US', {month:'long', day:'numeric', year:'numeric'});
  async function request(path = '', payload) {
    const response = await fetch(api + path, {method: payload ? 'POST' : 'GET', cache:'no-store', headers:{Authorization:`Bearer ${token}`, ...(payload ? {'Content-Type':'application/json'} : {})}, ...(payload ? {body:JSON.stringify(payload)} : {})});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'The request could not be confirmed. Try again.');
    return data;
  }
  function paint(data) {
    record = data;
    paintEmail(data);
    const c = data.chapter;
    $('workspace').hidden = false; $('access-status').hidden = true; $('test-notice').hidden = !test;
    $('chapter-title').textContent = c.name;
    $('chapter-status').textContent = c.status === 'official' ? 'Official chapter' : c.recognitionDeadline < today() ? 'Upcoming status expired' : 'Upcoming chapter';
    const destination = new URL(data.chapterUrl,location.href);
    if(destination.origin!==location.origin)throw new Error('Unexpected chapter page address');
    $('public-page').href = destination.href;
    $('deadline').textContent = `Hold and report the first meeting by ${pretty(c.recognitionDeadline)} for official recognition.`;
    for (const [id, value] of Object.entries({'chapter-name':c.name, school:c.school, city:c.location, message:c.lead.message, 'meeting-date':c.firstGathering.date})) $(id).value = value || '';
    paintContent();
    // Preserve a missed scheduled date while allowing unrelated details to save.
    $('meeting-date').min = c.firstGathering.date < today() ? c.firstGathering.date : today(); $('meeting-date').max = c.recognitionDeadline;
    $('meeting-date').disabled = Boolean(data.report) || c.recognitionDeadline < today();
    $('report-date').max = today();
    if (c.createdDate) $('report-date').min = c.createdDate;
    $('report-date').value = c.firstGathering.date <= today() ? c.firstGathering.date : '';
    $('report-form').hidden = Boolean(data.report);
    $('report-result').hidden = !data.report;
    if (data.report) {
      $('deadline').hidden = true;
      $('report-result').textContent = data.report.outcome === 'official'
        ? `First meeting reported for ${pretty(data.report.date)}. Your chapter is now official.`
        : `First meeting reported for ${pretty(data.report.date)}. The reporting deadline has passed. Contact TimeBack to review recognition.`;
    }
  }
  async function submit(event, statusId, work) {
    event.preventDefault();
    const button = event.target.querySelector('button'); button.disabled = true; $(statusId).textContent = 'Saving…';
    try { paint(await work()); $(statusId).textContent = record.publication?.status === 'pending' ? 'Saved. Website publication is pending.' : 'Saved.'; }
    catch (error) { $(statusId).textContent = error.message; }
    finally { button.disabled = false; }
  }
  const node = (tag, text, className) => { const el = document.createElement(tag); if (text) el.textContent = text; if (className) el.className = className; return el; };
  let imageUrls = [];
  async function thumbnail(id, alt) {
    const img = node('img'); img.alt = alt;
    const response = await fetch(api.replace('/owner','/media/')+id,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
    if (response.ok) { const url = URL.createObjectURL(await response.blob()); imageUrls.push(url); img.src=url; }
    return img;
  }
  async function content(payload, feedback) {
    try { const result=await request('/content',payload); paint(result); $(feedback).textContent=payload.action==='submit' ? 'Submitted for TimeBack review. Not published to Highlights.' : result.publication?.status === 'pending' ? 'Saved. Website publication is pending.' : 'Saved.'; }
    catch(error) { $(feedback).textContent=error.message; }
  }
  function action(label, callback) {
    const b=node('button',label,'secondary'); b.type='button'; b.addEventListener('click',async()=>{b.disabled=true;try{await callback();}finally{b.disabled=false;}});return b;
  }
  function paintContent() {
    imageUrls.forEach(URL.revokeObjectURL); imageUrls=[];
    const c=record.chapter;
    $('assigned-lead').textContent=`${c.lead.name} · Assigned Chapter Lead. Additional listings do not grant owner access.`;
    $('photo-list').replaceChildren(); $('team-list').replaceChildren(); $('activity-list').replaceChildren();
    const oldPhoto=$('team-photo').value;
    $('team-photo').replaceChildren(new Option('No photo',''));
    const selected=new Set([...$('activity-photos').querySelectorAll('input:checked')].map(i=>i.value));
    $('activity-photos').replaceChildren();
    (c.photos||[]).forEach((p,index)=>{
      const label=p.caption || `Photo ${index+1}`;
      $('team-photo').append(new Option(label,p.id));
      const choice=node('label'); const check=node('input'); check.type='checkbox';check.value=p.id;check.checked=selected.has(p.id);choice.append(check,document.createTextNode(label));$('activity-photos').append(choice);
      const card=node('form',null,'photo-card');
      thumbnail(p.id,label).then(img=>{if(card.isConnected)card.prepend(img);});
      const caption=node('label','Caption');const input=node('input');input.value=p.caption;input.maxLength=200;caption.append(input);
      const display=node('label',null,'consent');const box=node('input');box.type='checkbox';box.checked=p.gallery;display.append(box,document.createTextNode('Show in chapter gallery'));
      const permission=node('label',null,'consent');const consent=node('input');consent.type='checkbox';permission.append(consent,document.createTextNode('I have permission to publish this photo.'));
      const save=node('button','Save photo');save.type='submit';
      card.append(caption,display,permission,save,action('Remove photo',()=>{if(confirm('Remove this photo from the chapter and all activities/team listings?'))return content({kind:'photos',action:'remove',id:p.id},'photo-feedback');}));
      card.addEventListener('submit',async e=>{e.preventDefault();save.disabled=true;await content({kind:'photos',action:'save',id:p.id,caption:input.value,gallery:box.checked,permission:consent.checked},'photo-feedback');save.disabled=false;});
      $('photo-list').append(card);
    });
    $('team-photo').value=oldPhoto;
    if (!(c.photos||[]).length) $('activity-photos').append(node('p','Upload photos in Chapter photos to attach them here.','section-note'));
    (c.team||[]).forEach(p=>{
      const card=node('article',null,'content-row');card.append(node('h3',p.name),node('p',p.role));
      card.append(action('Edit',()=>{for(const k of ['id','name','role','bio','photo'])$('team-'+k).value=p[k]||'';$('team-permission').checked=false;$('team-editor').open=true;$('team-name').focus();}),action('Remove',()=>{if(confirm(`Remove ${p.name} from the chapter team?`))return content({kind:'team',action:'remove',id:p.id},'team-feedback');}));$('team-list').append(card);
    });
    (c.activities||[]).forEach(a=>{
      const card=node('article',null,'content-row');card.append(node('h3',a.title),node('p',pretty(a.date)),node('p',a.description));
      card.append(action('Edit',()=>{for(const k of ['id','title','date','description'])$('activity-'+k).value=a[k];$('activity-photos').querySelectorAll('input').forEach(i=>i.checked=a.photos.includes(i.value));$('activity-permission').checked=false;$('activity-editor').open=true;$('activity-title').focus();}),action('Remove',()=>{if(confirm('Remove this activity and its pending Highlights submission?'))return content({kind:'activities',action:'remove',id:a.id},'activity-feedback');}));
      const submitted=record.highlightSubmissions?.[a.id];
      const unchanged=submitted && JSON.stringify(submitted.activity)===JSON.stringify(a);
      if(unchanged)card.append(node('p','Submitted for TimeBack Highlights review.','section-note'));
      else card.append(action(submitted?'Resubmit for TimeBack Highlights':'Submit for TimeBack Highlights',()=>content({kind:'activities',action:'submit',id:a.id},'activity-feedback')));
      $('activity-list').append(card);
    });
    $('activity-date').max=today();
  }
  async function preparePhoto(file) {
    if(file.size>8*1024*1024)throw new Error('Images must be under 8 MB.');
    const unreadable='This photo could not be read. Choose a still JPEG, PNG, WebP or HEIC image, or export the photo as JPEG and try again.';
    // Sniff bytes rather than trusting MIME/extension (some phones omit MIME).
    const bytes=new Uint8Array(await file.slice(0,128).arrayBuffer());
    const ascii=(start,end)=>String.fromCharCode(...bytes.slice(start,end));
    const heic=ascii(4,8)==='ftyp'&&Array.from({length:Math.floor((bytes.length-8)/4)},(_,i)=>8+i*4).filter(p=>p!==12).some(p=>['heic','heix','hevc','hevx','mif1','msf1'].includes(ascii(p,p+4)));
    const supported=heic||(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)
      || (bytes[0]===137&&ascii(1,4)==='PNG'&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10)
      || (ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP');
    if(!supported)throw new Error(unreadable);
    if(ascii(8,12)==='WEBP'&&ascii(12,16)==='VP8X'&&(bytes[20]&2))throw new Error(unreadable);
    let url=URL.createObjectURL(file);const img=new Image();
    let canvas;
    try {
      const load=()=>new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});
      try{await load();}catch(error){
        if(!heic)throw error;
        // Lazy, same-origin dependency. The original never leaves this device.
        heicDecoder ||= import(heicModuleUrl).catch(error=>{heicDecoder=null;throw error;});
        const {heicTo}=await heicDecoder;
        const converted=await heicTo({blob:file,type:'image/jpeg',quality:0.9});
        URL.revokeObjectURL(url);url=URL.createObjectURL(converted);await load();
      }
      if(!img.naturalWidth||!img.naturalHeight)throw new Error();
      const scale=Math.min(1,1800/img.naturalWidth,1800/img.naturalHeight);
      canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
      canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
      const ctx=canvas.getContext('2d');
      if(!ctx)throw new Error();
      ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.85));
      if(!blob||blob.type!=='image/jpeg'||!blob.size||blob.size>8*1024*1024)throw new Error();
      return blob;
    } catch {throw new Error(unreadable);}
    finally {img.src='';URL.revokeObjectURL(url);if(canvas){canvas.width=0;canvas.height=0;}}
  }
  $('photo-files').addEventListener('change',async()=>{
    const files=$('photo-files');files.disabled=true;
    try {
      for(const file of files.files){
        $('photo-feedback').textContent='Preparing photo…';
        const photo=await preparePhoto(file);
        $('photo-feedback').textContent='Uploading…';
        const response=await fetch(api+'/photos',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':photo.type},body:photo});
        const result=await response.json();if(!response.ok)throw new Error(result.error||'The photo could not be uploaded. Please try again.');paint(result);
      }
      $('photo-feedback').textContent='Uploaded. Select where each photo should appear.';
    }catch(error){$('photo-feedback').textContent=error.message;}finally{files.disabled=false;files.value='';}
  });
  $('team-form').addEventListener('submit',async e=>{
    e.preventDefault(); const payload={kind:'team',action:'save',permission:$('team-permission').checked};
    for(const k of ['id','name','role','bio','photo'])payload[k]=$('team-'+k).value;
    await submit(e,'team-feedback',async()=>{const result=await request('/content',payload);$('team-form').reset();$('team-id').value='';$('team-editor').open=false;return result;});
  });
  $('activity-form').addEventListener('submit',async e=>{
    e.preventDefault();const payload={kind:'activities',action:'save',permission:$('activity-permission').checked,photos:[...$('activity-photos').querySelectorAll('input:checked')].map(i=>i.value)};
    for(const k of ['id','title','date','description'])payload[k]=$('activity-'+k).value;
    await submit(e,'activity-feedback',async()=>{const result=await request('/content',payload);$('activity-form').reset();$('activity-id').value='';$('activity-editor').open=false;return result;});
  });
  for(const kind of ['team','activity'])$('cancel-'+kind).addEventListener('click',()=>{$(kind+'-form').reset();$(kind+'-id').value='';$(kind+'-editor').open=false;});
  $('details-form').addEventListener('submit', event => submit(event, 'save-feedback', () => {
    const payload = {name:$('chapter-name').value, school:$('school').value, location:$('city').value, message:$('message').value};
    if (!$('meeting-date').disabled) payload.meetingDate = $('meeting-date').value;
    return request('', payload);
  }));
  $('profile-email-send').addEventListener('click', async () => {
    if (emailBusy || !needsEmailVerification() || Date.now() < emailRetryAt) return;
    emailBusy = true; emailAttempted = true; emailControls();
    $('profile-email-feedback').textContent = 'Requesting a code…';
    $('profile-email-test-code').textContent = ''; $('profile-email-test-code').hidden = true;
    try {
      const result = await request('/email-code', {});
      const seconds = Number(result.retryAfter);
      emailRetryAt = Date.now() + (Number.isFinite(seconds) && seconds > 0 ? seconds : 60) * 1000;
      clearInterval(emailTimer);
      emailTimer = setInterval(() => { emailControls(); if (Date.now() >= emailRetryAt) clearInterval(emailTimer); }, 1000);
      const messages = {
        sent: 'A verification code was sent to your saved email address.',
        pending: 'Your verification email is pending. Sending is not yet confirmed.',
        unknown: 'Verification email delivery could not be confirmed. Check your inbox before requesting another code.',
        failed: 'The verification email could not be sent. Please try again after the wait.',
        'test-only': test ? 'Isolated test mode. No email was sent.' : 'No verification email was sent. Please contact TimeBack.'
      };
      $('profile-email-feedback').textContent = messages[result.status] || 'Verification email delivery could not be confirmed. Check your inbox before requesting another code.';
      if (test && result.status === 'test-only' && /^[0-9]{6}$/.test(result.testCode || '')) {
        $('profile-email-test-code').textContent = `Isolated test code: ${result.testCode}`;
        $('profile-email-test-code').hidden = false;
      }
    } catch {
      $('profile-email-feedback').textContent = 'The code request could not be confirmed. Check your inbox before trying again.';
    } finally { emailBusy = false; emailControls(); }
  });
  $('profile-email-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (emailBusy || !needsEmailVerification()) return;
    const code = $('profile-email-code').value.trim();
    if (!/^[0-9]{6}$/.test(code)) { $('profile-email-feedback').textContent = 'Enter the six-digit code from your email.'; return; }
    emailBusy = true; emailControls();
    $('profile-email-feedback').textContent = 'Verifying…';
    try {
      const result = await request('/verify-email', {code});
      // Update only email state: a verification response must not reset draft edits,
      // selected report files, photo captions, or an in-flight report/upload receipt.
      for (const field of ['profileEmailVerificationRequired', 'recognitionEmailStatus', 'emailVerified', 'maskedEmail']) record[field] = result[field];
      paintEmail(record);
      if (record.emailVerified !== true) $('profile-email-feedback').textContent = 'Email verification was not confirmed. Check the code and try again.';
    } catch {
      $('profile-email-feedback').textContent = 'Email verification could not be confirmed. Check the code, try again, or request a new code when available.';
    } finally { emailBusy = false; emailControls(); }
  });
  const reportUploads=new Map();
  $('report-form').addEventListener('submit', event => submit(event, 'report-feedback', async()=>{
    const date=$('report-date').value,confirmed=$('meeting-confirmed').checked,input=$('report-photos'),files=[...input.files];
    if(files.length>6)throw new Error('Select up to six meeting photos.');
    input.disabled=true;
    try{
      const photoIds=[];
      for(const file of files){
        let saved=reportUploads.get(file);
        if(!saved){saved={key:crypto.randomUUID()};reportUploads.set(file,saved);}
        if(!saved.id){
          $('report-feedback').textContent='Uploading meeting photos…';
          const photo=await preparePhoto(file);
          const response=await fetch(api+'/photos',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':photo.type,'Idempotency-Key':saved.key},body:photo});
          const data=await response.json();
          if(!response.ok||!data.uploadedPhotoId)throw new Error(data.error||'The photo upload could not be confirmed. Please retry.');
          saved.id=data.uploadedPhotoId;
        }
        photoIds.push(saved.id);
      }
      const result=await request('/report',{date,confirmed,photoIds});
      input.value='';reportUploads.clear();return result;
    }finally{input.disabled=false;}
  }));
  if (!api) { $('access-status').textContent = 'Chapter management is not live yet.'; return; }
  if (!token) { $('access-status').textContent = 'Open your private owner link to manage your chapter. For access, contact zackaryxu@jointimeback.org.'; return; }
  request().then(paint).catch(error => { $('access-status').textContent = error.message; });
})();
