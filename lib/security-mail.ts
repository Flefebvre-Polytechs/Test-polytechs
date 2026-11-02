// Server-only Microsoft 365 transport. Never log credentials, codes or reset links.
export const validEmail=(email:string)=>email.length<=254&&/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email);
export function mailConfigured(){return ['POLYTECHS_MAIL_TENANT_ID','POLYTECHS_MAIL_CLIENT_ID','POLYTECHS_MAIL_CLIENT_SECRET','POLYTECHS_MAIL_FROM'].every(key=>!!process.env[key])}
export function emailMfaRequired(){return process.env.POLYTECHS_EMAIL_MFA_REQUIRED==='true'}
export function publicOrigin(){const value=process.env.POLYTECHS_PUBLIC_ORIGIN||process.env.RENDER_EXTERNAL_URL;if(!value)throw Error('Configure POLYTECHS_PUBLIC_ORIGIN.');const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password)throw Error('HTTPS origin required.');return url.origin}
export async function sendSecurityMail(to:string,subject:string,text:string){
 if(!mailConfigured()||!validEmail(to))throw Error('Security mail unavailable.');
 const tenant=process.env.POLYTECHS_MAIL_TENANT_ID!,from=process.env.POLYTECHS_MAIL_FROM!;
 if(!/^[a-zA-Z0-9.-]+$/.test(tenant)||!validEmail(from))throw Error('Invalid mail configuration.');
 const tokenResponse=await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:process.env.POLYTECHS_MAIL_CLIENT_ID!,client_secret:process.env.POLYTECHS_MAIL_CLIENT_SECRET!,scope:'https://graph.microsoft.com/.default',grant_type:'client_credentials'}),signal:AbortSignal.timeout(10000),cache:'no-store'});
 if(!tokenResponse.ok)throw Error('Microsoft 365 authorization failed.');
 const token=await tokenResponse.json() as {access_token?:string};if(!token.access_token)throw Error('Microsoft 365 authorization failed.');
 const response=await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}/sendMail`,{method:'POST',headers:{Authorization:`Bearer ${token.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({message:{subject,body:{contentType:'Text',content:text},toRecipients:[{emailAddress:{address:to}}]},saveToSentItems:false}),signal:AbortSignal.timeout(10000),cache:'no-store'});
 if(response.status!==202)throw Error('Microsoft 365 did not accept the message.');
}
