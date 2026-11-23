export const categories=['Sécurité','Environnement','Production','Qualité','Ressources humaines','Maintenance','R&D','Autre'];
export const ticketStatuses=['Ouvert','En cours','À vérifier','Clôturé'];
export type Task={id:string;title:string;done:boolean;pilot:string;due:string};
export type TicketLabel={id:string;kind:'topic'|'location';category:string;name:string};
export type Ticket={analysis?:TicketAnalysis;topicTags?:string[];locationTags?:string[];gmaoOrderId?:string;archivedAt?:string;archivedBy?:string;qualityActionId?:string;title:string;category:string;description:string;teams:string[];pilot:string;due:string;status:string;actions:Task[];responsibles:string[];source?:{routineId:string;date:string;questionId?:string}};
export type DashboardTicket=Pick<Ticket,'title'|'category'|'status'|'due'> & {id:string;updated_at:string;archived?:boolean};
export type DashboardTicketStats={
 counts:Record<string,{open:number;closed:number;total:number}>;
 totals:{open:number;late:number;verify:number};
 priorities:DashboardTicket[];
 recent:DashboardTicket[];
 updatedAt:string;
};
export const ticketIshikawaFamilies = [
 ['methodes','Méthodes'],['milieu','Milieu'],['materiel','Matériel'],
 ['matieres','Matières'],['main_oeuvre','Main-d’œuvre'],
] as const;

export const ticketAnalysisMethods = {
 '5p':{label:'5P · 5 Pourquoi',fields:[
  ['p1','Pourquoi le problème est-il apparu ?'],['p2','Pourquoi cette première cause existe-t-elle ?'],
  ['p3','Pourquoi ? (3)'],['p4','Pourquoi ? (4)'],['p5','Pourquoi ? (5)'],
  ['cause','Cause racine retenue et preuve'],
 ]},
 '8d':{label:'8D · Rapport Imp5.820f',fields:[
  ['d1','D1 · Constituer l’équipe'],['d2','D2 · Décrire le problème'],
  ['d3','D3 · Mettre en place les mesures immédiates'],
  ['d4','D4 · Identifier les causes racines et de non-détection'],
  ['d5','D5 · Choisir et valider les actions correctives'],
  ['d6','D6 · Mettre en œuvre les actions et vérifier leur efficacité'],
  ['d7','D7 · Prévenir la récidive'],['d8','D8 · Clôturer et reconnaître le travail de l’équipe'],
 ]},
 'arbre-causes':{label:'Arbre des causes',fields:[]},
 ishikawa:{label:'Ishikawa · 5M',fields:[...ticketIshikawaFamilies,['cause','Causes retenues et preuves']]},
 qqoqccp:{label:'QQOQCCP · Cadrage du problème',fields:[
  ['qui','Qui ?'],['quoi','Quoi ?'],['ou','Où ?'],['quand','Quand ?'],
  ['comment','Comment ?'],['combien','Combien ?'],['pourquoi','Pourquoi analyser cet écart ?'],
 ]},
} as const;
export const eightDCheckResults = ['Conforme', 'Non conforme'] as const;
const yesNo = ['Oui', 'Non'] as const;
const reportStatuses = ['À faire', 'En cours', 'À vérifier', 'Clôturé'] as const;

export type EightDField = {
 id: string;
 label: string;
 kind?: 'textarea' | 'date' | 'quantity';
 options?: readonly string[];
};

export const eightDChecks = [
 ['samples','Analyse des échantillons'],
 ['laboratory','Analyse des données du laboratoire'],
 ['production','Analyse des données de production'],
] as const;

export const eightDRootCauses = [
 ['packaging','Conditionnement'],
 ['transport','Transport'],
 ['cleaning','Nettoyage de ligne'],
 ['setup','Préparation de ligne'],
 ['equipment','Panne ou défaut matériel'],
 ['rawMaterial','Qualité de la matière première'],
 ['instructions','Non-respect des consignes'],
 ['contamination','Contamination croisée'],
 ['granulation','Défaut de coupe'],
 ['labelling','Étiquetage ou identification'],
 ['declaration','Déclaration non conforme'],
 ['dosing','Défaut de dosage'],
 ['moisture','Ensachage trop chaud ou humidité'],
 ['stops','Arrêts récurrents ou difficulté de production'],
 ['other','Autre cause'],
] as const;

export const eightDValidations = [
 ['report','Validation du rapport 8D'],
 ['plan','Validation du plan d’actions'],
 ['effectiveness','Vérification de l’efficacité'],
 ['closure','Clôture de la réclamation'],
] as const;

const eightDEffectivenessFields: readonly EightDField[] = [
 {id:'effectivenessCriterion',label:'Critère d’efficacité',kind:'textarea'},
 {id:'effectivenessDue',label:'Échéance de vérification',kind:'date'},
 {id:'implementationDate',label:'Date de mise en œuvre',kind:'date'},
 {id:'effectivenessResult',label:'Résultat du contrôle d’efficacité',kind:'textarea'},
];

export const eightDVerificationFields = [
 eightDEffectivenessFields,
 eightDEffectivenessFields.map(field=>({...field,id:field.id+'2'})),
];

export const eightDSteps: readonly {number:number;title:string;fields:readonly EightDField[]}[] = [
 {number:1,title:'Référence du rapport',fields:[
  {id:'claimReference',label:'Référence de la réclamation'},
  {id:'customer',label:'Client'},
  {id:'claimType',label:'Type de réclamation'},
  {id:'reportStatus',label:'État d’avancement du rapport',options:reportStatuses},
  {id:'reportDate',label:'Date du rapport',kind:'date'},
  {id:'receivedDate',label:'Date de réception',kind:'date'},
  {id:'customerReference',label:'Référence client'},
  {id:'deliveryNote',label:'Bon de livraison (BL)'},
  {id:'partName',label:'Désignation du produit'},
  {id:'supplierPart',label:'Référence produit fournisseur'},
  {id:'batchNumber',label:'Numéro de lot'},
  {id:'equipment',label:'Équipement de production'},
  {id:'claimAccepted',label:'Réclamation acceptée',options:yesNo},
  {id:'team',label:'Groupe de travail',kind:'textarea'},
 ]},
 {number:2,title:'Description du problème',fields:[
  {id:'problem',label:'Description du problème',kind:'textarea'},
 ]},
 {number:3,title:'Actions immédiates',fields:[
  {id:'containment',label:'Mesures immédiates engagées',kind:'textarea'},
  {id:'sampleRequest',label:'Échantillons demandés pour les lots concernés',options:yesNo},
  {id:'sampleQuantity',label:'Quantité demandée (kg)',kind:'quantity'},
 ]},
 {number:4,title:'Analyse des causes',fields:[
  {id:'method',label:'Méthode ou éléments d’analyse complémentaires',kind:'textarea'},
 ]},
 {number:5,title:'Causes racines',fields:[
  {id:'rootDetails',label:'Cause(s) retenue(s) et précisions',kind:'textarea'},
 ]},
 {number:6,title:'Actions correctives et préventives',fields:[]},
 {number:7,title:'Vérification de l’efficacité',fields:[]},
 {number:8,title:'Validation et clôture',fields:[
  {id:'reportAuthor',label:'Auteur du rapport'},
  {id:'reportAuthorRole',label:'Fonction de l’auteur'},
 ]},
];

export const eightDCompletionKey=(step:number)=>'completed-d'+step;
const eightDProgressFields: Record<number,readonly string[]> = {
 4:eightDChecks.flatMap(([id])=>[id+'Result',id+'Comment']),
 5:eightDRootCauses.map(([id])=>'root-'+id),
 7:eightDVerificationFields.flat().map(field=>field.id),
 8:eightDValidations.flatMap(([id])=>['validated-'+id,'validator-'+id]),
};

export function eightDProgress(analysis:TicketAnalysis,actions:readonly Task[]){
 return eightDSteps.map(step=>{
  const completionKey=eightDCompletionKey(step.number);
  if(step.number===6){
   const done=actions.length>0&&actions.every(action=>action.done&&action.title.trim());
   return {...step,completionKey,status:done?'complete' as const:actions.length?'active' as const:'todo' as const};
  }
  const filled=(key:string)=>!!analysis.values[key]?.trim();
  const started=step.fields.some(field=>filled(field.id))||
    (eightDProgressFields[step.number]??[]).some(filled)||
    step.number===4&&!!analysis.causes?.length;
  const status=analysis.values[completionKey]==='Oui'?'complete' as const:started?'active' as const:'todo' as const;
  return {...step,completionKey,status};
 });
}

export const eightDFields = new Map<string,EightDField>([
 ...eightDSteps.flatMap(step=>step.fields),
 ...eightDSteps.filter(step=>step.number!==6).map(step=>({
  id:eightDCompletionKey(step.number),label:'Étape D'+step.number+' terminée',options:['Oui'],
 })),
 ...eightDVerificationFields.flat(),
 ...eightDChecks.flatMap(([id,label]):EightDField[]=>[
  {id:id+'Result',label:'Conformité · '+label,options:eightDCheckResults},
  {id:id+'Comment',label:'Commentaires · '+label},
 ]),
 ...eightDRootCauses.map(([id,label])=>({id:'root-'+id,label,options:['Oui']})),
 ...eightDValidations.flatMap(([id,label]):EightDField[]=>[
  {id:'validated-'+id,label:'Date · '+label,kind:'date'},
  {id:'validator-'+id,label:'Nom et fonction · '+label},
 ]),
].map(field=>[field.id,field]));

export type FiveWhyPath={id:string;name:string;values:Record<string,string>};
export type FiveWhyCause={id:string;parentId:string|null;answer:string;label?:string;conclusion?:string;actionId?:string};
export type TicketAnalysis={method:keyof typeof ticketAnalysisMethods;values:Record<string,string>;paths?:FiveWhyPath[];causes?:FiveWhyCause[];causeTree?:TicketCauseTree};

export const causeTreeOutcomeId = 'final';
export const maxCauseTreeFacts = 100;
export const maxCauseTreeLinks = 300;
export const maxCauseTreeText = 500;
export type CauseTreeFact = {id:string;text:string;kind:'variation'|'permanent'};
export type CauseTreeLink = {antecedentId:string;effectId:string;uncertain:boolean};
export type TicketCauseTree = {outcome:string;facts:CauseTreeFact[];links:CauseTreeLink[]};

export function causeTreeLinksByEffect(links: readonly CauseTreeLink[]) {
 const grouped = new Map<string, CauseTreeLink[]>();
 for (const link of links) {
  const connections = grouped.get(link.effectId);
  if (connections) connections.push(link);
  else grouped.set(link.effectId, [link]);
 }
 return grouped;
}

export function causeTreeReachableFacts(links: ReadonlyMap<string, readonly CauseTreeLink[]>, effectId: string) {
 const seen = new Set([effectId]);
 const next = [effectId];
 while (next.length) {
  for (const {antecedentId} of links.get(next.pop()!) ?? []) {
   if (seen.has(antecedentId)) continue;
   seen.add(antecedentId);
   next.push(antecedentId);
  }
 }
 return seen;
}

function ticketCauseTreeError(value: unknown) {
 const invalid = 'Vérifiez les faits et les liens de l’arbre des causes.';
 if (!isAnalysisRecord(value) || Object.keys(value).some(key => !['outcome','facts','links'].includes(key))) return invalid;
 const {outcome, facts, links} = value;
 if (!str(outcome,maxCauseTreeText) || !Array.isArray(facts) || facts.length > maxCauseTreeFacts ||
  !Array.isArray(links) || links.length > maxCauseTreeLinks) return invalid;

 const factIds = new Set<string>();
 for (const fact of facts) {
  if (!isAnalysisRecord(fact) || Object.keys(fact).some(key => !['id','text','kind'].includes(key)) ||
   !str(fact.id,100,true) || fact.id === causeTreeOutcomeId || factIds.has(fact.id as string) ||
   !str(fact.text,maxCauseTreeText,true) || (fact.kind !== 'variation' && fact.kind !== 'permanent')) return invalid;
  factIds.add(fact.id as string);
 }

 const seenLinks = new Set<string>();
 for (const link of links) {
  if (!isAnalysisRecord(link) || Object.keys(link).some(key => !['antecedentId','effectId','uncertain'].includes(key)) ||
   typeof link.antecedentId !== 'string' || !factIds.has(link.antecedentId) ||
   typeof link.effectId !== 'string' || (link.effectId !== causeTreeOutcomeId && !factIds.has(link.effectId)) ||
   typeof link.uncertain !== 'boolean') return invalid;
  const key = JSON.stringify([link.antecedentId,link.effectId]);
  if (seenLinks.has(key)) return 'Un antécédent ne peut être relié deux fois au même fait.';
  seenLinks.add(key);
 }

 const byEffect = causeTreeLinksByEffect(links);
 const visited = new Set<string>();
 const visiting = new Set<string>();
 function visit(id: string): boolean {
  if (visiting.has(id)) return false;
  if (visited.has(id)) return true;
  visiting.add(id);
  if ((byEffect.get(id) ?? []).some(link => !visit(link.antecedentId))) return false;
  visiting.delete(id);
  visited.add(id);
  return true;
 }
 if (!visit(causeTreeOutcomeId)) return 'Un fait ne peut pas être son propre antécédent, même indirectement.';
 return visited.size === factIds.size + 1 ? '' : 'Chaque fait doit être relié au fait final.';
}

const maxFiveWhyPaths=10;
export const maxFiveWhyDepth=5;
export const maxFiveWhyCauses=maxFiveWhyPaths*maxFiveWhyDepth;

export function ticketFiveWhyPaths(analysis:TicketAnalysis):FiveWhyPath[]{
 return analysis.paths??[{id:'initial',name:'',values:analysis.values}];
}

export function ticketFiveWhyCauses(analysis:TicketAnalysis):FiveWhyCause[]{
 if(analysis.causes)return analysis.causes;
 return ticketFiveWhyPaths(analysis).flatMap((path,index)=>{
  const answers=Array.from({length:maxFiveWhyDepth},(_,i)=>path.values['p'+(i+1)]??'');
  const last=Math.max(answers.findLastIndex(answer=>answer!==''),path.name||path.values.cause?0:-1);
  const base='legacy-'+(index+1)+'-';
  return answers.slice(0,last+1).map((answer,i)=>({
   id:base+(i+1),parentId:i?base+i:null,answer,
   ...(i===0&&path.name?{label:path.name}:{}),
   ...(i===last&&path.values.cause?{conclusion:path.values.cause}:{}),
  }));
 });
}

export function ticketAnalysisError(analysis:unknown,actionIds?:ReadonlySet<string>){
 if(analysis===undefined)return '';
 if(!isAnalysisRecord(analysis)||Object.keys(analysis).some(key=>!['method','values','paths','causes','causeTree'].includes(key)))
  return 'Analyse du ticket invalide.';
 const {method,values,paths,causes,causeTree}=analysis as TicketAnalysis;
 if(typeof method!=='string'||!Object.hasOwn(ticketAnalysisMethods,method))
  return 'Choisissez une méthode d’analyse valide.';
 const keys=ticketAnalysisMethods[method].fields.map(([id])=>String(id));
 const validValues=(answers:unknown)=>isAnalysisRecord(answers)&&Object.entries(answers)
  .every(([key,value])=>typeof value==='string'&&value.length<=3000&&(keys.includes(key)||method==='8d'&&validEightDValue(key,value)));
 const responseError='Vérifiez les réponses de l’analyse (3 000 caractères maximum par champ).';
 if(!validValues(values))return responseError;
 if(method==='arbre-causes'){
  if(paths!==undefined||causes!==undefined)return 'Vérifiez les faits et les liens de l’arbre des causes.';
  return causeTree===undefined?'':ticketCauseTreeError(causeTree);
 }
 if(causeTree!==undefined)return 'Cet arbre ne correspond pas à la méthode d’analyse.';
 if(causes!==undefined){
  if((method!=='5p'&&method!=='8d')||(method==='5p'&&Object.keys(values).length)||paths!==undefined||!Array.isArray(causes)||causes.length>maxFiveWhyCauses)
   return 'L’arbre du 5 Pourquoi est invalide.';
  const depths=new Map<string,number>();
  for(const cause of causes){
   if(!isAnalysisRecord(cause)||Object.keys(cause).some(key=>!['id','parentId','answer','label','conclusion','actionId'].includes(key))||
    !str(cause.id,100,true)||depths.has(cause.id)||!str(cause.answer,3000)||
    (cause.label!==undefined&&!str(cause.label,100))||(cause.conclusion!==undefined&&!str(cause.conclusion,3000)))
    return 'Vérifiez les causes et les réponses du 5 Pourquoi.';
   const depth=cause.parentId===null?1:(depths.get(cause.parentId)??-1)+1;
   if(depth<1||depth>maxFiveWhyDepth)return 'Chaque cause doit être rattachée à un pourquoi précédent, sur 5 niveaux maximum.';
   if(cause.actionId!==undefined&&(!str(cause.actionId,100,true)||actionIds&&!actionIds.has(cause.actionId)))
    return 'L’action associée à une cause doit appartenir au ticket.';
   depths.set(cause.id,depth);
  }
  return '';
 }
 if(paths===undefined)return '';
 if(method!=='5p'||Object.keys(values).length||!Array.isArray(paths)||paths.length<1||paths.length>maxFiveWhyPaths)
  return 'La méthode 5 Pourquoi doit contenir entre 1 et '+maxFiveWhyPaths+' pistes.';
 const seen=new Set<string>();
 for(const path of paths){
  if(!isAnalysisRecord(path)||Object.keys(path).some(key=>key!=='id'&&key!=='name'&&key!=='values')||
   typeof path.id!=='string'||!path.id.trim()||path.id.length>100||seen.has(path.id)||
   typeof path.name!=='string'||path.name.length>100)
   return 'Les pistes du 5 Pourquoi sont invalides ou en double.';
  if(!validValues(path.values))return responseError;
  seen.add(path.id);
 }
 return '';
}

function validEightDValue(key:string,value:string){
 const field=eightDFields.get(key);
 if(!field)return false;
 if(!value)return true;
 if(field.options)return field.options.includes(value);
 if(field.kind==='date')return validDate(value);
 if(field.kind==='quantity')return /^\d{1,9}(\.\d{1,6})?$/.test(value);
 return true;
}

function isAnalysisRecord(value:unknown):value is Record<string,unknown>{
 return !!value&&typeof value==='object'&&!Array.isArray(value);
}
export type AuditQuestion={id:string;label:string;section?:string;type?:'conformity'|'text'|'number'|'date';required?:boolean;help?:string;evidence?:'none'|'comment'|'photo'|'both'};
export type Routine={archivedAt?:string;archivedBy?:string;binaryConformity?:boolean;mode?:'catalog'|'on-demand'|'scheduled-copy';title:string;description:string;teams:string[];pilot:string;start:string;time:string;repeat:'none'|'daily'|'weekly'|'monthly';interval:number;end:string;questions:AuditQuestion[];active:boolean};
export type Communication={title:string;body:string;sourceTeam:string;teams:string[]};
export type Row<T>={id:string;data:T;revision:number;created_at?:string;updated_at?:string;author?:string;has_runs?:number;scheduled_run_complete?:number};
export type AuditPhoto={id:string;questionId:string;name:string;mime:string;size:number;caption:string;author:string;createdAt:string};
export type Run={answers:(AuditQuestion&{result:string;value?:string;comment:string;author?:string;updatedAt?:string})[];notes:string;completed:boolean;location?:string;auditee?:string;startedAt?:string;completedAt?:string;startedBy?:string;completedBy?:string;routineTitle?:string;routineDescription?:string;photos?:AuditPhoto[]};
// N/A and unanswered points never count as compliant. A draft remains a draft,
// even when all the points answered so far are compliant.
export const auditQuestionType=(q:{type?:AuditQuestion['type']})=>q.type||'conformity';
export function auditAnswered(a:Run['answers'][number]){return auditQuestionType(a)==='conformity'?['Conforme','Non conforme','Non applicable'].includes(a.result):!!a.value?.trim()}
export function auditScore(answers:Run['answers']){const controls=answers.filter(a=>auditQuestionType(a)==='conformity'),conform=controls.filter(a=>a.result==='Conforme').length,nonconform=controls.filter(a=>a.result==='Non conforme').length,na=controls.filter(a=>a.result==='Non applicable').length,pending=answers.filter(a=>!auditAnswered(a)).length,requiredPending=answers.filter(a=>a.required!==false&&!auditAnswered(a)).length,applicable=conform+nonconform;return {conform,nonconform,na,pending,requiredPending,information:answers.length-controls.length,applicable,total:answers.length,percent:applicable?Math.round(conform/applicable*100):null}}
export function auditCompletionError(run:Run){
 for(const a of run.answers){if(a.required!==false&&!auditAnswered(a))return 'Renseignez tous les points obligatoires avant de terminer l’audit.';if(auditQuestionType(a)==='conformity'&&a.result==='Non conforme'){if(['comment','both'].includes(a.evidence||'none')&&!a.comment.trim())return 'Ajoutez une observation pour l’écart : '+a.label;if(['photo','both'].includes(a.evidence||'none')&&!run.photos?.some(p=>p.questionId===a.id))return 'Ajoutez une photo pour l’écart : '+a.label}}
 return '';
}
export function auditConformityChoices(binary=false) {
 return binary?['Conforme','Non conforme']:['Conforme','Non conforme','Non applicable'];
}
export function auditAnswerError(q:AuditQuestion,a:Run['answers'][number],binary=false){if(typeof a.comment!=='string'||a.comment.length>3000)return 'Observation invalide.';if(auditQuestionType(q)==='conformity')return (a.result==='À faire'||auditConformityChoices(binary).includes(a.result))?'':'Résultat invalide.';if(a.value!==undefined&&(typeof a.value!=='string'||a.value.length>3000))return 'Réponse invalide.';const value=a.value||'';if(value&&q.type==='date'&&!validDate(value))return 'Date invalide.';if(value&&q.type==='number'&&(!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(value)||!Number.isFinite(Number(value.replace(',','.')))))return 'Nombre invalide.';return ''}

export function auditSections(answers:Run['answers']){const sections=new Map<string,Run['answers']>();for(const a of answers){const section=a.section?.trim()||'Points de contrôle';sections.set(section,[...(sections.get(section)||[]),a])}return [...sections].map(([title,items])=>({title,answers:items,score:auditScore(items)}))}
export const validDate=(s:unknown):s is string=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const str=(s:unknown,max:number,required=false)=>typeof s==='string'&&s.length<=max&&(!required||!!s.trim());
const ids=(v:unknown)=>Array.isArray(v)&&v.length<=100&&v.every(x=>str(x,100,true))&&new Set(v).size===v.length;
export function ticketError(v:Ticket){if(!v||!str(v.title,200,true)||!categories.includes(v.category)||!str(v.description,10000)||!ids(v.teams)||!ids(v.responsibles)||!str(v.pilot,100)||!str(v.due,10)||(v.due&&!validDate(v.due))||!ticketStatuses.includes(v.status))return 'Vérifiez le titre, la catégorie, les équipes, le pilote et l’échéance.';if([v.topicTags,v.locationTags].some(tags=>tags!==undefined&&(!ids(tags)||tags.length>20)))return 'Sélectionnez au maximum 20 étiquettes par groupe, sans doublon.';if(!Array.isArray(v.actions)||v.actions.length>100||v.actions.some(a=>!a||!str(a.id,100,true)||!str(a.title,500,true)||typeof a.done!=='boolean'||!str(a.pilot,100)||!str(a.due,10)||(a.due&&!validDate(a.due)))||new Set(v.actions.map(a=>a.id)).size!==v.actions.length)return 'Chaque action doit avoir un libellé et une date valide si renseignée.';if(v.status==='Clôturé'&&(!v.pilot||v.actions.some(a=>!a.done)))return 'Désignez un pilote et terminez toutes les actions avant de clôturer.';if(v.source&&(!str(v.source.routineId,100,true)||!validDate(v.source.date)||(v.source.questionId!==undefined&&!str(v.source.questionId,100,true))))return 'Origine du ticket invalide.';return ticketAnalysisError(v.analysis,new Set(v.actions.map(action=>action.id)))}
export function routineError(v:Routine){if(!v||!str(v.title,200,true)||!str(v.description,10000)||!ids(v.teams)||!str(v.pilot,100)||!validDate(v.start)||!str(v.end,10)||(v.end&&(!validDate(v.end)||v.end<v.start))||!/^([01]\d|2[0-3]):[0-5]\d$/.test(v.time)||!['none','daily','weekly','monthly'].includes(v.repeat)||!Number.isInteger(v.interval)||v.interval<1||v.interval>52||typeof v.active!=='boolean'||(v.binaryConformity!==undefined&&typeof v.binaryConformity!=='boolean')||(v.mode!==undefined&&!['catalog','on-demand','scheduled-copy'].includes(v.mode)))return 'Vérifiez le titre, le calendrier et la récurrence.';if(!Array.isArray(v.questions)||v.questions.length<1||v.questions.length>100||v.questions.some(q=>!q||!str(q.id,100,true)||!str(q.label,500,true)||(q.section!==undefined&&!str(q.section,150))||(q.type!==undefined&&!['conformity','text','number','date'].includes(q.type))||(q.required!==undefined&&typeof q.required!=='boolean')||(q.help!==undefined&&!str(q.help,1000))||(q.evidence!==undefined&&!['none','comment','photo','both'].includes(q.evidence)))||new Set(v.questions.map(q=>q.id)).size!==v.questions.length)return 'Ajoutez au moins un point de contrôle, sans doublon ; limitez les thèmes à 150 caractères.';return ''}
export function communicationError(v:Communication){return !v||!str(v.title,200,true)||!str(v.body,15000,true)||!str(v.sourceTeam,100,true)||!ids(v.teams)||!v.teams.length?'Renseignez le titre, le message, le service émetteur et au moins une équipe destinataire.':''}
export function occurrenceDates(r:Routine,from:string,to:string){if(!r.active||r.archivedAt||r.mode==='catalog'||!validDate(from)||!validDate(to)||!validDate(r.start)||from>to)return [];const days:string[]=[];const start=new Date(r.start+'T00:00:00Z');const limit=r.end&&r.end<to?r.end:to;if(r.repeat==='none')return r.start>=from&&r.start<=limit?[r.start]:[];if(r.repeat==='monthly'){const f=new Date(from+'T00:00:00Z');const diff=(f.getUTCFullYear()-start.getUTCFullYear())*12+f.getUTCMonth()-start.getUTCMonth();let n=Math.max(0,Math.floor(diff/r.interval));for(let guard=0;guard<500;guard++,n++){const month=start.getUTCMonth()+n*r.interval;const target=new Date(Date.UTC(start.getUTCFullYear(),month,1));const last=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();target.setUTCDate(Math.min(start.getUTCDate(),last));const s=target.toISOString().slice(0,10);if(s>limit)break;if(s>=from)days.push(s)}}else{const step=r.interval*(r.repeat==='weekly'?7:1)*86400000;let n=Math.max(0,Math.ceil((Date.parse(from)-start.getTime())/step));for(let guard=0;guard<500;guard++,n++){const s=new Date(start.getTime()+n*step).toISOString().slice(0,10);if(s>limit)break;days.push(s)}}return days}
export const newTicket=():Ticket=>({title:'',category:'Sécurité',description:'',topicTags:[],locationTags:[],teams:[],pilot:'',due:'',status:'Ouvert',actions:[],responsibles:[]});
export const todayParis=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

export function scheduledAuditDates(r:Routine,from:string,to:string){
 return r.mode==='on-demand'?[]:occurrenceDates(r,from,to);
}
