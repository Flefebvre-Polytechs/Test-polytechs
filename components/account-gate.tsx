'use client';
import {useEffect,useState} from 'react';
import {GlobalMembersPanel} from '@/components/global-members-panel';
import {NotificationGate} from '@/components/notification-gate';
import {ProfileProvider} from '@/components/profile';
import {MailCheck,ShieldCheck,ArrowLeft} from 'lucide-react';
export type Account={id:string;username:string;displayName:string;role:'admin'|'editor'|'reader';mustChangePassword:boolean;email?:string|null};
async function auth(body:Record<string,string>){const res=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data:any=await res.json();if(!res.ok)throw Error(data.error||'Connexion impossible.');return data}
export function AccountGate({children}:{children:(account:Account,logout:()=>void)=>React.ReactNode}){
 const [account,setAccount]=useState<Account|null>(null),[ready,setReady]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[username,setUsername]=useState(''),[password,setPassword]=useState(''),[newPassword,setNewPassword]=useState(''),[confirmPassword,setConfirmPassword]=useState(''),[busy,setBusy]=useState(false),[mode,setMode]=useState<'login'|'code'|'forgot'|'reset'>('login'),[challenge,setChallenge]=useState(''),[code,setCode]=useState(''),[destination,setDestination]=useState(''),[expiresAt,setExpiresAt]=useState(0),[resetToken,setResetToken]=useState('');
 useEffect(()=>{const token=new URLSearchParams(window.location.hash.slice(1)).get('reset');if(token){setResetToken(token);setMode('reset');window.history.replaceState(null,'',window.location.pathname+window.location.search)}fetch('/api/auth',{cache:'no-store'}).then(async r=>{const d:any=await r.json();if(!r.ok)throw Error(d.error);setAccount(token?null:d.account)}).catch(e=>setError(e.message)).finally(()=>setReady(true))},[]);
 function back(){setMode('login');setChallenge('');setCode('');setResetToken('');setError('');setNotice('');setPassword('');setNewPassword('');setConfirmPassword('')}
 async function submit(e:React.FormEvent){e.preventDefault();setError('');setNotice('');setBusy(true);try{
  if(mode==='forgot'){const data=await auth({action:'forgot-password',identifier:username});setNotice(data.message);return;}
  if(mode==='reset'){
   if(newPassword!==confirmPassword)throw Error('Les mots de passe ne correspondent pas.');
   await auth({action:'reset-password',token:resetToken,newPassword});back();setNotice('Mot de passe réinitialisé. Connectez-vous avec votre nouveau mot de passe.');return;
  }
  if(account?.mustChangePassword&&newPassword!==confirmPassword)throw Error('Les mots de passe ne correspondent pas.');
  const data=account?.mustChangePassword?await auth({action:'password',oldPassword:password,newPassword}):mode==='code'?await auth({action:'verify-email',challenge,code}):await auth({action:'login',email:username,password});
  setPassword('');setNewPassword('');setConfirmPassword('');
  if(data.requiresEmailCode){setChallenge(data.challenge);setDestination(data.destination);setExpiresAt(data.expiresAt);setMode('code');setCode('');return;}
  setAccount(data.account);setMode('login');setChallenge('');setCode('');
 }catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function logout(){try{await auth({action:'logout'})}finally{setAccount(null);back()}}
 if(!ready)return <div className="login-page"><p role="status">Ouverture de l’espace QSE…</p></div>;
 if(account&&!account.mustChangePassword&&mode==='login')return <ProfileProvider account={account} logout={logout}><NotificationGate logout={logout}>{children(account,logout)}</NotificationGate></ProfileProvider>;
 const changing=!!account?.mustChangePassword&&mode==='login';
 const title=changing?'Sécuriser votre compte':mode==='code'?'Vérifiez votre identité':mode==='forgot'?'Mot de passe oublié':mode==='reset'?'Nouveau mot de passe':'Connexion';
 return <main className="login-page"><section className="login-card auth-card"><img src="/polytechs-logo.png" width="180" height="100" alt="Polytechs"/><span className="brand-sub">POLYTECHS CONNECT</span>{mode==='code'&&<div className="auth-emblem"><MailCheck size={27}/></div>}<h1>{title}</h1><p>{changing?'Choisissez un nouveau mot de passe avant d’accéder à votre espace.':mode==='code'?<>Saisissez le code envoyé à <strong data-no-translate>{destination}</strong>.</>:mode==='forgot'?'Indiquez l’adresse e-mail associée à votre compte.':mode==='reset'?'Choisissez un mot de passe personnel de 12 caractères minimum.':'Connectez-vous à votre espace de travail.'}</p>
 <form onSubmit={submit} aria-busy={busy}>
 {(mode==='forgot'||(mode==='login'&&!changing))&&<label>Adresse e-mail<input inputMode="email" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required maxLength={254} autoFocus disabled={busy}/></label>}
 {mode==='login'&&<label>{changing?'Mot de passe actuel':'Mot de passe'}<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required maxLength={256} disabled={busy}/></label>}
 {mode==='code'&&<><label>Code de vérification<input className="auth-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} required autoFocus disabled={busy}/></label><small>Code valable 10 minutes · 5 essais maximum</small>{expiresAt>0&&<small>Expire à {new Date(expiresAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</small>}</>}
 {(changing||mode==='reset')&&<><label>Nouveau mot de passe<input type="password" autoComplete="new-password" minLength={12} maxLength={256} value={newPassword} onChange={e=>setNewPassword(e.target.value)} required disabled={busy}/></label><label>Confirmer le mot de passe<input type="password" autoComplete="new-password" minLength={12} maxLength={256} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required disabled={busy}/></label></>}
 {error&&<p role="alert" className="error">{error}</p>}{notice&&<p role="status" className="success">{notice}</p>}
 <button className="primary" disabled={busy}>{busy?'Veuillez patienter…':changing||mode==='reset'?'Enregistrer le mot de passe':mode==='code'?'Vérifier et se connecter':mode==='forgot'?'Envoyer le lien':'Se connecter'}</button>
 </form>
 {mode==='login'&&!changing&&<button type="button" className="text-link" disabled={busy} onClick={()=>{setMode('forgot');setPassword('');setError('');setNotice('')}}>Mot de passe oublié ?</button>}
 {mode!=='login'&&<button type="button" className="text-link auth-back" disabled={busy} onClick={back}><ArrowLeft size={15}/>{mode==='code'?'Recommencer / demander un nouveau code':'Retour à la connexion'}</button>}
 {changing&&<button type="button" className="text-link" onClick={logout} disabled={busy}>Changer de compte</button>}
 <p className="auth-security"><ShieldCheck size={14}/> Accès personnel et sécurisé</p></section></main>
}

export function AccountPanel({account}:{account:Account}){return <GlobalMembersPanel account={account}/>;}
