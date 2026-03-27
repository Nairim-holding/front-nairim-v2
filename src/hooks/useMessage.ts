import { useState, useCallback, useRef } from "react";

export type MessageType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  text: string;
  type: MessageType;
  duration: number;
}

export const useMessage = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const showMessage = useCallback((text: string, type: MessageType, duration = 5000) => {
    const id = ++nextId.current;
    setToasts(prev => [...prev, { id, text, type, duration }]);
  }, []);

  const hideMessage = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, showMessage, hideMessage };
};
