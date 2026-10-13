export function dayRange(date = new Date()) {
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return { start, end };
}
export function meetingURL(event) {
  const candidates = [event.hangoutLink, ...(event.conferenceData?.entryPoints || []).filter(p=>p.entryPointType==='video').map(p=>p.uri)];
  for(const candidate of candidates){try{const url=new URL(candidate);if(url.protocol==='https:')return url.href;}catch{}}
  // Invitations often put the meeting link only in description or location.
  const text=[event.description,event.location].filter(Boolean).join(' ').replace(/&amp;/g,'&');
  const links=text.match(/(?<![\w.\/-])(?:https:\/\/)?(?:meet\.google\.com|(?:[\w-]+\.)?zoom\.us|teams\.microsoft\.com|teams\.live\.com)\/[^\s<>"']+/gi)||[];
  for(const link of links){try{const url=new URL(link.startsWith('https://')?link:'https://'+link.replace(/[),.;]+$/,''));if(url.protocol==='https:')return url.href;}catch{}}
  return null;
}
export function localInput(date) {
  const d = new Date(date); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
export function eventPatch(title, start, end, reminder) {
  if (!title.trim()) throw new Error('일정 제목을 입력해 주세요.');
  const s = new Date(start), e = new Date(end);
  if (!Number.isFinite(+s) || !Number.isFinite(+e) || e <= s) throw new Error('종료 시간은 시작 시간보다 늦어야 합니다.');
  return { summary: title.trim(), start: { dateTime: s.toISOString() }, end: { dateTime: e.toISOString() }, reminders: { useDefault: false, overrides: reminder === 'none' ? [] : [{ method: 'popup', minutes: Number(reminder) }] } };
}
