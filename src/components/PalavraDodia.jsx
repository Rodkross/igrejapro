import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Loader2 } from 'lucide-react';

export default function PalavraDodia() {
  const navigate = useNavigate();
  const [verso, setVerso] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    const buscarPalavraDodia = async () => {
      try {
        setCarregando(true);
        const hoje = new Date().toISOString().split('T')[0];
        const cacheKey = `palavraDodia_${hoje}`;
        
        // Verificar se já há verso em cache para hoje
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          setVerso(JSON.parse(cached));
          setCarregando(false);
          return;
        }

        // Buscar verso aleatório da API
        const versosDisponiveis = [
          { livro: 'João', capitulo: 3, versiculo: 16 },
          { livro: 'Salmos', capitulo: 23, versiculo: 1 },
          { livro: 'Romanos', capitulo: 3, versiculo: 23 },
          { livro: 'Efésios', capitulo: 2, versiculo: 8 },
          { livro: 'Filipenses', capitulo: 4, versiculo: 13 },
          { livro: '1 Pedro', capitulo: 1, versiculo: 3 },
          { livro: 'Mateus', capitulo: 5, versiculo: 14 },
          { livro: '1 João', capitulo: 1, versiculo: 9 },
          { livro: 'Tiago', capitulo: 1, versiculo: 22 },
          { livro: 'Marcos', capitulo: 11, versiculo: 24 },
        ];

        const versoAleatorio = versosDisponiveis[Math.floor(Math.random() * versosDisponiveis.length)];
        const referencia = `${versoAleatorio.livro} ${versoAleatorio.capitulo}:${versoAleatorio.versiculo}`;
        
        const response = await fetch(
          `https://www.bible-api.com/${encodeURIComponent(referencia)}?translation=almeida`
        );
        
        if (!response.ok) throw new Error('Falha ao buscar verso');
        
        const data = await response.json();
        const versoData = {
          texto: data.text,
          referencia: data.reference,
        };

        // Cachear para o dia
        localStorage.setItem(cacheKey, JSON.stringify(versoData));
        setVerso(versoData);
      } catch (err) {
        console.error('Erro ao buscar palavra do dia:', err);
        setErro(err.message);
      } finally {
        setCarregando(false);
      }
    };

    buscarPalavraDodia();
  }, []);

  if (carregando) {
    return (
      <div className="bg-gradient-hero rounded-2xl p-6 border border-white/10 shadow-elegant flex items-center justify-center min-h-[120px]">
        <Loader2 className="animate-spin text-gold" size={24} />
      </div>
    );
  }

  if (erro || !verso) {
    return (
      <div className="bg-gradient-hero rounded-2xl p-6 border border-white/10 shadow-elegant text-center">
        <p className="text-sm text-slate-300">Indisponível no momento</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-hero rounded-2xl p-6 border border-white/10 shadow-elegant overflow-hidden relative">
      {/* Decoração de fundo */}
      <div className="absolute -bottom-8 -right-8 w-24 h-24 rounded-full bg-gold/10 blur-3xl"></div>
      
      <div className="relative z-10 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gold/20 rounded-lg flex items-center justify-center border border-gold/30">
            <BookOpen size={18} className="text-gold" />
          </div>
          <div>
            <p className="text-[9px] font-bold text-gold uppercase tracking-widest">Palavra do Dia</p>
            <p className="text-[11px] font-bold text-white/80">{verso.referencia}</p>
          </div>
        </div>

        {/* Verso */}
        <p className="text-sm font-medium text-slate-100 italic leading-relaxed">
          "{verso.texto}"
        </p>

        {/* Botão */}
        <button
          onClick={() => navigate('/entretenimento/biblia')}
          className="w-full bg-gold text-navy font-bold text-sm py-2.5 rounded-xl hover:bg-gold/90 transition-colors mt-2 shadow-lg active:scale-95"
        >
          Ver Mais Versículos
        </button>
      </div>
    </div>
  );
}
