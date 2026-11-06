import json,datetime,re,sys,zipfile,xml.etree.ElementTree as E
from pathlib import Path
def read_book(path):
 z=zipfile.ZipFile(path);n={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
 ss=[''.join(t.itertext()) for t in E.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si',n)] if 'xl/sharedStrings.xml' in z.namelist() else []
 rels={r.get('Id'):r.get('Target') for r in E.fromstring(z.read('xl/_rels/workbook.xml.rels'))};out={}
 for sheet in E.fromstring(z.read('xl/workbook.xml')).findall('m:sheets/m:sheet',n):
  target=rels[sheet.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')];target=target.lstrip('/') if target.startswith('/') else 'xl/'+target
  rows={}
  for row in E.fromstring(z.read(target)).findall('m:sheetData/m:row',n):
   cells={}
   for c in row.findall('m:c',n):
    v=c.find('m:v',n);inline=c.find('m:is',n);value=v.text if v is not None else ''.join(inline.itertext()) if inline is not None else None
    if value is None:continue
    if c.get('t')=='s':value=ss[int(value)]
    elif c.get('t') not in ('str','inlineStr','e'):
     try:value=float(value)
     except ValueError:pass
    cells[c.get('r')]=value
   if cells:rows[row.get('r')]=cells
  out[sheet.get('name')]=rows
 return out
if len(sys.argv)!=4:raise SystemExit('Usage: python scripts/import-qsse-budget.py suivi.xlsx forecast.xlsx private-output.json')
b=read_book(sys.argv[1]);f=read_book(sys.argv[2]);records=[]
files=[Path(sys.argv[1]).name,Path(sys.argv[2]).name]
def val(c,k,r):return c.get(k+str(r))
def txt(v):return '' if v is None else str(int(v)) if isinstance(v,float) and v.is_integer() else str(v).strip()
def base(id,kind,section,sheet,row,source,c):return dict(id=id,kind=kind,section=section,label='',account='',date='',dateSource='',reference='',category='',amount=None,status='Suivi',actual2025=None,actual2026=None,budgetYtd2026=None,budget2026=None,forecast2026=None,budget2027=None,months=[None]*12,notes='',source=source,sheet=sheet,row=row,raw=c,revision=0)
for sheet,section in [('2500 - 2026','2500'),('2600 - 2026','2600'),('4520 - 2026','4520'),('Interim 2026','interim')]:
 for r,c in b[sheet].items():
  if int(r)<2:continue
  core={k:v for k,v in c.items() if re.match(r'^[B-H]\d+$',k)}
  if not core:continue
  d=base('order-'+section+'-'+r,'order',section,sheet,int(r),files[0],core)
  v=val(c,'D',r);d['amount']=round(v,2) if isinstance(v,(int,float)) else None
  date=val(c,'B',r);d['dateSource']=txt(date)
  if isinstance(date,(int,float)) and 40000<date<60000:d['date']=(datetime.datetime(1899,12,30)+datetime.timedelta(days=date)).strftime('%Y-%m-%d')
  d['reference']=txt(val(c,'C',r))
  if section=='2500':d['category']=txt(val(c,'E',r));d['label']=txt(val(c,'F',r)) or d['category']
  else:d['label']=txt(val(c,'F' if section=='2600' else 'E',r));d['account']=txt(val(c,'E',r)) if section=='2600' else ''
  d['label']=d['label'] or ('Commande '+d['reference'] if d['reference'] else 'Ligne à compléter')
  d['notes']=' · '.join(k+' : '+txt(v) for k,v in core.items() if k.startswith(('G','H')) or section in ('4520','interim') and k.startswith('F'))
  text=' '.join(map(txt,core.values())).lower()
  d['status']='Annulée' if 'annul' in text else 'Non validée' if 'non valid' in text else 'À vérifier' if not d['date'] or d['amount'] is None else 'Suivi'
  records.append(d)
for section,rows in f.items():
 if section=='Données':continue
 for r,c in rows.items():
  if not 11<=int(r)<=34:continue
  d=base('account-'+section+'-'+r,'account',section,section,int(r),files[1],c)
  d['account']=txt(val(c,'D',r));d['label']=txt(val(c,'E',r));d['notes']='\n'.join(label+': '+txt(val(c,col,r)) for col,label in [('J','Réalisé juillet 2026'),('P','Prévisionnel 2026'),('T','Budget 2027')] if val(c,col,r) is not None)
  for col,key in [('F','actual2026'),('G','budgetYtd2026'),('K','actual2025'),('L','budget2026'),('M','forecast2026'),('Q','budget2027')]:
   v=val(c,col,r);d[key]=round(-v,2) if isinstance(v,(int,float)) else None
  d['months']=[round(-val(c,col,r),2) if isinstance(val(c,col,r),(int,float)) else None for col in ['U','V','W','X','Y','Z','AA','AB','AC','AD','AE','AF']]
  # Preserve supplied monthly rounding; do not silently adjust the last month.
  records.append(d)
metadata=dict(files=files,period='Janvier à juillet 2026',notes=['Les charges comptables négatives sont affichées en dépenses positives. Les montants d’origine sont conservés dans chaque ligne.','Les commandes et le réalisé comptable sont deux suivis distincts : ils ne sont pas additionnés.','La période 2026 / budget 2027 suit les cellules de paramétrage et les en-têtes dynamiques. La ligne 10 du fichier contient des libellés anciens.','Les cellules vides restent non renseignées. Les mensualisations sont reprises sans correction automatique.'],sourceSummaries={s:rows if s=='TDB Budgets ' else {r:{k:v for k,v in c.items() if not re.match(r'^[B-H]\d+$',k)} for r,c in rows.items()} for s,rows in b.items()})
Path(sys.argv[3]).write_text(json.dumps(dict(records=records,metadata=metadata),ensure_ascii=False))
print('Records',len(records),'orders',sum(r['kind']=='order' for r in records),'accounts',sum(r['kind']=='account' for r in records))
for section in ['2500','2600','4520']:
 for col,key in [('F','actual2026'),('G','budgetYtd2026'),('K','actual2025'),('L','budget2026'),('M','forecast2026'),('Q','budget2027')]:
  got=round(sum(r[key] or 0 for r in records if r['kind']=='account' and r['section']==section),2);want=round(-f[section]['35'][col+'35'],2);assert abs(got-want)<=.02,(section,key,got,want)
print('Source accounting totals reconciled for all 18 section/period totals')
