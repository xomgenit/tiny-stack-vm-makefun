import{readdirSync as r,mkdirSync as m,readFileSync as f,writeFileSync as w}from'node:fs';
let B=[(a,b)=>a+b|0,(a,b)=>a-b|0,Math.imul,(a,b)=>a/b|0,(a,b)=>a%b,(a,b)=>(a>>>0)/(b>>>0)|0,(a,b)=>(a>>>0)%(b>>>0)|0,,(a,b)=>a&b,(a,b)=>a|b,(a,b)=>a^b,,(a,b)=>a<<b,(a,b)=>a>>b,(a,b)=>a>>>b|0],C=[(a,b)=>+(a==b),(a,b)=>+(a<b),(a,b)=>+((a>>>0)<(b>>>0))];
function V(p,q){
let s=[],c=[],M=new Int32Array(256),o=[],j=0,n=0,k=0;
for(;;){
if(n++>=1e6)return[o,10];
if(k<0||k>=p.length)return[o,9];
let b=p[k],a,d;
if(b<8){
if(!b)return[o,0];
if(b<3){
if(k+(b<2?2:5)>p.length)return[o,9];
if(s.length>255)return[o,3];
s.push(b<2?p.readInt8(k+1):p.readInt32LE(k+1));k+=b<2?2:5;
}else if(b==3){if(!s.length)return[o,2];s.pop();k++}
else if(b==4){if(!s.length)return[o,2];if(s.length>255)return[o,3];s.push(s[s.length-1]);k++}
else if(b==5){if(s.length<2)return[o,2];a=s.pop();d=s.pop();s.push(a,d);k++}
else if(b==6){if(s.length<2)return[o,2];if(s.length>255)return[o,3];s.push(s[s.length-2]);k++}
else{if(s.length<3)return[o,2];a=s.pop();d=s.pop();let e=s.pop();s.push(d,a,e);k++}
}else if(b<35&&b>15){
if(b==23){if(!s.length)return[o,2];s[s.length-1]=-s[s.length-1]|0;k++}
else if(b==27){if(!s.length)return[o,2];s[s.length-1]=~s[s.length-1];k++}
else if(b==31)return[o,5];
else{if(s.length<2)return[o,2];let y=s.pop(),x=s.pop();if(b>18&&b<23&&!y)return[o,4];s.push(b<32?B[b-16](x,y):C[b-32](x,y));k++}
}else if(b<51&&b>47){
if(k+2>=p.length)return[o,9];
let t=k+3+p.readInt16LE(k+1);
if(b==48)k=t;
else{if(!s.length)return[o,2];a=s.pop();k=(b==49)==!a?t:k+3}
}else if(b==51){
if(k+2>=p.length)return[o,9];
if(c.length>63)return[o,7];
c.push(k+3);k=p.readUInt16LE(k+1);
}else if(b==52){if(!c.length)return[o,8];k=c.pop()}
else if(b==64){if(!s.length)return[o,2];a=s.pop();if(a<0||a>255)return[o,6];s.push(M[a]);k++}
else if(b==65){if(s.length<2)return[o,2];a=s.pop();if(a<0||a>255)return[o,6];M[a]=s.pop();k++}
else if(b==80){if(!s.length)return[o,2];a=s.pop();d=a+'';if(o.length+d.length>65536)return[o,11];o.push(...Buffer.from(d));k++}
else if(b==81){if(!s.length)return[o,2];a=s.pop();if(o.length>65535)return[o,11];o.push(a&255);k++}
else if(b==82){if(s.length>255)return[o,3];s.push(j<q.length?q[j++]:-1);k++}
else if(b==83){if(!s.length)return[o,2];return[o,s.pop()&255]}
else return[o,5];
}}
let I=process.env.MAKEFUN_INPUT_DIR||'/input',O=process.env.MAKEFUN_OUTPUT_DIR||'/output';
for(let d of r(I).sort()){
let x=V(f(I+'/'+d+'/program.bin'),f(I+'/'+d+'/input.bin'));
m(O+'/'+d,{recursive:true});
w(O+'/'+d+'/stdout.bin',Buffer.from(x[0]));
w(O+'/'+d+'/exit.txt',x[1]+'\n');
}
