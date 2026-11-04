import assert from 'node:assert/strict';
import fs from 'node:fs';import ts from 'typescript';import QRCode from 'qrcode';import sharp from 'sharp';import jsQR from 'jsqr';
const source=ts.transpileModule(fs.readFileSync('lib/epi-qr.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {epiCodeFromQr}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
for(const url of ['https://polytechsconnect.fr/epi-stock/scan?code=EPI_001','https://old-host.onrender.com/epi-stock?code=ABC*123','https://polytechsconnect.fr/epi-stock/scan/?code=GANTS-01']){
 const png=await QRCode.toBuffer(url,{width:640,margin:2,errorCorrectionLevel:'M'}),{data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const result=jsQR(new Uint8ClampedArray(data),info.width,info.height,{inversionAttempts:'dontInvert'});assert.ok(result,'Camera decoder reads existing QR labels');assert.equal(epiCodeFromQr(result.data),new URL(url).searchParams.get('code'));
}
for(const url of ['javascript:alert(1)','https://example.com/elsewhere?code=EPI001','https://example.com/epi-stock/scan?code=x','https://example.com/epi-stock/scan?code=../../secret','https://example.com/epi-stock/scan','EPI001','garbage'])assert.equal(epiCodeFromQr(url),null);
console.log('EPI scanner: actual QR decoding, current/legacy labels, trailing slash and invalid destination/reference rejection passed.');
