// Converts a validated import payload (see importValidator.js) into the
// { phases, items } shape roadmapStore.createCustomRoadmap expects (issue
// #4). Pure — no DOM, no store, no Firebase — so a future schemaVersion bump
// means adding a new adapter function here, never touching the validator or
// the store. Only ever called on data that has already passed
// validateImportPayload(); it does not re-validate.

function genId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function adaptImportToRoadmap(data) {
  const phases = [];
  const items = {};

  data.phases.forEach(phase => {
    const sections = [];
    phase.sections.forEach(section => {
      section.items.forEach(rawItem => {
        const [title, priority] = Array.isArray(rawItem) ? rawItem : [rawItem, phase.priority];
        const id = genId('custom');
        items[id] = {
          id,
          title: title.trim(),
          phase: phase.title,
          section: section.title,
          priority,
          done: false,
          custom: true,
          deleted: false,
          resources: [],
          createdAt: Date.now()
        };
      });
      sections.push({ id: genId('section'), title: section.title });
    });
    phases.push({ id: genId('phase'), title: phase.title, priority: phase.priority, resourceKey: null, sections });
  });

  return { phases, items };
}
