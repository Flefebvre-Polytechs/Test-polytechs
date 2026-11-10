/** Import pasted monthly production and water readings without guessing year or site. */
export type WaterImportRow={month:number;production:number;water:number};
const monthNames=['janvier','fevrier','mars','avril','mai','juin','juillet','aout','septembre','octobre','novembre','decembre'];
const fold=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr').trim();
export function frenchDecimal(raw:string){
 const clean=raw.replace(/[\u00a0\u202f]/g,' ').trim();
 if(!/^(?:\d{1,3}(?: \d{3})+|\d+)(?:[,.]\d{1,4})?$/.test(clean))return null;
 const value=Number(clean.replaceAll(' ','').replace(',','.'));
 return Number.isFinite(value)&&value>=0&&value<=1e9?value:null;
}
export function parseWaterTable(input:string):{rows:WaterImportRow[];errors:string[]}{
 if(input.length>10000)return {rows:[],errors:['Le tableau dépasse 10 000 caractères.']};
 const rows:WaterImportRow[]=[],errors:string[]=[],seen=new Set<number>();
 for(const [index,line] of input.split(/\r?\n/).entries()){
  if(!line.trim()||/^\s*[|\-+:\s]+$/.test(line))continue;
  const cells=line.includes('|')?line.split('|').map(x=>x.trim()).filter(Boolean):line.includes('\t')?line.split('\t').map(x=>x.trim()):line.split(';').map(x=>x.trim());
  if(cells.length<3)continue;
  const first=fold(cells[0]).replace(/\.$/,'');
  const monthIndex=monthNames.findIndex(name=>name===first||name.slice(0,3)===first&&first.length===3);
  if(monthIndex<0)continue; // Headings, separator rows and footers are not input records.
  const month=monthIndex+1;
  const production=frenchDecimal(cells[1]),water=frenchDecimal(cells[2]);
  if(seen.has(month)){errors.push('Ligne '+(index+1)+' : mois '+cells[0]+' en double.');continue}
  seen.add(month);
  if(production===null||water===null){errors.push('Ligne '+(index+1)+' : production ou eau invalide (4 décimales au maximum).');continue}
  rows.push({month,production,water});
 }
 rows.sort((a,b)=>a.month-b.month);
 if(rows.length===0&&!errors.length)errors.push('Aucun mois valide détecté. Collez trois colonnes : mois, tonnes produites, consommation d’eau en m³.');
 return {rows,errors};
}
export const waterImportMonthName=(month:number)=>monthNames[month-1]?monthNames[month-1][0].toUpperCase()+monthNames[month-1].slice(1):'';
