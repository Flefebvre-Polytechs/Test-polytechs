// L'import original est limité au Worker du Site privé. Le dépôt de code public
// reste fonctionnel sans ce fichier : un administrateur pourra l'ajouter à une autre installation.
type Seed={source:string;method:string;units:Array<any>;risks:Array<any>;actions:Array<any>;updates:Array<any>};
import {privateSource} from './private-source';
export const evrpSource=privateSource<Seed|null>('duerp-source.json',null);
