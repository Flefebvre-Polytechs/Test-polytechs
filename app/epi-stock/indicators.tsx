'use client';
import {useEffect,useState} from 'react';
import {Bar,BarChart,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import {ArrowDownToLine,ArrowUpFromLine,Coins,TriangleAlert,Wallet} from 'lucide-react';

type Month={month:string;label:string;issuedUnits:number;receivedUnits:number;issuedCostCents:number;issuedCostEur:number;valuedUnits:number;unvaluedUnits:number};
type Product={code:string;name:string;reference:string;family:string;units:number;costCents:number;valuedUnits:number;unvaluedUnits:number};
type Family={family:string;units:number;costCents:number;unvaluedUnits:number};
type Summary={issuedUnits:number;receivedUnits:number;issuedCostCents:number;receivedCostCents:number;valuedIssuedUnits:number;unvaluedIssuedUnits:number;unvaluedReceivedUnits:number;stockValueCents:number;unvaluedStockUnits:number;unvaluedStockReferences:number;pricedReferences:number;totalReferences:number;atRisk:number;notInventoried:number};
type IndicatorsData={period:{months:number;start:string;endExclusive:string;family:string};families:string[];summary:Summary;monthly:Month[];top:Product[];byFamily:Family[];error?:string};
const euros=(cents:number)=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(cents/100);
const qty=(value:number)=>new Intl.NumberFormat('fr-FR').format(value);
const isCostKnown=(priced:number,unknown:number)=>priced>0||unknown===0;

export function EpiIndicators(){
  const [months,setMonths]=useState(6),[family,setFamily]=useState(''),[data,setData]=useState<IndicatorsData|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setError('');
    fetch('/api/epi-stock/indicators?months='+months+'&family='+encodeURIComponent(family),{signal:controller.signal,cache:'no-store'})
      .then(async response=>{const result=await response.json() as IndicatorsData;if(!response.ok)throw Error(result.error||'Indicateurs indisponibles.');return result})
      .then(result=>{if(!controller.signal.aborted){setData(result);setLoading(false)}})
      .catch(e=>{if(!controller.signal.aborted){setError((e as Error).message);setLoading(false)}});
    return()=>controller.abort();
  },[months,family]);
  const s=data?.summary;
  function exportCsv(){
    if(!data)return;
    const safe=(value:string|number)=>'"'+String(value).replace(/^[=+@\-\t\r]/,"'").replaceAll('"','""')+'"';
    const rows:(string|number)[][]=[
      ['Indicateurs EPI – période',data.period.start,data.period.endExclusive+' (exclue)'],
      ['Famille',data.period.family||'Toutes'],
      [],
      ['Mois','Sorties (unités)','Entrées (unités)','Coût connu des sorties HT (€)','Sorties sans prix (unités)'],
      ...data.monthly.map(m=>[m.month,m.issuedUnits,m.receivedUnits,(m.issuedCostCents/100).toFixed(2),m.unvaluedUnits]),
      [],
      ['Code QR','Référence fournisseur','EPI','Famille','Sorties (unités)','Coût connu HT (€)','Sorties sans prix (unités)'],
      ...data.top.map(p=>[p.code,p.reference,p.name,p.family,p.units,(p.costCents/100).toFixed(2),p.unvaluedUnits])
    ];
    const blob=new Blob(['\ufeff'+rows.map(row=>row.map(safe).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='polytechs-indicateurs-epi.csv';link.click();URL.revokeObjectURL(url);
  }
  return <section className="epi-indicators">
    <div className="epi-indicators-header"><div><h2>Consommation et coûts des EPI</h2><p>Sorties réelles du magasin, valorisation HT et suivi des références.</p></div><button className="outline" onClick={exportCsv} disabled={!data||loading}><ArrowDownToLine size={16}/> Exporter CSV</button></div>
    <div className="epi-indicators-filters"><div role="group" aria-label="Période des indicateurs"><span>Période</span>{[1,3,6,12].map(n=><button type="button" key={n} aria-pressed={months===n} onClick={()=>setMonths(n)}>{n} mois</button>)}</div><label>Famille d’EPI<select value={family} onChange={e=>setFamily(e.target.value)}><option value="">Toutes les familles</option>{(data?.families||[]).map(item=><option key={item} value={item}>{item}</option>)}</select></label></div>
    {error&&<p className="error" role="alert">{error}</p>}
    {loading?<section className="stock-card" role="status">Actualisation des indicateurs…</section>:data&&s&&<>
      <div className="epi-indicators-kpis">
        <article><small><ArrowUpFromLine size={15}/> Consommation</small><strong>{qty(s.issuedUnits)}</strong><span>unités sorties sur la période</span></article>
        <article><small><Coins size={15}/> Coût des sorties HT</small><strong>{isCostKnown(s.valuedIssuedUnits,s.unvaluedIssuedUnits)?euros(s.issuedCostCents):'—'}</strong><span>{s.unvaluedIssuedUnits>0?qty(s.unvaluedIssuedUnits)+' unité(s) sans prix à la sortie':'Sorties entièrement valorisées'}</span></article>
        <article><small><Wallet size={15}/> Valeur du stock HT</small><strong>{s.pricedReferences?euros(s.stockValueCents):'—'}</strong><span>{s.unvaluedStockReferences>0?qty(s.unvaluedStockReferences)+' référence(s) en stock sans prix':'Selon les prix actuellement renseignés'}</span></article>
        <article><small><ArrowDownToLine size={15}/> Entrées magasin</small><strong>{qty(s.receivedUnits)}</strong><span>unités reçues sur la période</span></article>
        <article><small><TriangleAlert size={15}/> Seuils atteints</small><strong>{qty(s.atRisk)}</strong><span>références inventoriées à réapprovisionner</span></article>
        <article><small>Couverture tarifaire</small><strong>{s.totalReferences?Math.round(s.pricedReferences/s.totalReferences*100):0} %</strong><span>{s.pricedReferences} / {s.totalReferences} référence(s) avec prix</span></article>
      </div>
      <p className="epi-indicators-help">La consommation correspond uniquement aux mouvements « Sortie », y compris les dotations remises. Les inventaires ne sont pas comptés comme consommation. Les coûts sont calculés au prix unitaire HT enregistré au moment du mouvement : une sortie ancienne sans prix reste non valorisée. Les montants affichés peuvent donc être partiels et ne représentent pas les factures fournisseurs.</p>
      <div className="epi-indicators-charts">
        <article className="stock-card"><h3>Évolution des sorties et entrées</h3><p>Quantités par mois</p><div className="epi-chart" role="img" aria-label="Histogramme mensuel des entrées et sorties EPI"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.monthly} margin={{left:-15,right:8,top:12,bottom:0}}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label" tick={{fontSize:11}}/><YAxis allowDecimals={false}/><Tooltip formatter={(value,name)=>[qty(Number(value)||0),name==='issuedUnits'?'Sorties':'Entrées']}/><Bar dataKey="issuedUnits" name="Sorties" fill="#624081" radius={[4,4,0,0]}/><Bar dataKey="receivedUnits" name="Entrées" fill="#53a59c" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div></article>
        <article className="stock-card"><h3>Coût des sorties connu (HT)</h3><p>Valorisation par mois — hors mouvements sans prix</p>{s.valuedIssuedUnits?<div className="epi-chart" role="img" aria-label="Histogramme mensuel des coûts de sortie connus"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.monthly} margin={{left:-15,right:8,top:12,bottom:0}}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label" tick={{fontSize:11}}/><YAxis tickFormatter={v=>qty(Number(v))}/><Tooltip formatter={value=>[euros(Math.round((Number(value)||0)*100)),'Coût HT connu']}/><Bar dataKey="issuedCostEur" name="Coût connu" fill="#9770b5" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>:<p className="epi-indicators-empty">Aucune sortie valorisée sur cette période. Renseignez les prix unitaires des EPI pour suivre les prochains coûts.</p>}</article>
      </div>
      <div className="epi-indicators-charts">
        <article className="stock-card"><h3>EPI les plus consommés</h3><div className="epi-indicators-table-wrap"><table><thead><tr><th>EPI / référence</th><th>Sorties</th><th>Coût connu HT</th></tr></thead><tbody>{data.top.map(p=><tr key={p.code}><td><strong>{p.name}</strong><small>{p.reference} · {p.family}</small></td><td>{qty(p.units)}</td><td>{p.valuedUnits?euros(p.costCents):p.unvaluedUnits?'—':euros(0)}{p.unvaluedUnits>0&&<small>{qty(p.unvaluedUnits)} sans prix</small>}</td></tr>)}{!data.top.length&&<tr><td colSpan={3}>Aucune sortie sur cette période.</td></tr>}</tbody></table></div></article>
        <article className="stock-card"><h3>Consommation par famille</h3><div className="epi-indicators-table-wrap"><table><thead><tr><th>Famille</th><th>Unités</th><th>Coût connu HT</th></tr></thead><tbody>{data.byFamily.map(p=><tr key={p.family}><td>{p.family}</td><td>{qty(p.units)}</td><td>{p.units===p.unvaluedUnits?'—':euros(p.costCents)}{p.unvaluedUnits>0&&<small>{qty(p.unvaluedUnits)} sans prix</small>}</td></tr>)}{!data.byFamily.length&&<tr><td colSpan={3}>Aucune sortie sur cette période.</td></tr>}</tbody></table></div></article>
      </div>
      <p className="epi-indicators-help">{s.notInventoried>0&&<>{qty(s.notInventoried)} référence(s) encore non inventoriée(s). </>}{s.unvaluedStockUnits>0&&<>{qty(s.unvaluedStockUnits)} unité(s) en stock n’ont pas de valeur connue. </>}La couverture tarifaire et le stock sont calculés sur le catalogue actuel ; les sorties historiques restent comptées même si une référence est devenue inactive.</p>
    </>}
  </section>;
}
