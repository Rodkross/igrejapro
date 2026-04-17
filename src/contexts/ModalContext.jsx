import React, { createContext, useContext, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

const ModalContext = createContext({
  confirmModal: async () => false,
  alertModal: async () => true,
});

export const useModal = () => useContext(ModalContext);

export function ModalProvider({ children }) {
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'confirm', // 'confirm', 'alert'
    variant: 'danger', // 'danger', 'success', 'info', 'warning'
    onConfirm: () => {},
    onCancel: () => {},
  });

  const confirmModal = (title, message, variant = 'danger') => {
    return new Promise((resolve) => {
      setModalState({
        isOpen: true,
        title,
        message,
        type: 'confirm',
        variant,
        onConfirm: () => {
          setModalState(s => ({ ...s, isOpen: false }));
          resolve(true);
        },
        onCancel: () => {
          setModalState(s => ({ ...s, isOpen: false }));
          resolve(false);
        }
      });
    });
  };

  const alertModal = (title, message, variant = 'info') => {
    return new Promise((resolve) => {
      setModalState({
        isOpen: true,
        title,
        message,
        type: 'alert',
        variant,
        onConfirm: () => {
          setModalState(s => ({ ...s, isOpen: false }));
          resolve(true);
        },
        onCancel: () => {
          setModalState(s => ({ ...s, isOpen: false }));
          resolve(true);
        }
      });
    });
  };

  const variantConfig = {
    danger: { 
      icon: <AlertTriangle className="text-rose-500" size={32} />, 
      bg: 'bg-rose-50', 
      btn: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20'
    },
    success: { 
      icon: <CheckCircle2 className="text-emerald-500" size={32} />, 
      bg: 'bg-emerald-50', 
      btn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
    },
    info: { 
      icon: <Info className="text-blue-500" size={32} />, 
      bg: 'bg-blue-50', 
      btn: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
    },
    warning: { 
      icon: <AlertTriangle className="text-amber-500" size={32} />, 
      bg: 'bg-amber-50', 
      btn: 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
    }
  };

  return (
    <ModalContext.Provider value={{ confirmModal, alertModal }}>
      {children}
      
      {modalState.isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[24px] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col border border-slate-100 transform transition-all animate-in zoom-in-95 duration-200">
            <div className="p-6 pb-2 text-center relative mt-4">
               <div className={`mx-auto w-16 h-16 rounded-[20px] flex items-center justify-center mb-5 ${variantConfig[modalState.variant].bg}`}>
                 {variantConfig[modalState.variant].icon}
               </div>
               <h3 className="text-xl font-bold text-slate-900 tracking-tight leading-none mb-2">{modalState.title}</h3>
               <p className="text-[13px] text-slate-500 font-medium leading-relaxed mt-2">{modalState.message}</p>
            </div>
            
            <div className="p-6 pt-6 flex gap-3 w-full">
              {modalState.type === 'confirm' && (
                <button
                  onClick={modalState.onCancel}
                  className="flex-1 px-4 py-3.5 bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold rounded-2xl transition-colors text-[13px]"
                >
                  Cancelar
                </button>
              )}
              <button
                onClick={modalState.onConfirm}
                className={`flex-1 px-4 py-3.5 font-bold rounded-2xl transition-all shadow-lg text-[13px] tracking-wide ${variantConfig[modalState.variant].btn}`}
              >
                {modalState.type === 'confirm' ? 'Confirmar' : 'Entendi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}
