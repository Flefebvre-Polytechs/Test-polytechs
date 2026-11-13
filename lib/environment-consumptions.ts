/** Reference catalog for the environment consumption register.
 *  All values are manually recorded from actual invoices, meters or reports.
 *  Never derive carbon factors, physical equivalences or missing values.
 */
export const environmentSections=[
 {id:'activity',label:'Activité',description:'Volume fabriqué et activité des installations.',intro:'Reliez la performance environnementale à la production réellement déclarée.'},
 {id:'energy',label:'Énergies',description:'Électricité, gaz et carburants.',intro:'Comparez les consommations réelles, les cibles et l’intensité énergétique.'},
 {id:'renewable',label:'Énergies renouvelables',description:'Production et autoconsommation solaire.',intro:'Distinguez la production renouvelable, l’autoconsommation et les achats garantis.'},
 {id:'resources',label:'Utilisation des ressources',description:'Matières, emballages et déchets.',intro:'Mesurez la consommation de matières et l’intégration de recyclé.'},
 {id:'water',label:'Utilisations de l’eau',description:'Eau de ville, réutilisation et rejets.',intro:'La consommation suivie correspond exclusivement à l’eau du réseau d’eau de ville. La réutilisation et les rejets sont suivis séparément.'}
] as const;
export type EnvironmentSection=(typeof environmentSections)[number]['id'];
export const environmentMetrics=[
 {key:'production_t',section:'activity',label:'Production réalisée',unit:'t',direction:'min',description:'Tonnes de produits effectivement fabriquées.'},
 {key:'operating_h',section:'activity',label:'Heures de fonctionnement',unit:'h',direction:'min',description:'Heures cumulées des lignes selon la méthode retenue par le site.'},
 {key:'electricity_grid_kwh',section:'energy',label:'Électricité réseau',unit:'kWh',direction:'max',description:'Électricité prélevée sur le réseau, hors autoconsommation solaire.'},
 {key:'natural_gas_kwh',section:'energy',label:'Gaz naturel',unit:'kWh',direction:'max',description:'Énergie facturée en kWh (pouvoir calorifique selon facture).'},
 {key:'fuel_l',section:'energy',label:'Carburants',unit:'L',direction:'max',description:'Volumes consommés en litres, sans conversion automatique en kWh.'},
 {key:'solar_generated_kwh',section:'renewable',label:'Production photovoltaïque',unit:'kWh',direction:'min',description:'Énergie solaire produite, qu’elle soit autoconsommée ou injectée.'},
 {key:'solar_self_kwh',section:'renewable',label:'Autoconsommation solaire',unit:'kWh',direction:'min',description:'Part de la production photovoltaïque directement consommée sur le site.'},
 {key:'renewable_purchased_kwh',section:'renewable',label:'Électricité renouvelable achetée',unit:'kWh',direction:'min',description:'Achats couverts par une garantie d’origine ; peuvent être inclus dans l’électricité réseau.'},
 {key:'virgin_material_t',section:'resources',label:'Matières vierges consommées',unit:'t',direction:'max',description:'Matières vierges effectivement mises en œuvre.'},
 {key:'recycled_material_t',section:'resources',label:'Matières recyclées consommées',unit:'t',direction:'min',description:'Matières recyclées incorporées à la production.'},
 {key:'packaging_t',section:'resources',label:'Emballages utilisés',unit:'t',direction:'max',description:'Emballages consommés, toutes matières confondues.'},
 {key:'waste_t',section:'resources',label:'Déchets générés',unit:'t',direction:'max',description:'Déchets du site en tonnes. À rapprocher du registre des déchets ; pas de synchronisation automatique.'},
 {key:'water_consumed_m3',section:'water',label:'Consommation d’eau de ville',unit:'m³',direction:'max',description:'Volume consommé provenant exclusivement du réseau public d’eau de ville, selon les compteurs ou les factures du site.'},
 {key:'water_network_m3',section:'water',label:'Eau du réseau',unit:'m³',direction:'max',description:'Volume prélevé auprès du réseau public.'},
 {key:'water_other_m3',section:'water',label:'Autres prélèvements d’eau',unit:'m³',direction:'max',description:'Eau de forage ou autre ressource, si applicable et mesurée.'},
 {key:'water_reused_m3',section:'water',label:'Eau réutilisée',unit:'m³',direction:'min',description:'Volume d’eau réemployé dans les procédés.'},
 {key:'water_discharge_m3',section:'water',label:'Eaux rejetées',unit:'m³',direction:'max',description:'Volume des rejets mesurés, distinct des prélèvements.'}
] as const;
export type EnvironmentMetric=(typeof environmentMetrics)[number]['key'];
export type EnvironmentSite='site-1'|'site-2';
export type EnvironmentScope=EnvironmentSite|'all';
export const environmentSites=[{id:'site-1',label:'Site 1 · Production'},{id:'site-2',label:'Site 2 · Produits finis'}] as const;
export type EnvironmentEntry={id:string;site:EnvironmentSite;metric:EnvironmentMetric;period:string;value:number|null;target:number|null;note:string;revision:number;updated_at:string;updated_by:string};
export const environmentMetricKeys=new Set<string>(environmentMetrics.map(m=>m.key));
export function metricInfo(key:string){return environmentMetrics.find(m=>m.key===key)}
export function validMonth(s:string){return /^(20\d\d|2100)-(0[1-9]|1[0-2])$/.test(s)}
export function currentMonth(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit'}).format(new Date())}
export function monthsEnding(period:string,count:number){if(!validMonth(period)||!Number.isInteger(count)||count<1||count>36)return [];const [y,m]=period.split('-').map(Number);return Array.from({length:count},(_,i)=>{const d=new Date(Date.UTC(y,m-1-(count-1-i),1));return d.toISOString().slice(0,7)})}
export function formatEnvironmentNumber(n:number|null,maximumFractionDigits=4){return n===null?'—':n.toLocaleString('fr-FR',{maximumFractionDigits})}
export function sumEnvironment(entries:EnvironmentEntry[],metric:EnvironmentMetric,periods:string[],scope:EnvironmentScope,field:'value'|'target'='value'){
 const selected=entries.filter(r=>r.metric===metric&&periods.includes(r.period)&&(scope==='all'||r.site===scope)&&r[field]!==null);
 const count=selected.length,expected=periods.length*(scope==='all'?2:1);
 return {value:count?selected.reduce((sum,r)=>sum+(r[field]??0),0):null,count,expected,partial:count>0&&count<expected};
}
export function monthlyEnvironment(entries:EnvironmentEntry[],metric:EnvironmentMetric,periods:string[],scope:EnvironmentScope){
 return periods.map(period=>({period,label:new Date(period+'-01T12:00:00Z').toLocaleDateString('fr-FR',{month:'short',year:'2-digit',timeZone:'UTC'}),actual:sumEnvironment(entries,metric,[period],scope).value,target:sumEnvironment(entries,metric,[period],scope,'target').value}));
}
/** Ratios are calculated only over matched site-month cells, never over disjoint periods. */
export function environmentPaired(entries:EnvironmentEntry[],first:EnvironmentMetric,second:EnvironmentMetric,periods:string[],scope:EnvironmentScope){
 const sites=scope==='all'?environmentSites.map(s=>s.id):[scope];
 let firstTotal=0,secondTotal=0,count=0;
 for(const site of sites)for(const period of periods){
  const a=entries.find(r=>r.site===site&&r.period===period&&r.metric===first&&r.value!==null);
  const b=entries.find(r=>r.site===site&&r.period===period&&r.metric===second&&r.value!==null);
  if(!a||!b)continue;
  firstTotal+=a.value!;secondTotal+=b.value!;count++;
 }
 return {firstTotal,secondTotal,count,expected:sites.length*periods.length,partial:count<sites.length*periods.length};
}
export function environmentIntensity(entries:EnvironmentEntry[],numerator:EnvironmentMetric,periods:string[],scope:EnvironmentScope){
 const pair=environmentPaired(entries,numerator,'production_t',periods,scope);
 return {value:pair.count&&pair.secondTotal>0?pair.firstTotal/pair.secondTotal:null,partial:pair.partial,count:pair.count,expected:pair.expected};
}
export function environmentShare(entries:EnvironmentEntry[],part:EnvironmentMetric,complement:EnvironmentMetric,periods:string[],scope:EnvironmentScope){
 const pair=environmentPaired(entries,part,complement,periods,scope);
 const total=pair.firstTotal+pair.secondTotal;
 return {value:pair.count&&total>0?100*pair.firstTotal/total:null,partial:pair.partial,count:pair.count,expected:pair.expected};
}
