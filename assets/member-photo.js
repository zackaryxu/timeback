// Photo preparation is local to the browser. Only the cropped WebP is saved.
const MAX_BYTES=10*1024*1024;
const unreadable='That photo could not be opened. Try another photo, or export it as JPG and choose it again.';
let heicDecoder;

export async function withPhotoDeadline(work,ms=45000) {
  let timer;
  try{return await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('This photo is taking too long to prepare. Choose a JPG copy, or reload and try again.')),ms);})]);}
  finally{clearTimeout(timer);}
}

export function photoKind(bytes) {
  const text=(a,b)=>String.fromCharCode(...bytes.slice(a,b));
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'jpeg';
  if(text(0,8)==='\x89PNG\r\n\x1a\n')return 'png';
  if(text(0,4)==='RIFF'&&text(8,12)==='WEBP')return 'webp';
  if(text(4,8)==='ftyp'&&Array.from({length:Math.floor((bytes.length-8)/4)},(_,i)=>8+4*i).filter(p=>p!==12).some(p=>['heic','heix','hevc','hevx','mif1','msf1'].includes(text(p,p+4))))return 'heic';
  throw new Error('Choose a JPG, PNG, WebP or HEIC photo. Other file types are not supported.');
}

export async function openPhoto(file,onProgress=()=>{}) {
  if(!file.size)throw new Error('This file is empty. Choose another photo.');
  if(file.size>MAX_BYTES)throw new Error('This photo is over 10 MB. Export a smaller copy and choose it again.');
  const kind=photoKind(new Uint8Array(await file.slice(0,128).arrayBuffer()));
  let image=new Image(),url;
  const close=()=>{image.src='';if(url)URL.revokeObjectURL(url);url=null;};
  const load=blob=>new Promise((resolve,reject)=>{
    if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(blob);
    const timer=setTimeout(()=>{image.src='';reject(new Error(unreadable));},30000);
    image.onload=()=>{clearTimeout(timer);resolve();};
    image.onerror=()=>{clearTimeout(timer);reject(new Error(unreadable));};
    image.src=url;
  });
  try {
    // Native decoding respects camera orientation and also works without createImageBitmap.
    try{await load(file);}catch(error){
      if(kind!=='heic')throw error;
      onProgress('Preparing iPhone photo… This can take a few seconds.');
      heicDecoder ||= import('./vendor/heic-to-1.5.2.js').catch(error=>{heicDecoder=null;throw error;});
      const converted=await withPhotoDeadline((async()=>{const {heicTo}=await heicDecoder;return heicTo({blob:file,type:'image/jpeg',quality:.9});})());
      await load(converted);
    }
    const width=image.naturalWidth,height=image.naturalHeight;
    if(width<80||height<100)throw new Error('This photo is too small. Choose one at least 80 × 100 pixels.');
    if(width*height>50000000)throw new Error('This photo is over 50 megapixels. Export a smaller copy and choose it again.');
    return {image,width,height,close};
  } catch(error){close();throw new Error(error.message?.startsWith('This photo')?error.message:unreadable);}
}

export function cropPhoto(photo,position=.5) {
  const {width:w,height:h,image}=photo,sw=Math.min(w,h*.8),sh=sw/.8;
  const canvas=document.createElement('canvas');canvas.width=800;canvas.height=1000;
  try {
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('This browser could not prepare the photo. Try an updated browser.');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,800,1000);
    ctx.drawImage(image,(w-sw)*position,(h-sh)*position,sw,sh,0,0,800,1000);
    for(const quality of [.85,.75,.65,.5]) {
      const data=canvas.toDataURL('image/webp',quality);
      if(!data.startsWith('data:image/webp;'))throw new Error('This browser cannot save photos in the required format. Try an updated browser.');
      if(data.split(',')[1].length<=800000)return data;
    }
    throw new Error('This photo could not be prepared. Try a smaller or less detailed photo.');
  } finally {canvas.width=0;canvas.height=0;}
}
