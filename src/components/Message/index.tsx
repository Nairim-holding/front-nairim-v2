/* eslint-disable react-hooks/set-state-in-effect */
import { MessageType } from "@/hooks/useMessage";
import { X, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";

interface MessageProps {
  message: string;
  type: MessageType;
  visible: boolean;
  onClose: () => void;
  duration?: number; 
}

export default function Message({ message, type, visible, onClose, duration = 5000 }: MessageProps) {
  const [render, setRender] = useState(visible);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    if (visible) {
      setRender(true);
      setIsFadingOut(false);
    } else if (render) {
      setIsFadingOut(true);
      setTimeout(() => setRender(false), 400); 
    }
  }, [visible, render]);

  if (!render) return null;

  const bgColor = type === 'success' ? 'bg-green-50 border-green-200' 
                : type === 'error' ? 'bg-red-50 border-red-200' 
                : 'bg-blue-50 border-blue-200';
  
  const textColor = type === 'success' ? 'text-green-800' 
                  : type === 'error' ? 'text-red-800' 
                  : 'text-blue-800';

  const barColor = type === 'success' ? 'bg-green-500' 
                 : type === 'error' ? 'bg-red-500' 
                 : 'bg-blue-500';
  
  const icon = type === 'success' ? <CheckCircle size={20} className="text-green-600" />
              : type === 'error' ? <XCircle size={20} className="text-red-600" />
              : <AlertCircle size={20} className="text-blue-600" />;

  const animationClass = isFadingOut ? 'animate-toast-out' : 'animate-toast-in';

  return (
    <div className="fixed top-5 left-1/2 transform -translate-x-1/2 z-[1000000] max-w-md w-full px-4">
      <div className={`${bgColor} border rounded-xl relative overflow-hidden shadow-lg ${animationClass}`}>
        
        <div className="p-4 flex items-center gap-3">
          {icon}
          <p className={`text-sm font-medium flex-1 ${textColor}`}>{message}</p>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-black/5 rounded transition-colors"
            aria-label="Fechar mensagem"
          >
            <X size={16} className={textColor} />
          </button>
        </div>

        {!isFadingOut && (
          <div 
            className={`absolute bottom-0 left-0 h-1 ${barColor}`}
            style={{ animation: `shrink ${duration}ms linear forwards` }}
          />
        )}
      </div>

      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes toast-out {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(-20px); }
        }
        .animate-toast-in { animation: toast-in 0.4s ease-out forwards; }
        .animate-toast-out { animation: toast-out 0.4s ease-in forwards; }
      `}</style>
    </div>
  );
}