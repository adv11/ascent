const PIECE_COUNT = 18;
const DURATION_MS = 1400;

// CSS-only confetti flourish (issue #181) — a short burst of falling pieces
// on first reaching 100% for a phase or roadmap. Fire-and-forget, no
// cleanup needed by the caller: each piece removes itself after its
// animation ends, and the whole burst is skipped under
// prefers-reduced-motion (same convention as item-entering/animatePhaseBody).
export function triggerConfetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const container = document.createElement('div');
  container.className = 'confetti-burst';
  container.setAttribute('aria-hidden', 'true');

  for (let i = 0; i < PIECE_COUNT; i += 1) {
    const piece = document.createElement('span');
    piece.className = `confetti-piece confetti-piece-${i % 6} confetti-piece-delay-${i % 7}`;
    container.appendChild(piece);
  }

  document.body.appendChild(container);
  setTimeout(() => container.remove(), DURATION_MS + 200);
}
