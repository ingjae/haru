window.reminder?.onShow(data=>{
  document.body.className=data.side==='right'?'right':data.side==='left'?'left':'panel';
  document.getElementById('caption').textContent=data.preview?'알림 미리보기':data.minutes===0?'지금 시작해요':`${data.minutes}분 뒤 시작해요`;
  document.getElementById('title').textContent=data.title;
  document.getElementById('time').textContent=new Date(data.start).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false});
  const card=document.querySelector('.balloon');card.classList.remove('pop','slide');void card.offsetWidth;if(['pop','slide'].includes(data.animation))card.classList.add(data.animation);
});
document.querySelector('.content').onclick=()=>window.reminder?.open();
document.getElementById('dismiss').onclick=()=>window.reminder?.close();
