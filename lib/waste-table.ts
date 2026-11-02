import {fold,validDate,type WasteRecord} from './waste';

export function wasteColumn(index:number){let value=index+1,result='';while(value){value--;result=String.fromCharCode(65+value%26)+result;value=Math.floor(value/26)}return result}
export function wasteTableColumns(headers:string[]){return headers.map((heading,index)=>({key:wasteColumn(index),label:heading.trim()||`Colonne ${wasteColumn(index)}`})).filter(column=>!['BH','BI','BJ'].includes(column.key))}
export type WasteTableSort={key:string;direction:'asc'|'desc'}|null;
export function filterWasteTable(records:WasteRecord[],rawById:Record<string,Record<string,string>>,columns:{key:string;label:string}[],query:string,filters:Record<string,string>,sort:WasteTableSort){
 const term=fold(query.trim()),active=Object.entries(filters).filter(([,value])=>value.trim());
 const cell=(record:WasteRecord,key:string)=>wasteTableValue(record,rawById[record.id]||{},key);
 const rows=records.filter(record=>(!term||fold([record.type,...columns.map(column=>cell(record,column.key))].join(' ')).includes(term))&&active.every(([key,value])=>fold(cell(record,key)).includes(fold(value.trim()))));
 if(!sort)return rows;
 const compare=new Intl.Collator('fr',{numeric:true,sensitivity:'base'});
 return rows.sort((a,b)=>{const left=cell(a,sort.key).trim(),right=cell(b,sort.key).trim();if(!left||!right)return left? -1:right?1:0;
  const date=(value:string)=>{const fr=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);return fr?`${fr[3]}-${fr[2].padStart(2,'0')}-${fr[1].padStart(2,'0')}`:value};
  const numeric=(value:string)=>Number(value.replace(/\s/g,'').replace(',','.'));
  const difference=sort.key==='A'?date(left).localeCompare(date(right)):['AI','AJ'].includes(sort.key)&&Number.isFinite(numeric(left))&&Number.isFinite(numeric(right))?numeric(left)-numeric(right):compare.compare(left,right);
  return (sort.direction==='asc'?1:-1)*difference||a.id.localeCompare(b.id)});
}

// Preserve the original Excel cells. For an edited or newly created movement,
// show the current value of fields that can be changed in the application.
export function wasteTableValue(record:WasteRecord,raw:Record<string,string>,key:string):string{
 if(Object.hasOwn(record.cellOverrides||{},key))return record.cellOverrides![key];
 if(record.sourceRow&&record.revision===0)return raw[key]||'';
 const values:Record<string,string>={
  A:record.date, F:record.client?'X':'', AA:record.excluded?'X':'', AC:record.bsd,
  AD:record.type, AE:record.code, AH:record.danger==='À vérifier'?'':record.danger,
  AI:record.estimate===null?'':String(record.estimate),AJ:record.quantity===null?'':String(record.quantity),
  AQ:record.treatment,AR:record.collector,AX:record.destination,
 };
 return Object.hasOwn(values,key)?values[key]:raw[key]||'';
}

export const wasteManagedColumns={A:'date',F:'client',AA:'excluded',AC:'bsd',AD:'type',AE:'code',AH:'danger',AI:'estimate',AJ:'quantity',AQ:'treatment',AR:'collector',AX:'destination'} as const;
const familyFlags:Record<string,string>={E:'DIB',F:'Déchets clients',G:'Purges',H:'Cartons',I:'Plastiques',J:'Terre et granulés',K:'4 flux',L:'Big-bags',M:'Plastiques',N:'Plastiques',O:'Plastiques',P:'Plastiques',Q:'Déchets dangereux',R:'Autres',S:'Ferraille',T:'Palettes',U:'Bois',V:'Déchets ménagers',W:'Papier',X:'Retraits salariés',Y:'Intervenants extérieurs',Z:'Déchetterie'};
const selected=(value:string)=>['x','oui','1','true'].includes(fold(value.trim()).toLowerCase());
function booleanCell(value:string){const text=fold(value.trim()).toLowerCase();if(!text||['non','0','false'].includes(text))return false;if(selected(value))return true;throw Error('Saisissez X, Oui, Non ou laissez la cellule vide.')}
function numberCell(value:string){const text=value.trim().replace(/[\s\u00a0]/g,'').replace(',','.');if(!text)return null;const n=Number(text);if(!Number.isFinite(n)||n<0||n>1_000_000)throw Error('Saisissez une quantité positive valide.');return n}
function dateCell(value:string){const text=value.trim();if(!text)return '';const fr=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);const iso=fr?`${fr[3]}-${fr[2].padStart(2,'0')}-${fr[1].padStart(2,'0')}`:text;if(!validDate(iso))throw Error('Saisissez une date valide (AAAA-MM-JJ ou JJ/MM/AAAA).');return iso}

export function applyWasteCell(record:WasteRecord,key:string,value:string):WasteRecord{
 const overrides={...record.cellOverrides,[key]:value};
 const next:WasteRecord={...record,cellOverrides:overrides};
 switch(key){
  case 'A':next.date=dateCell(value);break;
  case 'F':next.client=booleanCell(value);break;
  case 'AA':next.excluded=booleanCell(value);break;
  case 'AC':next.bsd=value.trim();break;
  case 'AD':next.type=value.trim();break;
  case 'AE':next.code=value.trim();break;
  case 'AH':{const text=fold(value.trim());next.danger=text==='oui'?'Oui':text==='non'?'Non':text===''||text==='a verifier'?'À vérifier':next.danger;if(!['oui','non','','a verifier'].includes(text))throw Error('Saisissez Oui, Non ou À vérifier.');break}
  case 'AI':next.estimate=numberCell(value);break;
  case 'AJ':next.quantity=numberCell(value);break;
  case 'AQ':next.treatment=value.trim();break;
  case 'AR':next.collector=value.split('\n')[0].trim();break;
  case 'AX':next.destination=value.trim();break;
 }
 if(Object.hasOwn(familyFlags,key)){
  const marked=Object.keys(familyFlags).filter(column=>selected(overrides[column]??record.raw?.[column]??''));
  const primary=marked.find(column=>!['E','F','Q','R','X','Y','Z'].includes(column))||marked[0];
  next.family=primary?familyFlags[primary]:'Autres';
 }
 return next;
}
