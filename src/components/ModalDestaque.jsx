import React, { useState } from 'react';
import { X, Calendar, Clock, Star, CheckCircle2 } from 'lucide-react';

export default function ModalDestaque({ eventos, aoFechar, aoSilenciar }) {
  const [indiceAtual, setIndiceAtual] = useState(0);
  const [naoExibirMais, setNaoExibirMais] = useState(false);

  if (!eventos || eventos.length === 0 || indiceAtual >= eventos.length) return null;
  const evento = eventos[indiceAtual];

  const handleNext = () => {
    if (naoExibirMais) {
       aoSilenciar(evento.id);
    }
    
    if (indiceAtual < eventos.length - 1) {
       setIndiceAtual(prev => prev + 1);
       setNaoExibirMais(false);
    } else {
       aoFechar();
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/95 backdrop-blur-md animate-in fade-in duration-500">
      <div className="relative w-full max-w-3xl flex flex-col items-center">
        
        {eventos.length > 1 && (
            <div className="absolute -top-8 left-0 right-0 text-center text-white/50 text-[10px] font-black uppercase tracking-widest">
              Aviso {indiceAtual + 1} de {eventos.length}
            </div>
        )}

        <div className="relative bg-white rounded-[2.5rem] md:rounded-[3.5rem] shadow-[0_0_60px_rgba(0,0,0,0.7)] overflow-hidden border-4 border-amber-400 animate-in zoom-in-95 duration-500">
          
          {/* Botão Fechar / Próximo INTERNO */}
          <button 
            onClick={handleNext}
            className="absolute top-4 right-4 z-50 p-2 bg-slate-900/50 hover:bg-rose-500 backdrop-blur-md rounded-full text-white transition-all hover:rotate-90 shadow-xl"
          >
            <X size={24} strokeWidth={3} />
          </button>
          
          {/* Banner Inteiro */}
          <div className="bg-slate-900 flex items-center justify-center min-h-[300px]">
            <img 
              src={evento.bannerUrl} 
              className="w-full h-auto max-h-[65vh] object-contain" 
              alt="Destaque" 
            />
          </div>
          
          {/* Info e Controle */}
          <div className="bg-white p-6 md:p-8 italic border-t border-slate-50">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-6">
              <div className="text-left w-full md:w-auto">
                <div className="flex items-center gap-2 mb-1">
                  <Star size={14} className="text-amber-500 fill-amber-500"/>
                  <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest leading-none">Aviso Importante</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">
                  {evento.titulo}
                </h2>
              </div>

              <div className="flex gap-6 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-8 w-full md:w-auto justify-center">
                <div className="text-center md:text-left">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Calendar size={10}/> Data</p>
                  <p className="text-sm font-black text-slate-800 uppercase">{new Date(evento.dataEspecífica + "T12:00:00").toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</p>
                </div>
                <div className="text-center md:text-left">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Clock size={10}/> Hora</p>
                  <p className="text-sm font-black text-slate-800 uppercase">{evento.horario}</p>
                </div>
              </div>
            </div>

            {/* CAIXA DE SELEÇÃO PARA NÃO EXIBIR MAIS */}
            <div className="flex items-center justify-center md:justify-start border-t border-slate-50 pt-4">
               <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={naoExibirMais}
                      onChange={(e) => setNaoExibirMais(e.target.checked)}
                    />
                    <div className={`w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center ${naoExibirMais ? 'bg-blue-600 border-blue-600' : 'border-slate-200 group-hover:border-blue-400'}`}>
                      {naoExibirMais && <CheckCircle2 size={16} className="text-white" />}
                    </div>
                  </div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-slate-700 transition-colors">
                    Não me mostrar este aviso novamente
                  </span>
               </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}