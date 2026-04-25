import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../database/firebase';
import { collection, getDocs, doc, updateDoc, orderBy, setDoc, getDoc, query, limit } from 'firebase/firestore';
import { useOutletContext } from 'react-router-dom';

import { Clock, Trophy, RotateCcw, Medal, Cross, CheckCircle2, CircleX, ArrowRight, Loader2 } from 'lucide-react';

export default function QuizGame() {
  const { usuario } = useOutletContext();
  const [perguntas, setPerguntas] = useState([]);
  const [indiceAtual, setIndiceAtual] = useState(0);
  const [score, setScore] = useState(0); // Este agora controla a pontuação da rodada
  const [vidas, setVidas] = useState(3);
  const [respondido, setRespondido] = useState(false);
  const [opcaoSelecionada, setOpcaoSelecionada] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const [ranking, setRanking] = useState([]);
  const [cooldown, setCooldown] = useState(null);
  const [tempoRestante, setTempoRestante] = useState(10);
  const [mostraControles, setMostraControles] = useState(false);

  const carregarRanking = useCallback(async () => {
    const q = query(collection(db, "usuarios"), orderBy("recordeQuiz", "desc"), limit(5));
    const snap = await getDocs(q);
    setRanking(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, []);

  const carregarJogo = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Verificar Cooldown
      const userRef = doc(db, "usuarios", String(usuario.id));
      const userSnap = await getDoc(userRef);
      const timestampBloqueio = userSnap.data()?.bloqueioQuiz?.seconds * 1000;

      if (timestampBloqueio) {
        const agora = new Date().getTime();
        const tempoDecorrido = agora - timestampBloqueio;
        const tempoTotalCooldown = 30 * 60 * 1000;
        if (tempoDecorrido < tempoTotalCooldown) {
          setCooldown(Math.ceil((tempoTotalCooldown - tempoDecorrido) / 1000));
          setVidas(0); // Garante que o estado de "sem vidas" seja mantido durante o cooldown
          setLoading(false);
          return;
        }
      }

      // 2. Filtrar perguntas já acertadas
      const progressoRef = doc(db, "progresso_quiz", String(usuario.id));
      const progressoSnap = await getDoc(progressoRef);
      const acertadasIds = progressoSnap.exists() ? progressoSnap.data().acertos || [] : [];

      const snapPerguntas = await getDocs(collection(db, "quiz_biblico"));
      const todas = snapPerguntas.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const disponiveis = todas.filter(p => !acertadasIds.includes(String(p.id)));

      if (disponiveis.length > 0) {
        setPerguntas(disponiveis.sort(() => Math.random() - 0.5).slice(0, 10));
      }
      
      setVidas(3);
      setScore(0); // Reseta score da rodada
      setIndiceAtual(0);
      setGameOver(false);
      setRespondido(false);
      setCooldown(null);
      setTempoRestante(10);
      setMostraControles(false);
      await carregarRanking();
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [usuario.id, carregarRanking]);

  const validarResposta = useCallback(async (opcao) => {
    if (respondido || gameOver) return;

    const questao = perguntas[indiceAtual];
    const acertou = opcao !== null && opcao === questao.resposta_correta;
    const pontosVariacao = acertou ? 10 : -5;
    const vidasAposResposta = acertou ? vidas : vidas - 1;

    // ATUALIZAÇÃO IMEDIATA DO ESTADO VISUAL
    setOpcaoSelecionada(opcao);
    setRespondido(true);
    setScore(prev => prev + pontosVariacao);
    setVidas(vidasAposResposta);
    setMostraControles(false);

    // Lógica de fim de jogo ou próxima questão
    if (vidasAposResposta < 1) {
      setTimeout(() => setGameOver(true), 1500);
      try {
        const userRef = doc(db, "usuarios", String(usuario.id));
        await updateDoc(userRef, { bloqueioQuiz: new Date() });
      } catch (err) {
        console.error("Erro ao salvar bloqueio do quiz:", err);
      }
    } else {
      const delay = acertou ? 1500 : 10000;
      setTimeout(() => setMostraControles(true), delay);
    }

    // Atualiza dados no backend em segundo plano
    try {
      const userRef = doc(db, "usuarios", String(usuario.id));
      const uSnap = await getDoc(userRef);
      const totalBanco = uSnap.data()?.recordeQuiz || 0;
      const novoTotal = Math.max(0, totalBanco + pontosVariacao);

      await updateDoc(userRef, { recordeQuiz: novoTotal });

      setRanking(prev =>
        prev.map(p => p.id === String(usuario.id) ? { ...p, recordeQuiz: novoTotal } : p)
          .sort((a, b) => (b.recordeQuiz || 0) - (a.recordeQuiz || 0))
      );

      if (acertou) {
        const progRef = doc(db, "progresso_quiz", String(usuario.id));
        const pSnap = await getDoc(progRef);
        const acertosAtuais = pSnap.exists() ? pSnap.data().acertos || [] : [];
        await setDoc(progRef, { acertos: [...new Set([...acertosAtuais, String(questao.id)])] }, { merge: true });
      }
    } catch (err) {
      console.error("Erro ao processar pontuação/acertos:", err);
    }
  }, [respondido, gameOver, perguntas, indiceAtual, vidas, usuario.id]);

  const proximaQuestao = () => {
    if (indiceAtual < perguntas.length - 1) {
      setIndiceAtual(v => v + 1);
      setRespondido(false);
      setOpcaoSelecionada(null);
      setTempoRestante(10);
      setMostraControles(false);
    } else {
      setGameOver(true);
    }
  };

  useEffect(() => {
    if (respondido || gameOver || loading || perguntas.length === 0) {
        return;
    }

    const timerId = setInterval(() => {
        setTempoRestante(prev => {
            if (prev > 1) {
                return prev - 1;
            } else {
                clearInterval(timerId);
                validarResposta(null); // Tempo esgotado, conta como resposta errada
                return 0;
            }
        });
    }, 1000);

    return () => clearInterval(timerId);
  }, [respondido, gameOver, loading, indiceAtual]);

  useEffect(() => {
    if (cooldown === null) return;

    if (cooldown <= 0) {
      setCooldown(null); // Para o timer
      carregarJogo(); // Tenta carregar o jogo novamente
      return;
    }

    const timerId = setInterval(() => {
      setCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timerId);
  }, [cooldown, carregarJogo]);

  useEffect(() => { carregarJogo(); }, [carregarJogo]);

  if (loading) return <div className="p-20 text-center font-black text-gold animate-pulse italic">CARREGANDO...</div>;

  if (cooldown) {
    const minutos = String(Math.floor(cooldown / 60)).padStart(2, '0');
    const segundos = String(cooldown % 60).padStart(2, '0');
    return (
      <div className="max-w-xl mx-auto bg-slate-900 p-10 rounded-[3rem] border border-rose-500/30 text-center italic shadow-2xl">
        <Clock size={60} className="mx-auto text-rose-500 mb-6 animate-pulse" />
        <h2 className="text-2xl font-black text-white uppercase mb-2">Acesso Temporário Bloqueado</h2>
        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mb-6">Suas vidas acabaram. Tente em:</p>
        <div className="text-5xl font-black text-rose-500 mb-8 tabular-nums text-center">{minutos}:{segundos}</div>
        <button onClick={carregarJogo} className="bg-white/10 text-white px-8 py-3 rounded-xl font-black uppercase text-xs">Verificar</button>
      </div>
    );
  }

  if (gameOver || (perguntas.length === 0 && !loading)) return (
    <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in zoom-in duration-500 italic">
      <div className="bg-slate-900 rounded-[3rem] p-10 border border-gold/20 shadow-2xl text-center flex flex-col justify-center">
        <Trophy size={60} className="text-gold mx-auto mb-4 drop-shadow-gold" />
        <h2 className="text-3xl font-black text-white uppercase mb-2">Fim de Jogo</h2>
        <p className={`text-5xl font-black mb-10 text-center ${score >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
            {score > 0 ? `+${score}` : score}
        </p>
        <button onClick={carregarJogo} className="w-full bg-gold text-navy font-black py-4 rounded-xl uppercase flex items-center justify-center gap-2 hover:bg-white transition-all shadow-xl"><RotateCcw size={18} /> Novo Jogo</button>
      </div>

      <div className="bg-slate-900 rounded-[3rem] p-8 border border-white/5 shadow-2xl text-left">
        <h3 className="text-xl font-black text-white uppercase mb-6 flex items-center gap-2 text-left"><Medal className="text-gold" size={24} /> Ranking Global</h3>
        <div className="space-y-3">
          {ranking.map((p, i) => (
            <div key={p.id} className={`flex justify-between items-center p-4 rounded-2xl border ${p.id === String(usuario.id) ? 'bg-gold/10 border-gold/50 shadow-gold/5 shadow-lg' : 'bg-white/5 border-white/10'}`}>
              <div className="flex items-center gap-3 text-left">
                <span className="font-black text-gold text-lg shrink-0">#{i+1}</span>
                <div className="shrink-0">
                  {p.fotoUrl ? (
                    <img src={p.fotoUrl} alt="" className="w-6 h-6 rounded-full object-cover border border-white/10 shadow-sm" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center font-bold text-[10px] text-white uppercase">{p.nome?.charAt(0) || '?'}</div>
                  )}
                </div>
                <span className="font-bold text-white uppercase text-[10px] tracking-widest leading-none truncate">{p.nome}</span>
              </div>
              <span className="font-black text-white bg-white/10 px-3 py-1 rounded-lg text-sm">{p.recordeQuiz || 0}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 italic font-sans animate-in fade-in">
      <div className="flex justify-between items-center bg-slate-900/80 p-6 rounded-[2rem] border border-white/10 shadow-xl backdrop-blur-md">
        <div className="text-left">
          <p className="text-[10px] font-black text-gold uppercase tracking-[0.4em] mb-2 text-left leading-none">Vidas</p>
          <div className="flex gap-2">
            {[...Array(3)].map((_, i) => (
              <Cross key={i} size={20} className={`${i < vidas ? 'text-rose-600 fill-rose-600' : 'text-slate-800'} transition-all duration-500`} />
            ))}
          </div>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-black text-gold uppercase tracking-[0.4em] mb-1 text-center leading-none">TEMPO</p>
          <p className={`text-3xl font-black tabular-nums text-center transition-colors ${tempoRestante <= 3 ? 'text-rose-500 animate-pulse' : 'text-white'}`}>{tempoRestante}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-gold uppercase tracking-[0.4em] mb-1 text-right leading-none">Score Partida</p>
          <p className={`text-3xl font-black tabular-nums text-right ${score < 0 ? 'text-rose-500' : 'text-emerald-400'}`}>{score}</p>
        </div>
      </div>

      <div className={`bg-slate-900 rounded-[2rem] transition-all duration-500 border border-white/5 text-left relative overflow-hidden shadow-2xl ${respondido ? 'p-4 md:p-6' : 'p-6 md:p-8'}`}>
        <h3 className={`font-black text-white relative z-10 text-left leading-tight tracking-tight transition-all duration-300 ${respondido ? 'text-base md:text-lg mb-2' : 'text-lg md:text-xl mb-6'}`}>{perguntas[indiceAtual]?.pergunta}</h3>
        <div className={`grid grid-cols-1 md:grid-cols-2 relative z-10 text-left transition-all duration-300 ${respondido ? 'gap-1.5 md:gap-2' : 'gap-2 md:gap-3'}`}>
          {perguntas[indiceAtual]?.opcoes.map((op, i) => {
            const isSelected = op === opcaoSelecionada;
            const isCorrect = op === perguntas[indiceAtual].resposta_correta;
            
            // Lógica UX: Quando respondido, as opções erradas que não foram selecionadas ficam menores para economizar espaço
            const isUnessential = respondido && !isSelected && !isCorrect;

            return (
              <button key={i} disabled={respondido} onClick={() => validarResposta(op)}
                className={`rounded-xl border-2 font-bold text-left transition-all duration-300 flex items-center justify-between text-[11px] md:text-sm
                ${respondido 
                  ? (isCorrect 
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500 p-2.5 md:p-3 min-h-[45px]' 
                      : (isSelected 
                          ? 'bg-rose-500/10 border-rose-500 text-rose-500 p-2.5 md:p-3 min-h-[45px]' 
                          : 'opacity-40 border-white/5 text-slate-500 p-2 min-h-[30px] text-[9px] md:text-xs'
                        )
                    ) 
                  : 'bg-white/5 border-white/10 text-slate-300 hover:border-gold/40 p-3 md:p-4 min-h-[60px] md:min-h-[70px]'
                } ${isUnessential ? 'hidden md:flex' : 'flex'}`}>
                <span className="text-left leading-tight pr-2">{op}</span>
                {respondido && (
                  <div className="flex-shrink-0">
                    {isCorrect && <CheckCircle2 size={isUnessential ? 14 : 18} className="text-emerald-500 animate-in zoom-in" />}
                    {isSelected && !isCorrect && <CircleX size={18} className="text-rose-500 animate-in zoom-in" />}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {respondido && (
          <div className="mt-2 space-y-2 animate-in slide-in-from-bottom-3 duration-500 text-left relative z-20">
            <div className="p-2.5 md:p-3 bg-gold/5 rounded-xl border-l-4 border-gold text-left flex flex-col justify-center">
              <p className="text-gold text-[8px] md:text-[9px] font-black uppercase tracking-widest mb-0.5 text-left">Fonte</p>
              <p className="text-white font-bold italic text-xs md:text-sm leading-snug text-left">{perguntas[indiceAtual].referencia}</p>
            </div>
            
            {mostraControles ? (
              <div className="flex flex-col sm:flex-row gap-2 mt-1.5 animate-in fade-in">
                <button onClick={proximaQuestao} className="w-full sm:flex-1 bg-gold text-navy font-black py-2 md:py-3 rounded-lg uppercase flex items-center justify-center gap-2 hover:bg-white transition-all shadow-xl text-[11px] md:text-sm">
                  Próxima <ArrowRight size={14} />
                </button>
                <button onClick={() => setGameOver(true)} className="w-full sm:w-auto bg-white/5 text-white/40 font-black py-2 md:py-3 px-4 rounded-lg uppercase text-[9px] tracking-wider hover:bg-rose-500/20 hover:text-rose-500 transition-all shadow-none">
                  Parar
                </button>
              </div>
            ) : (
              !gameOver && (
                <div className="mt-4 text-center animate-in fade-in">
                  <Loader2 className="animate-spin text-gold mx-auto" size={24} />
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}