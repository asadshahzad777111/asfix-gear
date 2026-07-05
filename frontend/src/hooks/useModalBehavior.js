import { useEffect, useRef } from 'react';

/**
 * Shared behavior for full-screen/overlay modals (Add Product, login, etc.)
 * so they never feel "stuck" on mobile:
 *
 * 1. Locks background page scroll while open (without this, iOS/Android
 *    let the page behind the overlay scroll, which combined with a fixed
 *    overlay makes the screen feel frozen/janky).
 * 2. Pushes a history entry when the modal opens and listens for
 *    `popstate`, so the phone's hardware/gesture back button closes the
 *    modal instead of navigating away from the page underneath it (the
 *    "opens but can't go back" bug) — and it never fights the browser's
 *    own back stack because we pop our own entry off before calling
 *    `onClose`.
 *
 * Usage: call unconditionally in the modal component, gated by `open`.
 *
 * Returns:
 * - `closeWithoutHistoryBack()` — legacy escape hatch before navigate/onClose.
 * - `navigateAway(navigate, to, options)` — preferred when leaving the modal
 *   for another route (forgot password, register, etc.). Replaces the modal
 *   history entry and closes without the cleanup `history.back()` racing the
 *   new navigation (which otherwise snaps users back to /account/register).
 */
export default function useModalBehavior(open, onClose) {
  const closingViaPopRef = useRef(false);
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('modal-open');

    window.history.pushState({ modal: true }, '');
    pushedRef.current = true;
    closingViaPopRef.current = false;

    const handlePopState = () => {
      closingViaPopRef.current = true;
      onClose();
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.classList.remove('modal-open');
      window.removeEventListener('popstate', handlePopState);
      if (pushedRef.current && !closingViaPopRef.current) {
        window.history.back();
      }
      pushedRef.current = false;
      closingViaPopRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const closeWithoutHistoryBack = () => {
    closingViaPopRef.current = true;
  };

  const navigateAway = (navigate, to, options = {}) => {
    closingViaPopRef.current = true;
    pushedRef.current = false;
    navigate(to, { ...options, replace: options.replace ?? true });
    onClose();
  };

  return { closeWithoutHistoryBack, navigateAway };
}
