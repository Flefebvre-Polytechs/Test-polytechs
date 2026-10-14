'use client';
import {useEffect,useState} from 'react';
import {MetricChart} from '@/components/metric-chart';
import {DashboardDataEntry} from '@/components/dashboard-data-entry';
import {periodMeasurements,indicatorMeasurements,type Widget} from '@/lib/unit-dashboard';
export function IndicatorBlock({w,boardId,revision,canContribute,onSaved}:{w:Widget;boardId:string;revision:number;canContribute:boolean;onSaved:()=>void}){
 const [months,setMonths]=useState(3);
 const periodKey='polytechs-period-'+boardId+'-'+w.id;
 useEffect(()=>{try{const saved=Number(sessionStorage.getItem(periodKey));if([1,3,6,12].includes(saved))setMonths(saved)}catch{}},[periodKey]);
 const history=indicatorMeasurements(w),measurements=periodMeasurements(w,months);
 const legacyRows=w.rows?.length?w.rows:[['Mesure',w.value],['Objectif',w.target]].filter(r=>r[1]?.trim());
 const points=history.length?measurements.map(m=>({label:m.date,value:Number(m.value.replace(',','.'))})):legacyRows.map(r=>({label:r[0],value:Number(r[1]?.replace(',','.'))})).filter(p=>Number.isFinite(p.value));
 return <><div className="indicator-controls"><label>Période <select aria-label={'Période · '+w.title} value={months} onChange={e=>{const value=Number(e.target.value);setMonths(value);try{sessionStorage.setItem(periodKey,String(value))}catch{}}}>{[1,3,6,12].map(n=><option key={n} value={n}>{n===12?'1 an':n+' mois'}</option>)}</select></label>{canContribute&&<DashboardDataEntry id={boardId} revision={revision} widgets={[w]} onSaved={onSaved} todayOnly/>}</div>{!history.length&&<p className="board-muted">Les données non datées restent affichées. Saisissez une mesure datée pour commencer le suivi.</p>}{history.length>0&&!points.length?<p>Aucune mesure sur cette période.</p>:<MetricChart title={w.title} points={points} mode={w.chartType} accent={w.accent} caption={history.length?'Historique des mesures':'Indicateur saisi manuellement'} details={w.text}/>}<p className="board-muted">{w.unit||'Valeur'} · Objectif : {w.target||'à définir'}</p></>;
}
