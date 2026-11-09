export type TechnicalSheet={id:string;name:string;mime:string;size:number;author:string;created_at:string};
export type Product={code:string;family:string;name:string;specifics:string;source_row:number;source_sheet:string;catalog_status:string;quantity:number|null;minimum:number|null;location:string;revision:number;technical_sheet:TechnicalSheet|null};
