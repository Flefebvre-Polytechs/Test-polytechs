// The public source repository contains no private stock catalogue.
type Catalog={source:string;duplicateRows:unknown[];items:Array<{code:string;family:string;name:string;specifics:string;sourceRow:number;sourceSheet:string;catalogStatus:string}>};
import {privateSource} from './private-source';
export const epiCatalog=privateSource<Catalog>('epi-catalog.json',{source:'',duplicateRows:[],items:[]});
