import { el } from '../dom.js';
import { openModal } from './modal.js';
import { showToast } from './toast.js';
import { createIcon } from './icons.js';
import { generateShareCard } from './shareCard.js';
import { BRAND_NAME } from './brand.js';

const FILENAME = 'ascent-progress.png';

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

// openShareModal(analytics, activityLog) — analytics is computeAnalytics()'s
// output, activityLog is the same effective (backfilled) log the Progress
// page's own heatmap renders from. Generates the card once at open time;
// Download/Copy/Share all reuse the same canvas rather than regenerating it.
export async function openShareModal(analytics, activityLog) {
  const canvas = await generateShareCard(analytics, activityLog);
  canvas.className = 'share-card-preview';

  const captionInput = el('textarea', {
    className: 'share-caption-input',
    'aria-label': 'Caption',
    rows: '6'
  });
  captionInput.value = buildCaption(analytics);

  const downloadBtn = el('button', { type: 'button', className: 'btn btn-primary btn-sm', text: 'Download PNG' });
  const copyBtn = el('button', { type: 'button', className: 'btn btn-secondary btn-sm', text: 'Copy image' });
  const webShareBtn = el('button', { type: 'button', className: 'btn btn-secondary btn-sm', text: 'Share…' });

  downloadBtn.addEventListener('click', async () => {
    const blob = await canvasToBlob(canvas);
    if (!blob) {
      showToast('Could not generate the image. Try again.', 'error');
      return;
    }
    downloadBlob(blob, FILENAME);
    showToast('Downloaded ascent-progress.png.', 'success');
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
      const file = new File([blob], FILENAME, { type: 'image/png' });
      try {
        if (navigator.canShare && !navigator.canShare({ files: [file] })) {
          showToast('Sharing an image is not supported on this device.', 'error');
          return;
        }
        await navigator.share({ files: [file], title: `${BRAND_NAME} progress`, text: captionInput.value });
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
    ariaLabel: 'Share your progress',
    className: 'share-modal-card',
    content: [
      closeBtn,
      el('h2', { text: 'Share your progress' }),
      canvas,
      el('label', { className: 'share-caption-label', text: 'Caption' }, [captionInput]),
      el('div', { className: 'share-modal-actions' }, [downloadBtn, copyBtn, webShareBtn])
    ]
  });

  return modal;
}
