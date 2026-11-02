import {openPhoto,cropPhoto} from './member-photo.js';

// Reuse the normal profile editor, keeping the person's latest bio and links.
// The setup capability itself never receives editing permission for old profiles.
export async function saveSetupPhoto(editorUrl,photoUpload,{test=false,fetcher=fetch}={}){
  const url=new URL(editorUrl),key=new URLSearchParams(url.hash.slice(1)).get('access');
  if(url.origin!=='https://jointimeback.org'||url.pathname!=='/members/'||!key||!/^[A-Za-z0-9_-]{43}$/.test(key)||((url.searchParams.get('test')==='1')!==test))throw Error('Use the profile editing link from this chapter setup.');
  const api='https://msdawliajqdgungoaqvc.supabase.co/functions/v1/timeback-member-editor'+(test?'/test':'')+'/profile';
  const request=async(method,body)=>{const response=await fetcher(api,{method,headers:{Authorization:'Bearer '+key,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(60000)});let data;try{data=await response.json()}catch{throw Error('The photo response was interrupted. Try Save photo again; the chapter is already created.')}if(!response.ok)throw Error(data.error||'The photo could not be saved. Try Save photo again.');return data;};
  const current=await request('GET');
  const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(photoUpload)))].map(b=>b.toString(16).padStart(2,'0')).join('');
  if(current.profile.photo===`member-content/photos/${current.profile.id}/${digest}.webp`)return current;
  return request('PUT',{version:current.version,bio:current.profile.bio||'',links:current.profile.links||[],photoUpload});
}

export function createSetupPhotoPicker(onChange=()=>{}){
  const element=document.createElement('div');element.className='setup-photo';
  const label=document.createElement('label');label.textContent='Profile photo ';const optional=document.createElement('span');optional.className='optional-label';optional.textContent='optional';label.append(optional);
  const input=document.createElement('input');input.type='file';input.accept='image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif';label.append(input);
  const help=document.createElement('small');help.textContent='JPG, PNG, WebP or iPhone HEIC, up to 10 MB. Choose a photo they’re happy to publish.';
  const preview=document.createElement('div');preview.className='setup-photo-preview';preview.hidden=true;
  const image=document.createElement('img');image.alt='Profile photo preview';image.width=96;image.height=120;
  const controls=document.createElement('div');const cropLabel=document.createElement('label');cropLabel.textContent='Adjust framing';const crop=document.createElement('input');crop.type='range';crop.min='0';crop.max='100';crop.value='50';cropLabel.append(crop);
  const remove=document.createElement('button');remove.type='button';remove.className='text-button';remove.textContent='Remove photo';controls.append(cropLabel,remove);preview.append(image,controls);
  const status=document.createElement('p');status.className='help';status.setAttribute('role','status');
  const save=document.createElement('button');save.type='button';save.className='secondary';save.textContent='Save photo';save.hidden=true;
  element.append(label,help,preview,status,save);
  let bitmap=null,data=null,busy=false,sequence=0,saved=false;
  const setStatus=(text,error=false)=>{status.textContent=text;status.classList.toggle('error',error)};
  const picker={element,save,get data(){return data},get busy(){return busy},get saved(){return saved},lock(value){input.disabled=crop.disabled=remove.disabled=save.disabled=value||busy},status:setStatus,markSaved(){saved=true;remove.textContent='Discard selection';save.hidden=true;setStatus('Profile photo saved. It will appear after the site finishes publishing.');},dispose(){sequence++;bitmap?.close();bitmap=null;data=null;},};
  const render=()=>{const result=cropPhoto(bitmap,Number(crop.value)/100);data=result.split(',')[1];image.src=result;preview.hidden=false;saved=false;remove.textContent='Remove photo';setStatus('Photo ready. It will be added to their public profile.');onChange(picker)};
  input.addEventListener('change',async()=>{const file=input.files[0];if(!file)return;const seq=++sequence;busy=true;picker.lock(true);setStatus('Preparing photo…');onChange(picker);try{const next=await openPhoto(file,setStatus);if(seq!==sequence){next.close();return}const previous=bitmap;bitmap=next;crop.value='50';try{render();previous?.close()}catch(e){next.close();bitmap=previous;throw e}}catch(e){setStatus(e.message||'Choose another photo.',true)}finally{if(seq===sequence){busy=false;picker.lock(false);input.value='';onChange(picker)}}});
  crop.addEventListener('input',()=>{if(bitmap&&!busy){try{render()}catch(e){setStatus(e.message,true)}}});
  remove.onclick=()=>{const wasSaved=saved;sequence++;bitmap?.close();bitmap=null;data=null;saved=false;input.value='';preview.hidden=true;image.removeAttribute('src');save.hidden=true;setStatus(wasSaved?'Selection cleared. The saved profile photo is unchanged.':'No photo selected. They can add one later.');onChange(picker)};
  return picker;
}
