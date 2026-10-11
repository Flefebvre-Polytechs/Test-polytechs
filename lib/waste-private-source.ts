import type {WasteRecord} from './waste';
import {privateSource} from './private-source';
type WasteSource={source:string;sha256:string;headers:string[];records:WasteRecord[];adrReference:{row:number;raw:Record<string,string>}[];treatments:string[]};
// Deliberately imported by server routes only: never expose source data in client bundles.
export const wasteSource=privateSource<WasteSource|null>('waste-source.json',null);
