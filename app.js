'use strict';
const KEY = 'arbeitszeit-pwa-v1';
const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');
const formatDate = d => `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}`;
const formatTime = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const formatDuration = ms => { const m = Math.floor(ms / 60000); return `${pad(Math.floor(m/60))}:${pad(m%60)}`; };
let state;
let storageAvailable = true;
function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && Array.isArray(saved.records) && (saved.start === null || (typeof saved.start === 'number' && Number.isFinite(saved.start)))) {
      return saved;
    }
  } catch (e) { storageAvailable = false; }
  return { start: null, records: [] };
}
function persist(next) {
  try { localStorage.setItem(KEY, JSON.stringify(next)); state = next; storageAvailable = true; return true; }
  catch (e) { storageAvailable = false; $('notice').textContent = 'Speichern nicht möglich. Bitte freien Speicher und Safari-Einstellungen prüfen.'; return false; }
}
function render() {
  const running = state.start !== null;
  $('today').textContent = new Intl.DateTimeFormat('de-DE', {weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date());
  $('start').disabled = running;
  $('end').disabled = !running;
  $('dot').classList.toggle('running',running);
  $('status').textContent = running ? 'Arbeitszeit läuft' : 'Bereit zur Erfassung';
  $('since').textContent = running ? `Beginn: ${formatDate(new Date(state.start))}, ${formatTime(new Date(state.start))} Uhr` : 'Noch keine laufende Erfassung';
  $('count').textContent = `${state.records.length} Einträge`;
  $('records').replaceChildren();
  if (!state.records.length) {
    const empty = document.createElement('div'); empty.className='empty'; empty.textContent='Noch keine Arbeitszeiten erfasst.'; $('records').append(empty);
  }
  for (const r of [...state.records].reverse()) {
    const item = document.createElement('div'); item.className='record';
    const left = document.createElement('div');
    const date = document.createElement('div'); date.className='record-date'; date.textContent=formatDate(new Date(r.start));
    const times = document.createElement('div'); times.className='record-times'; times.textContent=`${formatTime(new Date(r.start))} – ${formatTime(new Date(r.end))}`;
    const duration = document.createElement('div'); duration.className='record-duration'; duration.textContent=`${formatDuration(r.end-r.start)} Std.`;
    left.append(date,times);item.append(left,duration);$('records').append(item);
  }
  if (!storageAvailable) $('notice').textContent = 'Achtung: Dauerhafte Speicherung derzeit nicht verfügbar.';
}
state = load(); render();
$('start').addEventListener('click', () => {
  if (state.start !== null) return;
  if (persist({...state,start:Date.now()})) { $('notice').textContent='Anfangszeit gespeichert.';render(); }
});
$('end').addEventListener('click', () => {
  if (state.start === null) return;
  const end = Date.now();
  if (end < state.start) { $('notice').textContent='Die Gerätezeit liegt vor der Anfangszeit. Bitte Uhrzeit prüfen.'; return; }
  const next = {start:null,records:[...state.records,{start:state.start,end}]};
  if (persist(next)) { $('notice').textContent='Arbeitszeit gespeichert.';render(); }
});
$('export').addEventListener('click', async () => {
  if (!state.records.length) { $('notice').textContent='Noch keine Einträge zum Exportieren vorhanden.'; return; }
  const header='Datum       Anfang Endzeit Dauer\r\n';
  const rows=state.records.map(r=>`${formatDate(new Date(r.start))}  ${formatTime(new Date(r.start))}   ${formatTime(new Date(r.end))}   ${formatDuration(r.end-r.start)}`).join('\r\n');
  const blob=new Blob(['\ufeff',header,rows,'\r\n'],{type:'text/plain;charset=utf-8'});
  const file=new File([blob],'Arbeitszeiten.txt',{type:'text/plain'});
  try {
    if (navigator.canShare && navigator.canShare({files:[file]})) {
      await navigator.share({files:[file],title:'Arbeitszeiten'});
      $('notice').textContent='Export über das Teilen-Menü gestartet.';
      return;
    }
  } catch(e) { if (e.name==='AbortError') return; }
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='Arbeitszeiten.txt';document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
  $('notice').textContent='Textdatei zum Herunterladen bereitgestellt.';
});
if ('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));

// PWA-Installation: Android/unterstützte Browser können einen Installationsdialog anbieten.
// Auf iOS ist nur eine Anleitung möglich; Installation erfolgt durch den Benutzer.
let deferredInstallPrompt = null;
const installSection = $('install-section');
const installGuide = $('install-guide');
const installed = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
function updateInstallVisibility() { installSection.hidden = installed(); }
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredInstallPrompt = event; updateInstallVisibility(); });
window.addEventListener('appinstalled', () => { deferredInstallPrompt = null; installGuide.hidden = true; updateInstallVisibility(); });
$('install').addEventListener('click', async () => {
  if (deferredInstallPrompt) {
    const prompt = deferredInstallPrompt;
    deferredInstallPrompt = null;
    try { await prompt.prompt(); await prompt.userChoice; } catch(e) { installGuide.hidden = false; }
  } else {
    installGuide.hidden = !installGuide.hidden;
  }
});
$('close-guide').addEventListener('click', () => { installGuide.hidden = true; });
updateInstallVisibility();
