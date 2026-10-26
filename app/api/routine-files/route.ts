import sharp from 'sharp';
import {bucket} from '@/db/raw';
import {checkOrigin} from '@/lib/access';
import {auditAccess,auditFail,auditNoStore,updateAudit} from '@/lib/audit-server';
export const runtime='nodejs';
const limit=2*1024*1024;

export async function GET(req:Request){try{
  const q=new URL(req.url).searchParams,access=await auditAccess(req,q.get('routine')||'',q.get('date')||'');
  if(access.error)return access.error;
  const file=access.run!.data.photos?.find(p=>p.id===q.get('id'));if(!file)return auditFail('Photo introuvable.',404);
  const blob=await bucket().get('audits/'+access.run!.id+'/'+file.id);if(!blob)return auditFail('Photo indisponible.',404);
  return new Response(blob.body,{headers:{...auditNoStore,'Content-Type':'image/jpeg','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Content-Disposition':"inline; filename*=UTF-8''"+encodeURIComponent(file.name)}});
}catch(e){console.error(e);return auditFail('Chargement de la photo impossible.',503)}}

export async function POST(req:Request){try{
  if(!checkOrigin(req))return auditFail('Origine non autorisée.',403);
  const q=new URL(req.url).searchParams,access=await auditAccess(req,q.get('routine')||'',q.get('date')||'',true);
  if(access.error)return access.error;
  const {run,user}=access;
  if(run!.data.completed)return auditFail('Rouvrez le compte rendu avant de modifier ses photos.',409);
  // Bound the complete multipart stream even when Content-Length is absent.
  const reader=req.body?.getReader();if(!reader)return auditFail('Choisissez une photo.');
  const chunks:Uint8Array[]=[];let total=0;while(true){const part=await reader.read();if(part.done)break;total+=part.value.length;if(total>limit+65536){await reader.cancel();return auditFail('Limite : 2 Mo par photo.',413)}chunks.push(part.value)}
  const form=await new Response(Buffer.concat(chunks),{headers:{'Content-Type':req.headers.get('content-type')||''}}).formData();
  const revision=Number(form.get('revision')),file=form.get('file'),questionId=String(form.get('questionId')||''),caption=String(form.get('caption')||'').trim();
  if(!Number.isInteger(revision)||revision!==run!.revision)return auditFail('Le compte rendu a changé. Rechargez avant de réessayer.',409);
  if(!(file instanceof File)||!file.size||file.size>limit||file.name.length>200||caption.length>500||questionId&&!run!.data.answers.some(a=>a.id===questionId))return auditFail('Photo, légende ou point de contrôle invalide.');
  const photos=run!.data.photos||[];if(photos.length>=30)return auditFail('Limite : 30 photos par compte rendu.');
  let bytes:Buffer;try{const source=sharp(Buffer.from(await file.arrayBuffer()),{limitInputPixels:20_000_000,animated:false}),metadata=await source.metadata();if(!['jpeg','png','webp'].includes(metadata.format||''))return auditFail('Choisissez une image JPG, PNG ou WebP.');bytes=await source.rotate().resize({width:1800,height:1800,fit:'inside',withoutEnlargement:true}).jpeg({quality:82}).toBuffer()}catch{return auditFail('Image illisible ou trop grande. Choisissez une autre photo.')}
  if(photos.reduce((n,p)=>n+p.size,0)+bytes.length>20*1024*1024)return auditFail('Limite : 20 Mo de photos par compte rendu.');
  const id=crypto.randomUUID(),now=new Date().toISOString(),photo={id,questionId,name:file.name.replace(/\.[^.]+$/,'').replace(/[\r\n\x00]/g,'')+'.jpg',mime:'image/jpeg',size:bytes.length,caption,author:user!.displayName,createdAt:now},key='audits/'+run!.id+'/'+id,data={...run!.data,photos:[...photos,photo]};
  await bucket().put(key,bytes);
  try{if(!await updateAudit(run!,data,user!.displayName,now)){await bucket().delete(key);return auditFail('Le compte rendu a changé. Rechargez avant de réessayer.',409)}}catch(e){await bucket().delete(key);throw e}
  return Response.json({data,revision:run!.revision+1},{headers:auditNoStore});
}catch(e){console.error(e);return auditFail('Ajout de la photo impossible. Vérifiez la liste avant de réessayer.',503)}}

export async function DELETE(req:Request){try{
  if(!checkOrigin(req))return auditFail('Origine non autorisée.',403);
  const q=new URL(req.url).searchParams,access=await auditAccess(req,q.get('routine')||'',q.get('date')||'',true);if(access.error)return access.error;
  const {run,user}=access;if(run!.data.completed)return auditFail('Rouvrez le compte rendu avant de modifier ses photos.',409);
  const body=await req.json() as {id?:string;revision?:number};if(body.revision!==run!.revision)return auditFail('Le compte rendu a changé. Rechargez avant de réessayer.',409);
  const photos=run!.data.photos||[];if(!photos.some(p=>p.id===body.id))return auditFail('Photo introuvable.',404);
  const data={...run!.data,photos:photos.filter(p=>p.id!==body.id)};
  if(!await updateAudit(run!,data,user!.displayName,new Date().toISOString()))return auditFail('Le compte rendu a changé. Rechargez avant de réessayer.',409);
  return Response.json({data,revision:run!.revision+1},{headers:auditNoStore});
}catch(e){console.error(e);return auditFail('Retrait de la photo impossible.',503)}}
