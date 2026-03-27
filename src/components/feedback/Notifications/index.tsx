'use client';

import { useCallback, useEffect } from 'react';
import { usePopupContext } from '@/contexts/PopupContext';
import { useMessageContext } from '@/contexts/MessageContext';
import ConfirmDialog from '../ConfirmDialog';
import Toast from '../Toast';

export default function GlobalNotifications() {
  const { toasts, hideMessage } = useMessageContext();
  const { popup, hidePopup } = usePopupContext();

  const handleConfirm = useCallback(() => {
    popup.onConfirm?.();
    hidePopup();
  }, [popup.onConfirm, hidePopup]);

  const handleCancel = useCallback(() => {
    popup.onCancel?.();
    hidePopup();
  }, [popup.onCancel, hidePopup]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && popup.visible) hidePopup();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [popup.visible, hidePopup]);

  return (
    <>
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[1000000] flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast toast={toast} onClose={hideMessage} />
          </div>
        ))}
      </div>
      <ConfirmDialog
        visible={popup.visible}
        title={popup.title}
        content={popup.content}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
}
