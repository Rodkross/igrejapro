import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { X, Gift, Sparkles } from 'lucide-react';

export default function AniversarioOverlay({ nome, onFinalizar, DURACAO_MS }) {
  const [naoMostrarMais, setNaoMostrarMais] = useState(false);

  useEffect(() => {
    // 1. Disparar confetes profissionais
    const dispararConfetes = () => {
      const duracao = 3 * 1000;
      const fim = Date.now() + duracao;

      const frame = () => {
        confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#db2777', '#2563eb', '#fbbf24'] });
        confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#db2777', '#2563eb', '#fbbf24'] });

        if (Date.now() < fim) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    };

    dispararConfetes();

    // 2. Timer para fechar automático
    const timer = setTimeout(() => {
      onFinalizar(naoMostrarMais);
    }, DURACAO_MS);

    return () => clearTimeout(timer);
  }, [onFinalizar, naoMostrarMais, DURACAO_MS]);

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[999] flex flex-col items-center justify-center p-6 animate-in fade-in duration-700">
      
      {/* BALÕES SUBINDO EM BACKGROUND */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <div 
            key={i}
            className="absolute bottom-[-50px] text-5xl animate-balloon opacity-20"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 4}s`,
              animationDuration: `${7 + Math.random() * 5}s`
            }}
          >
            🎈
          </div>
        ))}
      </div>

      {/* MODAL CENTRAL */}
      <div className="relative text-center space-y-8 max-w-xl bg-white p-12 rounded-[4rem] shadow-[0_0_50px_rgba(0,0,0,0.3)] border-4 border-blue-500 animate-in zoom-in-75 duration-500">
        
        {/* BOTÃO FECHAR INTERNO */}
        <button 
          onClick={() => onFinalizar(naoMostrarMais)}
          className="absolute top-5 right-5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-full transition-all z-10"
        >
          <X size={24} strokeWidth={3} />
        </button>
        
        <div className="mx-auto bg-blue-50 text-blue-600 w-24 h-24 rounded-[2rem] flex items-center justify-center shadow-inner animate-bounce">
          <Gift size={48} strokeWidth={2} />
        </div>
        
        <div className="space-y-2">
          <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] italic">Hoje é o seu dia!</p>
          <h1 className="text-5xl font-black text-slate-950 tracking-tighter leading-tight uppercase italic">
            Parabéns,<br />
            <span className="text-blue-600 drop-shadow-sm">{nome}!</span>
          </h1>
        </div>
        
        <div className="py-6 border-y border-slate-100 relative">
          <Sparkles className="absolute -top-3 left-1/2 -translate-x-1/2 text-amber-400" size={24} />
          <p className="text-lg font-bold text-slate-700 leading-relaxed italic">
            "O Senhor te abençoe e te guarde; o Senhor faça resplandecer o seu rosto sobre ti e te conceda a paz."
          </p>
          <p className="text-[9px] font-black text-slate-400 mt-3 uppercase tracking-widest">— Números 6:24-26</p>
        </div>

        <div className="pt-2 flex items-center justify-center gap-3">
          <input 
            type="checkbox" 
            id="naoMostrar" 
            checked={naoMostrarMais}
            onChange={(e) => setNaoMostrarMais(e.target.checked)}
            className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <label htmlFor="naoMostrar" className="text-slate-500 text-[10px] font-black uppercase tracking-wider cursor-pointer select-none">
            Já comemorei hoje, não exibir novamente
          </label>
        </div>
      </div>

      {/* ESTILO DOS BALÕES */}
      <style>{`
        @keyframes balloon {
          0% { transform: translateY(0) rotate(0deg); opacity: 0; }
          10% { opacity: 0.4; }
          90% { opacity: 0.4; }
          100% { transform: translateY(-130vh) rotate(25deg); opacity: 0; }
        }
        .animate-balloon {
          animation-name: balloon;
          animation-timing-function: ease-in;
          animation-fill-mode: forwards;
        }
      `}</style>
    </div>
  );
}