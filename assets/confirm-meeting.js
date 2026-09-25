(() => {
  'use strict';
  const heicModuleUrl=new URL('./vendor/heic-to-1.5.2.js',document.currentScript.src).href;
  let heicDecoder;
  const $=id=>document.getElementById(id);
  const params=new URLSearchParams(location.search),test=params.get('test')==='1',preview=params.get('preview')==='1';
  const local=['127.0.0.1','localhost'].includes(location.hostname);
  const configured=(document.querySelector('meta[name="chapter-api"]')?.content||'').replace(/\/$/,'');
  const api=local?`/api/${test?'test-chapters':'chapters'}/owner`:configured?`${configured}${test?'/test':''}/owner`:'';
  const storageKey=`timeback-owner-${test?'test':'local'}`;
  let token=new URLSearchParams(location.hash.slice(1)).get('owner')||'';
  if(location.hash)history.replaceState(null,'',location.pathname+location.search);
  try{if(token)sessionStorage.setItem(storageKey,token);else token=sessionStorage.getItem(storageKey)||'';}catch{}
  const today=timeZone=>{
    if(timeZone){try{const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(part=>[part.type,part.value]));return `${parts.year}-${parts.month}-${parts.day}`;}catch{}}
    const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const pretty=value=>new Date(value+'T12:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  const ownerUrl=()=>new URL(`../chapter-owner/${test?'?test=1':''}#owner=${token}`,location.href).href;
  let receipt;
  async function request(path='',payload){
    const response=await fetch(api+path,{method:payload?'POST':'GET',cache:'no-store',headers:{Authorization:`Bearer ${token}`,...(payload?{'Content-Type':'application/json'}:{})},...(payload?{body:JSON.stringify(payload)}:{})});
    const data=await response.json();if(!response.ok)throw Error(data.error||'The request could not be confirmed. Try again.');return data;
  }
  function celebrate(rect){
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const layer=document.createElement('div');layer.className='confetti-layer';layer.setAttribute('aria-hidden','true');
    const colors=['#148b55','#e0b848','#4e83a4','#e7876c'];
    for(let i=0;i<24;i++){
      const piece=document.createElement('span');piece.className='confetti-piece';
      piece.style.left=`${rect.left+rect.width/2}px`;piece.style.top=`${rect.top+rect.height/2}px`;
      piece.style.setProperty('--color',colors[i%colors.length]);
      piece.style.setProperty('--spread',`${Math.round(Math.random()*280-140)}px`);
      piece.style.setProperty('--rise',`${-Math.round(70+Math.random()*110)}px`);
      piece.style.setProperty('--drift',`${Math.round(Math.random()*400-200)}px`);
      piece.style.setProperty('--drop',`${Math.round(120+Math.random()*180)}px`);
      piece.style.setProperty('--spin',`${Math.round(Math.random()*480-240)}deg`);
      piece.style.setProperty('--end-spin',`${Math.round(Math.random()*900-450)}deg`);
      piece.style.animationDelay=`${Math.round(Math.random()*90)}ms`;
      layer.append(piece);
    }
    document.body.append(layer);setTimeout(()=>layer.remove(),1600);
  }
  function officialMessage(data){
    const status=data.recognitionEmailStatus;
    if(data.chapter.flow!=='new-lead')return status==='sent'
      ? 'Your chapter is official. Check your email for its recognition note and chapter page.'
      : status==='pending'
        ? 'Your chapter is official. We’ll email you when its page is ready.'
        : 'Your chapter is official. Its page may take a little time to update.';
    if(data.profileEmailVerificationRequired)return 'Your chapter is official. Verify your contact email in chapter management to receive your profile link.';
    return status==='sent'
      ? 'Your chapter is official. Check your email for your profile link and chapter page.'
      : status==='pending'
        ? 'Your chapter is official. We’ll email you when your chapter page and Chapter Lead profile are ready.'
        : 'Your chapter is official. Your chapter page and team profile may take a little time to update.';
  }
  function paint(data){
    receipt=data;const chapter=data.chapter,current=today(data.timeZone),expired=chapter.recognitionDeadline<current;
    $('workspace').hidden=false;$('status').hidden=true;$('chapter-name').textContent=chapter.name;
    $('profile-reward').hidden=chapter.flow!=='new-lead';
    $('edit-link').href=preview?'#':ownerUrl();
    $('meeting-date').min=chapter.createdDate;$('meeting-date').max=current;
    const initial=chapter.firstGathering.date<=current?chapter.firstGathering.date:current;
    $('meeting-date').value=initial;$('date-display').textContent=pretty(initial);
    $('confirm-form').hidden=!!data.report;
    $('result').hidden=!data.report;
    $('late-note').hidden=true;
    if(data.report){
      $('statement').hidden=true;$('promise').hidden=true;
      $('result').textContent=data.report.outcome!=='official'
        ? 'Your report was received after the deadline and needs review before recognition.'
        : officialMessage(data);
      $('edit-link').textContent=data.profileEmailVerificationRequired?'verify your email in chapter management':'edit your chapter page';
    }else if(expired){
      $('statement').hidden=true;$('promise').hidden=true;$('late-note').hidden=false;
      $('confirm-button').textContent='Yes, report our first meeting ✓';
    }
  }
  $('change-date').addEventListener('click',()=>{$('date-field').hidden=false;$('meeting-date').focus();});
  $('meeting-date').addEventListener('change',()=>{if($('meeting-date').value)$('date-display').textContent=pretty($('meeting-date').value);});
  $('edit-link').addEventListener('click',event=>{if(preview)event.preventDefault();});
  const uploads=new Map();
  $('report-photos').addEventListener('change',()=>{
    const files=$('report-photos').files;
    if(files.length>6){$('report-photos').value='';$('feedback').textContent='Choose up to six photos.';}
    else $('feedback').textContent='';
    $('photo-selection').hidden=!$('report-photos').files.length;
    $('clear-photos').hidden=!$('report-photos').files.length;
    if($('report-photos').files.length){
      const count=$('report-photos').files.length;
      $('photo-selection').textContent=`${count} ${count===1?'photo':'photos'} selected. Private unless you later choose to publish ${count===1?'it':'them'}.`;
    }
  });
  $('clear-photos').addEventListener('click',()=>{
    $('report-photos').value='';uploads.clear();$('photo-selection').hidden=true;$('clear-photos').hidden=true;$('feedback').textContent='';
  });
  async function preparePhoto(file){
    if(file.size>8*1024*1024)throw new Error('Photos must be under 8 MB each.');
    const unreadable='This photo could not be read. Choose a still JPEG, PNG, WebP or HEIC image, or export it as JPEG and try again.';
    const bytes=new Uint8Array(await file.slice(0,128).arrayBuffer());
    const ascii=(start,end)=>String.fromCharCode(...bytes.slice(start,end));
    const heic=ascii(4,8)==='ftyp'&&Array.from({length:Math.floor((bytes.length-8)/4)},(_,i)=>8+i*4).filter(p=>p!==12).some(p=>['heic','heix','hevc','hevx','mif1','msf1'].includes(ascii(p,p+4)));
    const supported=heic||(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)
      ||(bytes[0]===137&&ascii(1,4)==='PNG'&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10)
      ||(ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP');
    if(!supported)throw new Error(unreadable);
    if(ascii(8,12)==='WEBP'&&ascii(12,16)==='VP8X'&&(bytes[20]&2))throw new Error(unreadable);
    let url=URL.createObjectURL(file);const img=new Image();let canvas;
    try{
      const load=()=>new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});
      try{await load();}catch(error){
        if(!heic)throw error;
        heicDecoder ||= import(heicModuleUrl).catch(error=>{heicDecoder=null;throw error;});
        const {heicTo}=await heicDecoder;
        const converted=await heicTo({blob:file,type:'image/jpeg',quality:0.9});
        URL.revokeObjectURL(url);url=URL.createObjectURL(converted);await load();
      }
      if(!img.naturalWidth||!img.naturalHeight)throw new Error();
      const scale=Math.min(1,1800/img.naturalWidth,1800/img.naturalHeight);
      canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
      const ctx=canvas.getContext('2d');if(!ctx)throw new Error();
      ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.85));
      if(!blob||blob.type!=='image/jpeg'||!blob.size||blob.size>8*1024*1024)throw new Error();
      return blob;
    }catch{throw new Error(unreadable);}
    finally{img.src='';URL.revokeObjectURL(url);if(canvas){canvas.width=0;canvas.height=0;}}
  }
  async function uploadPhotos(){
    const files=[...$('report-photos').files];if(files.length>6)throw new Error('Choose up to six photos.');
    const photoIds=[];
    for(const [index,file] of files.entries()){
      let saved=uploads.get(file);if(!saved){saved={key:crypto.randomUUID()};uploads.set(file,saved);}
      if(!saved.id){
        $('feedback').textContent=`Uploading photo ${index+1} of ${files.length}…`;
        const photo=await preparePhoto(file);
        const response=await fetch(api+'/photos',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':photo.type,'Idempotency-Key':saved.key},body:photo});
        const data=await response.json();
        if(!response.ok||!data.uploadedPhotoId)throw new Error('The photo upload could not be confirmed. Try again, or remove the photos to confirm without them.');
        saved.id=data.uploadedPhotoId;
      }
      photoIds.push(saved.id);
    }
    return photoIds;
  }
  $('confirm-form').addEventListener('submit',async event=>{
    event.preventDefault();
    if(preview){
      if(token){$('feedback').textContent='Design preview only. Nothing was reported.';return;}
      const rect=$('confirm-button').getBoundingClientRect();
      paint({...receipt,chapter:{...receipt.chapter,status:'official'},report:{date:$('meeting-date').value,outcome:'official'},recognitionEmailStatus:'pending'});
      celebrate(rect);return;
    }
    const button=$('confirm-button'),label=button.innerHTML;button.disabled=true;$('feedback').textContent='Confirming…';
    try{
      const photoIds=await uploadPhotos(),rect=button.getBoundingClientRect(),wasReported=!!receipt?.report;
      const result=await request('/report',{confirmed:true,date:$('meeting-date').value,photoIds});
      paint(result);$('feedback').textContent='';
      if(!wasReported&&result.report?.outcome==='official')celebrate(rect);
    }
    catch(error){$('feedback').textContent=error.message;}
    finally{button.disabled=false;button.innerHTML=label;}
  });
  if(preview&&!token){$('preview-notice').hidden=false;paint({chapter:{name:'TimeBack at Your School',flow:'new-lead',status:'upcoming',createdDate:today(),recognitionDeadline:today(),firstGathering:{date:today()}},report:null});return;}
  if(!token){$('status').textContent='Open the private link in your TimeBack email to confirm your meeting.';return;}
  if(!api){$('status').textContent='Meeting confirmation is not connected yet.';return;}
  request().then(paint).catch(error=>{$('status').textContent=error.message;});
})();
