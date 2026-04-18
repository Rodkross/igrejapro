import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

// Este é um novo componente melhorado para as respostas do quiz.
// Ele foi desenhado para ter uma altura consistente e fornecer um feedback claro e sem mudanças bruscas no layout.

export default function QuizAnswerCard({ text, onClick, isSelected, isCorrect, isRevealed }) {
  
  // Determina o estilo visual com base nas propriedades
  const getStateStyles = () => {
    if (isRevealed) {
      if (isSelected && isCorrect) {
        // Selecionado e Correto: Verde
        return 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-lg shadow-emerald-100';
      }
      if (isSelected && !isCorrect) {
        // Selecionado e Incorreto: Vermelho
        return 'bg-rose-50 border-rose-500 text-rose-800 shadow-lg shadow-rose-100';
      }
      if (!isSelected && isCorrect) {
        // Não selecionado, mas era a resposta correta: Borda verde
        return 'bg-white border-emerald-300';
      }
      // Estado padrão para outras respostas não selecionadas após a revelação
      return 'bg-slate-100 border-slate-200 text-slate-500 opacity-70';
    }

    // Antes da resposta ser revelada
    if (isSelected) {
      // Selecionado pelo usuário, mas ainda não revelado
      return 'bg-blue-50 border-blue-500 shadow-lg shadow-blue-100';
    }

    // Estado padrão, clicável
    return 'bg-white border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 cursor-pointer';
  };

  const stateStyles = getStateStyles();

  return (
    <button
      onClick={onClick}
      disabled={isRevealed}
      className={`w-full px-5 py-4 rounded-2xl border-2 text-left transition-all duration-300 flex items-center justify-between gap-4 ${stateStyles}`}
    >
      <p className="font-bold text-sm leading-snug">{text}</p>
      
      {/* Este container reserva espaço para o ícone, prevenindo a mudança de layout */}
      <div className="w-6 h-6 shrink-0">
        {isRevealed && isSelected && (isCorrect ? <CheckCircle2 size={24} className="text-emerald-500 animate-in zoom-in" /> : <XCircle size={24} className="text-rose-500 animate-in zoom-in" />)}
      </div>
    </button>
  );
}