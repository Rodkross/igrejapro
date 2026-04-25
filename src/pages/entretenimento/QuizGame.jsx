import React, { useState, useEffect } from 'react';
import { db } from '../../database/firebase';
import { collection, getDocs, doc, updateDoc, orderBy, setDoc, getDoc, query, limit } from 'firebase/firestore';
import { Trophy, ArrowRight, RotateCcw, CheckCircle2, XCircle, Medal, Cross, Clock } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';

export default function QuizGame() {
  const { usuario } = useOutletContext();
  const [perguntas, setPerguntas] = useState([]);
  const [indiceAtual, setIndiceAtual] = useState(0);
  const [score, setScore] = useState(0);
  const [vidas, setVidas] = useState(3);
  const [respondido, setRespondido] = useState(false);
  const [opcaoSelecionada, setOpcaoSelecionada] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const [ranking, setRanking] = useState([]);
  const [tempoProximaVida, setTempoProximaVida] = useState(null);
  const [tempoRestante, setTempoRestante] = useState(10);
  const [ultimaReg, setUltimaReg] = useState(null);

  const carregarJogo = async () => {
    setLoading(true);
    try {
      const userRef = doc(db, "usuarios", String(usuario.id));
      const userSnap = await getDoc(userRef);
      const data = userSnap.data();
      
      let vidasDB = data?.vidasQuiz !== undefined ? data.vidasQuiz : 3;
      let ultimaRegDb = data?.ultimaRegeneracaoVida?.toMillis() || Date.now();

      if (vidasDB < 3) {
        const agora = Date.now();
        const tempoPassado = agora - ultimaRegDb;
        const tempoNecessario = 10 * 60 * 1000;
        const vidasGanhas = Math.floor(tempoPassado / tempoNecessario);
        
        if (vidasGanhas > 0) {
          vidasDB = Math.min(3, vidasDB + vidasGanhas);
          ultimaRegDb = ultimaRegDb + (vidasGanhas * tempoNecessario);
          await updateDoc(userRef, { 
            vidasQuiz: vidasDB, 
            ultimaRegeneracaoVida: new Date(ultimaRegDb) 
          });
        }
      }

      setVidas(vidasDB);
      setUltimaReg(ultimaRegDb);

      if (vidasDB > 0) {
        const progressoRef = doc(db, "progresso_quiz", String(usuario.id));
        const progressoSnap = await getDoc(progressoRef);
        const acertadasIds = progressoSnap.exists() ? progressoSnap.data().acertos || [] : [];

        const snapPerguntas = await getDocs(collection(db, "quiz_biblico"));
        const todas = snapPerguntas.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const disponiveis = todas.filter(p => !acertadasIds.includes(String(p.id)));

        if (disponiveis.length > 0) {
          setPerguntas(disponiveis.sort(() => Math.random() - 0.5).slice(0, 10));
        } else {
          setPerguntas([]);
        }
        
        setScore(0);
        setIndiceAtual(0);
        setGameOver(false);
        setRespondido(false);
        setTempoRestante(10);
      }
      
      await carregarRanking();
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const carregarRanking = async () => {
    const q = query(collection(db, "usuarios"), orderBy("recordeQuiz", "desc"), limit(5));
    const snap = await getDocs(q);
    setRanking(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const validarResposta = async (opcao) => {
    if (respondido || gameOver || vidas <= 0) return;
    
    const questao = perguntas[indiceAtual];
    const acertou = opcao !== null && opcao === questao.resposta_correta;
    const pontosVariacao = acertou ? 10 : -5;

    setOpcaoSelecionada(opcao);
    setRespondido(true);
    setScore(prev => prev + pontosVariacao);
    
    let novasVidas = vidas;
    let novaUltimaReg = ultimaReg;

    if (!acertou) {
      novasVidas -= 1;
      setVidas(novasVidas);
      if (vidas === 3) {
        novaUltimaReg = Date.now();
        setUltimaReg(novaUltimaReg);
      }
    }

    try {
      const userRef = doc(db, "usuarios", String(usuario.id));
      const uSnap = await getDoc(userRef);
      const totalBanco = uSnap.data()?.recordeQuiz || 0;
      const novoTotal = Math.max(0, totalBanco + pontosVariacao);

      const updates = { recordeQuiz: novoTotal };
      
      if (!acertou) {
        updates.vidasQuiz = novasVidas;
        if (vidas === 3) {
          updates.ultimaRegeneracaoVida = new Date(novaUltimaReg);
        }
      }

      await updateDoc(userRef, updates);

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

      if (!acertou && novasVidas <= 0) {
        setTimeout(() => setGameOver(true), 1500);
      }
    } catch (err) {
      console.error("Erro ao processar resposta:", err);
    }
  };

  const proximaQuestao = () => {
    if (indiceAtual < perguntas.length - 1) {
      setIndiceAtual(v => v + 1);
      setRespondido(false);
      setOpcaoSelecionada(null);
      setTempoRestante(10);
    } else {
      setGameOver(true);
    }
  };

  useEffect(() => { carregarJogo(); }, []);

  useEffect(() => {
    let interval;
    if (vidas < 3 && ultimaReg) {
      interval = setInterval(() => {
        const agora = Date.now();
        const tempoPassado = agora - ultimaReg;
        const tempoNecessario = 10 * 60 * 1000;
        
        if (tempoPassado >= tempoNecessario) {
          const vidasGanhas = Math.floor(tempoPassado / tempoNecessario);
          if (vidasGanhas > 0) {
            const novasVidas = Math.min(3, vidas + vidasGanhas);
            setVidas(novasVidas);
            setUltimaReg(ultimaReg + (vidasGanhas * tempoNecessario));
            const userRef = doc(db, "usuarios", String(usuario.id));
            updateDoc(userRef, { 
              vidasQuiz: novasVidas, 
              ultimaRegeneracaoVida: new Date(ultimaReg + (vidasGanhas * tempoNecessario)) 
            }).catch(console.error);
          }
        } else {
          const faltam = tempoNecessario - (tempoPassado % tempoNecessario);
          const min = Math.floor(faltam / 60000);
          const sec = Math.floor((faltam % 60000) / 1000);
          setTempoProximaVida(`${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`);
        }
      }, 1000);
    } else {
      setTempoProximaVida(null);
    }
    return () => clearInterval(interval);
  }, [vidas, ultimaReg, usuario.id]);

  useEffect(() => {
    let timer;
    if (!loading && !gameOver && perguntas.length > 0 && !respondido && tempoRestante > 0 && vidas > 0) {
      timer = setInterval(() => {
        setTempoRestante(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            validarResposta(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [loading, gameOver, perguntas, respondido, tempoRestante, vidas, indiceAtual]);

  if (loading) return <div className="p-20 text-center font-black text-gold animate-pulse italic">CARREGANDO...</div>;

  if (vidas <= 0 && !loading) return (
    <div className="max-w-xl mx-auto bg-slate-900 p-10 rounded-[3rem] border border-rose-500/30 text-center italic shadow-2xl animate-in zoom-in">
      <Clock size={60} className="mx-auto text-rose-500 mb-6 animate-pulse" />
      <h2 className="text-3xl font-black text-white uppercase mb-2">Leia mais a Bíblia</h2>
      <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mb-6">Suas vidas acabaram. Próxima vida em:</p>
      <div className="text-5xl font-black text-rose-500 mb-8 tabular-nums text-center">{tempoProximaVida || "00:00"}</div>
      <button onClick={carregarJogo} className="bg-white/10 text-white px-8 py-3 rounded-xl font-black uppercase text-xs hover:bg-white/20 transition-all">Verificar Novamente</button>
    </div>
  );

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
        <div className="text-left w-1/3">
          <p className="text-[10px] font-black text-gold uppercase tracking-[0.4em] mb-2 text-left leading-none">Vidas</p>
          <div className="flex gap-2">
            {[...Array(3)].map((_, i) => (
              <Cross key={i} size={20} className={`${i < vidas ? 'text-rose-600 fill-rose-600' : 'text-slate-800'} transition-all duration-500`} />
            ))}
          </div>
          {vidas < 3 && tempoProximaVida && (
            <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-wider">+1 em {tempoProximaVida}</p>
          )}
        </div>
        
        <div className="flex flex-col items-center justify-center w-1/3">
          <p className="text-[10px] font-black text-gold uppercase tracking-[0.4em] mb-1 leading-none">Tempo</p>
          <p className={`text-4xl font-black tabular-nums transition-colors duration-300 ${tempoRestante <= 3 ? 'text-rose-500 animate-pulse scale-110' : 'text-white'}`}>{tempoRestante}s</p>
        </div>

        <div className="text-right w-1/3">
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
                    {isSelected && !isCorrect && <XCircle size={18} className="text-rose-500 animate-in zoom-in" />}
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
              <p className="text-white font-bold italic text-xs md:text-sm leading-snug text-left">{perguntas[indiceAtual]?.referencia || 'Bíblia Sagrada'}</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 mt-1.5">
              <button onClick={proximaQuestao} className="w-full sm:flex-1 bg-gold text-navy font-black py-2 md:py-3 rounded-lg uppercase flex items-center justify-center gap-2 hover:bg-white transition-all shadow-xl text-[11px] md:text-sm">
                Próxima <ArrowRight size={14}/>
              </button>
              <button onClick={() => setGameOver(true)} className="w-full sm:w-auto bg-white/5 text-white/40 font-black py-2 md:py-3 px-4 rounded-lg uppercase text-[9px] tracking-wider hover:bg-rose-500/20 hover:text-rose-500 transition-all shadow-none">
                Parar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}