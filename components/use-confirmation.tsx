'use client';
import {useEffect,useRef,useState} from 'react';
import {ConfirmDialog} from '@/components/confirm-dialog';
export function useConfirmation(){
 const [message,setMessage]=useState(''),[labels,setLabels]=useState<{title?:string;confirmLabel?:string}>({}),pending=useRef<((accepted:boolean)=>void)|null>(null);
 useEffect(()=>()=>{pending.current?.(false);pending.current=null},[]);
 const finish=(accepted:boolean)=>{const resolve=pending.current;pending.current=null;setMessage('');resolve?.(accepted)};
 const askConfirm=(text:string,options:{title?:string;confirmLabel?:string}={})=>{if(pending.current)return Promise.resolve(false);return new Promise<boolean>(resolve=>{pending.current=resolve;setLabels(options);setMessage(text)})};
 return {askConfirm,confirmation:<ConfirmDialog open={!!message} title={labels.title||'Confirmer l’abandon de la saisie'} description={message} confirmLabel={labels.confirmLabel||'Abandonner la saisie'} onCancel={()=>finish(false)} onConfirm={()=>finish(true)}/>};
}
