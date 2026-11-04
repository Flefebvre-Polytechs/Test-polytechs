import {database} from '@/db/raw';
import {epiCatalog as catalog} from '@/lib/epi-private-source';

// Canonical families keep old imports and new manual references in the same groups.
export function epiFamily(value:string){const family=value.trim(),key=family.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z]/g,'');if(['YEUX','YEUXVISAGE','YEUXETVISAGE','TETE'].includes(key))return 'TÊTE';if(['MAIN','MAINS'].includes(key))return 'MAIN';return family}

export async function ensureCatalog(){const db=database();const row=await db.prepare('SELECT COUNT(*) AS total FROM epi_products').first<{total:number}>();if((row?.total??0)>=catalog.items.length)return;const now=new Date().toISOString();const statements=catalog.items.flatMap(item=>[db.prepare('INSERT OR IGNORE INTO epi_products (code,family,name,specifics,source_row,source_sheet,catalog_status,quantity,minimum,location,revision,updated_at) VALUES (?,?,?,?,?,?,?,NULL,NULL,?,1,?)').bind(item.code,epiFamily(item.family),item.name,item.specifics,item.sourceRow,item.sourceSheet,item.catalogStatus,'',now),db.prepare("UPDATE epi_products SET specifics=? WHERE code=? AND (specifics IS NULL OR trim(specifics)='')").bind(item.specifics,item.code)]);for(let i=0;i<statements.length;i+=40)await db.batch(statements.slice(i,i+40))}
