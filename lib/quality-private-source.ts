import type {QualityAction} from './quality-actions';
import {privateSource} from './private-source';
export const qualitySource=privateSource<{source:string;records:QualityAction[];owners:Record<string,string>;guide:{row:number;raw:Record<string,string>}[];trace:{row:number;raw:Record<string,string>}[];methods:string[];origins:string[]}>('quality-actions-source.json',{source:"Plan d’actions",records:[],owners:{},guide:[],trace:[],methods:[],origins:[]});
