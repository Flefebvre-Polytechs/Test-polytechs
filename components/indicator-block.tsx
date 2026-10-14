'use client';
import {useEffect,useState} from 'react';
import {MetricChart} from '@/components/metric-chart';
import {DashboardDataEntry} from '@/components/dashboard-data-entry';
import {numericTarget,targetReached,periodMeasurements,indicatorMeasurements,type Widget} from '@/lib/unit-dashboard';
export function IndicatorBlock({w,boardId,revision,canContribute,canCreateTicket,onSaved}:{w:Widget;boardId:string;revision:number;canContribute:boolean;canCreateTicket:boolean;onSaved:()=>void}){
 const [months,setMonths]=useState(3);
 const periodKey='polytechs-period-'+boardId+'-'+w.id;
 useEffect(()=>{try{const saved=Number(sessionStorage.getItem(periodKey));if([1,3,6,12].includes(saved))setMonths(saved)}catch{}},[periodKey]);
 const history=indicatorMeasurements(w),measurements=periodMeasurements(w,months);
 const legacyRows=w.rows?.length?w.rows:[['Mesure',w.value]].filter(r=>r[1]?.trim());
 const points=history.length?measurements.map(m=>({label:new Date(m.date+'T12:00:00').toLocaleDateString('fr-FR'),value:Number(m.value.replace(',','.'))})):legacyRows.map(r=>({label:r[0],value:Number(r[1]?.replace(',','.'))})).filter(p=>Number.isFinite(p.value));
 const target=numericTarget(w.target),latest=measurements.at(-1);
 const outside=latest&&target!==undefined&&!targetReached(Number(latest.value.replace(',','.')),target,w.targetDirection);
 const ticketLink='/tickets?'+new URLSearchParams({new:'1',indicatorBoard:boardId,indicatorId:w.id,measurementDate:latest?.date||''});
 return <><div className="indicator-controls"><label>Période <select aria-label={'Période · '+w.title} value={months} onChange={e=>{const value=Number(e.target.value);setMonths(value);try{sessionStorage.setItem(periodKey,String(value))}catch{}}}>{[1,3,6,12].map(n=><option key={n} value={n}>{n===12?'1 an':n+' mois'}</option>)}</select></label>{canContribute&&<DashboardDataEntry id={boardId} revision={revision} widgets={[w]} onSaved={onSaved} todayOnly/>}</div>{latest&&<div className="indicator-latest" style={{color:target===undefined?undefined:targetReached(Number(latest.value.replace(',','.')),target,w.targetDirection)?'#15803d':'#b91c1c'}}><strong>{latest.value} <small>{w.unit}</small></strong><time dateTime={latest.date}>{new Date(latest.date+'T12:00:00').toLocaleDateString('fr-FR')}</time></div>}{outside&&<div className="indicator-ticket-reminder" role="status">{canCreateTicket?<a href={ticketLink} className="indicator-ticket-link" title="Objectif non atteint : ouvrir un ticket"><span className="indicator-ticket-pulse" aria-hidden="true">🎫</span><span>Ouvrir un ticket</span></a>:<span>🎫 Objectif non atteint : prévenez le coordinateur de l’équipe.</span>}</div>}{!history.length&&<p className="board-muted">Les données non datées restent affichées. Saisissez une mesure datée pour commencer le suivi.</p>}{history.length>0&&!points.length?<p>Aucune mesure sur cette période.</p>:<MetricChart title={w.title} points={points} mode={w.chartType} accent={w.accent} target={target} targetDirection={w.targetDirection} unit={w.unit} caption={history.length?'Historique des mesures':'Indicateur saisi manuellement'} details={w.text}/>}<p className="board-muted">{w.unit||'Valeur'} · Objectif : {w.target||'à définir'}</p></>;
}
