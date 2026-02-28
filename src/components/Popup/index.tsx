import { ReactNode } from "react";
import { X } from "lucide-react";

interface PopupProps {
  visible: boolean;
  title: string;
  content: ReactNode;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export default function Popup({ visible, title, content, onConfirm, onCancel }: PopupProps) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-layer-overlay z-[1000001] flex items-center justify-center p-4">
      <div className="bg-surface rounded-xl max-w-md w-full shadow-2xl animate-fade-in">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold text-content">{title}</h3>
            <button 
              onClick={onCancel}
              className="p-1 hover:bg-surface-subtle rounded-lg transition-colors"
              aria-label="Fechar"
            >
              <X size={20} className="text-content-secondary" />
            </button>
          </div>
          <div className="text-content-secondary mb-6">
            {content}
          </div>
          <div className="flex justify-end gap-3">
            <button 
              onClick={onCancel}
              className="px-5 py-2.5 bg-gradient-to-r from-brand to-brand-hover text-content-inverse rounded-lg text-sm font-medium hover:opacity-90 transition-opacity "
            >
              Cancelar
            </button>
            <button 
              onClick={onConfirm}
              className="px-5 py-2.5 border border-ui-border rounded-lg text-sm font-medium hover:bg-surface-subtle transition-colors"
            >
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}