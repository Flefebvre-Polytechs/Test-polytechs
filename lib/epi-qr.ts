/** Read existing EPI labels without navigating to a URL supplied by a QR code. */
export function epiCodeFromQr(value:string):string|null{
 try{
  const url=new URL(value);
  if(!['https:','http:'].includes(url.protocol)||!['/epi-stock','/epi-stock/scan'].includes(url.pathname.replace(/\/$/,'')))return null;
  const code=url.searchParams.get('code')||'';
  return /^[A-Za-z0-9*_-]{4,80}$/.test(code)?code:null;
 }catch{return null}
}
