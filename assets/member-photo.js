// Photo preparation is local to the browser. Only the cropped WebP is saved.
const MAX_BYTES=10*1024*1024;
const unreadable='That photo could not be opened. Try another photo, or export it as JPG and choose it again.';
let heicDecoder,webpEncoder,webpEncoderLoading;

async function prepareWebpEncoder(onProgress) {
  if(webpEncoder)return;
  const probe=document.createElement('canvas');probe.width=1;probe.height=1;
  let native=false;
  try{native=probe.toDataURL('image/webp',.5).startsWith('data:image/webp;');}
  finally{probe.width=0;probe.height=0;}
  if(native)return;
  onProgress('Preparing photo for this browser…');
  webpEncoderLoading ||= (async()=>{
    const [{default:createEncoder},{defaultOptions}]=await Promise.all([
      import('./vendor/webp-encoder-1.5.0/webp_enc.js'),
      import('./vendor/webp-encoder-1.5.0/options.js')
    ]);
    const response=await fetch(new URL('./vendor/webp-encoder-1.5.0/webp_enc.wasm',import.meta.url),{signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw new Error('Photo converter unavailable');
    const module=await createEncoder({wasmBinary:new Uint8Array(await response.arrayBuffer())});
    return {module,options:defaultOptions};
  })().catch(error=>{webpEncoderLoading=null;throw error;});
  try{webpEncoder=await withPhotoDeadline(webpEncoderLoading);}
  catch{throw new Error('This photo converter could not load. Check your connection and choose the photo again, or open this page directly in Safari or Chrome.');}
}

function fallbackWebp(ctx,quality) {
  if(!webpEncoder)throw new Error('This browser could not prepare the photo. Reload this page and choose the photo again.');
  const pixels=ctx.getImageData(0,0,800,1000);
  const bytes=webpEncoder.module.encode(pixels.data,800,1000,{...webpEncoder.options,quality:quality*100,low_memory:1});
  if(!bytes?.length)throw new Error('This photo could not be prepared. Try another photo.');
  let binary='';
  for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return 'data:image/webp;base64,'+btoa(binary);
}

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
    await prepareWebpEncoder(onProgress);
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
      const native=canvas.toDataURL('image/webp',quality);
      const data=native.startsWith('data:image/webp;')?native:fallbackWebp(ctx,quality);
      if(data.split(',')[1].length<=800000)return data;
    }
    throw new Error('This photo could not be prepared. Try a smaller or less detailed photo.');
  } finally {canvas.width=0;canvas.height=0;}
}
