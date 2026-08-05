// Plain-language priority labels (issue #485) — display-layer only. The stored
// `priority` field (P0-P3) and every CSS/dataset value are unchanged; this is
// the single place that maps a code to the text a user actually reads.
export const PRIORITY_LABELS = {
  P0: 'Must do',
  P1: 'Should do',
  P2: 'Later',
  P3: 'Later'
};

export function priorityLabel(code) {
  return PRIORITY_LABELS[code] || code;
}
