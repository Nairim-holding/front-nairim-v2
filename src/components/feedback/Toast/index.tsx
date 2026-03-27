'use client';

import type { MessageType, ToastItem } from '@/hooks/useMessage';
import { X, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

const TOAST_STYLES = `
  @keyframes toast-in {
    from { opacity: 0; transform: translateY(-12px) scale(0.96); }
    to   { opacity: 1; transform: translateY(0)    scale(1);    }
  }
  @keyframes toast-out {
    from { opacity: 1; transform: translateY(0)    scale(1);    }
    to   { opacity: 0; transform: translateY(-8px) scale(0.96); }
  }
  @keyframes shrink { from { width: 100%; } to { width: 0%; } }
  .toast-in  { animation: toast-in  0.22s cubic-bezier(0.22,1,0.36,1) forwards; }
  .toast-out { animation: toast-out 0.18s ease-in forwards; }
`;

const TYPE_STYLES: Record<MessageType, { bg: string; text: string; bar: string; icon: React.ReactNode }> = {
  success: {
    bg: 'bg-green-50 border-green-200',
    text: 'text-green-800',
    bar: 'bg-green-500',
    icon: <CheckCircle size={18} className="text-green-600 shrink-0" />,
  },
  error: {
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-800',
    bar: 'bg-red-500',
    icon: <XCircle size={18} className="text-red-600 shrink-0" />,
  },
  info: {
    bg: 'bg-blue-50 border-blue-200',
    text: 'text-blue-800',
    bar: 'bg-blue-500',
    icon: <AlertCircle size={18} className="text-blue-600 shrink-0" />,
  },
};

interface ToastProps {
  toast: ToastItem;
  onClose: (id: number) => void;
}

export default function Toast({ toast, onClose }: ToastProps) {
  const [isFadingOut, setIsFadingOut] = useState(false);

  const dismiss = () => {
    setIsFadingOut(true);
    setTimeout(() => onClose(toast.id), 180);
  };

  useEffect(() => {
    const timer = setTimeout(dismiss, toast.duration);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id, toast.duration]);

  const { bg, text, bar, icon } = TYPE_STYLES[toast.type];

  return (
    <div className={`${bg} border rounded-xl relative overflow-hidden shadow-lg ${isFadingOut ? 'toast-out' : 'toast-in'}`}>
      <div className="px-4 py-3 flex items-center gap-3">
        {icon}
        <p className={`text-sm font-medium flex-1 ${text}`}>{toast.text}</p>
        <button
          onClick={dismiss}
          className="p-1 hover:bg-black/5 rounded transition-colors"
          aria-label="Fechar"
        >
          <X size={14} className={text} />
        </button>
      </div>
      <div
        className={`absolute bottom-0 left-0 h-[3px] ${bar}`}
        style={{ animation: `shrink ${toast.duration}ms linear forwards` }}
      />
      <style>{TOAST_STYLES}</style>
    </div>
  );
}
