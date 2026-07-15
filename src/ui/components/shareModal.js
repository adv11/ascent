import { el } from '../dom.js';
import { openModal } from './modal.js';
import { showToast } from './toast.js';
import { createIcon } from './icons.js';
import { generateShareCard, generateBadgeCard } from './shareCard.js';
import { BRAND_NAME } from './brand.js';

const FILENAME = 'ascent-progress.png';
const BADGE_FILENAME = 'ascent-badge.png';

function buildCaption(analytics) {
  const { overview, streaks } = analytics;
  return [
    `🔥 ${streaks.current}-day streak on ${BRAND_NAME}!`,
    `Completed ${overview.done}/${overview.total} items (${overview.pct}%) on my roadmap.`,
    '',
    'Preparing for my next move 💪',
    '',
    '#LearningInPublic'
  ].join('\n');
}

function buildBadgeCaption(kind, label) {
  const headline = kind === 'roadmap' ? `Just finished my "${label}" roadmap on ${BRAND_NAME}! 🏆` : `Just finished the "${label}" phase on ${BRAND_NAME}! 🏆`;
  return [headline, '', 'Onward to the next move 💪', '', '#LearningInPublic'].join('\n');
}

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

// buildAndOpenShareModal(canvas, caption, filename, title) — shared by both
// openShareModal and openBadgeShareModal (issue #181): builds the
// caption/Download/Copy/Share UI around an already-generated canvas and
// opens it in a modal, rather than two parallel implementations.
function buildAndOpenShareModal(canvas, caption, filename, title) {
  canvas.className = 'share-card-preview';

  const captionInput = el('textarea', {
    className: 'share-caption-input',
    'aria-label': 'Caption',
    rows: '6'
  });
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
    downloadBlob(blob, filename);
    showToast(`Downloaded ${filename}.`, 'success');
  });

  // Copy/Share both need feature-detection — neither is universally
  // supported, and per the issue's own spec an unsupported browser should
  // just fall back to the always-visible inline preview (right-click to
  // save) rather than showing a button that would silently fail.
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
      const file = new File([blob], filename, { type: 'image/png' });
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

// openShareModal(analytics, activityLog) — analytics is computeAnalytics()'s
// output, activityLog is the same effective (backfilled) log the Progress
// page's own heatmap renders from. Generates the card once at open time;
// Download/Copy/Share all reuse the same canvas rather than regenerating it.
export async function openShareModal(analytics, activityLog) {
  const canvas = await generateShareCard(analytics, activityLog);
  return buildAndOpenShareModal(canvas, buildCaption(analytics), FILENAME, 'Share your progress');
}

// openBadgeShareModal(kind, label) — kind is 'roadmap' or 'phase', label is
// the roadmap/phase title just completed (issue #181). Reuses the same
// modal chrome as openShareModal with a distinct badge-card canvas and copy.
export async function openBadgeShareModal(kind, label) {
  const canvas = await generateBadgeCard(kind, label);
  const title = kind === 'roadmap' ? 'Roadmap complete!' : 'Phase complete!';
  return buildAndOpenShareModal(canvas, buildBadgeCaption(kind, label), BADGE_FILENAME, title);
}
