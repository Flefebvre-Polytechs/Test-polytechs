import {database} from '@/db/raw';
import {requireRole} from '@/lib/access';
import {teamsAllowed} from '@/lib/team-access';
import {ensureCatalog} from '@/lib/epi-catalog-server';

export const runtime='nodejs';
const fail=(error:string,status=400)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});

export async function GET(req:Request){try{
  const gate=await requireRole(req);if(gate.error)return gate.error;
  if(!await teamsAllowed(gate.user!,['qsse']))return fail('Accès QSSE nécessaire.',403);
  const code=new URL(req.url).searchParams.get('code')||'';
  if(!/^[A-Za-z0-9*_-]{4,80}$/.test(code))return fail('Référence invalide.');
  await ensureCatalog();
  const product=await database().prepare('SELECT p.code,p.family,p.name,p.specifics,p.catalog_status,p.quantity,p.minimum,p.location,CASE WHEN ph.code IS NULL THEN 0 ELSE 1 END AS has_photo,ph.updated_at AS photo_updated_at FROM epi_products p LEFT JOIN epi_photos ph ON ph.code=p.code WHERE p.code=?').bind(code).first();
  if(!product)return fail('EPI introuvable.',404);
  const canEdit=gate.user!.role!=='reader'&&await teamsAllowed(gate.user!,['qsse'],true);
  return Response.json({product,canEdit},{headers:{'Cache-Control':'private, no-store'}});
}catch(e){console.error(e);return fail('Fiche EPI indisponible.',503)}}
