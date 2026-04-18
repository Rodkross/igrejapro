import React, { useState, useEffect } from 'react';
import { db } from '../../database/firebase';
import { collection, getDocs, doc, updateDoc, orderBy, setDoc, getDoc, query, limit } from 'firebase/firestore';
import { Trophy, ArrowRight, RotateCcw, CheckCircle2, XCircle, PlusCircle, Gamepad2, Medal, Ban, Cross, Clock } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';

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

  const carregarJogo = async () => {
    setLoading(true);
    try {
      // 1. Verificar Cooldown
      const userRef = doc(db, "usuarios", String(usuario.id));
      const userSnap = await getDoc(userRef);
      const timestampBloqueio = userSnap.data()?.bloqueioQuiz?.seconds * 1000;
      
      if (timestampBloqueio) {
        const agora = new Date().getTime();
        if (agora - timestampBloqueio < 30 * 60 * 1000) {
          setCooldown(Math.ceil((30 * 60 * 1000 - (agora - timestampBloqueio)) / 60000));
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
    if (respondido || gameOver) return;
    
    const questao = perguntas[indiceAtual];
    const acertou = opcao === questao.resposta_correta;
    const pontosVariacao = acertou ? 10 : -5;

    // ATUALIZAÇÃO IMEDIATA DO ESTADO VISUAL
    setOpcaoSelecionada(opcao);
    setRespondido(true);
    setScore(prev => prev + pontosVariacao);
    if (!acertou) setVidas(v => v - 1);

    try {
      const userRef = doc(db, "usuarios", String(usuario.id));
      const uSnap = await getDoc(userRef);
      const totalBanco = uSnap.data()?.recordeQuiz || 0;
      const novoTotal = Math.max(0, totalBanco + pontosVariacao);

      // 1. Grava novo total no Firebase
      await updateDoc(userRef, { recordeQuiz: novoTotal });

      // 2. Atualiza Ranking local para refletir na hora
      setRanking(prev => 
        prev.map(p => p.id === String(usuario.id) ? { ...p, recordeQuiz: novoTotal } : p)
            .sort((a, b) => (b.recordeQuiz || 0) - (a.recordeQuiz || 0))
      );

      // 3. Se acertou, salva nos acertos
      if (acertou) {
        const progRef = doc(db, "progresso_quiz", String(usuario.id));
        const pSnap = await getDoc(progRef);
        const acertosAtuais = pSnap.exists() ? pSnap.data().acertos || [] : [];
        await setDoc(progRef, { acertos: [...new Set([...acertosAtuais, String(questao.id)])] }, { merge: true });
      }

      // 4. Se perdeu a última vida
      if (!acertou && vidas <= 1) {
        await updateDoc(userRef, { bloqueioQuiz: new Date() });
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
    } else {
      setGameOver(true);
    }
  };

  useEffect(() => { carregarJogo(); }, []);

  if (loading) return <div className="p-20 text-center font-black text-gold animate-pulse italic">CARREGANDO...</div>;

  if (cooldown) return (
    <div className="max-w-xl mx-auto bg-slate-900 p-10 rounded-[3rem] border border-rose-500/30 text-center italic shadow-2xl">
      <Clock size={60} className="mx-auto text-rose-500 mb-6 animate-pulse" />
      <h2 className="text-2xl font-black text-white uppercase mb-2">Acesso Temporário Bloqueado</h2>
      <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mb-6">Suas vidas acabaram. Tente em:</p>
      <div className="text-5xl font-black text-rose-500 mb-8 tabular-nums text-center">{cooldown} MIN</div>
      <button onClick={carregarJogo} className="bg-white/10 text-white px-8 py-3 rounded-xl font-black uppercase text-xs">Verificar</button>
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
                <span className="font-black text-gold text-lg">#{i+1}</span>
                <span className="font-bold text-white uppercase text-[10px] tracking-widest leading-none">{p.nome}</span>
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
        <div className="text-right">
          <p className="text-[10px] font-black text-gold uppercase tracking-[0.4em] mb-1 text-right leading-none">Score Partida</p>
          <p className={`text-3xl font-black tabular-nums text-right ${score < 0 ? 'text-rose-500' : 'text-emerald-400'}`}>{score}</p>
        </div>
      </div>

      <div className="bg-slate-900 rounded-[3rem] p-8 border border-white/5 text-left relative overflow-hidden shadow-2xl">
        <h3 className="text-xl md:text-2xl font-black text-white mb-10 relative z-10 text-left leading-tight tracking-tight">"{perguntas[indiceAtual]?.pergunta}"</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10 text-left">
          {perguntas[indiceAtual]?.opcoes.map((op, i) => (
            <button key={i} disabled={respondido} onClick={() => validarResposta(op)}
              className={`p-6 rounded-2xl border-2 font-black text-left transition-all min-h-[80px] ${respondido ? (op === perguntas[indiceAtual].resposta_correta ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500' : (op === opcaoSelecionada ? 'bg-rose-500/10 border-rose-500 text-rose-500' : 'opacity-10 border-white/5')) : 'bg-white/5 border-white/10 text-slate-300 hover:border-gold/40'}`}>
              <span className="text-left leading-tight">{op}</span>
            </button>
          ))}
        </div>

        {respondido && (
          <div className="mt-10 space-y-4 animate-in slide-in-from-bottom-3 duration-500 text-left">
            <div className="p-6 bg-gold/5 rounded-2xl border-l-4 border-gold text-left">
              <p className="text-gold text-[10px] font-black uppercase tracking-widest mb-1 text-left">Fonte da Verdade</p>
              <p className="text-white font-black italic text-lg leading-snug text-left">{perguntas[indiceAtual].referencia}</p>
            </div>
            <button onClick={proximaQuestao} className="w-full bg-gold text-navy font-black py-5 rounded-xl uppercase flex items-center justify-center gap-2 hover:bg-white transition-all shadow-xl">
              Próxima Questão <ArrowRight size={20}/>
            </button>
            <button onClick={() => setGameOver(true)} className="w-full bg-white/5 text-white/40 font-black py-3 rounded-xl uppercase text-[10px] tracking-widest hover:bg-rose-500/20 hover:text-rose-500 transition-all shadow-none">
              Parar e Ver Ranking
            </button>
          </div>
        )}
      </div>
    </div>
  );
}