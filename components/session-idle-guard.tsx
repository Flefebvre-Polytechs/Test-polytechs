'use client';

import {useEffect,useRef,type ReactNode} from 'react';

const IDLE_LIMIT_MS=15*60*1000;
const HEARTBEAT_GAP_MS=15*1000;
const POINTER_MOVE_GAP_MS=5000;

/**
 * The server decides whether a session remains valid. Only deliberate
 * human interaction sends activity heartbeats; automatic API polling never
 * extends the user's session. The EPI-only tablet scan has its own scope.
 */
export function SessionIdleGuard({children,onExpired}:{children:ReactNode;onExpired:()=>void}){
 const onExpiredRef=useRef(onExpired);
 onExpiredRef.current=onExpired;
 useEffect(()=>{
  let alive=true,lastInteraction=Date.now(),lastHeartbeat=Date.now(),lastPointerMove=0;
  let sending=false,validating=false;
  const channel=typeof BroadcastChannel==='undefined'?null:new BroadcastChannel('polytechs-auth-user-activity');
  function expire(){if(!alive)return;alive=false;onExpiredRef.current()}
  async function validate(){
   if(!alive||validating)return;
   if(Date.now()-lastInteraction>=IDLE_LIMIT_MS){expire();return}
   validating=true;
   try{
    const response=await fetch('/api/auth',{cache:'no-store'});
    if(!alive)return;
    if(!response.ok){if(response.status===401)expire();return}
    const result=await response.json() as {account?:unknown};
    if(!result.account)expire();
   }catch{ /* A temporary network failure must not erase unsaved work. */ }
   finally{validating=false}
  }
  async function heartbeat(){
   if(!alive||sending||Date.now()-lastHeartbeat<HEARTBEAT_GAP_MS)return;
   if(Date.now()-lastInteraction>=IDLE_LIMIT_MS){expire();return}
   sending=true;lastHeartbeat=Date.now();
   try{
    const response=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'activity'}),cache:'no-store'});
    if(response.status===401)expire();
   }catch{ /* The server will still enforce the last recorded activity. */ }
   finally{sending=false}
  }
  function interaction(){
   if(!alive)return;
   const now=Date.now();
   if(now-lastInteraction>=IDLE_LIMIT_MS){expire();return}
   lastInteraction=now;
   channel?.postMessage(now);
   void heartbeat();
  }
  function pointerMove(){
   const now=Date.now();
   if(now-lastPointerMove<POINTER_MOVE_GAP_MS)return;
   lastPointerMove=now;
   interaction();
  }
  function onVisibility(){if(!document.hidden)void validate()}
  channel && (channel.onmessage=(event:MessageEvent<unknown>)=>{
   const value=event.data;
   // Only same-origin tabs can broadcast this timestamp; never share cookies.
   if(typeof value==='number'&&Number.isFinite(value)&&value>Date.now()-IDLE_LIMIT_MS&&value<=Date.now()+5000){
    lastInteraction=Math.max(lastInteraction,value);
   }
  });
  const passive: AddEventListenerOptions={passive:true,capture:true};
  window.addEventListener('pointerdown',interaction,passive);
  window.addEventListener('pointermove',pointerMove,passive);
  window.addEventListener('keydown',interaction,passive);
  window.addEventListener('touchstart',interaction,passive);
  window.addEventListener('wheel',interaction,passive);
  window.addEventListener('scroll',interaction,passive);
  document.addEventListener('visibilitychange',onVisibility);
  window.addEventListener('focus',validate);
  // Timer throttling in background tabs is handled again on focus.
  const interval=window.setInterval(()=>{if(Date.now()-lastInteraction>=IDLE_LIMIT_MS)expire()},10000);
  return()=>{
   alive=false;window.clearInterval(interval);channel?.close();
   window.removeEventListener('pointerdown',interaction,true);
   window.removeEventListener('pointermove',pointerMove,true);
   window.removeEventListener('keydown',interaction,true);
   window.removeEventListener('touchstart',interaction,true);
   window.removeEventListener('wheel',interaction,true);
   window.removeEventListener('scroll',interaction,true);
   document.removeEventListener('visibilitychange',onVisibility);
   window.removeEventListener('focus',validate);
  };
 },[]);
 return <>{children}</>;
}
