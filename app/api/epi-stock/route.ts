import {requireEpiRole} from '@/lib/epi-session';
import {epiCanRead,epiCanManage} from '@/lib/epi-access';
import {database} from '@/db/raw';
import {checkOrigin,requireRole} from '@/lib/access';
import {epiCatalog as catalog} from '@/lib/epi-private-source';
import {ensureCatalog,epiFamily} from '@/lib/epi-catalog-server';

const error=(message:string,status=400)=>Response.json({error:message},{status});
type Product={code:string;quantity:number|null;revision:number;catalog_status:string};
type Editable={supplier_reference:string;family:string;name:string;specifics:string;revision:number};


export async function GET(req:Request){try{const gate=await requireRole(req);if(gate.error)return gate.error;if(!await epiCanRead(gate.user!))return Response.json({error:'Accès QSSE nécessaire.'},{status:403});const params=new URL(req.url).searchParams,code=params.get('code');const db=database();if(code){const offset=Number(params.get('offset')||0);if(!/^[A-Za-z0-9*_-]{4,80}$/.test(code)||!Number.isSafeInteger(offset)||offset<0||offset>100000)return error('Historique invalide.');const movements=await db.prepare('SELECT * FROM epi_movements WHERE code=? ORDER BY created_at DESC,id DESC LIMIT 101 OFFSET ?').bind(code,offset).all();return Response.json({movements:movements.results.slice(0,100),hasMore:movements.results.length>100},{headers:{'Cache-Control':'no-store'}})}await ensureCatalog();const products=await db.prepare('SELECT p.*,CASE WHEN ph.code IS NULL THEN 0 ELSE 1 END AS has_photo,ph.updated_at AS photo_updated_at FROM epi_products p LEFT JOIN epi_photos ph ON ph.code=p.code WHERE p.catalog_status<>\'Supprimé\' ORDER BY p.family,p.name,p.code').all();return Response.json({products:products.results,canManage:await epiCanManage(gate.user!),source:catalog.source,sourceCount:catalog.items.length,duplicateRows:catalog.duplicateRows},{headers:{'Cache-Control':'no-store'}})}catch(e){console.error(e);return error('Stock EPI indisponible.',503)}}

export async function POST(req:Request){try{if(!checkOrigin(req))return error('Requête non autorisée.',403);const body=await req.json() as Record<string,unknown>;if(!body||typeof body!=='object'||Array.isArray(body))return error('Demande invalide.');const scanMovement=body.action===undefined&&['inventaire','entree','sortie'].includes(String(body.kind));const gate=scanMovement?await requireEpiRole(req,true):await requireRole(req,'editor');if(gate.error)return gate.error;if(!await epiCanManage(gate.user!))return Response.json({error:'Droit de modification QSSE nécessaire.'},{status:403});const db=database();if(body.action==='import'){if(gate.user!.role!=='admin')return error('Import réservé aux administrateurs.',403);await ensureCatalog();return Response.json({ok:true})}
const code=String(body.code||'');if(!/^[A-Za-z0-9*_-]{4,80}$/.test(code))return error('Référence invalide.');
if(body.action==='create'){
const family=epiFamily(String(body.family||'')),name=String(body.name||'').trim(),specifics=String(body.specifics||'').trim(),location=String(body.location||'').trim(),supplierReference=String(body.supplier_reference||code).trim();
const minimum=body.minimum===''||body.minimum===null||body.minimum===undefined?null:Number(body.minimum);
if(!family||family.length>100||!name||name.length>200||!supplierReference||supplierReference.length>120||/[\u0000-\u001f\u007f]/.test(supplierReference)||specifics.length>1000||location.length>150||minimum!==null&&(!Number.isSafeInteger(minimum)||minimum<0||minimum>1000000))return error('Renseignez une famille et un libellé valides.');
const result=await db.prepare("INSERT OR IGNORE INTO epi_products (code,supplier_reference,family,name,specifics,source_row,source_sheet,catalog_status,quantity,minimum,location,revision,updated_at) VALUES (?,?,?,?,?,0,'Ajout manuel','Actif',NULL,?,?,1,?)").bind(code,supplierReference,family,name,specifics,minimum,location,new Date().toISOString()).run();
if(!result.meta.changes)return error('Ce code existe déjà, y compris parmi les références supprimées. Utilisez un code unique.',409);
return Response.json({ok:true,code},{status:201});
}
if(body.action==='edit'){
const revision=Number(body.revision),family=epiFamily(String(body.family||'')),name=String(body.name||'').trim(),specifics=String(body.specifics||'').trim(),supplierReference=String(body.supplier_reference||'').trim();
if(!Number.isSafeInteger(revision)||revision<1||!family||family.length>100||!name||name.length>200||!supplierReference||supplierReference.length>120||/[\u0000-\u001f\u007f]/.test(supplierReference)||specifics.length>1000)return error('Vérifiez la référence fournisseur et les informations de l’EPI.');
const previous=await db.prepare("SELECT supplier_reference,family,name,specifics,revision FROM epi_products WHERE code=? AND catalog_status<>'Supprimé'").bind(code).first<Editable>();
if(!previous)return error('EPI introuvable ou supprimé.',404);
if(previous.revision!==revision)return error('Cette fiche EPI a été modifiée entre-temps. Rechargez.',409);
const before={supplier_reference:previous.supplier_reference||code,family:previous.family,name:previous.name,specifics:previous.specifics};
const after={supplier_reference:supplierReference,family,name,specifics};
if(JSON.stringify(before)===JSON.stringify(after))return Response.json({ok:true,unchanged:true});
const now=new Date().toISOString();
const updated=await db.batch([
db.prepare("UPDATE epi_products SET supplier_reference=?,family=?,name=?,specifics=?,revision=revision+1,updated_at=? WHERE code=? AND revision=? AND catalog_status<>'Supprimé'").bind(supplierReference,family,name,specifics,now,code,revision),
db.prepare("INSERT INTO epi_product_edits (id,code,before_json,after_json,author,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1").bind(crypto.randomUUID(),code,JSON.stringify(before),JSON.stringify(after),gate.user!.displayName,now)
]);
if(!updated[0].meta.changes||!updated[1].meta.changes)return error('Cette fiche EPI a été modifiée entre-temps. Rechargez.',409);
return Response.json({ok:true,code});
}
if(body.action==='delete'){
const revision=body.revision;if(typeof revision!=='number'||!Number.isSafeInteger(revision)||revision<1)return error('Version de référence invalide.');
// Keep the row and its movements so old dotations remain traceable and imports cannot recreate it.
const result=await db.prepare("UPDATE epi_products SET catalog_status='Supprimé',revision=revision+1,updated_at=? WHERE code=? AND revision=? AND catalog_status<>'Supprimé'").bind(new Date().toISOString(),code,revision).run();
if(!result.meta.changes)return error('Référence modifiée ou supprimée entre-temps. Rechargez.',409);
return Response.json({ok:true});
}
if(body.action==='catalog'){if(gate.user!.role!=='admin')return error('Validation réservée aux administrateurs.',403);const status=String(body.status||''),revision=Number(body.revision);if(!['Actif','À confirmer','Inactif'].includes(status)||!Number.isSafeInteger(revision))return error('Statut invalide.');const result=await db.prepare('UPDATE epi_products SET catalog_status=?,revision=revision+1,updated_at=? WHERE code=? AND revision=? AND catalog_status<>\'Supprimé\'').bind(status,new Date().toISOString(),code,revision).run();if(!result.meta.changes)return error('Référence modifiée entre-temps. Rechargez.',409);return Response.json({ok:true})}
if(body.action==='settings'){const minimum=body.minimum===''||body.minimum===null?null:Number(body.minimum),location=String(body.location||'').trim(),revision=Number(body.revision);if(minimum!==null&&(!Number.isSafeInteger(minimum)||minimum<0||minimum>1000000)||location.length>150||!Number.isSafeInteger(revision))return error('Paramètres invalides.');const result=await db.prepare('UPDATE epi_products SET minimum=?,location=?,revision=revision+1,updated_at=? WHERE code=? AND revision=? AND catalog_status<>\'Supprimé\'').bind(minimum,location,new Date().toISOString(),code,revision).run();if(!result.meta.changes)return error('Référence modifiée entre-temps. Rechargez.',409);return Response.json({ok:true})}
const kind=String(body.kind||''),amount=Number(body.amount),recipient=String(body.recipient||'').trim(),note=String(body.note||'').trim();if(body.amount===null||body.amount===undefined||body.amount===''||!['inventaire','entree','sortie'].includes(kind)||!Number.isSafeInteger(amount)||amount<0||amount>1000000||recipient.length>150||note.length>1000)return error('Mouvement invalide.');if(kind!=='inventaire'&&amount===0)return error('Indiquez une quantité positive.');if(kind==='sortie'&&!recipient)return error('Indiquez le bénéficiaire ou le service.');const product=await db.prepare('SELECT code,quantity,revision,catalog_status FROM epi_products WHERE code=?').bind(code).first<Product>();if(!product||product.catalog_status==='Supprimé')return error('Référence inconnue ou supprimée.',404);if(product.catalog_status==='Inactif'&&kind==='entree')return error('Une référence inactive ne peut plus être réapprovisionnée.');if(product.quantity===null&&kind!=='inventaire')return error('Faites le premier inventaire avant une entrée ou une sortie.');const before=product.quantity??0,after=kind==='inventaire'?amount:before+(kind==='entree'?amount:-amount);if(after<0)return error('Sortie supérieure au stock disponible.');if(after>1000000)return error('Le solde dépasse la limite de suivi.');const delta=after-before,now=new Date().toISOString();const result=await db.batch([db.prepare('UPDATE epi_products SET quantity=?,revision=revision+1,updated_at=? WHERE code=? AND revision=? AND catalog_status<>\'Supprimé\'').bind(after,now,code,product.revision),db.prepare('INSERT INTO epi_movements (id,code,kind,delta,quantity,recipient,note,author,created_at) SELECT ?,?,?,?,?,?,?,?,? WHERE changes()=1 AND EXISTS (SELECT 1 FROM epi_products WHERE code=? AND revision=?)').bind(crypto.randomUUID(),code,kind,delta,after,recipient,note,gate.user!.displayName,now,code,product.revision+1)]);if(!result[0].meta.changes||!result[1].meta.changes)return error('Stock modifié simultanément. Rechargez et recommencez.',409);return Response.json({ok:true,quantity:after});
}catch(e){console.error(e);return error('Enregistrement impossible. Réessayez.',503)}}
