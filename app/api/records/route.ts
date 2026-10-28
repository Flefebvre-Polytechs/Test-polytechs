import {recordAccess} from '@/lib/record-access';
import { database } from '@/db/raw';
import { normalize,validate,type QRecord } from '@/lib/workflows';
import {checkOrigin,requireRole} from '@/lib/access';
export async function GET(req:Request){try{const gate=await requireRole(req);if(gate.error)return gate.error;const rows=(await database().prepare('SELECT * FROM records ORDER BY created DESC').all()).results;const canRead=await recordAccess(gate.user!,rows),id=new URL(req.url).searchParams.get('history');if(id){const record=rows.find((r:any)=>r.id===id);if(!record||!canRead(record))return Response.json({error:'Fiche non accessible.'},{status:403});const history=(await database().prepare('SELECT revision,snapshot,saved_at FROM record_history WHERE record_id=? ORDER BY revision DESC').bind(id).all()).results.filter((r:any)=>canRead(JSON.parse(r.snapshot)));return Response.json({history},{headers:{'Cache-Control':'private, no-store'}})}const canWrite=await recordAccess(gate.user!,rows,true);return Response.json({records:rows.filter(canRead),editableIds:rows.filter(canRead).filter(canWrite).map(r=>r.id),canCreate:canWrite({kind:'Action'}),canCreateHealth:canWrite({kind:'Accidents du travail'})},{headers:{'Cache-Control':'private, no-store'}})}catch(e){console.error(e);return Response.json({error:'Chargement impossible.'},{status:503})}}
export async function POST(req:Request){try{if(!checkOrigin(req))return Response.json({error:'Requête non autorisée.'},{status:403});const gate=await requireRole(req,'editor');if(gate.error)return gate.error;const b=await req.json() as QRecord&Record<string,unknown>;if(!b||typeof b!=='object'||Array.isArray(b))return Response.json({error:'Fiche invalide.'},{status:400});for(const key of ['title','kind','domain','status','priority','owner','due','description','url'])if(typeof b[key]!=='string'||b[key].length>5000)return Response.json({error:'Fiche invalide.'},{status:400});if(b.title.length>200||b.owner.length>150||!['Qualité','Sécurité','Environnement'].includes(b.domain)||!['Haute','Normale','Basse'].includes(b.priority))return Response.json({error:'Valeurs invalides.'},{status:400});for(const k of ['id','sourceId'])if(b[k]!==undefined&&(typeof b[k]!=='string'||b[k].length>100))return Response.json({error:'Référence invalide.'},{status:400});if(!b.details||typeof b.details!=='object'||Array.isArray(b.details)||Object.values(b.details).some(v=>typeof v!=='string'||v.length>5000)||JSON.stringify(b.details).length>30000)return Response.json({error:'Champs complémentaires invalides.'},{status:400});
const db=database(),all=(await db.prepare('SELECT * FROM records').all()).results.map(normalize),r=normalize(b);r.status=b.status;const canWrite=await recordAccess(gate.user!,all,true);if(!canWrite(r)||b.id&&!canWrite(all.find(x=>x.id===b.id)||{sourceId:'missing'}))return Response.json({error:'Droit de modification du service nécessaire.'},{status:403});if(r.details.ownerId){if(r.details.ownerId.length>100)return Response.json({error:'Pilote invalide.'},{status:400});const person=await db.prepare('SELECT display_name FROM users WHERE id=?').bind(r.details.ownerId).first<{display_name:string}>();if(!person)return Response.json({error:'Compte pilote introuvable.'},{status:400});r.owner=person.display_name;}const errors=validate(r,all);if(errors.length)return Response.json({error:errors.join('\n')},{status:400});const now=new Date().toISOString(),id=b.id||crypto.randomUUID(),details=JSON.stringify(r.details);const previous=all.find(x=>x.id===b.id);
if(r.kind==='EPI'){
  const issued=previous?.kind==='EPI'&&previous.status!=='À remettre';
  if(issued&&previous&&(r.status==='À remettre'||r.details.reference!==previous.details.reference||r.details.quantity!==previous.details.quantity||r.details.assignee!==previous.details.assignee))return Response.json({error:'Une dotation déjà remise ne peut pas changer de référence, de quantité ou de bénéficiaire. Créez une autre dotation et corrigez le stock par inventaire si nécessaire.'},{status:400});
  if(!issued&&['À remplacer','Retiré'].includes(r.status))return Response.json({error:'Passez d’abord la dotation en service pour enregistrer la remise.'},{status:400});
}
if(b.id){if(!previous)return Response.json({error:'Fiche introuvable.'},{status:404});if(previous.sourceId&&previous.sourceId!==r.sourceId)return Response.json({error:'Le lien d’origine est conservé pour protéger l’historique. Créez une fiche distincte.'},{status:400});if(previous.kind!==r.kind)return Response.json({error:'Le module d’une fiche existante ne peut pas être modifié.'},{status:400});if(b.revision!==previous.revision)return Response.json({error:'Cette fiche a été modifiée depuis son ouverture. Fermez-la puis rouvrez-la pour consulter la dernière version. Copiez votre saisie avant de fermer.'},{status:409});}
if(r.kind==='EPI'&&r.status==='En service'&&(!previous||previous.status==='À remettre')){
  const code=r.details.reference||'',amount=Number(r.details.quantity);
  if(!/^[A-Za-z0-9*_-]{4,80}$/.test(code)||!Number.isSafeInteger(amount)||amount<1||amount>1000000)return Response.json({error:'Choisissez une référence du catalogue et une quantité entière positive.'},{status:400});
  const product=await db.prepare('SELECT quantity,revision,catalog_status FROM epi_products WHERE code=?').bind(code).first<{quantity:number|null;revision:number;catalog_status:string}>();
  if(!product||product.catalog_status!=='Actif'||product.quantity===null)return Response.json({error:'Référence non confirmée, inactive ou non inventoriée. Vérifiez le catalogue et le stock avant la remise.'},{status:400});
  if(product.quantity<amount)return Response.json({error:'Stock insuffisant pour cette dotation.'},{status:409});
  const next=product.quantity-amount,revision=product.revision+1;
  const stockUpdate=db.prepare('UPDATE epi_products SET quantity=quantity-?,revision=revision+1,updated_at=? WHERE code=? AND revision=? AND quantity>=? AND catalog_status=?'+(previous?' AND EXISTS (SELECT 1 FROM records WHERE id=? AND revision=?)':'')).bind(...(previous?[amount,now,code,product.revision,amount,'Actif',id,previous.revision]:[amount,now,code,product.revision,amount,'Actif']));
  const movement=db.prepare("INSERT INTO epi_movements (id,code,kind,delta,quantity,recipient,note,author,created_at) SELECT ?,?,'sortie',?,?,?,?,?,? WHERE changes()=1 AND EXISTS (SELECT 1 FROM epi_products WHERE code=? AND revision=?)").bind(crypto.randomUUID(),code,-amount,next,r.details.assignee,'Dotation '+id,gate.user!.displayName,now,code,revision);
  const record=previous?
    db.prepare('UPDATE records SET title=?,domain=?,status=?,priority=?,owner=?,due=?,description=?,url=?,details=?,source_id=?,updated=?,revision=revision+1 WHERE id=? AND revision=? AND changes()=1 AND EXISTS (SELECT 1 FROM epi_products WHERE code=? AND revision=?)').bind(r.title.trim(),r.domain,r.status,r.priority,r.owner,r.due,r.description,r.url,details,r.sourceId||'',now,id,previous.revision,code,revision):
    db.prepare('INSERT INTO records (id,title,kind,domain,status,priority,owner,due,description,url,details,created,updated,revision,source_id) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE changes()=1 AND EXISTS (SELECT 1 FROM epi_products WHERE code=? AND revision=?)').bind(id,r.title.trim(),r.kind,r.domain,r.status,r.priority,r.owner,r.due,r.description,r.url,details,now,now,1,r.sourceId||'',code,revision);
  const statements=previous?[stockUpdate,movement,db.prepare('INSERT INTO record_history (id,record_id,revision,snapshot,saved_at) SELECT ?,?,?,?,? WHERE changes()=1 AND EXISTS (SELECT 1 FROM epi_products WHERE code=? AND revision=?)').bind(crypto.randomUUID(),id,previous.revision,JSON.stringify(previous),now,code,revision),record]:[stockUpdate,movement,record];
  const results=await db.batch(statements);
  if(results.some(result=>!result.meta.changes))return Response.json({error:'Stock ou dotation modifiés entre-temps. Rechargez et réessayez.'},{status:409});
  return Response.json({id});
}
if(previous){
const results=await db.batch([
db.prepare('UPDATE records SET title=?,domain=?,status=?,priority=?,owner=?,due=?,description=?,url=?,details=?,source_id=?,updated=?,revision=revision+1 WHERE id=? AND revision=?').bind(r.title.trim(),r.domain,r.status,r.priority,r.owner,r.due,r.description,r.url,details,r.sourceId||'',now,id,previous.revision),
db.prepare('INSERT INTO record_history (id,record_id,revision,snapshot,saved_at) SELECT ?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),id,previous.revision,JSON.stringify(previous),now)
]);if(!results[0].meta.changes)return Response.json({error:'Modification concurrente. Fermez et rouvrez la fiche avant de réessayer.'},{status:409});
}else {const created=await db.prepare('INSERT INTO records (id,title,kind,domain,status,priority,owner,due,description,url,details,created,updated,revision,source_id) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ?=\'\' OR EXISTS (SELECT 1 FROM records WHERE id=?)').bind(id,r.title.trim(),r.kind,r.domain,r.status,r.priority,r.owner,r.due,r.description,r.url,details,now,now,1,r.sourceId||'',r.sourceId||'',r.sourceId||'').run();if(!created.meta.changes)return Response.json({error:'La fiche d’origine a été supprimée entre-temps. Rechargez le registre avant de créer une action.'},{status:409});}return Response.json({id});
}catch(e){console.error(e);return Response.json({error:'Enregistrement impossible. Votre saisie est conservée.'},{status:503});}}

export async function DELETE(req:Request){
 try{
  if(!checkOrigin(req))return Response.json({error:'Requête non autorisée.'},{status:403});
  const gate=await requireRole(req,'admin');if(gate.error)return gate.error;
  const body=await req.json().catch(()=>null) as {id:string;revision:number;confirmation:string}|null;
  if(!body||typeof body!=='object'||Array.isArray(body)||typeof body.id!=='string'||!body.id||body.id.length>100||!Number.isSafeInteger(body.revision)||body.revision<1||body.confirmation!=='SUPPRIMER')return Response.json({error:'Saisissez exactement SUPPRIMER pour confirmer la suppression.'},{status:400});
  const db=database(),rows=(await db.prepare('SELECT * FROM records').all()).results,raw=rows.find((r:any)=>r.id===body.id);
  if(!raw)return Response.json({error:'Fiche introuvable ou déjà supprimée.'},{status:404});
  const allowed=await recordAccess(gate.user!,rows,true);if(!allowed(raw))return Response.json({error:'Suppression non autorisée.'},{status:403});
  const record=normalize(raw);
  if(record.revision!==body.revision)return Response.json({error:'Cette fiche a changé depuis son ouverture. Fermez cette fenêtre puis rouvrez la fiche avant de la supprimer.'},{status:409});
  if(['Gestion documentaire','Gestion des déchets'].includes(record.kind))return Response.json({error:'Gérez cette fiche depuis son module dédié pour conserver ses documents et son historique.'},{status:409});
  if(record.kind==='EPI'&&record.status!=='À remettre')return Response.json({error:'Cette dotation a déjà été remise. Conservez sa traçabilité et utilisez le suivi EPI pour la retirer ou corriger le stock.'},{status:409});
  if(rows.some((r:any)=>r.source_id===record.id))return Response.json({error:'Cette fiche possède des actions liées. Traitez ou supprimez ces actions avant de supprimer leur fiche d’origine.'},{status:409});
  const now=new Date().toISOString();
  const results=await db.batch([
   db.prepare('INSERT INTO record_deletions (record_id,revision,snapshot,deleted_at,deleted_by) SELECT id,revision,?,?,? FROM records WHERE id=? AND revision=? AND NOT EXISTS (SELECT 1 FROM records child WHERE child.source_id=records.id)').bind(JSON.stringify(record),now,gate.user!.id,body.id,body.revision),
   db.prepare('DELETE FROM records WHERE id=? AND revision=? AND changes()=1').bind(body.id,body.revision),
   db.prepare("INSERT INTO security_events (id,action,user_id,detail,created_at) SELECT ?,'record-delete',?,?,? WHERE changes()=1").bind(crypto.randomUUID(),gate.user!.id,body.id,now)
  ]);
  if(!results[1].meta.changes)return Response.json({error:'La fiche ou ses actions liées ont changé. Fermez cette fenêtre et rechargez le registre.'},{status:409});
  return Response.json({deleted:true,id:body.id});
 }catch(e){console.error(e);return Response.json({error:'Suppression impossible. La fiche est conservée ; réessayez après avoir rechargé le registre.'},{status:503})}
}
