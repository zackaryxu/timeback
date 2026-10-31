(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  // Cached pre-release HTML must keep working with the new script during rollout.
  if(!$('photo-status')){
    const message=document.createElement('p');message.id='photo-status';message.className='photo-status';message.tabIndex=-1;message.setAttribute('role','status');message.setAttribute('aria-live','polite');
    const save=document.createElement('button');save.id='save-photo';save.type='button';save.className='primary';save.textContent='Save changes';save.hidden=true;
    $('photo').closest('section').append(message,save);
  }
  if(!$('save-feedback')){const message=document.createElement('p');message.id='save-feedback';message.tabIndex=-1;message.setAttribute('role','status');message.setAttribute('aria-live','polite');$('save-state').parentElement.append(message);}
  $('profile-form').noValidate=true;
  $('photo').accept='image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif';
  const photoHelp=$('photo-help')||$('photo').closest('section').querySelector('.fine');
  if(photoHelp){photoHelp.id='photo-help';photoHelp.textContent='JPG, PNG, WebP or iPhone HEIC, up to 10 MB. We’ll resize it for you.';}
  $('photo').setAttribute('aria-describedby','photo-help photo-status');
  const testMode=new URLSearchParams(location.search).get('test')==='1';
  const api=document.querySelector('meta[name="editor-api"]').content.replace(/\/$/,'')+(testMode?'/test':'');
  const storageKey='timeback-member-access'+(testMode?'-test':'');
  const photoModuleUrl=new URL('./member-photo.js',document.currentScript.src).href;
  let photoTools;
  let key='',profile,version,baseline='',demo=false,photoBitmap=null,photoData=null,busy=false,photoBusy=false,photoSequence=0;
  const demoProfile={id:'preview',name:'Your name',role:'TimeBack team',intro:'Your team introduction appears here.',bio:'I enjoy helping people turn big goals into small, practical steps. At TimeBack, I’m learning to make those conversations engaging and useful.',links:[],photo:null,portraitUrl:null};
  const status=(message,error=false)=>{for(const id of ['status','save-feedback']){$(id).textContent=message;$(id).classList.toggle('error',error);}$('status').hidden=!!profile;};
  const photoStatus=(message,error=false)=>{$('photo-status').textContent=message;$('photo-status').classList.toggle('error',error);$('photo').setAttribute('aria-invalid',String(error));};
  const values=()=>({bio:$('bio').value,links:[...$('links').children].map(row=>({label:row.querySelector('[data-label]').value.trim(),url:row.querySelector('[data-url]').value.trim()})).filter(l=>l.label||l.url),photoUpload:photoData});
  const dirty=()=>!!profile&&JSON.stringify(values())!==baseline;
  function update() {
    $('bio-preview').textContent=$('bio').value;
    $('bio-count').textContent=`${$('bio').value.length.toLocaleString()} / 1,600`;
    $('links-preview').replaceChildren();
    for(const link of values().links){if(!link.label||!/^https:\/\//i.test(link.url))continue;const a=document.createElement('a');a.textContent=link.label;a.href=link.url;a.target='_blank';a.rel='noopener noreferrer';$('links-preview').append(a);}
    $('save').disabled=busy||photoBusy||!dirty()||demo;
    $('save-photo').disabled=busy||photoBusy||!photoData||demo;
    $('save-photo').hidden=!photoData&&!photoBusy;
    $('photo').disabled=busy||photoBusy;
    $('crop').disabled=busy||photoBusy;
    $('undo-photo').disabled=busy||photoBusy;
    $('sign-out').disabled=busy||photoBusy;
    $('save-state').textContent=demo?'Preview only':photoBusy?'Preparing photo…':dirty()?'Unsaved changes':'All changes saved';
    $('add-link').disabled=$('links').children.length>=3||busy;
  }
  function addLink(link={label:'',url:''}) {
    if($('links').children.length>=3)return;
    const row=document.createElement('div');row.className='link-row';
    const nameLabel=document.createElement('label');nameLabel.textContent='Label';
    const name=document.createElement('input');name.dataset.label='';name.maxLength=40;name.placeholder='LinkedIn';name.value=link.label;nameLabel.append(name);
    const urlLabel=document.createElement('label');urlLabel.textContent='Web address';
    const url=document.createElement('input');url.dataset.url='';url.type='url';url.maxLength=500;url.placeholder='https://';url.value=link.url;urlLabel.append(url);
    const remove=document.createElement('button');remove.type='button';remove.className='quiet remove-link';remove.textContent='×';remove.setAttribute('aria-label','Remove link');remove.onclick=()=>{row.remove();update();};
    row.append(nameLabel,urlLabel,remove);$('links').append(row);update();
  }
  function portrait(url) {
    $('portrait-image').hidden=!url;$('initials').hidden=!!url;
    if(url)$('portrait-image').src=url;else $('portrait-image').removeAttribute('src');
    $('portrait-image').alt=profile.name;
    if($('mobile-photo-image')){
      $('mobile-photo-preview').hidden=!url;
      if(url)$('mobile-photo-image').src=url;else $('mobile-photo-image').removeAttribute('src');
      $('mobile-photo-image').alt=`Photo preview for ${profile.name}`;
    }
  }
  function loadProfile(data) {
    photoSequence++;photoBusy=false;profile=data.profile;version=data.version;photoData=null;photoBitmap?.close();photoBitmap=null;
    $('welcome').hidden=true;$('editor').hidden=false;$('sign-out').hidden=false;
    $('preview-notice').hidden=!demo;$('sign-out').textContent=demo?'Leave preview':'Sign out';
    $('member-name').textContent=profile.name;$('member-role').textContent=profile.role;$('member-intro').textContent=profile.intro;
    $('initials').textContent=profile.name.split(' ').map(v=>v[0]).join('').toUpperCase();
    $('bio').value=profile.bio||'';$('links').replaceChildren();(profile.links||[]).forEach(addLink);
    const base=new URL('../',location.href);portrait(profile.photo?new URL(profile.photo,base).href:profile.portraitUrl);
    $('public-profile').hidden=demo||testMode;$('public-profile').href=new URL(`about/${profile.id}/`,base).href;
    $('undo-photo').hidden=true;$('crop-controls').hidden=true;$('photo').value='';
    photoStatus(profile.photo||profile.portraitUrl?'Your current photo is shown in the preview. Choose another to replace it.':'Choose a photo, adjust the preview, then save it.');
    baseline=JSON.stringify(values());update();
    $('contribution-section').hidden=testMode;
    $('contribution-form').querySelectorAll('input,textarea,button').forEach(el=>el.disabled=demo);
    $('refresh-contributions').disabled=demo;
    $('contribution-history').replaceChildren();
    if(demo)$('contribution-status').textContent='Preview only. Reports are not submitted.';
    else if(!testMode)refreshContributions();
  }
  async function request(method,body,route='profile') {
    if(!api)throw new Error('Member sign-in is not connected yet. You can try the editor preview below.');
    const response=await fetch(`${api}/${route}`,{method,headers:{Authorization:`Bearer ${key}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(45000)});
    let result;try{result=await response.json();}catch{throw new Error('The website returned an unreadable response. Your changes are still here. Check your public profile before trying to save again.');}if(!response.ok)throw new Error(result.error||'Please try again in a moment.');return result;
  }
  async function login(value) {
    key=value.trim();if(!key){status('Paste the access code from your invite.',true);return;}
    const button=$('sign-in').querySelector('button');button.disabled=true;button.textContent='Opening your profile…';
    try{demo=false;const data=await request('GET');sessionStorage.setItem(storageKey,key);loadProfile(data);status('');}
    catch(error){status(error.message,true);key='';sessionStorage.removeItem(storageKey);}
    finally{button.disabled=false;button.textContent='Open my profile';}
  }
  $('sign-in').addEventListener('submit',e=>{e.preventDefault();login($('access-key').value);});
  async function refreshContributions() {
    const owner=key;
    try {
      const result=await request('GET',null,'contributions');
      if(owner!==key)return;
      $('contribution-history').replaceChildren();
      for(const item of result.submissions){const li=document.createElement('li');li.textContent=`#${item.number} · ${item.status.replaceAll('-',' ')} · ${item.createdAt.slice(0,10)}`;$('contribution-history').append(li);}
      $('contribution-status').textContent=result.submissions.length?'':'No submissions yet.';
    }catch(error){if(owner===key)$('contribution-status').textContent=error.message;}
  }
  $('refresh-contributions').onclick=()=>refreshContributions();
  $('contribution-form').onsubmit=async event=>{
    event.preventDefault();if(demo)return;
    const owner=key;
    const controls=[...$('contribution-form').querySelectorAll('input,textarea,button')];
    const payload={summary:$('contribution-summary').value,when:$('contribution-when').value,wording:$('contribution-wording').value,evidence:$('contribution-evidence').value.split('\n').map(v=>v.trim()).filter(Boolean)};
    controls.forEach(el=>el.disabled=true);
    try {const result=await request('POST',payload,'contributions');if(owner!==key)return;$('contribution-form').reset();await refreshContributions();if(owner===key)$('contribution-status').textContent=`Submission #${result.number} received for review. Nothing has been published.`;}
    catch(error){if(owner===key)$('contribution-status').textContent=error.message;}
    finally{if(owner===key)controls.forEach(el=>el.disabled=demo);}
  };
  $('try-preview').onclick=()=>{demo=true;loadProfile({profile:structuredClone(demoProfile),version:null});status('');};
  $('sign-out').onclick=()=>{if(dirty()&&!confirm('Leave without saving your changes?'))return;sessionStorage.removeItem(storageKey);key='';profile=null;demo=false;photoBitmap?.close();photoBitmap=null;$('access-key').value='';$('editor').hidden=true;$('welcome').hidden=false;$('sign-out').hidden=true;$('contribution-section').hidden=true;$('contribution-form').reset();$('contribution-history').replaceChildren();status('');};
  $('add-link').onclick=()=>addLink();$('profile-form').addEventListener('input',update);
  function cropPhoto() {
    if(!photoBitmap)return;
    try {
      const data=photoTools.cropPhoto(photoBitmap,Number($('crop').value)/100);
      photoData=data.split(',')[1];portrait(data);$('undo-photo').hidden=false;$('crop-controls').hidden=false;
      photoStatus(demo?'Photo ready in this preview. Nothing will be published.':'Photo ready. Adjust the framing if needed, then choose Save changes.');update();
    }catch(error){photoStatus(error.message,true);}
  }
  $('photo').onchange=async()=>{
    const file=$('photo').files[0];if(!file)return;
    const sequence=++photoSequence;
    photoBusy=true;photoStatus('Preparing photo…');status('');update();
    try{
      photoTools ||= await import(photoModuleUrl);
      const image=await photoTools.openPhoto(file,message=>{if(sequence===photoSequence)photoStatus(message);});
      if(sequence!==photoSequence){image.close();return;}
      // Prepare before replacing an existing draft, so a failed choice cannot erase it.
      let data;try{data=photoTools.cropPhoto(image,.5);}catch(error){image.close();throw error;}
      photoBitmap?.close();photoBitmap=image;photoData=data.split(',')[1];portrait(data);$('crop').value=50;
      $('undo-photo').hidden=false;$('crop-controls').hidden=false;
      photoStatus(demo?'Photo ready in this preview. Nothing will be published.':'Photo ready. Adjust the framing if needed, then choose Save changes.');
    }catch(error){photoStatus((error.message||'That photo could not be opened. Please try another.')+(photoData?' Your previous selection is still ready to save.':''),true);}
    finally{if(sequence===photoSequence){photoBusy=false;$('photo').value='';update();}}
  };
  $('crop').oninput=cropPhoto;
  $('undo-photo').onclick=()=>{photoSequence++;photoData=null;photoBitmap?.close();photoBitmap=null;portrait(profile.photo?new URL('../'+profile.photo,location.href).href:profile.portraitUrl);$('undo-photo').hidden=true;$('crop-controls').hidden=true;$('photo').value='';photoStatus('Photo selection discarded. Your current public photo has not changed.');update();};
  $('save-photo').onclick=()=>$('profile-form').requestSubmit();
  $('profile-form').onsubmit=async e=>{
    e.preventDefault();if(demo||busy||photoBusy||!dirty())return;
    const edit=values();
    for(const l of edit.links){let url;try{url=new URL(l.url);}catch{}if(!l.label||!url||url.protocol!=='https:'||url.username||url.password){const message='Give each link a label and a full https:// address, or remove the unfinished link, then save again.';status(message,true);if(edit.photoUpload)photoStatus(message,true);$(edit.photoUpload?'photo-status':'save-feedback').focus();return;}}
    busy=true;update();$('save').textContent='Saving…';status('');
    // Lock inputs during the request so a successful response cannot erase newer typing.
    const controls=[...$('profile-form').querySelectorAll('input,textarea,button')];controls.forEach(c=>c.disabled=true);
    try{const result=await request('PUT',{version,...edit});loadProfile(result);const message=testMode?'Test profile saved. Nothing was published.':'Saved. Your public profile will update after publishing, usually in a few minutes. Use View public profile to check it.';status(message);if(edit.photoUpload)photoStatus(message);}
    catch(error){const message=error.name==='TimeoutError'?'The connection timed out. Your changes are still here. Check your public profile before retrying.':error.message;status(message,true);if(edit.photoUpload)photoStatus(message,true);}
    finally{busy=false;controls.forEach(c=>c.disabled=false);$('save').textContent='Save changes';update();$(edit.photoUpload?'photo-status':'save-feedback').focus();}
  };
  window.addEventListener('beforeunload',event=>{if(dirty()){event.preventDefault();event.returnValue='';}});
  function openInvite() {
    const invite=new URLSearchParams(location.hash.slice(1)).get('access');
    if(!invite)return false;
    history.replaceState(null,'',location.pathname+location.search);login(invite);return true;
  }
  // A link opened while already on /members/ changes only the fragment.
  window.addEventListener('hashchange',openInvite);
  if(!openInvite()) {
    if(new URLSearchParams(location.search).get('preview')==='1')$('try-preview').click();
    else if(sessionStorage.getItem(storageKey))login(sessionStorage.getItem(storageKey));
  }
  if(!api){$('access-key').disabled=true;$('sign-in').querySelector('button').disabled=true;$('sign-in').querySelector('button').textContent='Member sign-in coming soon';}
})();
