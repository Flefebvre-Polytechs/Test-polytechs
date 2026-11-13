'use client';
import {useCallback,useEffect,useMemo,useState,type FormEvent} from 'react';
import {AccountGate} from '@/components/account-gate';
import {HubFrame} from '@/components/hub-layout';
import {Activity,ArrowDownToLine,ArrowRight,BarChart3,CalendarDays,Check,ChevronRight,Droplets,FileClock,FilePlus2,Leaf,LineChart as TrendIcon,LockKeyhole,Plus,RefreshCcw,Save,Search,Sun,Target,TrendingDown,TrendingUp,Warehouse,X,Zap} from 'lucide-react';
import {Bar,BarChart,CartesianGrid,Legend,Line,ComposedChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import {currentMonth,environmentMetrics,environmentSections,environmentSites,environmentIntensity,environmentShare,formatEnvironmentNumber,metricInfo,monthlyEnvironment,monthsEnding,sumEnvironment,type EnvironmentEntry,type EnvironmentMetric,type EnvironmentScope,type EnvironmentSection,type EnvironmentSite} from '@/lib/environment-consumptions';
import {EnvironmentBulkImport} from './bulk-import';
import './style.css';

const icons={activity:Activity,energy:Zap,renewable:Sun,resources:Leaf,water:Droplets};
const format=(n:number|null,max=2)=>formatEnvironmentNumber(n,max);
const stamp=(m:string)=>new Date(m+'-01T12:00:00Z').toLocaleDateString('fr-FR',{month:'long',year:'numeric',timeZone:'UTC'});
const csvCell=(v:unknown)=>{let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'};
type Tile={key:string;name:string;value:number|null;unit:string;detail:string;goal?:number|null;partial?:boolean;count?:number;expected?:number;direction?:'min'|'max'};
type Editor={site:EnvironmentSite;period:string;metric:EnvironmentMetric};
type AuditRow={previous_snapshot:string;new_snapshot:string;actor:string;created_at:string};
export default function Page(){return <AccountGate>{()=> <EnvironmentWorkspace/>}</AccountGate>}

function EnvironmentWorkspace(){
 const [tab,setTab]=useState<EnvironmentSection>('activity'),[scope,setScope]=useState<EnvironmentScope>('all');
 const [endMonth,setEndMonth]=useState(currentMonth),[windowSize,setWindowSize]=useState<1|3|6|12>(12);
 const [records,setRecords]=useState<EnvironmentEntry[]>([]),[ready,setReady]=useState(false),[loading,setLoading]=useState(false),[canEdit,setCanEdit]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [focus,setFocus]=useState<EnvironmentMetric>('production_t'),[editor,setEditor]=useState<Editor|null>(null);
 const [value,setValue]=useState(''),[target,setTarget]=useState(''),[note,setNote]=useState('');
 const [historyId,setHistoryId]=useState(''),[history,setHistory]=useState<AuditRow[]>([]),[historyError,setHistoryError]=useState('');
 const [showAll,setShowAll]=useState(false);
 const periods=useMemo(()=>monthsEnding(endMonth,windowSize),[endMonth,windowSize]);
 const start=periods[0]||endMonth,end=periods[periods.length-1]||endMonth;
 const load=useCallback(async()=>{
  setLoading(true);
  try{
   const r=await fetch('/api/environnement/consommations?start='+encodeURIComponent(start)+'&end='+encodeURIComponent(end),{cache:'no-store'});
   const result=await r.json() as {entries?:EnvironmentEntry[];canEdit?:boolean;error?:string};
   if(!r.ok)throw Error(result.error||'Impossible de charger les consommations.');
   setRecords(result.entries||[]);setCanEdit(result.canEdit===true);setError('');setReady(true);
  }catch(e){setError((e as Error).message);setReady(false)}finally{setLoading(false)}
 },[start,end]);
 useEffect(()=>{void load()},[load]);
 useEffect(()=>{setFocus(environmentMetrics.find(m=>m.section===tab)!.key);setShowAll(false)},[tab]);
 const section=environmentSections.find(x=>x.id===tab)!,sectionMetrics=environmentMetrics.filter(m=>m.section===tab&&(!['water_network_m3','water_other_m3'].includes(m.key)||records.some(r=>r.metric===m.key)));
 const focused=sectionMetrics.find(m=>m.key===focus)||sectionMetrics[0];
 const sum=(key:EnvironmentMetric,field:'value'|'target'='value')=>sumEnvironment(records,key,periods,scope,field);
 const tile=(key:EnvironmentMetric):Tile=>{const m=metricInfo(key)!,actual=sum(key),goal=sum(key,'target');return {key,name:m.label,value:actual.value,unit:m.unit,detail:m.description,goal:goal.value,partial:actual.partial,count:actual.count,expected:actual.expected,direction:m.direction}};
 const shareMaterials=environmentShare(records,'recycled_material_t','virgin_material_t',periods,scope);
 const shareSolar=environmentShare(records,'solar_self_kwh','electricity_grid_kwh',periods,scope);
 const tEnergy=environmentIntensity(records,'electricity_grid_kwh',periods,scope);
 const tWater=environmentIntensity(records,'water_consumed_m3',periods,scope);
 const tWaste=environmentIntensity(records,'waste_t',periods,scope);
 const selectedCards:Tile[]=tab==='activity'?[tile('production_t'),tile('operating_h'),{key:'energy-intensity',name:'Électricité réseau / tonne',value:tEnergy.value,unit:'kWh/t',detail:'Consommation électrique du réseau rapportée aux tonnes déclarées.',partial:tEnergy.partial,count:tEnergy.count,expected:tEnergy.expected},{key:'water-intensity',name:'Eau de ville / tonne',value:tWater.value,unit:'m³/t',detail:'Consommation du réseau d’eau de ville rapportée aux tonnes produites, sur les mêmes mois et sites.',partial:tWater.partial,count:tWater.count,expected:tWater.expected}]:
 tab==='energy'?[tile('electricity_grid_kwh'),tile('natural_gas_kwh'),tile('fuel_l'),{key:'energy-intensity',name:'Intensité électrique réseau',value:tEnergy.value,unit:'kWh/t',detail:'Électricité du réseau divisée par la production.',partial:tEnergy.partial,count:tEnergy.count,expected:tEnergy.expected}]:
 tab==='renewable'?[tile('solar_generated_kwh'),tile('solar_self_kwh'),tile('renewable_purchased_kwh'),{key:'solar-share',name:'Part d’autoconsommation',value:shareSolar.value,unit:'%',partial:shareSolar.partial,count:shareSolar.count,expected:shareSolar.expected,detail:'Énergie solaire autoconsommée / (électricité réseau + solaire autoconsommée). Les achats verts ne sont pas additionnés.'}]:
 tab==='resources'?[tile('virgin_material_t'),tile('recycled_material_t'),tile('waste_t'),{key:'recycled-share',name:'Part de matières recyclées',value:shareMaterials.value,unit:'%',partial:shareMaterials.partial,count:shareMaterials.count,expected:shareMaterials.expected,detail:'Matières recyclées / (matières vierges + recyclées).'}]:
 [tile('water_consumed_m3'),tile('water_discharge_m3'),tile('water_reused_m3'),{key:'water-intensity',name:'Eau de ville / tonne',value:tWater.value,unit:'m³/t',detail:'Eau du réseau rapportée à la production.',partial:tWater.partial,count:tWater.count,expected:tWater.expected}];
 const points=useMemo(()=>monthlyEnvironment(records,focused.key,periods,scope),[records,focused.key,periods,scope]);
 const hasReadings=points.some(x=>x.actual!==null||x.target!==null);
 const relevant=useMemo(()=>records.filter(x=>periods.includes(x.period)&&(scope==='all'||x.site===scope)&&sectionMetrics.some(m=>m.key===x.metric)).sort((a,b)=>b.period.localeCompare(a.period)||a.site.localeCompare(b.site)||a.metric.localeCompare(b.metric)),[records,periods,scope,sectionMetrics]);
 const visible=showAll?relevant:relevant.slice(0,20);
 const selected=editor?records.find(r=>r.site===editor.site&&r.period===editor.period&&r.metric===editor.metric)||null:null;
 useEffect(()=>{if(!editor)return;setValue(selected?.value===null||selected?.value===undefined?'':String(selected.value));setTarget(selected?.target===null||selected?.target===undefined?'':String(selected.target));setNote(selected?.note||'')},[editor?.site,editor?.period,editor?.metric,selected?.revision]);
 function chooseTab(next:EnvironmentSection){setTab(next);setEditor(null);setNotice('')}
 function openEditor(key:EnvironmentMetric=focused.key,period=end,site:EnvironmentSite=scope==='all'?'site-1':scope){setEditor({site,period,metric:key});setError('');setNotice('')}
 async function save(e:FormEvent){e.preventDefault();if(!editor||busy)return;
  const numeric=(s:string)=>s.trim()===''?null:Number(s.trim().replace(',','.'));
  const current=numeric(value),goal=numeric(target);
  if([current,goal].some(n=>n!==null&&(!Number.isFinite(n)||n<0||n>1e9||Math.abs(n*1e4-Math.round(n*1e4))>=1e-6))){setError('Indiquez des valeurs positives, avec au maximum quatre décimales.');return}
  setBusy(true);setError('');setNotice('');
  try{
   const r=await fetch('/api/environnement/consommations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',site:editor.site,period:editor.period,metric:editor.metric,value:current,target:goal,note:note.trim(),revision:selected?.revision||0})});
   const result=await r.json() as {error?:string};
   if(!r.ok)throw Error(result.error||'Enregistrement impossible.');
   setEditor(null);setNotice('Consommation et objectif enregistrés. Les indicateurs sont actualisés.');await load();
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 async function openHistory(id:string){setHistoryId(id);setHistory([]);setHistoryError('');
  try{const r=await fetch('/api/environnement/consommations?history='+encodeURIComponent(id),{cache:'no-store'}),json=await r.json() as {events?:AuditRow[];error?:string};if(!r.ok)throw Error(json.error||'Historique indisponible.');setHistory(json.events||[])}catch(e){setHistoryError((e as Error).message)}
 }
 function exportCsv(){const columns=['Mois','Site','Rubrique','Indicateur','Unité','Valeur réelle','Objectif du mois','Note / source','Dernière mise à jour','Modifié par'];const lines=relevant.map(r=>{const m=metricInfo(r.metric)!;return [r.period,environmentSites.find(s=>s.id===r.site)?.label||r.site,environmentSections.find(s=>s.id===m.section)?.label||'',m.label,m.unit,r.value===null?'':String(r.value),r.target===null?'':String(r.target),r.note,r.updated_at,r.updated_by]});const csv='\ufeff'+[columns,...lines].map(row=>row.map(csvCell).join(';')).join('\r\n');const href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=href;a.download='polytechs-environnement-'+tab+'-'+start+'-'+end+'.csv';a.click();URL.revokeObjectURL(href)}
 const FocusIcon=icons[tab];
 const currentScope=environmentSites.find(s=>s.id===scope)?.label||'Tous les sites';
 return <HubFrame active="Environnement" teamId="qsse"><div className="env-workspace">
  <div className="env-crumb"><a href="/unites?team=qsse">QSSE</a><ChevronRight size={14}/><span>Environnement</span><ChevronRight size={14}/><strong>Consommations</strong></div>
  <header className="env-hero"><div><div className="env-eyebrow"><Leaf size={16}/> PILOTAGE ENVIRONNEMENTAL · POLYTECHS</div><h1>Suivi des consommations</h1><p>Un suivi fiable par site, par mois et par ressource, avec objectifs, tendances et indicateurs rapportés à l’activité.</p></div><div className="env-hero-actions">{canEdit&&<EnvironmentBulkImport onSuccess={(period,site)=>{setEndMonth(period);setWindowSize(12);setScope(site);setTab('activity')}}/>}<a href="/dechets" className="env-outlined">Registre des déchets <ArrowRight size={16}/></a>{canEdit&&<button className="env-primary" type="button" onClick={()=>openEditor()}><Plus size={17}/> Nouvelle saisie</button>}</div></header>
  <nav className="env-tabs" aria-label="Rubriques du suivi environnemental">{environmentSections.map(item=>{const Icon=icons[item.id];return <button type="button" key={item.id} className={'env-tab '+(tab===item.id?'active':'')} aria-current={tab===item.id?'page':undefined} onClick={()=>chooseTab(item.id)}><Icon size={20}/><span>{item.label}</span></button>})}</nav>
  <div className="env-intro"><div className="env-intro-icon"><FocusIcon size={22}/></div><div><h2>{section.label}</h2><p>{section.intro}</p></div></div>
  <div className="env-filters">
   <label><Warehouse size={17}/> Périmètre<select value={scope} onChange={e=>setScope(e.target.value as EnvironmentScope)}><option value="all">Tous les sites</option>{environmentSites.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
   <label><CalendarDays size={17}/> Mois de référence<input type="month" value={endMonth} min="2020-01" max="2100-12" onChange={e=>setEndMonth(e.target.value||currentMonth())}/></label>
   <div className="env-window-group" aria-label="Période d’analyse"><span>Afficher</span>{([1,3,6,12] as const).map(n=><button key={n} type="button" className={windowSize===n?'active':''} onClick={()=>setWindowSize(n)} aria-pressed={windowSize===n}>{n} mois</button>)}</div>
   <button type="button" className="env-export" disabled={!relevant.length} onClick={exportCsv}><ArrowDownToLine size={16}/> CSV</button>
   <button type="button" className="env-refresh" aria-label="Actualiser les données" onClick={()=>void load()} disabled={loading}><RefreshCcw size={17}/></button>
  </div>
  {error&&<div className="env-error" role="alert">{error}</div>}{notice&&<div className="env-notice" role="status"><Check size={16}/>{notice}</div>}
  {!ready?<div className="env-empty-state"><LockKeyhole size={28}/><h2>{error==='Accès au service QSSE nécessaire.'?'Accès QSSE requis':loading?'Chargement des mesures…':'Registre non disponible'}</h2><p>{error==='Accès au service QSSE nécessaire.'?'La consultation des consommations est réservée aux membres autorisés QSSE.':'Actualisez pour récupérer les données du suivi environnemental.'}</p><button className="env-outlined" onClick={()=>void load()}>Réessayer</button></div>:<>
   <section className="env-kpis" aria-label="Indicateurs de consommation">
    {selectedCards.map((card,i)=>{const exceed=card.value!==null&&card.goal!==null&&card.goal!==undefined&&(!card.partial)&& (card.direction==='min'?card.value<card.goal:card.value>card.goal);
     return <div key={card.key} className={'env-kpi '+(exceed?'env-kpi-warning':'')}><div className="env-kpi-head"><span>{card.name}</span>{i===0?<FocusIcon size={19}/>:card.key.includes('intensity')?<TrendIcon size={19}/>:<BarChart3 size={19}/>}</div><strong>{format(card.value)} <small>{card.unit}</small></strong><div className="env-kpi-foot">{card.goal!==null&&card.goal!==undefined?<span className={exceed?'env-text-red':'env-text-green'}>Objectif : {format(card.goal)} {card.unit}{card.partial?' · partiel':''}</span>:card.partial?<span>Saisie partielle · {card.count??0}/{card.expected??periods.length*(scope==='all'?2:1)} site-mois</span>:<span>{card.value===null?'Aucune mesure saisie':windowSize+' mois · '+currentScope}</span>}</div><p className="env-kpi-tip">{card.detail}</p></div>})}
   </section>
   <div className="env-analysis-grid">
    <section className="env-panel env-chart-panel">
     <div className="env-panel-top"><div><span className="env-panel-eyebrow">ANALYSE TEMPORELLE</span><h2>Évolution des consommations</h2><p>Valeur réelle et objectif mensuel · {currentScope}</p></div><TrendIcon size={21}/></div>
     <label className="env-metric-picker">Indicateur<select value={focus} onChange={e=>setFocus(e.target.value as EnvironmentMetric)}>{sectionMetrics.map(m=><option key={m.key} value={m.key}>{m.label} ({m.unit})</option>)}</select></label>
     {hasReadings?<div className="env-chart" role="img" aria-label={'Historique mensuel pour '+focused.label}>
      <ResponsiveContainer width="100%" height="100%"><ComposedChart data={points} margin={{top:15,right:16,bottom:5,left:0}}><CartesianGrid vertical={false} stroke="#e8ebf1" strokeDasharray="4 4"/><XAxis dataKey="label" tick={{fill:'#798698',fontSize:11}} axisLine={false} tickLine={false}/><YAxis tick={{fill:'#798698',fontSize:11}} axisLine={false} tickLine={false} width={52} tickFormatter={n=>Number(n).toLocaleString('fr-FR')}/><Tooltip formatter={(n:any,key:any)=>[format(Number(n))+' '+focused.unit,key==='actual'?'Mesuré':'Objectif']} labelFormatter={(label:any)=>String(label)} contentStyle={{border:'1px solid #e7e3f0',borderRadius:12,boxShadow:'0 8px 25px #34274a13'}}/><Legend formatter={k=>k==='actual'?'Consommation':'Objectif'} verticalAlign="bottom"/><Bar dataKey="actual" maxBarSize={36} fill="#7442ba" radius={[6,6,0,0]} name="actual"/><Line type="monotone" dataKey="target" stroke="#e09952" strokeWidth={2.6} dot={{r:3}} connectNulls={false} name="target"/></ComposedChart></ResponsiveContainer>
     </div>:<div className="env-chart-empty"><BarChart3 size={29}/><strong>Pas encore de mesures</strong><span>Ajoutez les valeurs des factures ou relevés de compteurs pour voir l’évolution.</span></div>}
     <div className="env-chart-foot"><span><span className="env-dot purple"/> Mesures déclarées</span><span><span className="env-dot orange"/> Objectifs saisis</span><small>Une case vide reste une donnée manquante, jamais zéro.</small></div>
    </section>
    <section className="env-panel env-summary-panel">
     <div className="env-panel-top"><div><span className="env-panel-eyebrow">LECTURE DES DONNÉES</span><h2>{focused.label}</h2><p>{stamp(start)} – {stamp(end)}</p></div><Target size={21}/></div>
     <div className="env-feature-number"><span>Consommation déclarée</span><strong>{format(sum(focused.key).value)} <small>{focused.unit}</small></strong><p>{sum(focused.key).count} relevé(s) renseigné(s) sur {sum(focused.key).expected} site-mois possibles.</p></div>
     <div className="env-summary-separator"/>
     <div className="env-goal-line"><div><strong>Objectif renseigné</strong><span>{format(sum(focused.key,'target').value)} {focused.unit}</span></div><Target size={19}/></div>
     <p className="env-feature-description">{focused.description}</p>
     {focused.key==='waste_t'&&periods.length>0&&<div className="env-waste-comparison">
      <p>Production de déchets déclarée · {currentScope} · {stamp(start)} à {stamp(end)}.</p>
      <a href={'/dechets?'+new URLSearchParams({view:'register',from:start+'-01',to:new Date(Date.UTC(Number(end.slice(0,4)),Number(end.slice(5)),0)).toISOString().slice(0,10),status:'Enlevé'}).toString()}>Consulter les enlèvements de la période · tous sites</a>
     </div>}
     {canEdit&&<button type="button" className="env-primary env-full-button" onClick={()=>openEditor(focused.key)}><FilePlus2 size={17}/> Renseigner une mesure / un objectif</button>}
     <div className="env-small-hint">Les objectifs sont saisis mois par mois, pour chaque site. Les données historiques restent traçables.</div>
    </section>
   </div>
   {editor&&canEdit&&<section className="env-panel env-editor"><div className="env-panel-top"><div><span className="env-panel-eyebrow">{selected?'MODIFICATION':'NOUVELLE SAISIE'}</span><h2>{selected?'Modifier le relevé':'Ajouter un relevé mensuel'}</h2><p>Les corrections et leurs auteurs sont conservés dans l’historique.</p></div><button type="button" className="env-close" onClick={()=>setEditor(null)} aria-label="Fermer le formulaire"><X size={20}/></button></div>
    <form onSubmit={save}><div className="env-form-fields">
     <label>Site<select value={editor.site} onChange={e=>setEditor({...editor,site:e.target.value as EnvironmentSite})}>{environmentSites.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
     <label>Mois<input type="month" required min="2020-01" max="2100-12" value={editor.period} onChange={e=>setEditor({...editor,period:e.target.value})}/></label>
     <label>Indicateur<select value={editor.metric} onChange={e=>setEditor({...editor,metric:e.target.value as EnvironmentMetric})}>{environmentMetrics.filter(m=>m.section===tab&&(!['water_network_m3','water_other_m3'].includes(m.key)||m.key===editor.metric)).map(m=><option key={m.key} value={m.key}>{m.label} ({m.unit})</option>)}</select></label>
     <label>Consommation réelle ({metricInfo(editor.metric)?.unit})<input type="text" inputMode="decimal" placeholder="Non renseignée" value={value} onChange={e=>setValue(e.target.value)} maxLength={25}/></label>
     <label>Objectif du mois ({metricInfo(editor.metric)?.unit})<input type="text" inputMode="decimal" placeholder="Facultatif" value={target} onChange={e=>setTarget(e.target.value)} maxLength={25}/></label>
     <label className="env-form-notes">Source / commentaire (facture, compteur, méthode)<textarea rows={2} maxLength={1000} placeholder="Ex. : relève compteur de fin de mois, facture fournisseur…" value={note} onChange={e=>setNote(e.target.value)}/></label>
    </div><p className="env-edit-hint">Saisissez une valeur en {metricInfo(editor.metric)?.unit} · jusqu’à 4 décimales. Laisser le champ vide signifie « non renseigné ».</p>
    <div className="env-editor-actions"><button type="button" className="env-outlined" onClick={()=>setEditor(null)}>Annuler</button><button type="submit" className="env-primary" disabled={busy}><Save size={17}/>{busy?'Enregistrement…':'Enregistrer le relevé'}</button></div></form>
   </section>}
   <section className="env-panel env-register">
    <div className="env-panel-top"><div><span className="env-panel-eyebrow">TRAÇABILITÉ</span><h2>Relevés et objectifs enregistrés</h2><p>{relevant.length} saisie(s) · {section.label.toLowerCase()} · {currentScope}</p></div><div className="env-register-actions">{canEdit&&<button className="env-outlined" onClick={()=>openEditor(focused.key)}><Plus size={16}/> Ajouter</button>}</div></div>
    {relevant.length?<><div className="env-mobile-register">{visible.map(r=>{
     const metric=metricInfo(r.metric)!;
     return <details key={r.id}><summary><span>{stamp(r.period)} · {environmentSites.find(s=>s.id===r.site)?.label.split(' · ')[0]}<strong>{metric.label}</strong></span><b>{format(r.value)} {r.value===null?'':metric.unit}</b></summary>
      <div><p>Objectif · {format(r.target)} {r.target===null?'':metric.unit}</p>{r.note&&<p>{r.note}</p>}<p>Dernière saisie · {new Date(r.updated_at).toLocaleDateString('fr-FR')} · {r.updated_by}</p>
      <div className="env-row-actions">{canEdit&&<button type="button" onClick={()=>openEditor(r.metric,r.period,r.site)}>Modifier</button>}<button type="button" onClick={()=>void openHistory(r.id)}>Historique</button></div></div></details>
    })}</div><div className="env-table-wrap"><table className="env-table"><thead><tr><th>Mois</th><th>Site</th><th>Indicateur</th><th>Mesuré</th><th>Objectif</th><th>Dernière saisie</th><th>Actions</th></tr></thead><tbody>{visible.map(r=>{const m=metricInfo(r.metric)!;return <tr key={r.id}><td>{stamp(r.period)}</td><td>{environmentSites.find(s=>s.id===r.site)?.label.split(' · ')[0]}</td><td><strong>{m.label}</strong>{r.note&&<small title={r.note}>{r.note.length>75?r.note.slice(0,75)+'…':r.note}</small>}</td><td className="env-quantity">{format(r.value)} <small>{r.value===null?'':m.unit}</small></td><td>{format(r.target)} <small>{r.target===null?'':m.unit}</small></td><td><span>{new Date(r.updated_at).toLocaleDateString('fr-FR')}</span><small>{r.updated_by}</small></td><td><div className="env-row-actions">{canEdit&&<button type="button" onClick={()=>openEditor(r.metric,r.period,r.site)}>Modifier</button>}<button type="button" title="Historique de modifications" onClick={()=>void openHistory(r.id)}><FileClock size={16}/></button></div></td></tr>})}</tbody></table></div>{relevant.length>20&&<button className="env-show-more" onClick={()=>setShowAll(v=>!v)}>{showAll?'Afficher moins':'Afficher les '+relevant.length+' saisies'}</button>}</>:<div className="env-register-empty"><Search size={23}/><strong>Aucun relevé pour cette période.</strong><span>Les données ne sont pas encore saisies. Commencez par ajouter le premier mois.</span>{canEdit&&<button className="env-outlined" onClick={()=>openEditor()}><Plus size={16}/> Première saisie</button>}</div>}
   </section>
   {historyId&&<section className="env-panel env-history"><div className="env-panel-top"><div><span className="env-panel-eyebrow">JOURNAL DE MODIFICATION</span><h2>Historique du relevé</h2></div><button type="button" className="env-close" onClick={()=>setHistoryId('')} aria-label="Fermer l’historique"><X size={19}/></button></div>{historyError&&<p className="env-error">{historyError}</p>}{!historyError&&!history.length&&<p>Chargement de l’historique…</p>}{history.map((h,i)=>{let previous:{value?:number|null;target?:number|null;note?:string}={},next:{value?:number|null;target?:number|null;note?:string}={};try{previous=JSON.parse(h.previous_snapshot);next=JSON.parse(h.new_snapshot)}catch{}return <div key={i} className="env-history-row"><FileClock size={18}/><div><strong>{h.actor}</strong><span>{new Date(h.created_at).toLocaleString('fr-FR')}</span><p>Mesuré : {format(previous.value??null)} → {format(next.value??null)} · Objectif : {format(previous.target??null)} → {format(next.target??null)}</p>{next.note&&<small>Source / note : {next.note}</small>}</div></div>})}</section>}
   <footer className="env-footnote"><Leaf size={15}/><span>Suivi basé sur les relevés réellement saisis · aucune consommation estimée automatiquement · les données déchets ne sont pas encore synchronisées avec le registre.</span></footer>
  </>}
 </div></HubFrame>;
}
