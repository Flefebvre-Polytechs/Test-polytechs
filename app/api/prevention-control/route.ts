import {dateToday} from '@/lib/workflows';
import {database} from '@/db/raw';
import {checkOrigin,requireRole} from '@/lib/access';
import {planAccess} from '@/lib/prevention-documents';
import {canApproveUrgency,hseeMembers,notifyPrevention,urgentReview,urgentScope} from '@/lib/prevention-control';
const fail=(error:string,status=400)=>Response.json({error},{status});
export async function GET(req:Request){try{const gate=await requireRole(req);if(gate.error)return gate.error;const id=new URL(req.url).searchParams.get('record'),canApprove=await canApproveUrgency(gate.user!);if(!id)return Response.json({canApprove,hseeCount:(await hseeMembers()).length,users:(await database().prepare('SELECT id,display_name FROM users ORDER BY display_name').all()).results},{headers:{'Cache-Control':'private, no-store'}});const plan=await planAccess(gate.user!,id);if(!plan)return fail('Plan non accessible.',404);const review=await urgentReview(plan);return Response.json({canApprove,review},{headers:{'Cache-Control':'private, no-store'}})}catch(e){console.error(e);return fail('Contrôle HSEE indisponible.',503)}}
export async function POST(req:Request){try{
 if(!checkOrigin(req))return fail('Origine non autorisée.',403);const gate=await requireRole(req,'editor');if(gate.error)return gate.error;
 const body=await req.json() as Record<string,unknown>,id=String(body.record||''),decisionAction=['approve','reject'].includes(String(body.action)),plan=await planAccess(gate.user!,id,!decisionAction);if(!plan)return fail('Modification non autorisée.',403);
 if(body.revision!==plan.revision)return fail('Le plan a changé. Enregistrez puis actualisez la demande.',409);
 if(body.action==='notify'){const result=await notifyPrevention(plan,'Information interne',plan.revision||1);return Response.json({ok:!result.warning,...result})}
 if(!['request','approve','reject'].includes(String(body.action)))return fail('Action inconnue.');
 if(plan.status==='Clôturé'||plan.details.urgent!=='Oui'||!plan.details.urgentReason?.trim())return fail('Enregistrez un plan non clôturé avec une urgence justifiée.');
 const members=await hseeMembers();if(!members.length)return fail('Aucun validateur HSEE configuré. Attribuez le rôle Validateur HSEE dans la fiche des membres.',409);
 const previous=await urgentReview(plan),decision=body.action==='request'?'Demandée':body.action==='approve'?'Approuvée':'Refusée';
 if(body.action!=='request'&&!await canApproveUrgency(gate.user!))return fail('Décision réservée aux membres désignés Validateurs HSEE.',403);
 if(body.action!=='request'&&previous?.decision!=='Demandée')return fail('Une demande enregistrée et en attente est nécessaire.',409);
 if(body.action==='approve'&&plan.details.inspection&&plan.details.inspection<dateToday())return fail('Impossible d’approuver rétroactivement une urgence après la date de l’inspection.',409);
 if(body.action==='request'&&previous?.decision==='Approuvée')return fail('Cette urgence est déjà approuvée pour ce périmètre.',409);
 if(body.action==='request'&&previous?.decision==='Demandée')return fail('Demande déjà en attente.',409);
 const reason=String(body.reason||'').trim();if(body.action!=='request'&&(!reason||reason.length>2000))return fail('Consignez le motif de la décision HSEE.');
 const result=await database().prepare("INSERT INTO prevention_urgent_reviews (record_id,scope_hash,decision,reason,author_id,author,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM records WHERE id=? AND revision=?) AND COALESCE((SELECT id FROM prevention_urgent_reviews WHERE record_id=? AND scope_hash=? ORDER BY id DESC LIMIT 1),0)=?").bind(id,urgentScope(plan),decision,body.action==='request'?plan.details.urgentReason:reason,gate.user!.id,gate.user!.displayName,new Date().toISOString(),id,plan.revision,id,urgentScope(plan),previous?.id||0).run();
 if(!result.meta.changes)return fail('Le plan ou la décision a changé. Actualisez.',409);
 const notification=await notifyPrevention(plan,'Urgence '+decision,Number(result.meta.last_row_id)||Date.now(),members.map(m=>m.id));
 return Response.json({ok:true,...notification,review:await urgentReview(plan)});
}catch(e){console.error(e);return fail('Décision HSEE impossible.',503)}}
