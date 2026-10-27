import PDFDocument from 'pdfkit';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {auditQuestionType,auditScore,auditSections,type Run,type AuditPhoto} from '@/lib/hub';

export type AuditReport={title:string;description:string;date:string;teams:string[];author:string;revision:number;updatedAt:string;run:Run;url:string;photos:(AuditPhoto&{bytes:Buffer|null})[];tickets:{title:string;status:string;pilot:string;due:string;done:number;total:number}[]};
const blue='#005FAA',ink='#192D42',muted='#617185',line='#DFE7EF',pale='#F4F7FA';
export function auditDate(value:string){if(!value)return 'Non renseignée';const d=new Date(value.length===10?value+'T12:00:00Z':value);return Number.isNaN(d.getTime())?'Non renseignée':new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',dateStyle:'long',...(value.length===10?{}:{timeStyle:'short'})}).format(d)}
export function auditDuration(run:Run){if(!run.startedAt||!run.completedAt)return 'Non mesurée';const seconds=Math.max(0,Math.floor((Date.parse(run.completedAt)-Date.parse(run.startedAt))/1000));return Number.isFinite(seconds)?`${Math.floor(seconds/3600)?Math.floor(seconds/3600)+' h ':''}${Math.floor(seconds%3600/60)} min ${seconds%60} s`:'Non mesurée'}

export async function buildAuditPdf(report:AuditReport):Promise<Buffer>{
  const doc=new PDFDocument({autoFirstPage:false,bufferPages:true,size:'A4',margins:{top:40,bottom:15,left:40,right:40},info:{Title:report.title+' - Compte rendu d’audit',Author:report.run.completedBy||report.author,Subject:'Compte rendu Polytechs - révision '+report.revision}});
  const chunks:Buffer[]=[];const finished=new Promise<Buffer>((resolve,reject)=>{doc.on('data',c=>chunks.push(c));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject)});
  doc.registerFont('regular',readFileSync(resolve(process.cwd(),'public/fonts/roboto-400.ttf')));
  doc.registerFont('bold',readFileSync(resolve(process.cwd(),'public/fonts/roboto-700.ttf')));
  const logo=readFileSync(resolve(process.cwd(),'public/polytechs-logo.png'));
  const left=40,width=515,bottom=782;let y=0;
  function write(text:string,x:number,top:number,size=10,color=ink,bold=false){doc.font(bold?'bold':'regular').fontSize(size).fillColor(color).text(text,x,top,{lineBreak:false})}
  function wrap(text:string,maxWidth=width,size=10,bold=false){doc.font(bold?'bold':'regular').fontSize(size);const out:string[]=[];for(const para of String(text).replace(/\t/g,'  ').split(/\r?\n/)){let current='';for(const word of para.split(/\s+/)){if(!word)continue;const candidate=current?current+' '+word:word;if(doc.widthOfString(candidate)<=maxWidth){current=candidate;continue}if(current){out.push(current);current=''}for(const ch of word){if(doc.widthOfString(current+ch)>maxWidth&&current){out.push(current);current=''}current+=ch}}out.push(current)}return out}
  function page(){doc.addPage();doc.image(logo,left,27,{fit:[108,42]});write('SYSTÈME DE MANAGEMENT INTÉGRÉ',292,31,8,blue,true);write('Compte rendu d’audit · '+(report.run.completed?'Terminé':'Brouillon'),292,47,9,muted);doc.moveTo(left,79).lineTo(left+width,79).strokeColor(line).lineWidth(0.8).stroke();y=99}
  function ensure(height:number){if(y+height>bottom)page()}
  function para(text:string,{size=10,color=ink,bold=false,indent=0,gap=7}:{size?:number;color?:string;bold?:boolean;indent?:number;gap?:number}={}){for(const row of wrap(text,width-indent,size,bold)){ensure(size*1.4);write(row,left+indent,y,size,color,bold);y+=size*1.4}y+=gap}
  function heading(text:string){ensure(42);y+=9;para(text,{size:13,color:blue,bold:true,gap:10})}
  function metric(label:string,value:string,x:number){write(value,x,y,23,ink,true);write(label,x,y+31,8,muted)}
  function photoRows(photos:AuditReport['photos']){for(let i=0;i<photos.length;i+=2){const pair=photos.slice(i,i+2),cellWidth=249;const captions=pair.map(p=>wrap(p.caption||p.name,cellWidth-16,9));const height=177+Math.max(...captions.map(c=>c.length))*12+34;ensure(height+8);const top=y;pair.forEach((p,j)=>{const x=left+j*266;doc.roundedRect(x,top,cellWidth,height,5).fillAndStroke('#FFFFFF',line);if(p.bytes){doc.image(p.bytes,x+8,top+8,{fit:[cellWidth-16,155],align:'center',valign:'center'})}else write('Photo indisponible',x+14,top+65,10,muted);captions[j].forEach((row,k)=>write(row,x+8,top+174+k*12,9));const stampTop=top+178+captions[j].length*12;write(p.author.slice(0,38),x+8,stampTop,8,muted);write(auditDate(p.createdAt),x+8,stampTop+12,8,muted)});y=top+height+12}}
  page();
  para('RÉSULTATS DE LA ROUTINE',{size:9,color:blue,bold:true,gap:8});
  para(report.title,{size:23,bold:true,gap:9});
  para(report.teams.join(' · ')||'Service non renseigné',{color:muted,gap:15});
  const score=auditScore(report.run.answers);ensure(100);
  const color=score.nonconform?'#B73A39':score.pending?'#9B6513':score.applicable?'#287A56':muted;
  doc.circle(left+39,y+37,33).lineWidth(5).strokeColor(line).stroke();
  if(score.percent!==null&&score.percent>0){const start=-Math.PI/2,steps=Math.max(1,Math.ceil(score.percent/2));const r=33;for(let n=0;n<=steps;n++){const a=start+2*Math.PI*(score.percent/100)*(n/steps),x=left+39+Math.cos(a)*r,top=y+37+Math.sin(a)*r;if(!n)doc.moveTo(x,top);else doc.lineTo(x,top)}doc.strokeColor(color).lineWidth(5).stroke()}
  const percent=score.percent===null?'N/A':score.percent+' %';doc.font('bold').fontSize(16);write(percent,left+39-doc.widthOfString(percent)/2,y+27,16,color,true);
  metric('CONFORMES',String(score.conform),left+105);metric('NON CONFORMES',String(score.nonconform),left+238);metric('NON APPLICABLES',String(score.na),left+390);y+=88;
  para((report.run.completed?'Audit terminé':'BROUILLON · '+score.requiredPending+' réponse(s) obligatoire(s) à compléter')+' · Révision '+report.revision,{size:10,bold:true,color,gap:7});
  para('Score = points conformes / points évalués applicables. Les points N/A et les champs de contexte sont exclus. Ce résultat ne constitue pas une certification de conformité.',{size:8,color:muted,gap:15});
  const facts=[['Occurrence prévue',auditDate(report.date)],['Réalisé par',report.run.completedBy||report.run.startedBy||report.author],['Lieu / atelier',report.run.location||'Non renseigné'],['Personnes auditées',report.run.auditee||'Non renseignées'],['Début enregistré',auditDate(report.run.startedAt||'')],['Fin enregistrée',auditDate(report.run.completedAt||'')],['Durée écoulée',auditDuration(report.run)],['Dernière modification',auditDate(report.updatedAt)+' · '+report.author]];
  for(const [label,value] of facts){const rows=wrap(value,340,9);ensure(Math.max(25,rows.length*13+9));write(label,left,y,9,muted);for(const row of rows){write(row,left+170,y,9);y+=13}y+=8}
  if(report.description){heading('Consignes et périmètre');para(report.description,{size:10})}
  heading('Synthèse par thème');
  for(const section of auditSections(report.run.answers)){const label=section.score.percent===null?'N/A':section.score.percent+' %';para(section.title+' · '+label+' · '+section.score.conform+'/'+section.score.applicable+' conformes'+(section.score.pending?' · '+section.score.pending+' non renseigné(s)':''),{size:10,bold:true,gap:9})}
  let number=0;
  for(const section of auditSections(report.run.answers)){
    ensure(92);heading(section.title);para(`${section.score.conform} conforme(s) · ${section.score.nonconform} non conforme(s) · ${section.score.na} N/A · ${section.score.pending} non renseigné(s)`,{size:9,color:muted,gap:12});
    for(const answer of section.answers){number++;ensure(68);doc.moveTo(left,y).lineTo(left+width,y).strokeColor(line).lineWidth(0.5).stroke();y+=12;const resultColor=answer.result==='Conforme'?'#287A56':answer.result==='Non conforme'?'#B73A39':muted;
      para(number+'. '+answer.label,{bold:true,size:11,gap:5});para(auditQuestionType(answer)==='conformity'?answer.result:answer.value||'Non renseigné',{bold:true,color:resultColor,size:10,gap:8});if(answer.help)para('Critère : '+answer.help,{size:8,color:muted,gap:7});
      if(answer.comment){para(answer.comment,{size:10,gap:5});if(answer.author||answer.updatedAt)para([answer.author,answer.updatedAt?auditDate(answer.updatedAt):''].filter(Boolean).join(' · '),{size:8,color:muted,gap:10})}
      photoRows(report.photos.filter(p=>p.questionId===answer.id));y+=7;
    }
  }
  if(report.run.notes){heading('Synthèse et autres observations');para(report.run.notes)}
  const general=report.photos.filter(p=>!p.questionId||!report.run.answers.some(a=>a.id===p.questionId));if(general.length){heading('Photos générales');photoRows(general)}
  if(report.tickets.length){heading('Tickets et actions associés');para('État des tickets au moment de la génération du rapport.',{size:8,color:muted});for(const ticket of report.tickets){para(ticket.title,{bold:true,gap:4});para(`${ticket.status} · ${ticket.pilot||'Pilote à désigner'} · Échéance : ${ticket.due?auditDate(ticket.due):'non fixée'} · ${ticket.done}/${ticket.total} action(s) réalisée(s)`,{size:9,color:muted,gap:12})}}
  heading('Traçabilité');para('Document généré à partir du compte rendu enregistré. Les données non renseignées restent signalées. Les droits du site s’appliquent à la consultation ; le fichier téléchargé doit être partagé uniquement avec les personnes habilitées.',{size:8,color:muted});
  ensure(30);const linkText='Ouvrir le compte rendu dans Polytechs';write(linkText,left,y,9,blue);doc.link(left,y,doc.widthOfString(linkText),14,report.url);
  const pages=doc.bufferedPageRange();for(let i=0;i<pages.count;i++){doc.switchToPage(i);doc.moveTo(left,804).lineTo(left+width,804).strokeColor(line).lineWidth(0.5).stroke();write('Polytechs · Diffusion interne · Révision '+report.revision,left,815,8,muted);write(`${i+1} / ${pages.count}`,516,815,8,muted)}
  doc.end();return finished;
}
