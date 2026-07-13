import { el } from '../dom.js';
import { openModal } from './modal.js';
import { confirmDialog } from './confirmDialog.js';
import { showToast } from './toast.js';
import { getTemplate } from '../../data/templates/index.js';
import { publishRoadmapShare, revokeRoadmapShare, listMyShares } from '../../services/shareStore.js';

// "Share this roadmap" modal (issue #131) — generates a read-only published
// snapshot link (`sharedRoadmaps/{shareId}`) and lists/revokes the current
// account's already-published links. Reuses openModal()'s focus-trap/
// scroll-lock shell, same precedent as every other post-issue-#6-Phase-3.5
// modal in this app — see ".claude/rules/roadmap-store.md"'s "Roadmap
// sharing" section for the full data-model rationale.

function activeRoadmapTitle(store) {
  const activeTemplateId = store.getSnapshot().activeTemplateId;
  if (store.isCustomRoadmapId(activeTemplateId)) {
    const custom = store.getSnapshot().customRoadmaps.find(r => r.id === activeTemplateId);
    return custom ? custom.title : 'My roadmap';
  }
  return getTemplate(activeTemplateId).name;
}

function shareUrl(shareId) {
  return `${window.location.origin}${window.location.pathname}#/shared?id=${shareId}`;
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function renderShareRow(share, onRevoke) {
  const link = shareUrl(share.id);
  const row = el('li', { className: 'share-link-row' }, [
    el('span', { className: 'share-link-title', text: share.title }),
    el('button', {
      type: 'button',
      className: 'btn btn-secondary btn-sm',
      onClick: async () => {
        const ok = await copyToClipboard(link);
        showToast(ok ? 'Link copied.' : 'Could not copy the link. Copy it manually instead.', ok ? 'success' : 'error');
      },
      text: 'Copy link'
    }),
    el('button', {
      type: 'button',
      className: 'btn btn-danger btn-sm',
      onClick: () => onRevoke(share.id, row)
    }, ['Revoke'])
  ]);
  return row;
}

export function openShareRoadmapModal({ user, store }) {
  const status = el('p', { className: 'share-roadmap-modal-status', text: 'Generating a link…' });
  const list = el('ul', { className: 'share-link-list' });
  const generateBtn = el('button', { type: 'button', className: 'btn btn-primary', text: 'Generate a new link' });

  const { close } = openModal({
    ariaLabel: 'Share this roadmap',
    content: el('div', { className: 'share-roadmap-modal' }, [
      el('h2', { text: 'Share this roadmap' }),
      el('p', {
        className: 'share-roadmap-modal-copy',
        text: 'Anyone with the link can view a read-only snapshot of this roadmap — done state, priorities, and resource links. Notes are never included in a shared link.'
      }),
      generateBtn,
      status,
      el('h3', { text: 'Your published links' }),
      list
    ])
  });
  status.hidden = true;

  async function refreshList() {
    list.replaceChildren(el('li', { className: 'share-link-row', text: 'Loading…' }));
    const shares = await listMyShares(user.uid).catch(() => []);
    if (!shares.length) {
      list.replaceChildren(el('li', { className: 'share-link-row', text: 'No published links yet.' }));
      return;
    }
    list.replaceChildren(...shares.map(share => renderShareRow(share, handleRevoke)));
  }

  async function handleRevoke(shareId) {
    const ok = await confirmDialog({
      title: 'Revoke this share link?',
      message: 'Anyone with this link will immediately lose access. This cannot be undone.',
      confirmText: 'Revoke',
      cancelText: 'Cancel',
      danger: true
    });
    if (!ok) return;
    try {
      await revokeRoadmapShare(user.uid, shareId);
      showToast('Share link revoked.', 'success');
      refreshList();
    } catch {
      showToast('Could not revoke that link. Check your connection and try again.', 'error');
    }
  }

  generateBtn.addEventListener('click', async () => {
    generateBtn.disabled = true;
    status.hidden = false;
    status.textContent = 'Generating a link…';
    try {
      const shareId = await publishRoadmapShare(user.uid, store.getSnapshot(), activeRoadmapTitle(store));
      const link = shareUrl(shareId);
      await copyToClipboard(link);
      status.textContent = `Link copied: ${link}`;
      refreshList();
    } catch {
      status.textContent = 'Could not generate a link. Check your connection and try again.';
    } finally {
      generateBtn.disabled = false;
    }
  });

  refreshList();

  return { close };
}
