/**
 * Offline QR Code generator for staff badges: fixed Version 6-L, mask 0.
 * 41x41 modules plus a four-module quiet zone. No badge tokens leave Polytechs.
 * The QR encodes only the first-party verification URL (max 134 UTF-8 bytes).
 */
export const QR_VIEWBOX=49;
function multiply(a:number,b:number){
 let z=0;
 for(let i=0;i<8;i++){if(b&1)z^=a;b>>>=1;a=(a<<1)^((a&0x80)?0x11D:0)}
 return z;
}
function ecc(data:number[]){
 const degree=18,div=new Array<number>(degree).fill(0);div[degree-1]=1;
 let root=1;
 for(let i=0;i<degree;i++){
  for(let j=0;j<degree;j++){div[j]=multiply(div[j],root);if(j+1<degree)div[j]^=div[j+1]}
  root=multiply(root,2);
 }
 const result=new Array<number>(degree).fill(0);
 for(const byte of data){
  const factor=byte^result[0];result.shift();result.push(0);
  for(let i=0;i<degree;i++)result[i]^=multiply(div[i],factor);
 }
 return result;
}
export function qrPath(value:string){
 const raw=new TextEncoder().encode(value);
 if(raw.length>134)throw new Error('Adresse trop longue pour le QR code');
 const bits:number[]=[];
 const append=(number:number,count:number)=>{for(let i=count-1;i>=0;i--)bits.push((number>>>i)&1)};
 append(4,4);append(raw.length,8);
 for(const byte of raw)append(byte,8);
 for(let i=0;i<Math.min(4,136*8-bits.length);i++)bits.push(0);
 while(bits.length%8)bits.push(0);
 const words:number[]=[];
 for(let i=0;i<bits.length;i+=8){let word=0;for(let j=0;j<8;j++)word=(word<<1)|bits[i+j];words.push(word)}
 while(words.length<136)words.push(words.length%2===0?0xEC:0x11);
 const a=words.slice(0,68),b=words.slice(68),ae=ecc(a),be=ecc(b);
 const bytes:number[]=[];
 for(let i=0;i<68;i++)bytes.push(a[i],b[i]);
 for(let i=0;i<18;i++)bytes.push(ae[i],be[i]);
 const dataBits=bytes.flatMap(byte=>Array.from({length:8},(_,i)=>(byte>>>(7-i))&1));
 const size=41;
 const modules=Array.from({length:size},()=>Array<number>(size).fill(0));
 const functionModules=Array.from({length:size},()=>Array<boolean>(size).fill(false));
 const mark=(x:number,y:number,black:boolean|number)=>{if(x<0||y<0||x>=size||y>=size)return;modules[y][x]=black?1:0;functionModules[y][x]=true};
 for(let i=0;i<size;i++){mark(6,i,i%2===0);mark(i,6,i%2===0)}
 for(const [cx,cy] of [[3,3],[size-4,3],[3,size-4]]){
  for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){
   const distance=Math.max(Math.abs(dx),Math.abs(dy));mark(cx+dx,cy+dy,distance!==2&&distance!==4);
  }
 }
 // Version 6 has one alignment pattern not covered by the finder patterns.
 for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)mark(34+dx,34+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);
 const formatData=8; // ECC level L (1), mask pattern 0.
 let remainder=formatData;
 for(let i=0;i<10;i++)remainder=(remainder<<1)^((remainder&0x200)?0x537:0);
 const formatBits=((formatData<<10)|remainder)^0x5412;
 const f=(i:number)=>(formatBits>>>i)&1;
 for(let i=0;i<6;i++)mark(8,i,f(i));
 mark(8,7,f(6));mark(8,8,f(7));mark(7,8,f(8));
 for(let i=9;i<15;i++)mark(14-i,8,f(i));
 for(let i=0;i<8;i++)mark(size-1-i,8,f(i));
 for(let i=8;i<15;i++)mark(8,size-15+i,f(i));
 mark(8,size-8,1);
 let idx=0;
 for(let right=size-1;right>=1;right-=2){
  if(right===6)right=5;
  const upward=((right+1)&2)===0;
  for(let vertical=0;vertical<size;vertical++){
   const y=upward?size-1-vertical:vertical;
   for(let dx=0;dx<2;dx++){
    const x=right-dx;
    if(!functionModules[y][x])modules[y][x]=dataBits[idx++]||0;
   }
  }
 }
 // QR specification mask 0. Function modules are not masked.
 for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(!functionModules[y][x]&&(x+y)%2===0)modules[y][x]^=1;
 return modules.map((row,y)=>row.map((dark,x)=>dark?'M'+(x+4)+' '+(y+4)+'h1v1h-1z':'').join('')).join('');
}
