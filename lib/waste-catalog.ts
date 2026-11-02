import {blankWaste,fold,type WasteRecord} from './waste';

export type WasteCatalogItem={key:string;record:WasteRecord;count:number};

// A catalog entry is one waste designation and code. Its defaults come from
// one recent movement, so fields from different collectors are never mixed.
export function wasteCatalog(records:WasteRecord[]):WasteCatalogItem[]{
 const items=new Map<string,WasteCatalogItem>();
 const ordered=[...records].filter(r=>r.type.trim()).sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.updatedAt||'').localeCompare(a.updatedAt||''));
 for(const record of ordered){
  const key=fold(record.type.trim()).replace(/\s+/g,' ')+'|'+fold(record.code.trim());
  const item=items.get(key);
  if(item)item.count++;
  else items.set(key,{key,record,count:1});
 }
 return [...items.values()];
}

export function newWasteFromCatalog(item:WasteCatalogItem,draft:WasteRecord=blankWaste()):WasteRecord{
 const r=item.record;
 return {...draft,type:r.type,family:r.family,code:r.code,danger:r.danger,unit:r.unit,
  excluded:r.excluded,client:r.client,collector:r.collector,destination:r.destination,treatment:r.treatment};
}
