function parseMouseDown(line){
  const parts=line.trim().split(/\s+/);
  if(parts.length!==3||parts[0]!=='mouse-down')return null;
  const x=Number(parts[1]),y=Number(parts[2]);
  return Number.isFinite(x)&&Number.isFinite(y)?{x,y}:null;
}
function shouldDismiss(point,bounds,state){
  if(!point||!state.expanded||state.editing)return false;
  if(state.openedAt&&(state.now??Date.now())-state.openedAt<250)return false;
  return point.x<bounds.x||point.x>=bounds.x+bounds.width||point.y<bounds.y||point.y>=bounds.y+bounds.height;
}
function menuBarPanelBounds(tray,area){
  const width=Math.min(420,area.width),height=Math.min(800,area.height);
  return{x:Math.round(Math.max(area.x,Math.min(tray.x+tray.width/2-width/2,area.x+area.width-width))),y:area.y,width,height};
}
module.exports={parseMouseDown,shouldDismiss,menuBarPanelBounds};
