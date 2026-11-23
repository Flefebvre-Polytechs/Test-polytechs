import {
  BadgeCheck, BookOpen, BriefcaseBusiness, Building2, CalendarDays, ChartColumn,
  ClipboardCheck, Cog, Construction, Cpu, Euro, Factory, FileCheck2, FlaskConical,
  GraduationCap, HardHat, Headphones, HeartHandshake, HeartPulse, Leaf, Lightbulb,
  MapPin, Monitor, Network, Package, Recycle, ShieldCheck, ShoppingCart, Tag,
  Toolbox, Truck, Users, Warehouse, Wrench, type LucideIcon,
} from 'lucide-react';
import type { TeamIcon } from './team-organization';
export const categoryVisuals: Record<string, {Icon:LucideIcon; tone:string}> = {
  'Sécurité': {Icon:ShieldCheck,tone:'safety'},
  'Environnement': {Icon:Leaf,tone:'environment'},
  'Production': {Icon:Factory,tone:'production'},
  'Qualité': {Icon:FileCheck2,tone:'quality'},
  'Ressources humaines': {Icon:HeartHandshake,tone:'people'},
  'Maintenance': {Icon:Wrench,tone:'maintenance'},
  'R&D': {Icon:Lightbulb,tone:'research'},
  'Autre': {Icon:Tag,tone:'other'},
};

export const teamIcons = {
  briefcase: BriefcaseBusiness,
  shield: ShieldCheck,
  calendar: CalendarDays,
  lightbulb: Lightbulb,
  users: Users,
  factory: Factory,
  flask: FlaskConical,
  truck: Truck,
  'hard-hat': HardHat,
  cart: ShoppingCart,
  'heart-handshake': HeartHandshake,
  network: Network,
  wrench: Wrench,
  monitor: Monitor,
  leaf: Leaf,
  recycle: Recycle,
  package: Package,
  warehouse: Warehouse,
  cog: Cog,
  toolbox: Toolbox,
  construction: Construction,
  building: Building2,
  clipboard: ClipboardCheck,
  badge: BadgeCheck,
  book: BookOpen,
  chart: ChartColumn,
  'heart-pulse': HeartPulse,
  graduation: GraduationCap,
  headphones: Headphones,
  euro: Euro,
  chip: Cpu,
  pin: MapPin,
} satisfies Record<TeamIcon, LucideIcon>;

const teamVisuals: Record<string, {Icon:LucideIcon; family:string}> = {
  direction:{Icon:BriefcaseBusiness,family:'management'},
  qsse:{Icon:ShieldCheck,family:'management'},
  commercial:{Icon:BriefcaseBusiness,family:'operations'},
  planification:{Icon:CalendarDays,family:'operations'},
  rd:{Icon:Lightbulb,family:'operations'},
  production:{Icon:Factory,family:'operations'},
  laboratoire:{Icon:FlaskConical,family:'operations'},
  logistique:{Icon:Truck,family:'operations'},
  'travaux-neufs':{Icon:HardHat,family:'support'},
  achats:{Icon:ShoppingCart,family:'support'},
  rh:{Icon:HeartHandshake,family:'support'},
  procedes:{Icon:Network,family:'support'},
  maintenance:{Icon:Wrench,family:'support'},
  informatique:{Icon:Monitor,family:'support'},
};
export function teamVisual(id: string, icon?: TeamIcon | '') {
  const visual = teamVisuals[id] ?? { Icon: Users, family: 'support' };
  return icon && Object.hasOwn(teamIcons, icon) ? { ...visual, Icon: teamIcons[icon] } : visual;
}
