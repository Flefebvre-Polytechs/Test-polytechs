import type {ReactNode} from 'react';
import {
  ChevronDown,ChevronLeft,ChevronRight,LayoutDashboard,Maximize2,Minimize2,
  Minus,MoreHorizontal,Pause,Play,Plus,Star,
} from 'lucide-react';
import {DropdownMenu,DropdownMenuContent,DropdownMenuTrigger} from '@/components/ui/dropdown-menu';
import type {BoardLink} from '@/components/team-navigation';

export const dashboardZoom={min:70,max:130,step:5,initial:100} as const;

type ToolbarProps={
  boards:BoardLink[];
  selected:string;
  busy:boolean;
  editing:boolean;
  fullscreen:boolean;
  playing:boolean;
  zoom:number;
  isDefault:boolean;
  commands?:ReactNode;
  options:ReactNode;
  onSelect:(id:string)=>void;
  onStep:(delta:-1|1)=>void;
  onFullscreen:()=>void;
  onPlay:()=>void;
  onZoom:(zoom:number)=>void;
  onDefault:()=>void;
};

export function DashboardToolbar({
  boards,selected,busy,editing,fullscreen,playing,zoom,isDefault,commands,options,
  onSelect,onStep,onFullscreen,onPlay,onZoom,onDefault,
}:ToolbarProps){
  const locked=editing||busy;
  const canStep=boards.length>(selected?1:0)&&!locked;
  const fullscreenLabel=fullscreen?'Quitter le plein écran':'Plein écran';
  const playLabel=playing?'Mettre le diaporama en pause':'Lancer le diaporama';
  const pauseOnInteraction=playing?onPlay:undefined;
  return <section className="dashboard-toolbar" aria-label="Commandes du tableau de bord">
    <div className="dashboard-toolbar-nav">
      <button type="button" className="dashboard-tool icon-only" title="Tableau précédent" aria-label="Tableau précédent"
        disabled={!canStep} onClick={()=>onStep(-1)}><ChevronLeft size={17} aria-hidden="true"/></button>
      <button type="button" className="dashboard-tool icon-only" title="Tableau suivant" aria-label="Tableau suivant"
        disabled={!canStep} onClick={()=>onStep(1)}><ChevronRight size={17} aria-hidden="true"/></button>
      <label className="dashboard-toolbar-select">
        <LayoutDashboard size={17} aria-hidden="true"/>
        <select aria-label="Choisir un tableau de bord" value={selected} disabled={locked} onChange={event=>onSelect(event.target.value)}>
          <option value="">Activité du service</option>
          {boards.map(board=><option key={board.id} value={board.id}>{board.title}</option>)}
        </select>
        <ChevronDown size={15} aria-hidden="true"/>
      </label>
    </div>
    {commands&&<div className="dashboard-toolbar-group" role="group" aria-label="Gestion du tableau"
      onFocusCapture={pauseOnInteraction} onPointerDownCapture={pauseOnInteraction}>{commands}</div>}
    <div className="dashboard-toolbar-group" role="group" aria-label="Présentation">
      <button type="button" className="dashboard-tool" aria-label={fullscreenLabel} title={fullscreenLabel}
        aria-pressed={fullscreen} onClick={onFullscreen}>
        {fullscreen?<Minimize2 size={16} aria-hidden="true"/>:<Maximize2 size={16} aria-hidden="true"/>}
        <span className="dashboard-tool-label">{fullscreen?'Quitter':'Plein écran'}</span>
      </button>
      <button type="button" className="dashboard-tool" aria-label="Diaporama" aria-pressed={playing}
        title={boards.length<2?'Le diaporama nécessite au moins deux tableaux dans ce service.':playLabel}
        disabled={locked||boards.length<2} onClick={onPlay}>
        {playing?<Pause size={16} aria-hidden="true"/>:<Play size={16} aria-hidden="true"/>}
        <span className="dashboard-tool-label">{playing?'Pause':'Diaporama'}</span>
      </button>
    </div>
    <div className="dashboard-toolbar-group dashboard-toolbar-zoom" role="group" aria-label="Zoom du tableau">
      <button type="button" className="dashboard-tool icon-only" aria-label="Réduire le zoom" title="Réduire le zoom"
        disabled={zoom<=dashboardZoom.min} onClick={()=>onZoom(zoom-dashboardZoom.step)}><Minus size={16} aria-hidden="true"/></button>
      <button type="button" className="dashboard-tool dashboard-zoom-value" aria-label={'Zoom '+zoom+' %. Réinitialiser à 100 %'}
        title="Réinitialiser le zoom" onClick={()=>onZoom(dashboardZoom.initial)}>{zoom} %</button>
      <button type="button" className="dashboard-tool icon-only" aria-label="Agrandir le zoom" title="Agrandir le zoom"
        disabled={zoom>=dashboardZoom.max} onClick={()=>onZoom(zoom+dashboardZoom.step)}><Plus size={16} aria-hidden="true"/></button>
    </div>
    <div className="dashboard-toolbar-group dashboard-toolbar-end">
      {selected&&<button type="button" className="dashboard-tool dashboard-default" aria-pressed={isDefault}
        title="Choisir le tableau qui s’ouvre par défaut pour ce service dans ce navigateur"
        disabled={locked} onClick={onDefault}>
        <Star size={16} aria-hidden="true" fill={isDefault?'currentColor':'none'}/>
        {isDefault?'Par défaut':'Définir par défaut'}
      </button>}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="dashboard-tool icon-only" aria-label="Plus d’options du tableau"
            onFocus={pauseOnInteraction} onPointerDownCapture={pauseOnInteraction}
            title="Plus d’options du tableau" disabled={locked}><MoreHorizontal size={19} aria-hidden="true"/></button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="dashboard-toolbar-menu">{options}</DropdownMenuContent>
      </DropdownMenu>
    </div>
  </section>;
}
