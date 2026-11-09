import {database} from '@/db/raw';
import {checkOrigin,requireRole,securityEvent} from '@/lib/access';
import {teamsAllowed} from '@/lib/team-access';
import {authorizationStatuses,habilitationKinds,isValidDate} from '@/lib/habilitations';

const fail=(error:string,status=400)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
const ok=(data:unknown)=>Response.json(data,{headers:{'Cache-Control':'private, no-store'}});
const textField=(value:unknown,max=150)=>typeof value==='string'&&value.length<=max?value.trim():null;
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
const isId=(value:unknown)=>typeof value==='string'&&/^[a-f\d-]{36}$/i.test(value);
type Person={id:string;revision:number;active:number;qr_token:string};

async function gateRead(req:Request){
 const gate=await requireRole(req);
 if(gate.error)return {error:gate.error};
 if(!await teamsAllowed(gate.user!,['rh']))return {error:fail('Accès au service RH nécessaire.',403)};
 return {user:gate.user!};
}
async function gateWrite(req:Request){
 if(!checkOrigin(req))return {error:fail('Origine non autorisée.',403)};
 const gate=await requireRole(req,'editor');
 if(gate.error)return {error:gate.error};
 if(!await teamsAllowed(gate.user!,['rh'],true))return {error:fail('Gestion des habilitations réservée aux contributeurs RH.',403)};
 return {user:gate.user!};
}
export async function GET(req:Request){
 try{
  const gate=await gateRead(req);if(gate.error)return gate.error;
  const db=database();
  const [people,authorizations,files]=await Promise.all([
   db.prepare('SELECT * FROM hr_people ORDER BY last_name,first_name').all(),
   db.prepare('SELECT * FROM hr_authorizations ORDER BY updated_at DESC').all(),
   db.prepare('SELECT id,authorization_id,name,mime,size,author,created_at FROM hr_authorization_files ORDER BY created_at DESC').all()
  ]);
  return ok({people:people.results,authorizations:authorizations.results,files:files.results,canEdit:await teamsAllowed(gate.user!,['rh'],true)});
 }catch(e){console.error(e);return fail('Registre des habilitations indisponible.',503)}
}
export async function POST(req:Request){
 try{
  const gate=await gateWrite(req);if(gate.error)return gate.error;
  const b=await req.json() as Record<string,unknown>;
  if(!b||typeof b!=='object')return fail('Saisie invalide.');
  const db=database(),now=new Date().toISOString(),actor=gate.user!;
  if(b.action==='create-person'){
   const first=textField(b.firstName,80),last=textField(b.lastName,80),service=textField(b.service,100);
   if(!first||!last||service===null)return fail('Indiquez un prénom, un nom et éventuellement un service.');
   const id=crypto.randomUUID();
   await db.prepare('INSERT INTO hr_people (id,first_name,last_name,service,qr_token,active,revision,created_at,updated_at) VALUES (?,?,?,?,?,1,1,?,?)').bind(id,first,last,service,token(),now,now).run();
   await securityEvent('hr_person_created',actor.id,id);
   return ok({ok:true,id});
  }
  if(b.action==='update-person'||b.action==='rotate-badge'||b.action==='deactivate-person'){
   if(!isId(b.personId)||!Number.isSafeInteger(b.revision)||Number(b.revision)<1)return fail('Fiche ou révision invalide.');
   const p=await db.prepare('SELECT id,revision,active,qr_token FROM hr_people WHERE id=?').bind(b.personId).first<Person>();
   if(!p)return fail('Salarié introuvable.',404);
   let result;
   if(b.action==='rotate-badge'){
    result=await db.prepare('UPDATE hr_people SET qr_token=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(token(),now,b.personId,b.revision).run();
   }else if(b.action==='deactivate-person'){
    if(b.confirmation!=='SUPPRIMER')return fail('Saisissez SUPPRIMER pour désactiver cette fiche.');
    // Badge immediately stops working without destroying the traceable history.
    result=await db.prepare('UPDATE hr_people SET active=0,qr_token=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(token(),now,b.personId,b.revision).run();
   }else{
    const first=textField(b.firstName,80),last=textField(b.lastName,80),service=textField(b.service,100);
    if(!first||!last||service===null||typeof b.active!=='boolean')return fail('Données du salarié invalides.');
    const activating=b.active&&!p.active;
    result=await db.prepare('UPDATE hr_people SET first_name=?,last_name=?,service=?,active=?,qr_token=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(first,last,service,b.active?1:0,activating?token():p.qr_token,now,b.personId,b.revision).run();
   }
   if(!result.meta.changes)return fail('Fiche modifiée depuis son ouverture. Actualisez.',409);
   await securityEvent('hr_'+String(b.action),actor.id,String(b.personId));
   return ok({ok:true});
  }
  if(b.action==='save-authorization'){
   if(!isId(b.personId))return fail('Choisissez un salarié.');
   if(!await db.prepare('SELECT id FROM hr_people WHERE id=? AND active=1').bind(b.personId).first())return fail('Salarié inactif ou inconnu.',404);
   const kind=textField(b.kind,40),title=textField(b.title,150),category=textField(b.category,100),equipment=textField(b.equipment,150),zone=textField(b.zone,150),note=textField(b.note,2000),status=textField(b.status,20);
   const validFrom=textField(b.validFrom,10),validUntil=textField(b.validUntil,10),trainingUntil=textField(b.trainingUntil,10),medicalUntil=textField(b.medicalUntil,10);
   const checked=b.prerequisitesChecked===true;
   if(!kind||!habilitationKinds.includes(kind as typeof habilitationKinds[number])||!title||category===null||equipment===null||zone===null||note===null||!status||!authorizationStatuses.includes(status as typeof authorizationStatuses[number])||!validFrom||!isValidDate(validFrom)||[validUntil,trainingUntil,medicalUntil].some(x=>x===null||!isValidDate(x!,true)))return fail('Type, intitulé, dates ou statut invalide.');
   if([validUntil,trainingUntil,medicalUntil].some(x=>x!==''&&x!<validFrom))return fail('Une échéance précède le début de validité.');
   if(kind==='Autorisation de conduite'&&status==='active'&&!checked)return fail('Confirmez les contrôles préalables avant d’activer l’autorisation.');
   const id=typeof b.id==='string'&&b.id?b.id:crypto.randomUUID(),newRecord=!b.id;
   let result;
   if(newRecord)result=await db.prepare('INSERT INTO hr_authorizations (id,person_id,kind,title,category,equipment,zone,valid_from,valid_until,training_until,medical_until,status,prerequisites_checked,note,revision,updated_at,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)').bind(id,b.personId,kind,title,category,equipment,zone,validFrom,validUntil,trainingUntil,medicalUntil,status,checked?1:0,note,now,actor.displayName).run();
   else {
    if(!isId(b.id)||!Number.isSafeInteger(b.revision)||Number(b.revision)<1)return fail('Révision d’autorisation invalide.');
    result=await db.prepare('UPDATE hr_authorizations SET kind=?,title=?,category=?,equipment=?,zone=?,valid_from=?,valid_until=?,training_until=?,medical_until=?,status=?,prerequisites_checked=?,note=?,revision=revision+1,updated_at=?,updated_by=? WHERE id=? AND person_id=? AND revision=?').bind(kind,title,category,equipment,zone,validFrom,validUntil,trainingUntil,medicalUntil,status,checked?1:0,note,now,actor.displayName,id,b.personId,b.revision).run();
   }
   if(!result.meta.changes)return fail('Autorisation modifiée. Actualisez la fiche.',409);
   await db.prepare('INSERT INTO hr_authorization_events (id,person_id,authorization_id,action,actor_id,actor,created_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),b.personId,id,newRecord?'Création':'Modification',actor.id,actor.displayName,now).run();
   await securityEvent('hr_authorization_saved',actor.id,id);
   return ok({ok:true,id});
  }
  if(b.action==='revoke-authorization'){
   if(!isId(b.id)||!isId(b.personId)||!Number.isSafeInteger(b.revision)||b.confirmation!=='SUPPRIMER')return fail('Confirmez le retrait en saisissant SUPPRIMER.');
   const changed=await db.prepare("UPDATE hr_authorizations SET status='revoked',revision=revision+1,updated_at=?,updated_by=? WHERE id=? AND person_id=? AND revision=?").bind(now,actor.displayName,b.id,b.personId,b.revision).run();
   if(!changed.meta.changes)return fail('Autorisation modifiée ou introuvable. Actualisez.',409);
   await db.prepare('INSERT INTO hr_authorization_events (id,person_id,authorization_id,action,actor_id,actor,created_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),b.personId,b.id,'Retrait',actor.id,actor.displayName,now).run();
   await securityEvent('hr_authorization_revoked',actor.id,String(b.id));
   return ok({ok:true});
  }
  return fail('Action inconnue.');
 }catch(e){console.error(e);return fail('Modification des habilitations impossible.',503)}
}
