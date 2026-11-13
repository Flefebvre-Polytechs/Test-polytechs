import {budgetSections,budgetStateOf,validBudgetState,type BudgetSection,type BudgetRecord,type BudgetState} from './qsse-budget';
export type AnnualBudget={id:string;year:number;kind:'account'|'order';section:BudgetSection;label:string;account:string;category:string;date:string;reference:string;status:BudgetRecord['status'];budgetState:BudgetState;amount:number|null;actual:number|null;budgetYtd:number|null;budget:number|null;forecast:number|null;months:(number|null)[];notes:string;source:string;sheet:string;row:number;raw:BudgetRecord['raw'];revision:number};
export const annualBudgetState=(record:Partial<AnnualBudget>&{kind:'account'|'order'}):BudgetState=>budgetStateOf(record);
export const annualFields=['actual','budgetYtd','budget','forecast'] as const;
export const validBudgetYear=(year:unknown):year is number=>Number.isInteger(year)&&Number(year)>=2000&&Number(year)<=2100;
export function annualError(r:AnnualBudget){if(!r||!validBudgetYear(r.year)||!['account','order'].includes(r.kind)||!Object.hasOwn(budgetSections,r.section))return 'Exercice, type ou section invalide.';
 for(const k of ['id','label','account','category','date','reference','status','notes','source','sheet'] as const)if(typeof r[k]!=='string'||r[k].length>(k==='notes'?10000:500))return 'Texte invalide.';
 if(!r.id||!r.label.trim()||!['À vérifier','Suivi','Annulée','Non validée'].includes(r.status)||!validBudgetState(r.budgetState)||!Number.isInteger(r.revision)||r.revision<0)return 'Ligne incomplète.';
 if(r.date&&(!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||Number.isNaN(Date.parse(r.date))||new Date(r.date).toISOString().slice(0,10)!==r.date||Number(r.date.slice(0,4))!==r.year))return 'La date doit appartenir à l’exercice choisi.';
 for(const k of [...annualFields,'amount'] as const)if(r[k]!==null&&(typeof r[k]!=='number'||!Number.isFinite(r[k])||Math.abs(r[k]!)>1e10))return 'Montant invalide.';
 if(!Array.isArray(r.months)||r.months.length!==12||r.months.some(v=>v!==null&&(typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>1e10)))return 'Mensualisation invalide.';
 return ''}
export function annualTotal(rows:AnnualBudget[],key:typeof annualFields[number]|'amount'){const known=rows.filter(r=>r[key]!==null);return {amount:known.length?Math.round(known.reduce((s,r)=>s+r[key]!,0)*100)/100:null,missing:rows.length-known.length}}
export function carryBudget(rows:AnnualBudget[],year:number,copyAmounts:boolean){return rows.filter(r=>r.kind==='account').map(r=>({...r,id:crypto.randomUUID(),year,budgetState:'À prévoir' as const,actual:null,budgetYtd:null,forecast:null,budget:copyAmounts?r.budget:null,months:copyAmounts?[...r.months]:Array(12).fill(null),notes:'',source:'Reprise de structure depuis '+r.year,sheet:'',row:0,raw:{},revision:1}))}
