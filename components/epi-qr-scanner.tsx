'use client';
import {useEffect,useRef,useState} from 'react';
import {Camera,X} from 'lucide-react';
import {epiCodeFromQr} from '@/lib/epi-qr';

export function EpiQrScanner({onScan,onClose}:{onScan:(code:string)=>void;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),video=useRef<HTMLVideoElement>(null);
 const [error,setError]=useState(''),[ready,setReady]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{const element=dialog.current;element?.showModal();return()=>element?.close()},[]);
 useEffect(()=>{
  let cancelled=false,stream:MediaStream|undefined,timer:ReturnType<typeof setTimeout>|undefined;
  setError('');setReady(false);
  const stop=()=>{cancelled=true;if(timer)clearTimeout(timer);stream?.getTracks().forEach(track=>track.stop())};
  const hide=()=>{if(document.hidden){stop();onClose()}};document.addEventListener('visibilitychange',hide);
  async function start(){try{
   if(!navigator.mediaDevices?.getUserMedia)throw Error('La caméra nécessite une connexion HTTPS et un navigateur compatible.');
   stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}});
   if(cancelled){stream.getTracks().forEach(track=>track.stop());return}
   const element=video.current;if(!element)return;
   element.srcObject=stream;await element.play();const {default:decode}=await import('jsqr');
   if(cancelled)return;setReady(true);
   const canvas=document.createElement('canvas'),context=canvas.getContext('2d',{willReadFrequently:true});
   if(!context)throw Error('Lecture de la caméra indisponible.');
   function read(){if(cancelled)return;
    if(element!.readyState>=2&&element!.videoWidth){
     const scale=Math.min(1,640/element!.videoWidth);canvas.width=Math.round(element!.videoWidth*scale);canvas.height=Math.round(element!.videoHeight*scale);
     context!.drawImage(element!,0,0,canvas.width,canvas.height);const pixels=context!.getImageData(0,0,canvas.width,canvas.height);
     const result=decode(pixels.data,canvas.width,canvas.height,{inversionAttempts:'dontInvert'});
     if(result){const code=epiCodeFromQr(result.data);if(code){stop();onScan(code);return}setError('Ce QR code ne correspond pas à une étiquette EPI. Présentez une autre étiquette.');}
    }
    timer=setTimeout(read,180);
   }read();
  }catch(e){stream?.getTracks().forEach(track=>track.stop());if(cancelled)return;const name=(e as Error).name;setError(name==='NotAllowedError'?'Autorisez l’accès à la caméra dans les réglages de votre navigateur, puis réessayez.':name==='NotFoundError'?'Aucune caméra disponible sur cet appareil.':name==='NotReadableError'?'La caméra est déjà utilisée. Fermez l’autre application et réessayez.':(e as Error).message);setReady(false)}}
  void start();return()=>{stop();document.removeEventListener('visibilitychange',hide)};
 },[attempt,onScan,onClose]);
 return <dialog ref={dialog} className="epi-camera-dialog" aria-labelledby="epi-camera-title" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose()}}><header><h2 id="epi-camera-title"><Camera size={21}/> Scanner un autre EPI</h2><button type="button" autoFocus aria-label="Fermer le scanner" onClick={onClose}><X size={21}/></button></header><p>Placez le QR code de l’étiquette devant la caméra.</p><video ref={video} playsInline muted aria-label="Aperçu de la caméra"/>{!ready&&!error&&<p role="status">Ouverture de la caméra…</p>}{error&&<p className="epi-scan-error" role="alert">{error}</p>}{error&&!ready&&<button className="epi-scan-submit" type="button" onClick={()=>setAttempt(x=>x+1)}>Réessayer</button>}<small>Le scan ouvre la fiche de l’EPI. Aucun mouvement de stock n’est enregistré automatiquement.</small></dialog>;
}
