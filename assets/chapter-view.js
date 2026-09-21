// Isolated hosted-test renderer. Real chapters have standalone published pages.
(async()=>{
  const params=new URLSearchParams(location.search), id=params.get('id');
  const api=(document.querySelector('meta[name="chapter-api"]')?.content||'').replace(/\/$/,'');
  const status=document.getElementById('view-status');
  if(params.get('test')!=='1'||!id||!/^[a-z0-9-]+$/.test(id)||!api){status.textContent='A valid test chapter link is required.';return;}
  const el=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
  try{
    const response=await fetch(`${api}/test/public/${id}`,{cache:'no-store'});
    if(!response.ok)throw Error();
    const result=await response.json(), c=result.chapter||result;
    const wrapper=document.getElementById('chapter');wrapper.className='chapter-document';
    status.textContent='Test chapter · Not a real chapter';
    const header=el('header');header.className='cp-heading';
    const badge=el('p',c.status==='official'?'Official Chapter':'Upcoming Chapter');badge.className='cp-status';
    header.append(badge,el('h1',c.name),el('p',c.location));wrapper.append(header);
    function section(title,text){const s=el('section');s.className='cp-extra';s.append(el('h2',title));if(text)s.append(el('p',text));wrapper.append(s);return s;}
    if(c.lead.message)section('About the chapter',c.lead.message);
    section(c.status==='official'?'First meeting held':'First meeting',c.firstGathering.date);
    const lead=section('Chapter Lead');lead.append(el('h3',c.lead.name));if(c.lead.bio)lead.append(el('p',c.lead.bio));
    function photo(pid,caption){const f=el('figure'),img=el('img');img.src=`${api}/test/media/${pid}`;img.alt=caption||'';img.loading='lazy';f.append(img);if(caption)f.append(el('figcaption',caption));return f;}
    if(c.team?.length){const s=section('Chapter team'),grid=el('div');grid.className='cp-team-grid';for(const p of c.team){const card=el('article');if(p.photo)card.append(photo(p.photo,p.name));card.append(el('h3',p.name),el('p',p.role));if(p.bio)card.append(el('p',p.bio));grid.append(card);}s.append(grid);}
    if(c.activities?.length){const s=section('Activities','Updates from the chapter.');for(const a of [...c.activities].sort((a,b)=>b.date.localeCompare(a.date))){const card=el('article');card.className='cp-activity';card.append(el('time',a.date),el('h3',a.title),el('p',a.description));const grid=el('div');grid.className='cp-gallery';for(const p of a.photos||[])grid.append(photo(p,a.title));card.append(grid);s.append(card);}}
    const photos=(c.photos||[]).filter(p=>p.gallery);if(photos.length){const s=section('Photos'),grid=el('div');grid.className='cp-gallery';for(const p of photos)grid.append(photo(p.id,p.caption));s.append(grid);}
  }catch{status.textContent='This test chapter is unavailable.';}
})();
