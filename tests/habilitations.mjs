import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {qrPath,QR_VIEWBOX} from '../lib/qr-code.ts';
import {currentStatus,isValidDate,nextDeadline,statusLabel} from '../lib/habilitations.ts';

assert.equal(QR_VIEWBOX,49);
const url='https://polytechsconnect.fr/habilitation/'+'0123456789abcdef'.repeat(4);
assert.equal(createHash('sha256').update(qrPath(url)).digest('hex'),'27d9b75c9b5bb9a0e5ad615b9a9c0e3850690c567f6b8e2ea334610b643ae166','QR output must match the QR ISO matrix v6-L, mask 0');
assert.throws(()=>qrPath('a'.repeat(135)),/trop longue/);

const jsQR=(await import('jsqr')).default;
const scale=5,width=QR_VIEWBOX*scale,pixels=new Uint8ClampedArray(width*width*4);
for(let p=0;p<pixels.length;p+=4)pixels[p]=pixels[p+1]=pixels[p+2]=pixels[p+3]=255;
for(const [,xs,ys] of qrPath(url).matchAll(/M(\d+) (\d+)h1v1h-1z/g)){
 const x=Number(xs),y=Number(ys);
 for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){
  const offset=((y*scale+dy)*width+x*scale+dx)*4;
  pixels[offset]=pixels[offset+1]=pixels[offset+2]=0;
 }
}
const decoded=jsQR(pixels,width,width,{inversionAttempts:'dontInvert'});
assert.equal(decoded?.data,url,'Generated badge QR must actually decode on a scanner');

const record={status:'active',valid_from:'2026-01-01',valid_until:'2026-12-31',training_until:'',medical_until:'',prerequisites_checked:1,kind:'Autorisation de conduite'};
assert.equal(currentStatus(record,'2026-11-09'),'valid');
assert.equal(currentStatus({...record,valid_until:'2026-11-08'},'2026-11-09'),'expired');
assert.equal(currentStatus({...record,training_until:'2026-10-01'},'2026-11-09'),'expired');
assert.equal(currentStatus({...record,medical_until:'2026-10-01'},'2026-11-09'),'expired');
assert.equal(currentStatus({...record,prerequisites_checked:0},'2026-11-09'),'draft');
assert.equal(currentStatus({...record,valid_from:'2026-12-01'},'2026-11-09'),'pending');
assert.equal(currentStatus({...record,status:'suspended'},'2026-11-09'),'suspended');
assert.equal(currentStatus({...record,status:'revoked'},'2026-11-09'),'revoked');
assert.equal(nextDeadline({...record,valid_until:'2027-01-01',training_until:'2026-12-08',medical_until:'2026-11-10'}),'2026-11-10');
assert.equal(statusLabel.valid,'Valide');
assert.equal(isValidDate('2026-02-29'),false);
assert.equal(isValidDate('2028-02-29'),true);
console.log('Habilitation status and private QR generator checks passed.');
