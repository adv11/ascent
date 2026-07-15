import { celebrationShownKey } from './localStorageKeys.js';

function read(uid) {
  try {
    const raw = localStorage.getItem(celebrationShownKey(uid));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function write(uid, state) {
  localStorage.setItem(celebrationShownKey(uid), JSON.stringify(state));
}

export function hasShownRoadmapCelebration(uid, templateId) {
  return !!read(uid)[templateId]?.roadmap;
}

export function hasShownPhaseCelebration(uid, templateId, phaseTitle) {
  return !!read(uid)[templateId]?.phases?.includes(phaseTitle);
}

export function markRoadmapCelebrationShown(uid, templateId) {
  const state = read(uid);
  state[templateId] = { ...state[templateId], roadmap: true };
  write(uid, state);
}

export function markPhaseCelebrationShown(uid, templateId, phaseTitle) {
  const state = read(uid);
  const entry = state[templateId] || {};
  const phases = entry.phases || [];
  if (!phases.includes(phaseTitle)) phases.push(phaseTitle);
  state[templateId] = { ...entry, phases };
  write(uid, state);
}
