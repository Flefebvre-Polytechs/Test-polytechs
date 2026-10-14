'use client';
import {useRef,type PointerEvent} from 'react';
import type {Widget} from '@/lib/unit-dashboard';
export function WidgetResize({w,columns,disabled,onChange}:{w:Widget;columns:number;disabled:boolean;onChange:(value:Partial<Widget>)=>void}){
 const drag=useRef<{x:number;y:number;width:number;height:number;column:number;count:number;scale:number;axis:'width'|'height'|'both'}|null>(null);
 function start(e:PointerEvent<HTMLButtonElement>,axis:'width'|'height'|'both'){
  if(disabled||e.button!==0)return;
  const card=e.currentTarget.closest('article')!,grid=card.parentElement!,style=getComputedStyle(grid),count=style.gridTemplateColumns.split(' ').length,gap=parseFloat(style.columnGap)||0;
  const scale=card.getBoundingClientRect().width/(card as HTMLElement).offsetWidth||1;
  drag.current={x:e.clientX,y:e.clientY,width:Math.min(w.span||(w.wide?2:1),count),height:w.minHeight||160,column:(grid.getBoundingClientRect().width+gap*scale)/count,count,scale,axis};
  e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();e.stopPropagation();
 }
 function move(e:PointerEvent<HTMLButtonElement>){const d=drag.current;if(!d)return;const patch:Partial<Widget>={};if(d.axis!=='height')patch.span=Math.max(1,Math.min(columns,d.count,d.width+Math.round((e.clientX-d.x)/d.column)));if(d.axis!=='width')patch.minHeight=Math.max(160,Math.min(1000,Math.round((d.height+(e.clientY-d.y)/d.scale)/20)*20));onChange(patch)}
 function stop(){drag.current=null}
 return <><div className="widget-size-tools"><label>Largeur<select disabled={disabled} value={Math.min(w.span||(w.wide?2:1),columns)} onChange={e=>onChange({span:Number(e.target.value)})}>{Array.from({length:columns},(_,i)=>i+1).map(n=><option key={n} value={n}>{n} / {columns}</option>)}</select></label><label>Hauteur<select disabled={disabled} value={w.minHeight||160} onChange={e=>onChange({minHeight:Number(e.target.value)})}>{[...new Set([160,240,320,400,480,640,800,1000,w.minHeight||160])].sort((a,b)=>a-b).map(n=><option key={n} value={n}>{n} px</option>)}</select></label></div>{(['width','height','both'] as const).map(axis=><button key={axis} type="button" className={'widget-resize-edge resize-'+axis} disabled={disabled} aria-label={{width:'Ajuster la largeur : ',height:'Ajuster la hauteur : ',both:'Redimensionner : '}[axis]+w.title} title={{width:'Glissez le bord droit pour régler la largeur',height:'Glissez le bord inférieur pour régler la hauteur',both:'Glissez le coin pour redimensionner'}[axis]} onPointerDown={e=>start(e,axis)} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();if(axis!=='height'&&['ArrowLeft','ArrowRight'].includes(e.key))onChange({span:Math.max(1,Math.min(columns,(w.span||(w.wide?2:1))+(e.key==='ArrowRight'?1:-1)))});if(axis!=='width'&&['ArrowUp','ArrowDown'].includes(e.key))onChange({minHeight:Math.max(160,Math.min(1000,(w.minHeight||160)+(e.key==='ArrowDown'?20:-20)))})}}>{axis==='both'?'↘':null}</button>)}</>;
}
