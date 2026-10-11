import type {GedDocument} from './ged';
import {privateSource} from './private-source';
export const gedSource=privateSource<{source:string;records:GedDocument[];history:{row:number;date:string;dateSource:string;description:string}[];headers:Record<string,Record<string,string>>}|null>('ged-source.json',null);
