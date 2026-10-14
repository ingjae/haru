const WIDTHS=[0,120,180,240,360,480,640,800,1000,1200];
function menuBarWidth(selection,display,tray){
  if(!WIDTHS.includes(selection))throw Error('메뉴바 폭을 확인해 주세요.');
  const area=display.bounds;
  // Leave room for app menus; built-in displays conservatively avoid the notch.
  const reserve=display.internal?area.width*.58:Math.max(360,area.width*.2);
  const right=tray&&tray.width>0?tray.x+tray.width:area.x+area.width*.75;
  const capacity=Math.max(120,Math.min(2000,Math.floor((right-area.x-reserve-16)/10)*10));
  return selection===0?capacity:Math.min(selection,capacity);
}
module.exports={WIDTHS,menuBarWidth};
