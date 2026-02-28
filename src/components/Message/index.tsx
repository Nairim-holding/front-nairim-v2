import { MessageType } from "@/hooks/useMessage";
import { X, CheckCircle, XCircle, AlertCircle } from "lucide-react";

interface MessageProps {
  message: string;
  type: MessageType;
  visible: boolean;
  onClose: () => void;
}

export default function Message({ message, type, visible, onClose }: MessageProps) {
  if (!visible) return null;

  const bgColor = type === 'success' ? 'bg-green-50 border-green-200' 
                : type === 'error' ? 'bg-red-50 border-red-200' 
                : 'bg-blue-50 border-blue-200';
  
  const textColor = type === 'success' ? 'text-green-800' 
                  : type === 'error' ? 'text-red-800' 
                  : 'text-blue-800';
  
  const icon = type === 'success' ? <CheckCircle size={20} className="text-green-600" />
              : type === 'error' ? <XCircle size={20} className="text-red-600" />
              : <AlertCircle size={20} className="text-blue-600" />;

  return (
    <div className="fixed top-5 left-1/2 transform -translate-x-1/2 z-[1000000] max-w-md w-full px-4">
      <div className={`${bgColor} border rounded-xl p-4 flex items-center gap-3 shadow-lg animate-slide-up`}>
        {icon}
        <p className={`text-sm font-medium flex-1 ${textColor}`}>{message}</p>
        <button 
          onClick={onClose}
          className="p-1 hover:bg-surface/50 rounded transition-colors"
          aria-label="Fechar mensagem"
        >
          <X size={16} className={textColor} />
        </button>
      </div>
    </div>
  );
}