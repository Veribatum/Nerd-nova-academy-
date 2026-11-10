export const WORK_MODE_KEY = 'nerdnova_work_mode';

export function readWorkMode() {
  try {
    return localStorage.getItem(WORK_MODE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function crewArt(ctx, crew, offDutyArt = crew.portrait, scene = 'crew') {
  return ctx.ui?.workMode ? `assets/work-${crew.id}-${scene}.webp` : scene === 'mission' && crew.missionArt ? crew.missionArt : offDutyArt;
}

// Work-only scene manifest. All files have a verified older asset fallback until the new artwork is uploaded.
export const NOVA_WORK_ART = {
  bridge: ['assets/work-nova-bridge-v2.webp', 'assets/work-nova-bridge.webp'],
  manual: ['assets/work-nova-manual-v2.webp', 'assets/work-nova-crew.webp'],
  'rhel-link': ['assets/work-nova-rhel-link-before.webp','assets/work-nova-mission.webp'],
  cam: ['assets/work-nova-cam-before.webp','assets/work-nova-mission.webp'],
  'switch-watch': ['assets/work-nova-switch-watch-before.webp','assets/work-nova-mission.webp'],
  route: ['assets/work-nova-route-before.webp','assets/work-nova-mission.webp'],
  'ovs-island': ['assets/work-nova-ovs-island-before.webp','assets/work-nova-mission.webp'],
  'service-watch': ['assets/work-nova-service-watch-before.webp','assets/work-nova-mission.webp'],
  arp: ['assets/work-nova-arp-before.webp','assets/work-nova-mission.webp'],
  'rhel-link-after': ['assets/work-nova-rhel-link-after.webp','assets/work-nova-reward.webp'],
  'mission-after': ['assets/work-nova-shift-complete.webp','assets/work-nova-reward.webp'],
  'hangar-after': ['assets/work-nova-hangar-after.webp','assets/work-nova-reward.webp']
};
export function novaWorkScene(missionId, after = false) {
  return NOVA_WORK_ART[after ? (missionId === 'rhel-link' ? 'rhel-link-after' : missionId === 'switch-watch' ? 'hangar-after' : 'mission-after') : missionId] || NOVA_WORK_ART.bridge;
}
