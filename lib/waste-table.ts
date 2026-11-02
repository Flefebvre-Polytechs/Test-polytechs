import type {WasteRecord} from './waste';

export function wasteColumn(index:number){let value=index+1,result='';while(value){value--;result=String.fromCharCode(65+value%26)+result;value=Math.floor(value/26)}return result}
export function wasteTableColumns(headers:string[]){return headers.map((heading,index)=>({key:wasteColumn(index),label:heading.trim()||`Colonne ${wasteColumn(index)}`}))}

// Preserve the original Excel cells. For an edited or newly created movement,
// show the current value of fields that can be changed in the application.
export function wasteTableValue(record:WasteRecord,raw:Record<string,string>,key:string):string{
 if(record.sourceRow&&record.revision===0)return raw[key]||'';
 const values:Record<string,string>={
  A:record.date, F:record.client?'X':'', AA:record.excluded?'X':'', AC:record.bsd,
  AD:record.type, AE:record.code, AH:record.danger==='À vérifier'?'':record.danger,
  AI:record.estimate===null?'':String(record.estimate),AJ:record.quantity===null?'':String(record.quantity),
  AQ:record.treatment,AR:record.collector,AX:record.destination,
 };
 return Object.hasOwn(values,key)?values[key]:raw[key]||'';
}
