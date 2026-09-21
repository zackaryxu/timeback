(() => {
 'use strict';
 const $=id=>document.getElementById(id),test=new URLSearchParams(location.search).get('test')==='1';
 const base=document.querySelector('meta[name="editor-api"]').content.replace(/\/$/,'')+(test?'/test':'');
 let invite=new URLSearchParams(location.hash.slice(1)).get('invite'),editorToken='',recordKey='',busy=false;
 const status=message=>{$('status').textContent=message;};
 const random=()=>{const bytes=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');};
 history.replaceState(null,'',location.pathname+location.search);
 async function request(method,body){
  const response=await fetch(base+'/invite',{method,headers:{Authorization:'Bearer '+invite,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(45000)});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Invitation unavailable.');return result;
 }
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
   $('member-name').value=data.name||saved?.name||'';$('member-name').readOnly=!!data.name;
   $('listing-consent').checked=!!saved?.consent;
   $('claim-submit').textContent=data.claimed?'Continue setup':'Create profile';
   $('claim-form').hidden=false;status(test?'Test invitation. No public page will be published.':'');
  }catch(error){status(error.message);}
 }
 $('claim-form').onsubmit=async event=>{
  event.preventDefault();if(busy)return;busy=true;$('claim-submit').disabled=true;
  try{
   const name=$('member-name').value.trim(),consent=$('listing-consent').checked;
   sessionStorage.setItem(recordKey,JSON.stringify({editorToken,name,consent}));
   status('Creating profile…');
   const result=await request('POST',{name,listingConsent:consent,editorToken});
   if(result.publication.status==='pending'){status('Your place is claimed. Publication is pending. Select Continue setup to retry, or contact Zackary.');$('claim-submit').textContent='Continue setup';return;}
   const url=new URL('./'+(test?'?test=1':''),location.href);url.hash='access='+editorToken;
   $('open-editor').href=url.href;
   $('copy-editor').onclick=async()=>{try{await navigator.clipboard.writeText(url.href);status('Private editing link copied.');}catch{status('Open the editor using the link above.');}};
   $('claim-form').hidden=true;$('claim-complete').hidden=false;
   status(test?'Test profile created. Nothing was published.':'');
  }catch(error){status(error.name==='TimeoutError'?'The connection timed out. Retry in this tab; your claim is saved safely.':error.message);}
  finally{busy=false;$('claim-submit').disabled=false;}
 };
 window.addEventListener('hashchange',()=>{if(new URLSearchParams(location.hash.slice(1)).get('invite'))location.reload();});
 start();
})();
