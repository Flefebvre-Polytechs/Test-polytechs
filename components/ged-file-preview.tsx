'use client';
import {useEffect,useState} from 'react';
import {AlertTriangle,Download,FileText,FileSpreadsheet,LoaderCircle,ExternalLink} from 'lucide-react';

type FileRecord={id:string;name:string;mime:string;size:number};
type TextPreview={kind:'word';paragraphs:string[];truncated:boolean};
type Sheet={name:string;rows:{number:number;cells:string[]}[];truncated:boolean};
type SpreadsheetPreview={kind:'excel';sheets:Sheet[];truncated:boolean};
type Preview=TextPreview|SpreadsheetPreview;
type ZipEntry={offset:number;compressed:number;plain:number;method:number};
const WORD='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const SHEET='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const XML_LIMIT=12*1024*1024;
const urlFor=(id:string)=>'/api/ged-files?id='+encodeURIComponent(id)+'&preview=1';
const downloadFor=(id:string)=>'/api/ged-files?id='+encodeURIComponent(id);

function xmlDocument(content:string):Document{
 const xml=new DOMParser().parseFromString(content,'application/xml');
 if(xml.getElementsByTagName('parsererror').length)throw Error('Le document contient un XML illisible.');
 return xml;
}
function zipEntries(bytes:Uint8Array):Map<string,ZipEntry>{
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const u16=(p:number)=>view.getUint16(p,true),u32=(p:number)=>view.getUint32(p,true);
 let end=-1;
 for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--){
  if(u32(p)===0x06054b50&&p+22+u16(p+20)===bytes.length){end=p;break}
 }
 if(end<0)throw Error('Archive Office invalide.');
 const entries=new Map<string,ZipEntry>(),count=u16(end+10),start=u32(end+16),size=u32(end+12);
 if(count>5000||start+size!==end)throw Error('Archive Office invalide.');
 let p=start;
 for(let n=0;n<count;n++){
  if(p+46>end||u32(p)!==0x02014b50)throw Error('Archive Office invalide.');
  const method=u16(p+10),compressed=u32(p+20),plain=u32(p+24),len=u16(p+28),extra=u16(p+30),comment=u16(p+32),offset=u32(p+42);
  if(p+46+len+extra+comment>end||![0,8].includes(method))throw Error('Format de compression non pris en charge.');
  const name=new TextDecoder().decode(bytes.subarray(p+46,p+46+len));
  entries.set(name,{offset,compressed,plain,method});
  p+=46+len+extra+comment;
 }
 return entries;
}
async function readZipText(bytes:Uint8Array,entries:Map<string,ZipEntry>,name:string):Promise<string>{
 const f=entries.get(name);
 if(!f)throw Error('Élément Office manquant : '+name);
 if(f.plain>XML_LIMIT)throw Error('Ce document est trop volumineux pour un aperçu simplifié.');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const pos=f.offset;
 if(pos+30>bytes.length||view.getUint32(pos,true)!==0x04034b50)throw Error('Archive Office endommagée.');
 const start=pos+30+view.getUint16(pos+26,true)+view.getUint16(pos+28,true);
 if(start+f.compressed>bytes.length)throw Error('Archive Office tronquée.');
 const compressed=bytes.slice(start,start+f.compressed);
 let result:Uint8Array;
 if(f.method===0)result=compressed;
 else {
  if(typeof DecompressionStream==='undefined')throw Error('La lecture Office n’est pas compatible avec ce navigateur.');
  const stream=new Blob([compressed.buffer as ArrayBuffer]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const buffer=await new Response(stream).arrayBuffer();
  result=new Uint8Array(buffer);
 }
 if(result.length!==f.plain||result.length>XML_LIMIT)throw Error('Le contenu décompressé est invalide.');
 return new TextDecoder('utf-8',{fatal:true}).decode(result);
}
function nodeText(node:Element,ns:string):string{
 return [...node.getElementsByTagNameNS(ns,'t')].map(t=>t.textContent||'').join('');
}
async function parseOffice(buffer:ArrayBuffer,mime:string):Promise<Preview>{
 const bytes=new Uint8Array(buffer),entries=zipEntries(bytes);
 if(mime.includes('wordprocessingml')){
  const doc=xmlDocument(await readZipText(bytes,entries,'word/document.xml'));
  const paragraphs=[...doc.getElementsByTagNameNS(WORD,'p')].map(p=>nodeText(p,WORD)).filter(t=>t.trim().length);
  return {kind:'word',paragraphs:paragraphs.slice(0,1200),truncated:paragraphs.length>1200};
 }
 const book=xmlDocument(await readZipText(bytes,entries,'xl/workbook.xml'));
 const relationships=xmlDocument(await readZipText(bytes,entries,'xl/_rels/workbook.xml.rels'));
 const paths=new Map([...relationships.getElementsByTagName('*')].filter(e=>e.localName==='Relationship').map(e=>[e.getAttribute('Id')||'',e.getAttribute('Target')||'']));
 const strings=entries.has('xl/sharedStrings.xml')?
  [...xmlDocument(await readZipText(bytes,entries,'xl/sharedStrings.xml')).getElementsByTagNameNS(SHEET,'si')].map(si=>nodeText(si,SHEET)):[];
 const workbookSheets=[...book.getElementsByTagNameNS(SHEET,'sheet')];
 const result:Sheet[]=[];
 for(const sheet of workbookSheets.slice(0,8)){
  const id=sheet.getAttributeNS(REL,'id')||sheet.getAttribute('r:id')||'';
  const target=paths.get(id);
  if(!target)continue;
  const path=new URL(target,'https://preview.local/xl/workbook.xml').pathname.slice(1);
  if(!entries.has(path))continue;
  const xml=xmlDocument(await readZipText(bytes,entries,path));
  const rowNodes=[...xml.getElementsByTagNameNS(SHEET,'row')],rows:Sheet['rows']=[];
  for(const row of rowNodes.slice(0,200)){
   const cells=Array.from({length:30},()=>''),elements=[...row.getElementsByTagNameNS(SHEET,'c')];
   for(const cell of elements){
    const column=(cell.getAttribute('r')||'').match(/^[A-Z]+/)?.[0]||'';
    let index=0;for(const char of column)index=index*26+char.charCodeAt(0)-64;index--;
    if(index<0||index>=30)continue;
    const type=cell.getAttribute('t'),v=cell.getElementsByTagNameNS(SHEET,'v')[0]?.textContent||'';
    const inline=cell.getElementsByTagNameNS(SHEET,'is')[0];
    cells[index]=type==='s'?(strings[Number(v)]||''):type==='inlineStr'&&inline?nodeText(inline,SHEET):type==='b'?(v==='1'?'Vrai':'Faux'):v;
   }
   rows.push({number:Number(row.getAttribute('r'))||rows.length+1,cells});
  }
  result.push({name:sheet.getAttribute('name')||'Feuille',rows,truncated:rowNodes.length>200});
 }
 if(!result.length)throw Error('Aucune feuille lisible dans le classeur.');
 return {kind:'excel',sheets:result,truncated:workbookSheets.length>8};
}
function columnLabel(index:number){let label='';for(let i=index+1;i>0;i=Math.floor((i-1)/26))label=String.fromCharCode(65+(i-1)%26)+label;return label}
export function GedFilePreview({file}:{file:FileRecord}){
 const office=file.mime.includes('wordprocessingml')||file.mime.includes('spreadsheetml');
 const pdf=file.mime==='application/pdf',image=file.mime==='image/png'||file.mime==='image/jpeg';
 const [state,setState]=useState<{loading:boolean;data:Preview|null;error:string}>({loading:office,data:null,error:''});
 const [sheetIndex,setSheetIndex]=useState(0);
 useEffect(()=>{
  setSheetIndex(0);
  if(!office){setState({loading:false,data:null,error:''});return}
  const controller=new AbortController();setState({loading:true,data:null,error:''});
  (async()=>{
   try{
    const r=await fetch(urlFor(file.id),{credentials:'same-origin',cache:'no-store',signal:controller.signal});
    if(!r.ok)throw Error('Impossible de charger ce document. Vérifiez vos droits d’accès.');
    const bytes=await r.arrayBuffer();
    if(bytes.byteLength>15*1024*1024)throw Error('Le document est trop volumineux pour cet aperçu.');
    const data=await parseOffice(bytes,file.mime);
    if(!controller.signal.aborted)setState({loading:false,data,error:''});
   }catch(e){if(!controller.signal.aborted)setState({loading:false,data:null,error:(e as Error).message})}
  })();
  return ()=>controller.abort();
 },[file.id,file.mime,office]);
 const url=urlFor(file.id);
 const selected=state.data?.kind==='excel'?state.data.sheets[sheetIndex]:undefined;
 return <section className="ged-preview" aria-label={'Aperçu de '+file.name}>
  <header className="ged-preview-toolbar"><div><FileText size={18}/><span><strong>Consultation du document</strong><small title={file.name}>{file.name}</small></span></div><div className="ged-preview-actions"><a href={url} target="_blank" rel="noopener noreferrer" aria-label="Ouvrir dans un nouvel onglet"><ExternalLink size={15}/>Ouvrir</a><a href={downloadFor(file.id)} aria-label="Télécharger le fichier original"><Download size={15}/>Original</a></div></header>
  {pdf?<iframe className="ged-preview-pdf" title={'Lecture de '+file.name} src={url} loading="lazy" referrerPolicy="no-referrer"/>:
   image?<div className="ged-preview-image"><img src={url} alt={'Document : '+file.name}/></div>:
   office?<div className="ged-preview-office">
    <p className="ged-preview-warning"><AlertTriangle size={16}/>Lecture simplifiée : la mise en page, les graphiques, les objets et certaines formules peuvent différer. Vérifiez le fichier original avant toute validation.</p>
    {state.loading?<div className="ged-preview-loading"><LoaderCircle className="ged-preview-spinner" size={22}/>Préparation de la lecture…</div>:
    state.error?<div className="ged-preview-unavailable"><FileText size={28}/><strong>Aperçu indisponible</strong><span>{state.error}</span><a href={downloadFor(file.id)}>Télécharger le document original</a></div>:
    state.data?.kind==='word'?<article className="ged-preview-word" aria-label="Contenu textuel du document Word">{state.data.paragraphs.map((p,i)=><p key={i}>{p}</p>)}{!state.data.paragraphs.length&&<p>Aucun paragraphe textuel trouvé.</p>}{state.data.truncated&&<p className="ged-preview-warning">Aperçu limité aux 1 200 premiers paragraphes.</p>}</article>:
    state.data?.kind==='excel'?<><div className="ged-preview-sheet-tabs" role="group" aria-label="Feuilles du classeur">{state.data.sheets.map((s,i)=><button type="button" key={i} aria-pressed={i===sheetIndex} onClick={()=>setSheetIndex(i)}><FileSpreadsheet size={15}/>{s.name}</button>)}</div><div className="ged-preview-grid" role="region" aria-label={'Feuille '+(selected?.name||'')} tabIndex={0}><table><thead><tr><th>#</th>{Array.from({length:30},(_,i)=><th key={i}>{columnLabel(i)}</th>)}</tr></thead><tbody>{selected?.rows.map((row,i)=><tr key={i}><th>{row.number}</th>{row.cells.map((c,j)=><td key={j}>{c}</td>)}</tr>)}</tbody></table></div>{(selected?.truncated||state.data.truncated)&&<p className="ged-preview-warning">Aperçu limité aux 200 premières lignes, 30 premières colonnes et 8 premières feuilles.</p>}</>:
    null}
   </div>:
   <div className="ged-preview-unavailable"><FileText size={28}/><strong>Format non visualisable</strong><span>Utilisez le fichier original pour le consulter.</span></div>}
 </section>
}
