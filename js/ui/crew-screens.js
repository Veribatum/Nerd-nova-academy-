import { CREW, crewById, photoUnlocked } from '../data/crew.js?v=1.1.0';
import { MISSIONS, GALLERY } from '../data/missions.js?v=1.1.0';
import { h, icon } from './utils.js?v=1.1.0';

export function crewRoster(ctx) {
  return `<div class="section-head"><div><div class="eyebrow">RAPSCALLION / PERSONAL TROUBLE TICKETS</div><h2>Same crew. Better signal.</h2></div><a class="text-link" href="#/crew">Meet the crew ${icon('arrow', 17)}</a></div><div class="crew-roster">${CREW.map(c => {
    const fixed = ctx.store.data.completed.includes(c.wifiMission);
    return `<a class="crew-card" href="#/crew/${c.id}" style="--crew-color:${c.color}"><div class="crew-card-art"><img src="${c.portrait}" alt="Established crew portrait of ${c.name}" width="1122" height="1402" loading="lazy"><span>${fixed ? 'PERSONAL TRANSMISSION UNLOCKED' : 'WI-FI TROUBLE TICKET OPEN'}</span></div><div class="crew-card-copy"><div class="eyebrow">${h(c.station)}</div><h3>${c.name} ${icon(fixed ? 'check' : 'radio', 19)}</h3><p>${h(c.ticket)}</p><b>${fixed ? 'Visit her quarters' : 'Take her request'} ${icon('arrow', 16)}</b></div></a>`;
  }).join('')}</div>`;
}

export function crewDeck(ctx, selected, card) {
  const p = ctx.store.data;
  if (!selected) return `<div class="page-heading"><div class="eyebrow">RUM ISLAND CREW / ABOARD THE RAPSCALLION</div><h1>YOUR CREW<span class="accent">.</span></h1><p>Nova. Sylvanas. Samus. Jenny. Four women, a temperamental spaceship, and a very worthwhile incentive to keep the network running.</p></div>${crewRoster(ctx)}<div class="panel crew-reward-note"><div>${icon('photo', 28)}<h2>Fix the signal. Earn the transmission.</h2></div><p>Each crew member has a complete Wi-Fi investigation and her own personal photo reward. Read her request, diagnose the fault, apply a justified repair and pass verification. Your unlocked photos stay in your service record.</p><a class="button secondary" href="#/morale">Open private transmissions ${icon('arrow', 17)}</a></div>`;
  const missions = MISSIONS.filter(m => m.crew === selected.id);
  const wifi = missions.find(m => m.id === selected.wifiMission);
  const done = p.completed.includes(selected.wifiMission);
  const earned = GALLERY.filter(g => g.crew === selected.id && photoUnlocked(g, p));
  return `<a class="back-link" href="#/crew">${icon('back', 16)} Rapscallion crew</a><div class="crew-quarters" style="--crew-color:${selected.color}"><div class="quarters-portrait"><img src="${selected.portrait}" alt="${selected.name} in her quarters aboard the Rapscallion" width="1122" height="1402"><span>${selected.name.toUpperCase()} / COMMS OPEN</span></div><section><div class="eyebrow">${h(selected.station)} / PERSONAL CHANNEL</div><h1>${selected.name}<span class="accent">.</span></h1><p class="crew-role">${h(selected.role)}</p><blockquote>“${h(selected.intro)}”</blockquote><div class="personal-ticket"><div class="eyebrow">${done ? 'REQUEST RESOLVED / PHOTO DELIVERED' : 'HER WI-FI TROUBLE TICKET'}</div><h2>${h(wifi.title)}</h2><p>${h(selected.ticket)}</p><a class="button primary" href="#/briefing/${wifi.id}">${icon(done ? 'reset' : 'orders', 18)} ${done ? 'Replay investigation' : 'Read her mission briefing'} ${icon('arrow', 17)}</a></div><p class="small muted">${p.completed.filter(id => missions.some(m => m.id === id)).length} assigned operations verified · ${earned.length} personal ${earned.length === 1 ? 'photo' : 'photos'} unlocked</p><a class="text-link" href="#/morale">Your private transmissions ${icon('arrow', 17)}</a></section></div><div class="section-head"><div><div class="eyebrow">${selected.name.toUpperCase()} / ASSIGNED OPERATIONS</div><h2>Keep her station running.</h2></div></div><div class="mission-grid">${missions.map(m => card(m, p)).join('')}</div>`;
}
