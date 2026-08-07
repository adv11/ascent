import { el } from '../dom.js';
import { openModal } from './modal.js';
import { showToast } from './toast.js';
import { createIcon } from './icons.js';
import { createSelect } from './select.js';
import { generateShareCard, generateBadgeCard, shareSiteUrl } from './shareCard.js';
import { BRAND_NAME } from './brand.js';
import { computeHeatmap } from '../../core/analytics/heatmapData.js';
import { resolveRoadmapTitle } from '../utils/printRoadmap.js';

const FILENAME = 'ascent-progress.png';
const BADGE_FILENAME = 'ascent-badge.png';

const SCOPES = [
  { value: 'roadmap', label: 'This roadmap' },
  { value: 'all', label: 'All my roadmaps together', desc: 'Every roadmap you’ve started' },
  { value: 'todos', label: 'Today’s todos', desc: 'What you have been getting done daily' },
  { value: 'phase', label: 'A single phase' }
];

const STYLE_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'green', label: 'Green' }
];

const TOGGLES = [
  { key: 'streak', label: 'Streak' },
  { key: 'activitySquares', label: 'Activity squares' },
  { key: 'phaseNames', label: 'Phase names' },
  { key: 'date', label: 'Today’s date' },
  { key: 'link', label: 'Link to ' + BRAND_NAME }
];

const HASHTAGS = ['#LearningInPublic', '#100DaysOfCode', '#BuildInPublic'];

function canvasToBlob(canvas) {
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function dateLabelFor(now) {
  return new Date(now).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// buildCardData(...) — the one place scope/toggle selections turn into the
// plain shape shareCard.js's generateShareCard() renders. Kept as a single
// async function (rather than one per scope spread across the module) since
// every branch shares the same streak/activity/date/link toggle handling;
// only the headline/stats/phaseNames differ per scope.
async function buildCardData({ scope, style, toggles, phaseTitle, store, dailyTodoStore, analytics, activityLog, now = Date.now() }) {
  const dateLabel = toggles.date ? dateLabelFor(now) : null;
  const link = toggles.link ? shareSiteUrl() : null;
  const activityCells = toggles.activitySquares ? computeHeatmap(activityLog, now) : null;
  const streakStat = toggles.streak ? { value: `${analytics.streaks.current}-day`, label: 'current streak' } : null;
  const velocityStat = { value: analytics.velocity.toFixed(1), label: 'topics a day' };

  if (scope === 'todos') {
    const todos = dailyTodoStore.getSnapshot().todos;
    const done = todos.filter(t => t.done).length;
    const total = todos.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return {
      style,
      headlinePct: pct,
      headlineLabel: 'of today’s todos',
      stats: [{ value: `${done}/${total}`, label: 'todos done' }, streakStat, { value: String(total), label: 'todos today' }].filter(Boolean),
      activityCells,
      phaseNames: null,
      dateLabel,
      link
    };
  }

  if (scope === 'all') {
    const summary = await store.getAllRoadmapsSummary();
    const pct = summary.total > 0 ? Math.round((summary.done / summary.total) * 100) : 0;
    const count = summary.roadmaps.length;
    return {
      style,
      headlinePct: pct,
      headlineLabel: `across ${count} roadmap${count === 1 ? '' : 's'}`,
      stats: [{ value: `${summary.done}/${summary.total}`, label: 'topics done' }, streakStat, { value: String(count), label: 'roadmaps' }].filter(Boolean),
      activityCells,
      phaseNames: toggles.phaseNames ? summary.roadmaps.map(r => r.title) : null,
      dateLabel,
      link
    };
  }

  const snapshot = store.getSnapshot();
  const roadmapTitle = resolveRoadmapTitle(snapshot);

  if (scope === 'phase') {
    const phase = analytics.phaseBreakdown.find(p => p.phase === phaseTitle) || analytics.phaseBreakdown[0] || { phase: '', done: 0, total: 0, pct: 0 };
    return {
      style,
      headlinePct: phase.pct,
      headlineLabel: phase.phase ? `of ${phase.phase} in ${roadmapTitle}` : `in ${roadmapTitle}`,
      stats: [{ value: `${phase.done}/${phase.total}`, label: 'topics done' }, streakStat, velocityStat].filter(Boolean),
      activityCells,
      phaseNames: toggles.phaseNames && phase.phase ? [phase.phase] : null,
      dateLabel,
      link
    };
  }

  // Default scope: 'roadmap'.
  return {
    style,
    headlinePct: analytics.overview.pct,
    headlineLabel: `of my ${roadmapTitle} roadmap`,
    stats: [{ value: `${analytics.overview.done}/${analytics.overview.total}`, label: 'topics done' }, streakStat, velocityStat].filter(Boolean),
    activityCells,
    phaseNames: toggles.phaseNames ? analytics.phaseBreakdown.slice(0, 4).map(p => p.phase).filter(Boolean) : null,
    dateLabel,
    link
  };
}

function buildCaptionPresets(cardData) {
  const what = cardData.headlineLabel ? ` ${cardData.headlineLabel}` : '';
  const tags = HASHTAGS.join(' ');
  return [
    `${cardData.headlinePct}% done${what}.\n\n${tags}`,
    `Just hit ${cardData.headlinePct}%${what} on ${BRAND_NAME}!\n\n${tags}`,
    `Progress update: ${cardData.headlinePct}%${what}. Onward to the next move 💪\n\n${tags}`,
    `Tracking my progress with ${BRAND_NAME} — ${cardData.headlinePct}%${what}.\n\n${tags}`
  ];
}

function buildShareTargets(caption, link) {
  const url = link ? `https://${link}` : window.location.href;
  const encodedText = encodeURIComponent(caption);
  const encodedUrl = encodeURIComponent(url);
  return [
    { name: 'X', icon: 'x', href: `https://twitter.com/intent/tweet?text=${encodedText}` },
    { name: 'LinkedIn', icon: 'linkedin', href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}` },
    { name: 'WhatsApp', icon: 'whatsapp', href: `https://wa.me/?text=${encodedText}` },
    { name: 'Threads', icon: 'threads', href: `https://www.threads.net/intent/post?text=${encodedText}` },
    { name: 'Reddit', icon: 'reddit', href: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodeURIComponent(BRAND_NAME + ' progress')}` },
    { name: 'Telegram', icon: 'telegram', href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}` },
    { name: 'Facebook', icon: 'facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
    { name: 'Email', icon: 'mail', href: `mailto:?subject=${encodeURIComponent('My ' + BRAND_NAME + ' progress')}&body=${encodedText}` }
  ];
}

function buildSwitchRow({ label, checked, onChange }) {
  const id = `share-toggle-${label.replace(/\s+/g, '-').toLowerCase()}`;
  const input = el('input', { type: 'checkbox', id, role: 'switch', className: 'switch-input' });
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  const track = el('span', { className: 'switch-track', 'aria-hidden': 'true' });
  return el('div', { className: 'share-toggle-row' }, [
    el('label', { className: 'share-toggle-label', for: id, text: label }),
    el('span', { className: 'switch' }, [input, track])
  ]);
}

// openShareModal({ store, dailyTodoStore, analytics, activityLog }) —
// issue #501's full share-progress card generator,
// rebuilding the fixed single-card issue #8 modal. `analytics`/`activityLog`
// are the active roadmap's already-computed computeAnalytics()/
// buildEffectiveActivityLog() output (progress.js already holds both) —
// streak/velocity/activity-log data is user-global, so it applies
// identically regardless of which scope is selected; only the
// headline/stats/phase-names differ per scope (see buildCardData above).
export async function openShareModal({ store, dailyTodoStore, analytics, activityLog }) {
  let scope = 'roadmap';
  let style = 'light';
  const toggles = { streak: true, activitySquares: true, phaseNames: true, date: true, link: true };
  const phaseOptions = (analytics.phaseBreakdown || []).map(p => p.phase).filter(Boolean);
  let phaseTitle = phaseOptions[0] || '';
  let captionIndex = 0;
  let captionDirty = false;
  let latestCardData = null;

  const previewCanvas = el('canvas', { className: 'share-card-preview', width: '1200', height: '630' });
  const previewWrap = el('div', { className: 'share-preview-wrap' }, [previewCanvas]);

  const captionInput = el('textarea', { className: 'share-caption-input', 'aria-label': 'Caption', rows: '6' });
  captionInput.addEventListener('input', () => { captionDirty = true; });

  const hashtagRow = el('div', { className: 'share-hashtag-row' });
  HASHTAGS.forEach(tag => {
    hashtagRow.appendChild(el('button', {
      type: 'button',
      className: 'tag-chip',
      text: tag,
      onClick: () => {
        if (captionInput.value.includes(tag)) return;
        captionInput.value = captionInput.value ? `${captionInput.value}\n${tag}` : tag;
        captionDirty = true;
      }
    }));
  });

  const targetsGrid = el('div', { className: 'share-targets-grid' });
  const downloadBtn = el('button', { type: 'button', className: 'btn btn-primary btn-block' }, [createIcon('save', { size: 'xs' }), ' Download the image']);
  const copyImageBtn = el('button', { type: 'button', className: 'btn btn-secondary btn-sm', text: 'Copy image' });
  const copyLinkBtn = el('button', { type: 'button', className: 'btn btn-secondary btn-sm', text: 'Copy link' });

  const phaseSelectSlot = el('div', { className: 'share-phase-select-slot' });
  let phaseSelect = null;

  function renderPhaseSelect() {
    phaseSelect?._cleanup?.();
    phaseSelectSlot.replaceChildren();
    if (scope !== 'phase' || !phaseOptions.length) return;
    phaseSelect = createSelect(phaseOptions.map(p => ({ value: p, label: p })), { value: phaseTitle, ariaLabel: 'Phase' });
    phaseSelect.addEventListener('change', () => {
      phaseTitle = phaseSelect.value;
      regenerate({ refreshCaption: true });
    });
    phaseSelectSlot.appendChild(el('label', { className: 'field' }, [
      el('span', { className: 'field-label', text: 'Which phase?' }),
      phaseSelect
    ]));
  }

  function scopeDescription(opt) {
    if (opt.value === 'roadmap') return resolveRoadmapTitle(store.getSnapshot());
    if (opt.value === 'phase') return phaseTitle || 'Pick a phase';
    return opt.desc;
  }

  const scopeGroup = el('div', { className: 'share-scope-group', role: 'radiogroup', 'aria-label': 'What are you sharing?' });
  function renderScopeGroup() {
    scopeGroup.replaceChildren();
    SCOPES.forEach(opt => {
      const input = el('input', { type: 'radio', name: 'share-scope', className: 'share-scope-input', value: opt.value });
      input.checked = scope === opt.value;
      input.addEventListener('change', () => {
        if (!input.checked) return;
        scope = opt.value;
        renderPhaseSelect();
        regenerate({ refreshCaption: true });
      });
      scopeGroup.appendChild(el('label', { className: 'share-scope-option' }, [
        input,
        el('span', { className: 'share-scope-option-body' }, [
          el('span', { className: 'share-scope-option-label', text: opt.label }),
          el('span', { className: 'share-scope-option-desc', text: scopeDescription(opt) })
        ])
      ]));
    });
  }

  const styleSeg = el('div', { className: 'seg', role: 'radiogroup', 'aria-label': 'Card style' });
  STYLE_OPTIONS.forEach(opt => {
    const btn = el('button', {
      type: 'button',
      className: 'seg-item',
      'aria-selected': String(style === opt.value),
      text: opt.label,
      onClick: () => {
        if (style === opt.value) return;
        style = opt.value;
        Array.from(styleSeg.children).forEach(child => child.setAttribute('aria-selected', String(child === btn)));
        regenerate({ refreshCaption: false });
      }
    });
    styleSeg.appendChild(btn);
  });

  const togglesWrap = el('div', { className: 'share-toggles' });
  TOGGLES.forEach(({ key, label }) => {
    togglesWrap.appendChild(buildSwitchRow({
      label,
      checked: toggles[key],
      onChange: checked => {
        toggles[key] = checked;
        regenerate({ refreshCaption: false });
      }
    }));
  });

  async function regenerate({ refreshCaption }) {
    previewWrap.classList.add('share-preview-loading');
    const now = Date.now();
    let cardData;
    try {
      cardData = await buildCardData({ scope, style, toggles, phaseTitle, store, dailyTodoStore, analytics, activityLog, now });
    } catch (error) {
      console.error('Failed to build share card data', error);
      showToast('Could not generate the share card. Try again.', 'error');
      previewWrap.classList.remove('share-preview-loading');
      return;
    }
    latestCardData = cardData;
    if (refreshCaption && !captionDirty) {
      captionIndex = 0;
      captionInput.value = buildCaptionPresets(cardData)[captionIndex];
    }
    renderShareTargets();
    const canvas = await generateShareCard(cardData);
    canvas.className = 'share-card-preview';
    previewCanvas.replaceWith(canvas);
    previewWrap.replaceChildren(canvas);
    previewWrap.classList.remove('share-preview-loading');
  }

  function renderShareTargets() {
    targetsGrid.replaceChildren();
    buildShareTargets(captionInput.value, latestCardData?.link).forEach(target => {
      targetsGrid.appendChild(el('a', {
        className: 'btn btn-secondary btn-sm share-target-btn',
        href: target.href,
        target: '_blank',
        rel: 'noopener noreferrer'
      }, [createIcon(target.icon, { size: 'xs' }), ` ${target.name}`]));
    });
  }

  const suggestBtn = el('button', {
    type: 'button',
    className: 'btn btn-ghost btn-sm',
    text: 'Suggest another',
    onClick: () => {
      if (!latestCardData) return;
      const presets = buildCaptionPresets(latestCardData);
      captionIndex = (captionIndex + 1) % presets.length;
      captionInput.value = presets[captionIndex];
      captionDirty = false;
      renderShareTargets();
    }
  });

  downloadBtn.addEventListener('click', async () => {
    const canvas = previewWrap.querySelector('canvas');
    const blob = await canvasToBlob(canvas);
    if (!blob) {
      showToast('Could not generate the image. Try again.', 'error');
      return;
    }
    downloadBlob(blob, FILENAME);
    showToast(`Downloaded ${FILENAME}.`, 'success');
  });

  if (navigator.clipboard?.write && typeof window.ClipboardItem === 'function') {
    copyImageBtn.addEventListener('click', async () => {
      const canvas = previewWrap.querySelector('canvas');
      const blob = await canvasToBlob(canvas);
      if (!blob) {
        showToast('Could not generate the image. Try again.', 'error');
        return;
      }
      try {
        await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
        showToast('Copied image to clipboard.', 'success');
      } catch {
        showToast('Could not copy the image. Try downloading it instead.', 'error');
      }
    });
  } else {
    copyImageBtn.hidden = true;
  }

  if (navigator.clipboard?.writeText) {
    copyLinkBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(latestCardData?.link ? `https://${latestCardData.link}` : window.location.href);
        showToast('Copied link.', 'success');
      } catch {
        showToast('Could not copy the link.', 'error');
      }
    });
  } else {
    copyLinkBtn.hidden = true;
  }

  const closeBtn = el('button', {
    type: 'button',
    className: 'btn btn-ghost btn-icon modal-close',
    'aria-label': 'Close',
    onClick: () => modal.close()
  }, [createIcon('close', { size: 'sm' })]);

  const modal = openModal({
    ariaLabel: 'Share your progress',
    className: 'share-modal-card',
    content: [
      closeBtn,
      el('h2', { text: 'Share your progress' }),
      el('p', { className: 'share-modal-subtitle', text: 'Pick what goes on the card, edit the words, then post it anywhere. The image is made on your device — nothing is uploaded.' }),
      el('div', { className: 'share-modal-grid' }, [
        el('div', { className: 'share-modal-preview-col' }, [
          el('div', { className: 'share-preview-heading' }, [
            el('span', { className: 'share-preview-label', text: 'Preview · 1200 × 630' })
          ]),
          previewWrap,
          el('div', { className: 'share-style-row' }, [
            el('span', { className: 'field-label', text: 'Card style' }),
            styleSeg
          ])
        ]),
        el('div', { className: 'share-modal-controls-col' }, [
          el('div', { className: 'share-control-block' }, [
            el('h3', { className: 'share-control-heading', text: 'What are you sharing?' }),
            scopeGroup,
            phaseSelectSlot
          ]),
          el('div', { className: 'share-control-block' }, [
            el('h3', { className: 'share-control-heading', text: 'Show on the card' }),
            togglesWrap
          ]),
          el('div', { className: 'share-control-block' }, [
            el('div', { className: 'share-caption-heading-row' }, [
              el('h3', { className: 'share-control-heading', text: 'Your words' }),
              suggestBtn
            ]),
            el('label', { className: 'share-caption-label', text: 'Caption' }, [captionInput]),
            hashtagRow
          ]),
          el('div', { className: 'share-control-block' }, [
            el('h3', { className: 'share-control-heading', text: 'Post it' }),
            targetsGrid,
            downloadBtn,
            el('div', { className: 'share-modal-actions' }, [copyImageBtn, copyLinkBtn])
          ])
        ])
      ])
    ]
  });

  const rawClose = modal.close;
  modal.close = () => {
    phaseSelect?._cleanup?.();
    rawClose();
  };

  renderScopeGroup();
  renderPhaseSelect();
  await regenerate({ refreshCaption: true });

  return modal;
}

// openBadgeShareModal(kind, label) — kind is 'roadmap' or 'phase', label is
// the roadmap/phase title just completed (issue #181). Out of scope for
// issue #501's generator rebuild — kept as its own small, fixed-style modal.
export async function openBadgeShareModal(kind, label) {
  const canvas = await generateBadgeCard(kind, label);
  canvas.className = 'share-card-preview';
  const title = kind === 'roadmap' ? 'Roadmap complete!' : 'Phase complete!';
  const caption = kind === 'roadmap'
    ? `Just finished my "${label}" roadmap on ${BRAND_NAME}! 🏆\n\nOnward to the next move 💪\n\n#LearningInPublic`
    : `Just finished the "${label}" phase on ${BRAND_NAME}! 🏆\n\nOnward to the next move 💪\n\n#LearningInPublic`;

  const captionInput = el('textarea', { className: 'share-caption-input', 'aria-label': 'Caption', rows: '6' });
  captionInput.value = caption;

  const downloadBtn = el('button', { type: 'button', className: 'btn btn-primary btn-sm', text: 'Download PNG' });
  const copyBtn = el('button', { type: 'button', className: 'btn btn-secondary btn-sm', text: 'Copy image' });
  const webShareBtn = el('button', { type: 'button', className: 'btn btn-secondary btn-sm', text: 'Share…' });

  downloadBtn.addEventListener('click', async () => {
    const blob = await canvasToBlob(canvas);
    if (!blob) {
      showToast('Could not generate the image. Try again.', 'error');
      return;
    }
    downloadBlob(blob, BADGE_FILENAME);
    showToast(`Downloaded ${BADGE_FILENAME}.`, 'success');
  });

  if (navigator.clipboard?.write && typeof window.ClipboardItem === 'function') {
    copyBtn.addEventListener('click', async () => {
      const blob = await canvasToBlob(canvas);
      if (!blob) {
        showToast('Could not generate the image. Try again.', 'error');
        return;
      }
      try {
        await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
        showToast('Copied image to clipboard.', 'success');
      } catch {
        showToast('Could not copy the image. Try downloading it instead.', 'error');
      }
    });
  } else {
    copyBtn.hidden = true;
  }

  if (navigator.share) {
    webShareBtn.addEventListener('click', async () => {
      const blob = await canvasToBlob(canvas);
      if (!blob) {
        showToast('Could not generate the image. Try again.', 'error');
        return;
      }
      const file = new File([blob], BADGE_FILENAME, { type: 'image/png' });
      try {
        if (navigator.canShare && !navigator.canShare({ files: [file] })) {
          showToast('Sharing an image is not supported on this device.', 'error');
          return;
        }
        await navigator.share({ files: [file], title, text: captionInput.value });
      } catch (error) {
        if (error?.name !== 'AbortError') showToast('Could not open the share sheet. Try downloading instead.', 'error');
      }
    });
  } else {
    webShareBtn.hidden = true;
  }

  const closeBtn = el('button', {
    type: 'button',
    className: 'btn btn-ghost btn-icon modal-close',
    'aria-label': 'Close',
    onClick: () => modal.close()
  }, [createIcon('close', { size: 'sm' })]);

  const modal = openModal({
    ariaLabel: title,
    className: 'share-modal-card',
    content: [
      closeBtn,
      el('h2', { text: title }),
      canvas,
      el('label', { className: 'share-caption-label', text: 'Caption' }, [captionInput]),
      el('div', { className: 'share-modal-actions' }, [downloadBtn, copyBtn, webShareBtn])
    ]
  });

  return modal;
}
