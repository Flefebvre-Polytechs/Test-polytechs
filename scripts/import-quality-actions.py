import sys, json, zipfile, hashlib, datetime, xml.etree.ElementTree as E
from collections import Counter
path, output = sys.argv[1:]
n = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(path) as z:
    ss = [''.join(t.text or '' for t in e.iter('{'+n['m']+'}t')) for e in E.fromstring(z.read('xl/sharedStrings.xml'))]
    def sheet(number):
        rows = {}
        for row in E.fromstring(z.read(f'xl/worksheets/sheet{number}.xml')).findall('.//m:sheetData/m:row', n):
            cells = {}
            for c in row:
                v = c.find('m:v', n); value = v.text if v is not None else ''.join(t.text or '' for t in c.findall('.//m:t', n))
                if c.get('t') == 's' and value: value = ss[int(value)]
                if value: cells[''.join(x for x in c.get('r') if x.isalpha())] = value
            if cells: rows[int(row.get('r'))] = cells
        return rows
    def date(s):
        try: return (datetime.datetime(1899,12,30)+datetime.timedelta(days=float(s))).date().isoformat()
        except (ValueError, TypeError): return s or ''
    def num(s):
        try: return float(s)
        except (ValueError, TypeError): return None
    params = sheet(4)
    owners = {r['H']:r.get('I','') for r in params.values() if r.get('H') and r.get('I') and r.get('H') != 'Processus / Service'}
    records = []
    fields = {'B':'reference','D':'service','E':'origin','F':'problem','G':'objective','H':'method','I':'action','N':'target','T':'validation','V':'status','W':'comment','Z':'criterion'}
    numbers = {'J':'hours','K':'cost','M':'gravity','O':'exposure','X':'usedHours','Y':'usedCost','AA':'afterGravity','AB':'afterExposure'}
    for row,r in sheet(2).items():
        if row < 6 or not r.get('A','').isdigit(): continue
        a = dict(id='quality-source-'+str(row),revision=0,sourceRow=row,raw=r,created=date(r.get('C','')),due=date(r.get('U','')),sourceClass=r.get('Q',''),sourceEffective=r.get('AE',''),sourceNewAction=r.get('AF',''),pilot=owners.get(r.get('D',''),''),pilotId='',teamId='',ticketId='',gedId='',effectiveEvidence='',verifiedAt='',verifiedBy='',verificationNote='')
        a.update({k:r.get(c,'') for c,k in fields.items()}); a.update({k:num(r.get(c)) for c,k in numbers.items()});records.append(a)
    source = dict(source="PLAN D'ACTIONS QUALITE GENERAL.xlsx",sha256=hashlib.sha256(open(path,'rb').read()).hexdigest(),records=records,owners=owners,guide=[{'row':row,'raw':r} for row,r in sheet(1).items()],trace=[{'row':row,'raw':r} for row,r in sheet(5).items()],methods=[r['D'] for row,r in params.items() if row>=5 and r.get('D')],origins=[r['Q'] for row,r in params.items() if row>=5 and r.get('Q')])
    if not records:
        raise ValueError("Le classeur ne contient aucune action.")
    with open(output,'w') as f: json.dump(source,f,ensure_ascii=False,separators=(',',':'))
    print(json.dumps({'records':len(records),'statuses':dict(Counter(r['status'] for r in records)),'classes':dict(Counter(r['sourceClass'] for r in records))},ensure_ascii=False))
