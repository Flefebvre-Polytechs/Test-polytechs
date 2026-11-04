import {requireRole} from '@/lib/access';
import {database} from '@/db/raw';
import {epiCanRead} from '@/lib/epi-access';
import {ensureCatalog} from '@/lib/epi-catalog-server';

type ProductRow={code:string;name:string;supplier_reference:string;family:string;quantity:number|null;minimum:number|null;unit_cost_cents:number|null;catalog_status:string};
type MovementRow={code:string;kind:string;delta:number;unit_cost_cents:number|null;created_at:string};
type Bucket={month:string;label:string;issuedUnits:number;receivedUnits:number;issuedCostCents:number;receivedCostCents:number;valuedUnits:number;unvaluedUnits:number};
type Ranking={code:string;name:string;reference:string;family:string;units:number;costCents:number;valuedUnits:number;unvaluedUnits:number};
const bad=(error:string,status=400)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});

export async function GET(req:Request){try{
  const gate=await requireRole(req);
  if(gate.error)return gate.error;
  if(!await epiCanRead(gate.user!))return bad('Accès EPI non autorisé.',403);
  const query=new URL(req.url).searchParams;
  const months=Number(query.get('months')||6);
  if(![1,3,6,12].includes(months))return bad('Période invalide.');
  const family=(query.get('family')||'').trim();
  if(family.length>100)return bad('Famille invalide.');
  await ensureCatalog();
  const db=database();
  const products=(await db.prepare('SELECT code,name,supplier_reference,family,quantity,minimum,unit_cost_cents,catalog_status FROM epi_products').all()).results as ProductRow[];
  const families=[...new Set(products.filter(p=>p.catalog_status!=='Supprimé').map(p=>p.family))].sort((a,b)=>a.localeCompare(b,'fr'));
  if(family&&!families.includes(family))return bad('Famille inconnue.');
  const active=products.filter(p=>p.catalog_status!=='Supprimé'&&(!family||p.family===family));
  const map=new Map(products.map(p=>[p.code,p]));
  const now=new Date(),year=now.getUTCFullYear(),month=now.getUTCMonth();
  const start=new Date(Date.UTC(year,month-months+1,1)).toISOString();
  const end=new Date(Date.UTC(year,month+1,1)).toISOString();
  const movements=(await db.prepare('SELECT code,kind,delta,unit_cost_cents,created_at FROM epi_movements WHERE created_at>=? AND created_at<? ORDER BY created_at,id').bind(start,end).all()).results as MovementRow[];
  const monthly:Bucket[]=Array.from({length:months},(_,i)=>{
    const date=new Date(Date.UTC(year,month-months+1+i,1));
    return {month:date.toISOString().slice(0,7),label:new Intl.DateTimeFormat('fr-FR',{month:'short',year:'2-digit',timeZone:'UTC'}).format(date),issuedUnits:0,receivedUnits:0,issuedCostCents:0,receivedCostCents:0,valuedUnits:0,unvaluedUnits:0};
  });
  const monthMap=new Map(monthly.map(b=>[b.month,b]));
  const top=new Map<string,Ranking>();
  let issuedUnits=0,receivedUnits=0,issuedCostCents=0,receivedCostCents=0,valuedIssuedUnits=0,unvaluedIssuedUnits=0,unvaluedReceivedUnits=0;
  for(const m of movements){
    const p=map.get(m.code);
    if(!p||family&&p.family!==family)continue;
    const bucket=monthMap.get(m.created_at.slice(0,7));
    if(!bucket)continue;
    const qty=m.kind==='sortie'&&m.delta<0?-m.delta:m.kind==='entree'&&m.delta>0?m.delta:0;
    if(!qty)continue; // Un inventaire ou une correction de solde n'est pas une consommation.
    const valued=m.unit_cost_cents!==null&&Number.isSafeInteger(m.unit_cost_cents)&&m.unit_cost_cents>=0;
    if(m.kind==='sortie'){
      issuedUnits+=qty;bucket.issuedUnits+=qty;
      let item=top.get(m.code);
      if(!item){item={code:m.code,name:p.name,reference:p.supplier_reference||p.code,family:p.family,units:0,costCents:0,valuedUnits:0,unvaluedUnits:0};top.set(m.code,item)}
      item.units+=qty;
      if(valued){const cost=qty*m.unit_cost_cents!;issuedCostCents+=cost;valuedIssuedUnits+=qty;bucket.issuedCostCents+=cost;bucket.valuedUnits+=qty;item.costCents+=cost;item.valuedUnits+=qty}
      else{unvaluedIssuedUnits+=qty;bucket.unvaluedUnits+=qty;item.unvaluedUnits+=qty}
    }else{
      receivedUnits+=qty;bucket.receivedUnits+=qty;
      if(valued){const cost=qty*m.unit_cost_cents!;receivedCostCents+=cost;bucket.receivedCostCents+=cost}
      else unvaluedReceivedUnits+=qty;
    }
  }
  let stockValueCents=0,unvaluedStockUnits=0,unvaluedStockReferences=0,pricedReferences=0,atRisk=0,notInventoried=0;
  for(const p of active){
    if(p.unit_cost_cents!==null)pricedReferences++;
    if(p.quantity===null){notInventoried++;continue}
    if(p.minimum!==null&&p.quantity<=p.minimum)atRisk++;
    if(p.unit_cost_cents===null){unvaluedStockUnits+=p.quantity;unvaluedStockReferences++}
    else stockValueCents+=p.quantity*p.unit_cost_cents;
  }
  const ranking=[...top.values()].sort((a,b)=>b.units-a.units||b.costCents-a.costCents||a.name.localeCompare(b.name,'fr')).slice(0,12);
  const byFamily=[...top.values()].reduce<Record<string,{family:string;units:number;costCents:number;unvaluedUnits:number}>>((result,item)=>{
    const b=result[item.family]||(result[item.family]={family:item.family,units:0,costCents:0,unvaluedUnits:0});
    b.units+=item.units;b.costCents+=item.costCents;b.unvaluedUnits+=item.unvaluedUnits;return result;
  },{});
  return Response.json({
    period:{months,start:start.slice(0,10),endExclusive:end.slice(0,10),family},
    families,
    summary:{issuedUnits,receivedUnits,issuedCostCents,receivedCostCents,valuedIssuedUnits,unvaluedIssuedUnits,unvaluedReceivedUnits,stockValueCents,unvaluedStockUnits,unvaluedStockReferences,pricedReferences,totalReferences:active.length,atRisk,notInventoried},
    monthly:monthly.map(b=>({...b,issuedCostEur:b.issuedCostCents/100})),
    top:ranking,
    byFamily:Object.values(byFamily).sort((a,b)=>b.units-a.units||a.family.localeCompare(b.family,'fr'))
  },{headers:{'Cache-Control':'private, no-store'}});
}catch(e){console.error(e);return bad('Indicateurs EPI indisponibles.',503)}}
