import sys,json,datetime,hashlib
from openpyxl import load_workbook
from openpyxl.utils import get_column_letter

path,output=sys.argv[1:]
w=load_workbook(path,read_only=True,data_only=True)
records=[]
def text(value):
 if value is None:return ''
 if isinstance(value,(datetime.datetime,datetime.date)):return value.isoformat()[:10]
 return str(value).strip()
def date(value):
 return text(value) if isinstance(value,(datetime.datetime,datetime.date)) and value.year>=2000 else ''
def base(kind,sheet,row):
 return dict(id='vgp-source-'+hashlib.sha256((sheet+':'+str(row)).encode()).hexdigest()[:24],revision=1,controlId='',kind=kind,title='',domain=sheet,location='',reference='',provider='',pilotId='',lastDate='',due='',plannedDate='',months=None,regulatory='',status='À qualifier',description='',note='',ticketId='',sourceSheet=sheet,sourceRow=row,raw={})
for s in w:
 rows=list(s.iter_rows(max_col=min(s.max_column,100),values_only=True))
 headers=[text(v) for v in rows[0]]
 for number,row in enumerate(rows,1):
  get=lambda c:row[c-1] if c<=len(row) else None
  if s.title=='Récapitulatif':
   if number<6 or not get(2):continue
   r=base('control',s.title,number)
   r.update(title=text(get(2)),domain=text(get(1)).capitalize(),reference=text(get(4)),provider=text(get(17)),lastDate=date(get(18)),due=date(get(19)),description=text(get(14)),note=text(get(26)))
   frequency=get(5)
   r['months']=int(frequency) if isinstance(frequency,(int,float)) and frequency>0 else None
   r['regulatory']={'oui':'Oui','non':'Non'}.get(text(get(12)).lower(),'')
   header=[text(v) for v in rows[4]]
  else:
   if number<2:continue
   header=headers
   if s.title=='Mécanique 2024-2':cols=(3,2,6,5,0,9)
   elif s.title=='Mécanique 2025-1':cols=(4,1,8,6,20,10)
   elif s.title=='Presses':cols=(2,1,5,4,8,9)
   elif s.title=='Presse 07-2025':cols=(17,15,11,18,25,24)
   else:cols=(3,2,4,1,0,5)
   title,location,description,reference,due,last=cols
   if not text(get(description)):continue
   r=base('observation',s.title,number)
   r.update(title=(text(get(title)) or text(get(description)))[:300],location=text(get(location)),reference=text(get(reference)),description=text(get(description)),due=date(get(due)) if due else '',lastDate=date(get(last)) if last else '')
  r['raw']={get_column_letter(i+1)+' · '+(header[i] if i<len(header) else ''):text(v) for i,v in enumerate(row) if v is not None}
  records.append(r)
assert records and len({r['id'] for r in records})==len(records)
with open(output,'w') as f:json.dump({'records':records},f,ensure_ascii=False,separators=(',',':'))
from collections import Counter
print(json.dumps(dict(Counter(r['kind'] for r in records))))
