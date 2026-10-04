export const gestureKeys=['c','x','/'] as const;
export type GestureKey=typeof gestureKeys[number];
export type GesturePoint={x:number;y:number;at:number};

// Fixed screen-space paths and timings make successive touches comparable.
export function gesturePattern(key:GestureKey):GesturePoint[]{
  const points:GesturePoint[]=[];
  const line=(ax:number,ay:number,bx:number,by:number,start:number)=>{
    for(let i=0;i<=22;i++){const t=i/22;points.push({x:ax+(bx-ax)*t,y:ay+(by-ay)*t,at:start+t*750});}
  };
  if(key==='c'){
    for(let i=0;i<=32;i++){const t=i/32,a=(-55-250*t)*Math.PI/180;points.push({x:.33*Math.cos(a),y:.33*Math.sin(a),at:t*1050});}
  }else if(key==='x'){
    line(-.3,-.3,.3,.3,0);line(-.3,.3,.3,-.3,930);
  }else line(-.32,.32,.32,-.32,0);
  return points;
}
