export const CREW = [
  { id: 'nova', name: 'Nova', role: 'Pilot · mission control · trouble magnet', station: 'Command deck',
    portrait: 'assets/crew-nova.webp', color: '#e7b477', wifiMission: 'nova-wifi',
    intro: 'Welcome aboard the Rapscallion, Captain. Fix my connection and I’ll send you something considerably more interesting than a status report.',
    thanks: 'Working Wi-Fi. Actual evidence. Look at you, making competence attractive. Check your inbox, Marine.',
    ticket: 'My connection works by address, but the archive won’t load by name. I would like my music back before I start singing at you.' },
  { id: 'sylvanas', name: 'Sylvanas', role: 'Tactics · reconnaissance · exceptionally high standards', station: 'Observation quarters',
    portrait: 'assets/crew-sylvanas.webp', color: '#c5a7dd', wifiMission: 'sylvanas-wifi',
    intro: 'I prefer precision, Captain. Restore my connection without dismantling the ship and perhaps I shall reward your attention to detail.',
    thanks: 'A precise repair. No collateral damage. You have earned my attention—and the photograph I promised.',
    ticket: 'My console sees no wireless networks. The access point is operating. Begin with evidence, not excuses.' },
  { id: 'samus', name: 'Samus', role: 'Bounty hunter · shuttle operations · zero patience for lag', station: 'Shuttle bay',
    portrait: 'assets/crew-samus.webp', color: '#83b4e4', wifiMission: 'samus-wifi',
    intro: 'Contracts first. Then downtime. Get my terminal onto the right network and I’ll make the debrief worth opening.',
    thanks: 'Connection restored. Contract uploaded. Nice work, Captain. There’s a personal transmission waiting for you.',
    ticket: 'The terminal says connected, but my flight-data upload fails. Someone changed the active wireless profile during the handover.' },
  { id: 'jenny', name: 'Jenny', role: 'Embodied ship AI · systems · devastatingly accurate sarcasm', station: 'Data core',
    portrait: 'assets/crew-jenny.webp', color: '#89d5de', wifiMission: 'jenny-wifi',
    intro: 'Four crew members. One shared wireless network. A statistically predictable amount of drama. Verified repairs earn personal photo transmissions, Captain.',
    thanks: 'All checks passed. Your reward has been delivered. I have classified this as positive reinforcement. Nova has classified it differently.',
    ticket: 'My link is associated, but packet loss spikes in the crowded band. Compare the scan with the saved connection before changing anything.' }
];
export const crewById = id => CREW.find(c => c.id === id);
export const crewForMission = mission => crewById(mission?.crew) || CREW[0];
export const photoUnlocked = (photo, progress) => photo.mission ? progress.completed.includes(photo.mission) : progress.completed.length >= photo.unlock;
