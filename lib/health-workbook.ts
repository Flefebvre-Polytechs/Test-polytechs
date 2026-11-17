import {strFromU8,unzipSync} from 'fflate';
import {healthImportSheets,healthImportYear,type HealthEventType,type HealthImportRow} from './health-events';

function xml(bytes:Uint8Array|undefined){
 if(!bytes)throw Error('Le classeur ne contient pas toutes les feuilles attendues.');
 const text=strFromU8(bytes);
 if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('Format Excel non pris en charge.');
 const doc=new DOMParser().parseFromString(text,'application/xml');
 if(doc.getElementsByTagName('parsererror').length)throw Error('Le classeur Excel est illisible.');
 return doc;
}
function tags(root:Document|Element,name:string){return [...root.getElementsByTagNameNS('*',name)];}

function dateValue(raw:string,type:string,date1904:boolean){
 if(type==='n'&&/^\d+(\.\d+)?$/.test(raw)){
  const epoch=Date.UTC(date1904?1904:1899,date1904?0:11,date1904?1:30);
  const date=new Date(epoch+Math.floor(Number(raw))*86400000);
  if(Number.isFinite(date.getTime()))return date.toISOString().slice(0,10);
 }
 if(/^\d{4}-\d{2}-\d{2}/.test(raw))return raw.slice(0,10);
 const d=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
 return d?d[3]+'-'+d[2].padStart(2,'0')+'-'+d[1].padStart(2,'0'):'';
}

function timeValue(raw:string,type:string){
 if(type==='n'&&/^0?\.\d+$/.test(raw)){
  const m=Math.round(Number(raw)*1440)%1440;
  return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
 }
 const t=/^(\d{1,2})\s*(?:h|:)\s*(\d{1,2})?(?::\d{2})?$/i.exec(raw);
 if(t&&Number(t[1])<24&&Number(t[2]||'0')<60)return t[1].padStart(2,'0')+':'+(t[2]||'0').padStart(2,'0');
 return '';
}

const labels:Record<string,HealthEventType>={'1er soin':'Premier soin',ata:'Accident avec arrêt',atsa:'Accident sans arrêt',atj:'Accident de trajet'};

export async function readHealthWorkbook(file:File){
 if(!/\.xlsx$/i.test(file.name)||file.size>5*1024*1024)throw Error('Choisissez un classeur .xlsx de 5 Mo maximum.');
 const bytes=new Uint8Array(await file.arrayBuffer());
 const index=unzipSync(bytes,{filter:entry=>['xl/workbook.xml','xl/_rels/workbook.xml.rels','xl/sharedStrings.xml'].includes(entry.name)&&entry.originalSize<=2*1024*1024});
 const workbook=xml(index['xl/workbook.xml']),rels=xml(index['xl/_rels/workbook.xml.rels']);
 const date1904=['1','true'].includes(tags(workbook,'workbookPr')[0]?.getAttribute('date1904')||'');
 const strings=index['xl/sharedStrings.xml']?tags(xml(index['xl/sharedStrings.xml']),'si').map(e=>tags(e,'t').map(t=>t.textContent||'').join('')):[];
 const paths=new Map<string,typeof healthImportSheets[number]>();
 for(const name of healthImportSheets){
  const sheet=tags(workbook,'sheet').find(e=>e.getAttribute('name')===name);
  const id=sheet?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
  const relation=tags(rels,'Relationship').find(e=>e.getAttribute('Id')===id&&e.getAttribute('TargetMode')!=='External');
  const target=relation?.getAttribute('Target')||'';
  const path=target.startsWith('/')?target.slice(1):'xl/'+target;
  if(!/^xl\/worksheets\/sheet[0-9]+\.xml$/.test(path))throw Error('Feuille introuvable : '+name);
  paths.set(path,name);
 }
 const data=unzipSync(bytes,{filter:entry=>paths.has(entry.name)&&entry.originalSize<=4*1024*1024});
 const rows:HealthImportRow[]=[];
 const issues:string[]=[];
 for(const [path,sheet] of paths){
  for(const line of tags(xml(data[path]),'row')){
   const row=Number(line.getAttribute('r'));
   if(row<2)continue;
   const cells=new Map(tags(line,'c').map(cell=>{
    const col=cell.getAttribute('r')?.replace(/[0-9]/g,'')||'',type=cell.getAttribute('t')||'n';
    const raw=tags(cell,'v')[0]?.textContent||'';
    const text=type==='s'?strings[Number(raw)]||'':type==='inlineStr'?tags(cell,'t').map(t=>t.textContent||'').join(''):raw;
    return [col,{text:text.trim(),type}] as const;
   }));
   const get=(col:string)=>cells.get(col)?.text||'';
   if(!get('B')&&!get('K'))continue;
   const date=dateValue(get('F'),cells.get('F')?.type||'',date1904);
   if(date&&!date.startsWith(healthImportYear+'-'))continue;
   const type=sheet==='Accidento EE'?'Accident d’entreprise extérieure':labels[get('K').toLocaleLowerCase('fr')];
   if(!date||!type||!get('B')||!get('D')||!(get('S')||get('O'))){issues.push(sheet+' · ligne '+row);continue;}
   rows.push({sheet,row,date,eventType:type,time:timeValue(get('H'),cells.get('H')?.type||''),person:get('B'),place:get('D'),
    circumstances:[get('O'),get('S')].filter((s,i,a)=>s&&a.indexOf(s)===i).join('\n'),
    analysis:[get('Q'),get('R'),get('U')].filter((s,i,a)=>s&&a.indexOf(s)===i).join('\n'),
    service:get('C'),injurySite:get('M'),injuryNature:get('N'),daysOff:get('V'),workActivity:get('T')});
  }
 }
 return {rows,issues};
}
