export const budgetSections={'2500':'Sécurité','2600':'Recyclage et extérieurs','4520':'Assurance qualité','interim':'Intérim QSSE'} as const;
export type BudgetSection=keyof typeof budgetSections;
export type BudgetRecord={id:string;kind:'account'|'order';section:BudgetSection;label:string;account:string;date:string;dateSource:string;reference:string;category:string;amount:number|null;status:'À vérifier'|'Suivi'|'Annulée'|'Non validée';actual2025:number|null;actual2026:number|null;budgetYtd2026:number|null;budget2026:number|null;forecast2026:number|null;budget2027:number|null;months:(number|null)[];notes:string;source:string;sheet:string;row:number;raw:Record<string,string|number>;revision:number};
export const amountFields=['amount','actual2025','actual2026','budgetYtd2026','budget2026','forecast2026','budget2027'] as const;
export function budgetRecordError(r:BudgetRecord){
 if(!r||typeof r!=='object'||Array.isArray(r))return 'Ligne invalide.';
 if(!Object.hasOwn(budgetSections,r.section)||!['account','order'].includes(r.kind))return 'Section ou type invalide.';
 for(const k of ['id','label','account','date','dateSource','reference','category','status','notes','source','sheet'] as const)if(typeof r[k]!=='string'||r[k].length>(k==='notes'?10000:500))return 'Texte invalide.';
 if(!r.id||!r.label.trim()||!['À vérifier','Suivi','Annulée','Non validée'].includes(r.status)||!Number.isInteger(r.row)||r.row<0||!Number.isInteger(r.revision)||r.revision<0)return 'Ligne incomplète.';
 if(r.date&&(!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||Number.isNaN(Date.parse(r.date))||new Date(r.date).toISOString().slice(0,10)!==r.date))return 'Date invalide.';
 for(const k of amountFields)if(r[k]!==null&&(typeof r[k]!=='number'||!Number.isFinite(r[k])||Math.abs(r[k]!)>1e10))return 'Montant invalide.';
 if(!Array.isArray(r.months)||r.months.length!==12||r.months.some(v=>v!==null&&(typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>1e10)))return 'Mensualisation invalide.';
 if(!r.raw||typeof r.raw!=='object'||Array.isArray(r.raw)||Object.keys(r.raw).length>100||Object.values(r.raw).some(v=>typeof v!=='string'&&typeof v!=='number'||String(v).length>10000))return 'Source invalide.';
 return '';
}
export function sumBudget(rows:BudgetRecord[],field:typeof amountFields[number]){return Math.round(rows.reduce((sum,r)=>sum+(r[field]??0),0)*100)/100}
export function budgetIssues(r:BudgetRecord){const issues:string[]=[];if(r.kind==='order'){if(r.amount===null)issues.push('Montant à compléter');if(!r.date)issues.push('Date à compléter');if(r.status==='À vérifier')issues.push('À vérifier');}else if(r.budget2027!==null&&Math.abs(r.months.reduce<number>((a,b)=>a+(b??0),0)-r.budget2027)>0.02)issues.push('Mensualisation à ajuster');return issues;}

// Preserve the accounting section from Excel, independently of expense labels.
export const budgetSectionDetails:Record<BudgetSection,string>={'2500':'Sécurité','2600':'Recyclage et extérieurs','4520':'Assurance qualité','interim':'Personnel intérimaire QSSE'};
export function budgetSubtotal(rows:BudgetRecord[],field:typeof amountFields[number]){const known=rows.filter(r=>r[field]!==null);return {amount:known.length?sumBudget(known,field):null,missing:rows.length-known.length,count:rows.length}}
export function groupBudgetRows(rows:BudgetRecord[]){return (Object.keys(budgetSections) as BudgetSection[]).map(section=>({section,rows:rows.filter(r=>r.section===section)}))}

export const budgetSourceTabs={account:[{section:'2500',label:'2500'},{section:'2600',label:'2600'},{section:'4520',label:'4520'}],order:[{section:'',label:'TDB Budgets'},{section:'2500',label:'2500 - 2026'},{section:'2600',label:'2600 - 2026'},{section:'4520',label:'4520 - 2026'},{section:'interim',label:'Interim 2026'}]} as const;
export function budgetTabLabel(kind:BudgetRecord['kind'],section:string){return budgetSourceTabs[kind].find(tab=>tab.section===section)?.label||budgetSections[section as BudgetSection]||'Vue d’ensemble'}
