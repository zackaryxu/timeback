(() => {
 'use strict';
 const $=id=>document.getElementById(id),test=new URLSearchParams(location.search).get('test')==='1';
 const base=document.querySelector('meta[name="editor-api"]').content.replace(/\/$/,'')+(test?'/test':'');
 let invite=new URLSearchParams(location.hash.slice(1)).get('invite'),editorToken='',recordKey='',busy=false;
 let emailRequired=false,claimed=false,verifiedEmail='',codeRequested=false,retryAt=0,retryTimer;
 let claimDraft=null;
 const email=()=>$('member-email').value.trim();
 const status=message=>{$('status').textContent=message;};
 const random=()=>{const bytes=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');};
 history.replaceState(null,'',location.pathname+location.search);
 async function request(method,body,path=''){
  const response=await fetch(base+'/invite'+path,{method,headers:{Authorization:'Bearer '+invite,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(45000)});
  const result=await response.json();if(!response.ok){const error=Error(result.error||'Invitation unavailable.');error.retryAfter=result.retryAfter||Number(response.headers.get('Retry-After'));throw error;}return result;
 }
 function saveDraft(){
  const draft={editorToken,name:$('member-name').value.trim(),consent:$('listing-consent').checked,...(emailRequired?{email:email()}:{}),retryAt,codeRequested};
  sessionStorage.setItem(recordKey,JSON.stringify(draft));return draft;
 }
 function render(){
  const verified=verifiedEmail===email()&&!!verifiedEmail,wait=Math.max(0,Math.ceil((retryAt-Date.now())/1000));
  $('member-email').disabled=busy||!emailRequired||claimed;
  $('member-email').readOnly=codeRequested||verified;
  $('send-code').hidden=verified||claimed;
  $('send-code').disabled=busy||wait>0;
  $('send-code').textContent=wait?`Resend available in ${wait}s`:codeRequested?'Resend code':'Send verification code';
  $('code-section').hidden=!codeRequested||verified||claimed;
  $('email-code').disabled=busy||!codeRequested||verified||claimed;
  $('verify-code').disabled=busy;
  $('change-email').hidden=claimed||(!codeRequested&&!verified);
  $('change-email').disabled=busy;
  $('claim-submit').disabled=busy||(emailRequired&&!claimed&&!verified);
  $('retry-publication').disabled=busy;
  $('member-name').disabled=busy;$('listing-consent').disabled=busy;
 }
 function cooldown(seconds=60){
  retryAt=Math.max(retryAt,Date.now()+Math.max(60,Number(seconds)||60)*1000);
  watchCooldown();
 }
 function watchCooldown(){
  clearInterval(retryTimer);
  retryTimer=setInterval(()=>{render();if(Date.now()>=retryAt)clearInterval(retryTimer);},1000);
 }
 function errorMessage(error){return error.name==='TimeoutError'?'The connection timed out. Retry in this tab; your details and editing key are saved.':error.message;}
 function invalidateEmail(){
  verifiedEmail='';codeRequested=false;$('email-code').value='';$('email-status').textContent='';render();
 }
 function persistDraft(){try{saveDraft();}catch{status('Your browser could not save this tab. Allow session storage before continuing.');}}
 $('member-name').oninput=persistDraft;$('listing-consent').onchange=persistDraft;
 $('member-email').oninput=()=>{invalidateEmail();persistDraft();};
 $('change-email').onclick=()=>{if(busy)return;invalidateEmail();persistDraft();$('member-email').focus();};
 $('send-code').onclick=async()=>{
  if(busy||claimed||!emailRequired||Date.now()<retryAt)return;
  if(!$('member-email').reportValidity()||!email())return;
  busy=true;render();
  try{
   // Persist the same editing key before any request can bind it on the server.
   saveDraft();codeRequested=true;cooldown();saveDraft();$('email-code').value='';
   $('email-status').textContent='Requesting verification code…';
   const result=await request('POST',{email:email(),editorToken},'/email-code');
   cooldown(result.retryAfter);saveDraft();
   const messages={sent:'A verification code was sent. Enter the 6-digit code below.',pending:'Your verification email is queued. Enter the code when it arrives.',unknown:'Sending could not be confirmed. Check your inbox before requesting another code.',failed:'The code could not be sent. Check your email address, then try again when resend is available.','test-only':'Test mode: no email was sent.'};
   $('email-status').textContent=messages[result.status]||'Sending could not be confirmed. Check your inbox before requesting another code.';
   if(test&&result.status==='test-only'&&/^\d{6}$/.test(result.testCode||''))$('email-status').textContent+=` Test code: ${result.testCode}.`;
  }catch(error){
   if(error.retryAfter){cooldown(error.retryAfter);persistDraft();}
   $('email-status').textContent=errorMessage(error)+' Check your inbox before requesting another code.';
  }finally{busy=false;render();}
 };
 $('verify-code').onclick=async()=>{
  if(busy||!codeRequested||claimed)return;
  const code=$('email-code').value.trim();
  if(!/^\d{6}$/.test(code)){$('email-status').textContent='Enter the 6-digit code from your email.';$('email-code').focus();return;}
  busy=true;render();
  try{
   const result=await request('POST',{email:email(),editorToken,code},'/verify-email');
   if(result.verified!==true)throw Error('The code could not be verified. Try again or request a new code.');
   verifiedEmail=email();$('email-code').value='';$('email-status').textContent='Email verified. Agree to the public listing, then select Create profile.';
  }catch(error){$('email-code').value='';$('email-status').textContent=errorMessage(error);}
  finally{busy=false;render();}
 };
 $('email-code').onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();$('verify-code').onclick();}};
 async function start(){
  try{
   if(!base.startsWith('https://')&&!(test&&location.hostname==='127.0.0.1'&&base.startsWith('/api/')))throw Error('Invitation setup is not connected in this preview.');
   if(!invite)invite=sessionStorage.getItem('timeback-current-invite'+(test?'-test':''));
   if(!/^[A-Za-z0-9_-]{43}$/.test(invite||''))throw Error('Open your personal invitation link to continue.');
   const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(invite)))].map(b=>b.toString(16).padStart(2,'0')).join('');
   recordKey='timeback-member-claim-'+(test?'test-':'')+hash;
   const saved=JSON.parse(sessionStorage.getItem(recordKey)||'null');
   editorToken=saved?.editorToken||random();
   sessionStorage.setItem('timeback-current-invite'+(test?'-test':''),invite);
   const data=await request('GET');
   $('invite-role').textContent=data.role;$('invite-region').textContent=data.region||'';
   if(data.claimed&&!saved)throw Error('This invitation has already been claimed. Use your private editing link, or ask Zackary to replace it.');
   claimed=!!data.claimed;emailRequired=data.emailVerificationRequired===true;
   retryAt=Number(saved?.retryAt)||0;if(retryAt>Date.now())watchCooldown();
   codeRequested=!!saved?.codeRequested;
   $('member-name').value=data.name||saved?.name||'';$('member-name').readOnly=!!data.name||claimed;
   $('listing-consent').checked=!!saved?.consent;
   $('member-email').value=saved?.email||'';$('member-email').required=emailRequired&&!claimed;
   if(emailRequired&&!claimed&&codeRequested)$('email-status').textContent='Enter the code from your email, or request another when resend is available.';
   $('email-section').hidden=!emailRequired;render();
   $('claim-submit').textContent=data.claimed?'Continue setup':'Create profile';
   $('claim-form').hidden=false;status(test?'Test invitation. No public page will be published.':'');
  }catch(error){status(error.message);}
 }
 async function claim(){
  if(busy)return;
  if(emailRequired&&!claimed&&verifiedEmail!==email()){status('Verify your email before creating your profile.');return;}
  if(!claimDraft&&!$('claim-form').reportValidity())return;
  const draft=claimDraft||saveDraft();
  if(!draft.name||!draft.consent){status('Enter your full name and agree to the public listing before creating your profile.');return;}
  busy=true;render();
  try{
   status('Creating profile…');
   const result=await request('POST',{name:draft.name,listingConsent:draft.consent,editorToken,...(emailRequired?{email:draft.email}:{})});
   claimed=true;claimDraft=draft;
   const url=new URL('./'+(test?'?test=1':''),location.href);url.hash='access='+editorToken;
   $('open-editor').href=url.href;
   $('copy-editor').onclick=async()=>{try{await navigator.clipboard.writeText(url.href);status('Private editing link copied.');}catch{status('Open the editor using the link above.');}};
   $('claim-form').hidden=true;$('claim-complete').hidden=false;
   const pending=result.publication?.status==='pending';
   $('publication-status').textContent=test?'Test profile created. Nothing was published.':pending?'Your profile is saved. Public publication is pending. You can keep your private editing link and select Continue setup to retry.':'Your public page will appear after the website finishes publishing.';
   $('retry-publication').hidden=!pending;
   const delivery={sent:'Your private editing link was sent by email.',pending:'Your private editing link is queued for email delivery. Keep the link here while you wait.',queued:'Your private editing link is queued for email delivery. Keep the link here while you wait.',unknown:'Email delivery could not be confirmed. Keep your private editing link here.',failed:'The email could not be sent. Keep your private editing link here.','test-only':'Test mode: no email was sent.'};
   $('delivery-status').textContent=test?'Test mode: no email was sent.':delivery[result.emailStatus]||(emailRequired?'Email delivery has not been confirmed. Keep your private editing link here.':'');
   $('delivery-status').hidden=!$('delivery-status').textContent;
   status(test?'Test profile created. Nothing was published.':'');
  }catch(error){status(errorMessage(error));}
  finally{busy=false;render();}
 }
 $('claim-form').onsubmit=async event=>{event.preventDefault();try{await claim();}catch(error){status(errorMessage(error));}};
 $('retry-publication').onclick=()=>claim();
 window.addEventListener('hashchange',()=>{if(new URLSearchParams(location.hash.slice(1)).get('invite'))location.reload();});
 start();
})();
