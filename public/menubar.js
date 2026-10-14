import {colorInk} from './source-groups.js';
import {dayRange,timelineRange,timelineTime} from './calendar.js';
export function menuBarModel(events,now=new Date(),start=540,end=1260){
  timelineRange(start,end);
  const {start:day}=dayRange(now),from=+day+start*60000,to=+day+end*60000;
  const timed=events.filter(e=>e.start?.dateTime&&e.end?.dateTime).map(e=>({event:e,s:Date.parse(e.start.dateTime),e:Date.parse(e.end.dateTime)})).filter(e=>Number.isFinite(e.s)&&Number.isFinite(e.e)&&e.e>e.s).sort((a,b)=>a.s-b.s);
  const rowEnds=[-Infinity,-Infinity];
  const segments=timed.flatMap((item,index)=>{const s=Math.max(item.s,from),e=Math.min(item.e,to);if(s>=e)return[];let row=rowEnds.findIndex(last=>last<=s);if(row<0)row=0;rowEnds[row]=Math.max(rowEnds[row],e);return[{start:(s-from)/(to-from),end:(e-from)/(to-from),row,color:index%4,groupColor:/^#[0-9a-f]{6}$/i.test(item.event.haruColor||'')?item.event.haruColor:null,title:item.event.summary||'일정'}];});
  const fraction=(+now-from)/(to-from),next=timed.find(e=>e.e>+now);
  return {segments,current:fraction>=0&&fraction<1?fraction:null,startLabel:timelineTime(start),endLabel:timelineTime(end),startMinutes:start,endMinutes:end,count:timed.length,nextTitle:next?.event.summary||'',nextTime:next?new Date(next.s).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false}):''};
}
export function drawMenuBar(model,width=180,now=new Date(),dark=false){
  const canvas=document.createElement('canvas');canvas.width=width*2;canvas.height=44;
  const c=canvas.getContext('2d');c.scale(2,2);
  const ink=dark?'#f5f5f7':'#242426',muted=dark?'#ffffff65':'#00000040';
  const left=4,span=width-8,multi=model.segments.some(s=>s.row===1),colors=dark?['#2e65a0','#285d66','#624682','#76572f']:['#a7cfff','#95d4db','#cfb3eb','#efc48b'];
  c.strokeStyle=muted;c.lineWidth=.5;c.beginPath();c.moveTo(left,20);c.lineTo(width-left,20);c.stroke();
  for(const s of model.segments){const x=left+s.start*span,w=Math.max(2,(s.end-s.start)*span-1),y=multi?3+s.row*8:4,h=multi?7:14;c.fillStyle=s.groupColor||colors[s.color];c.beginPath();c.roundRect(x,y,w,h,Math.min(3,w/2));c.fill();
    if(w>60&&!multi){c.save();c.beginPath();c.rect(x+5,y,w-10,h);c.clip();c.font='500 10px -apple-system, sans-serif';c.textBaseline='middle';c.textAlign='left';c.fillStyle=s.groupColor?colorInk(s.groupColor):dark?'#f5f5f7':'#152431';let title=s.title;while(title.length>2&&c.measureText(title).width>w-12)title=title.slice(0,-2)+'…';c.fillText(title,x+6,y+h/2);c.restore();}
  }
  // Sparse ticks and labels sit in empty space, rather than forming a second header.
  const labelStep=width>=900?120:width>=480?180:360;
  c.font='500 9px -apple-system, sans-serif';c.textBaseline='middle';c.textAlign='center';
  for(let minute=Math.ceil(model.startMinutes/60)*60;minute<=model.endMinutes;minute+=labelStep){const f=(minute-model.startMinutes)/(model.endMinutes-model.startMinutes),x=left+f*span;
    if(model.segments.some(s=>f>=s.start-.012&&f<=s.end+.012))continue;
    c.fillStyle=ink;c.globalAlpha=.7;c.fillText(String(minute/60).padStart(2,'0'),Math.max(10,Math.min(width-10,x)),10);c.globalAlpha=1;
  }
  if(model.current!==null){const x=left+model.current*span;c.strokeStyle=dark?'#1c1c1e':'#fff';c.lineWidth=3;c.beginPath();c.moveTo(x,3);c.lineTo(x,21);c.stroke();c.strokeStyle='#ff453a';c.lineWidth=1.5;c.stroke();c.fillStyle='#ff453a';c.beginPath();c.moveTo(x-3,0);c.lineTo(x+3,0);c.lineTo(x,4);c.closePath();c.fill();}
  return canvas.toDataURL('image/png');
}
