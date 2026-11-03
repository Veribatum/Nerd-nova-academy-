export const WORK_MODE_KEY = 'nerdnova_work_mode';

export function readWorkMode() {
  try {
    return localStorage.getItem(WORK_MODE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function crewArt(ctx, crew, offDutyArt = crew.portrait, scene = '') {
  return ctx.ui?.workMode ? `assets/work-${crew.id}${scene ? `-${scene}` : ''}.webp` : offDutyArt;
}
