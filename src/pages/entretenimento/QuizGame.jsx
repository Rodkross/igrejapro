import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../database/firebase';
import { collection, getDocs, doc, updateDoc, orderBy, setDoc, getDoc, query, limit, deleteField, writeBatch, where } from 'firebase/firestore';
import { useOutletContext } from 'react-router-dom';
import { Clock, Trophy, RotateCcw, Medal, Cross, CheckCircle2, CircleX, ArrowRight, Loader2, BookOpen, Lightbulb, Timer } from 'lucide-react';

const getSeasonKey = () => {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  return `${ano}-${mes}`;
};

const formatarTemporada = (seasonKey) => {
  if (!seasonKey) return null;

  const [ano, mes] = seasonKey.split('-');
  const data = new Date(Number(ano), Number(mes) - 1, 1);
  return data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

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
  const [tempoRestante, setTempoRestante] = useState(15);
  const [mostraControles, setMostraControles] = useState(false);
  const [quizConcluido, setQuizConcluido] = useState(false);
  const [ultimoCampeao, setUltimoCampeao] = useState(null);
  const [ultimaTemporada, setUltimaTemporada] = useState(null);
  const [modalVerseOpen, setModalVerseOpen] = useState(false);
  const [verseLoading, setVerseLoading] = useState(false);
  const [verseData, setVerseData] = useState(null);

  const [dicasRestantes, setDicasRestantes] = useState(3);
  const [dicaRevelada, setDicaRevelada] = useState(false);
  const [usouDicaNestaQuestao, setUsouDicaNestaQuestao] = useState(false);
  const [dicasCooldown, setDicasCooldown] = useState(null);

  const abrirModalVersiculo = async (referencia) => {
    setModalVerseOpen(true);
    setVerseLoading(true);
    setVerseData(null);
    try {
      const url = `https://bible-api.com/${encodeURIComponent(referencia)}?translation=almeida`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.error) {
         setVerseData("Não foi possível carregar o versículo.");
      } else {
         setVerseData(data);
      }
    } catch (err) {
      console.error(err);
      setVerseData("Erro ao buscar o versículo.");
    }
    setVerseLoading(false);
  };

  const handleRevelarDica = async () => {
    if (dicasRestantes > 0 && !dicaRevelada) {
      const novasDicas = dicasRestantes - 1;
      setDicasRestantes(novasDicas);
      setDicaRevelada(true);
      setUsouDicaNestaQuestao(true);

      try {
        const userRef = doc(db, "usuarios", String(usuario.id));
        const updates = { dicasQuiz: novasDicas };
        if (dicasRestantes === 3) { // Estava cheio antes de usar
          updates.ultimaDicaUsadaQuiz = new Date();
          setDicasCooldown(5 * 60); // Inicia o cooldown visual de 5 minutos
        }
        await updateDoc(userRef, updates);
      } catch (err) {
        console.error("Erro ao atualizar dicas:", err);
      }
    }
  };

  const carregarRanking = useCallback(async () => {
    const q = query(collection(db, "usuarios"), orderBy("recordeQuiz", "desc"), limit(5));
    const snap = await getDocs(q);
    setRanking(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, []);

  const sincronizarTemporadaQuiz = useCallback(async () => {
    const temporadaAtual = getSeasonKey();
    const metaRef = doc(db, "quiz_config", "ranking_mensal");
    const metaSnap = await getDoc(metaRef);
    const metaAtual = metaSnap.exists() ? metaSnap.data() : null;

    if (!metaSnap.exists()) {
      await setDoc(metaRef, {
        temporadaAtual,
        ultimaTemporada: null,
        ultimoCampeao: null,
        atualizadoEm: new Date().toISOString()
      }, { merge: true });

      setUltimoCampeao(null);
      setUltimaTemporada(null);
      return;
    }

    setUltimoCampeao(metaAtual?.ultimoCampeao || null);
    setUltimaTemporada(metaAtual?.ultimaTemporada || null);

    if (metaAtual?.temporadaAtual === temporadaAtual) {
      return;
    }

    const rankingAnteriorSnap = await getDocs(query(collection(db, "usuarios"), orderBy("recordeQuiz", "desc"), limit(1)));
    const campeaoAnterior = rankingAnteriorSnap.empty
      ? null
      : (() => {
          const docCampeao = rankingAnteriorSnap.docs[0];
          const dados = docCampeao.data();
          return {
            id: String(docCampeao.id),
            nome: dados.nome || 'Participante',
            fotoUrl: dados.fotoUrl || '',
            pontuacao: dados.recordeQuiz || 0
          };
        })();

    const usuariosSnap = await getDocs(collection(db, "usuarios"));
    const batch = writeBatch(db);

    usuariosSnap.docs.forEach((usuarioDoc) => {
      batch.update(usuarioDoc.ref, { recordeQuiz: 0 });
    });

    batch.set(metaRef, {
      temporadaAtual,
      ultimaTemporada: metaAtual?.temporadaAtual || null,
      ultimoCampeao: campeaoAnterior,
      atualizadoEm: new Date().toISOString()
    }, { merge: true });

    await batch.commit();

    setUltimoCampeao(campeaoAnterior);
    setUltimaTemporada(metaAtual?.temporadaAtual || null);
  }, []);

  const carregarJogo = useCallback(async () => {
    setLoading(true);
    try {
      await sincronizarTemporadaQuiz();
      await carregarRanking(); // Garante o carregamento mesmo se cair no Cooldown depois

      // 1. Verificar Vidas e Cooldown
      const userRef = doc(db, "usuarios", String(usuario.id));
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data() || {};
      const agora = new Date().getTime();
      
      let vidasCalc = userData.vidasQuiz !== undefined ? Number(userData.vidasQuiz) : 3;
      if (isNaN(vidasCalc)) vidasCalc = 3;
      vidasCalc = Math.max(0, vidasCalc); // Bloqueia bug de vidas negativas
      let tsUltimaVida = null;
      if (userData.ultimaVidaPerdidaQuiz) {
          if (typeof userData.ultimaVidaPerdidaQuiz.toMillis === 'function') {
              tsUltimaVida = userData.ultimaVidaPerdidaQuiz.toMillis();
          } else if (userData.ultimaVidaPerdidaQuiz.seconds) {
              tsUltimaVida = userData.ultimaVidaPerdidaQuiz.seconds * 1000;
          } else if (typeof userData.ultimaVidaPerdidaQuiz.getTime === 'function') {
              tsUltimaVida = userData.ultimaVidaPerdidaQuiz.getTime();
          } else {
              tsUltimaVida = new Date(userData.ultimaVidaPerdidaQuiz).getTime();
          }
      }

      // Migração de legacy bloqueioQuiz
      if (userData.bloqueioQuiz?.seconds && !tsUltimaVida && vidasCalc === 3) {
          tsUltimaVida = userData.bloqueioQuiz.seconds * 1000;
          vidasCalc = 0;
      }

      const updates = {};
      const tempoVida = 10 * 60 * 1000; // 10 minutos por vida

      if (vidasCalc < 3 && tsUltimaVida) {
          const dec = agora - tsUltimaVida;
          if (dec >= tempoVida) {
              const recup = Math.floor(dec / tempoVida);
              vidasCalc = Math.min(3, vidasCalc + recup);
              if (vidasCalc === 3) {
                  tsUltimaVida = null;
              } else {
                  tsUltimaVida += recup * tempoVida;
              }

              updates.vidasQuiz = vidasCalc;
              updates.ultimaVidaPerdidaQuiz = tsUltimaVida ? new Date(tsUltimaVida) : deleteField();
              updates.bloqueioQuiz = deleteField();
          }
      }

      if (vidasCalc === 0) {
          const dec = agora - (tsUltimaVida || agora);
          if (dec < tempoVida) {
              setCooldown(Math.ceil((tempoVida - dec) / 1000));
              setVidas(0);
              setLoading(false);
              return;
          }
      }

      // 1.b. Verificar Dicas e Cooldown
      let dicasCalc = userData.dicasQuiz !== undefined ? Number(userData.dicasQuiz) : 3;
      if (isNaN(dicasCalc)) dicasCalc = 3;
      dicasCalc = Math.max(0, dicasCalc);

      let tsUltimaDica = null;
      if (userData.ultimaDicaUsadaQuiz) {
        if (typeof userData.ultimaDicaUsadaQuiz.toMillis === 'function') {
          tsUltimaDica = userData.ultimaDicaUsadaQuiz.toMillis();
        } else if (userData.ultimaDicaUsadaQuiz.seconds) {
          tsUltimaDica = userData.ultimaDicaUsadaQuiz.seconds * 1000;
        } else {
          tsUltimaDica = new Date(userData.ultimaDicaUsadaQuiz).getTime();
        }
      }

      const tempoDica = 5 * 60 * 1000; // 5 minutos por dica

      if (dicasCalc < 3 && tsUltimaDica) {
        const dec = agora - tsUltimaDica;
        if (dec >= tempoDica) {
          const recup = Math.floor(dec / tempoDica);
          dicasCalc = Math.min(3, dicasCalc + recup);
          if (dicasCalc === 3) {
            tsUltimaDica = null;
          } else {
            tsUltimaDica += recup * tempoDica;
          }
          updates.dicasQuiz = dicasCalc;
          updates.ultimaDicaUsadaQuiz = tsUltimaDica ? new Date(tsUltimaDica) : deleteField();
        }
      }

      if (Object.keys(updates).length > 0) {
        await updateDoc(userRef, updates);
      }

      // 2. Filtrar perguntas já acertadas
      const progressoRef = doc(db, "progresso_quiz", String(usuario.id));
      const progressoSnap = await getDoc(progressoRef);
      const acertadasIds = progressoSnap.exists() ? progressoSnap.data().acertos || [] : [];

      const q = query(collection(db, "quiz_biblico"), where("ativo", "==", true));
      const snapPerguntas = await getDocs(q);
      const todas = snapPerguntas.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const perguntasNaoRespondidas = todas.filter(p => !acertadasIds.includes(String(p.id)));
      
      // Pega 10 perguntas aleatórias que ainda não foram respondidas corretamente.
      // Se não houver mais perguntas inéditas, o jogo é considerado concluído.
      const perguntasRodada = perguntasNaoRespondidas.sort(() => Math.random() - 0.5).slice(0, 10);

      if (perguntasRodada.length > 0) {
        setPerguntas(perguntasRodada);
        setQuizConcluido(false);
      } else {
        setPerguntas([]);
        setQuizConcluido(true);
      }
      
      setVidas(vidasCalc);
      setDicasRestantes(dicasCalc);
      setScore(0); // Reseta score da rodada
      setIndiceAtual(0);
      setGameOver(false);
      setRespondido(false);
      setCooldown(null); // Reseta o cooldown
      if (dicasCalc < 3 && tsUltimaDica) {
        const dec = agora - tsUltimaDica;
        setDicasCooldown(Math.ceil((tempoDica - (dec % tempoDica)) / 1000));
      } else {
        setDicasCooldown(null);
      }
      setTempoRestante(15); // Define o tempo da questão para 15 segundos
      setMostraControles(false);
      setDicaRevelada(false);
      setUsouDicaNestaQuestao(false);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [usuario.id, carregarRanking, sincronizarTemporadaQuiz]);

  const reiniciarProgresso = useCallback(async () => {
    setLoading(true);
    try {
      const progressoRef = doc(db, "progresso_quiz", String(usuario.id));
      await setDoc(progressoRef, { acertos: [] }, { merge: true });

      const userRef = doc(db, "usuarios", String(usuario.id));
      await updateDoc(userRef, { 
          bloqueioQuiz: deleteField(),
          vidasQuiz: 3,
          ultimaVidaPerdidaQuiz: deleteField(),
          dicasQuiz: 3,
          ultimaDicaUsadaQuiz: deleteField()
      });

      await carregarJogo();
    } catch (err) {
      console.error("Erro ao reiniciar progresso do quiz:", err);
      setLoading(false);
    }
  }, [usuario.id, carregarJogo]);

  const validarResposta = useCallback(async (opcao) => {
    if (respondido || gameOver) return;

    const questao = perguntas[indiceAtual];
    const acertou = opcao !== null && opcao === questao.resposta_correta;
    const pontosVariacao = acertou ? (usouDicaNestaQuestao ? 5 : 10) : -5;
    const vidasAposResposta = Math.max(0, acertou ? vidas : vidas - 1);

    // ATUALIZAÇÃO IMEDIATA DO ESTADO VISUAL
    setOpcaoSelecionada(opcao);
    setRespondido(true);
    setScore(prev => prev + pontosVariacao);
    setVidas(vidasAposResposta);
    setMostraControles(false);

    // Lógica de fim de jogo ou próxima questão
    if (vidasAposResposta < 1) {
      setTimeout(() => setGameOver(true), 1500);
    } else {
      const delay = acertou ? 1500 : 2000;
      setTimeout(() => setMostraControles(true), delay);
    }

    // Atualiza dados no backend em segundo plano
    try {
      const userRef = doc(db, "usuarios", String(usuario.id));
      const uSnap = await getDoc(userRef);
      const data = uSnap.data() || {};
      const totalBanco = data.recordeQuiz || 0;
      const novoTotal = Math.max(0, totalBanco + pontosVariacao);

      const updates = { recordeQuiz: novoTotal };
      
      if (!acertou) {
          updates.vidasQuiz = vidasAposResposta;
          if (vidas === 3 || (!data.ultimaVidaPerdidaQuiz && !data.bloqueioQuiz)) {
              updates.ultimaVidaPerdidaQuiz = new Date();
              // Inicia o cooldown visual de 10 minutos
              setCooldown(10 * 60);
          }
          if (vidasAposResposta === 0) {
              updates.bloqueioQuiz = deleteField();
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
    } catch (err) {
      console.error("Erro ao processar pontuação/acertos:", err);
    }
  }, [respondido, gameOver, perguntas, indiceAtual, vidas, usuario.id]);

  const proximaQuestao = () => {
    if (indiceAtual < perguntas.length - 1) {
      setIndiceAtual(v => v + 1);
      setRespondido(false);
      setOpcaoSelecionada(null);
      setTempoRestante(15);
      setMostraControles(false);
      setDicaRevelada(false);
      setUsouDicaNestaQuestao(false);
    } else {
      setGameOver(true);
    }
  };

  useEffect(() => {
    if (respondido || gameOver || loading || perguntas.length === 0 || dicaRevelada) {
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
  }, [respondido, gameOver, loading, indiceAtual, dicaRevelada]);

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

  useEffect(() => {
    if (dicasCooldown === null) return;

    if (dicasCooldown <= 0) {
      // Quando o timer de dica acaba, recarrega o jogo para recalcular
      // vidas e dicas de forma sincronizada.
      carregarJogo();
      return;
    }

    const timerId = setInterval(() => {
      setDicasCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timerId);
  }, [dicasCooldown, carregarJogo]);

  useEffect(() => { carregarJogo(); }, [carregarJogo]);

  const renderUltimoCampeao = () => {
    if (!ultimoCampeao) return null;

    return (
      <div className="mb-4 p-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10">
        <p className="text-[10px] font-black text-emerald-300 uppercase tracking-widest mb-2">
          Campeao da Ultima Temporada
        </p>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {ultimoCampeao.fotoUrl ? (
              <img src={ultimoCampeao.fotoUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-white/10 shadow-sm" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-bold text-xs text-white uppercase">
                {ultimoCampeao.nome?.charAt(0) || '?'}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-black text-white uppercase text-[11px] tracking-wider truncate">{ultimoCampeao.nome}</p>
              <p className="text-[9px] text-emerald-200 uppercase tracking-widest">
                {formatarTemporada(ultimaTemporada) || 'Temporada anterior'}
              </p>
            </div>
          </div>
          <span className="font-black text-white bg-white/10 px-3 py-1 rounded-lg text-sm shrink-0">
            {ultimoCampeao.pontuacao || 0}
          </span>
        </div>
      </div>
    );
  };

  if (loading) return <div className="p-20 text-center font-black text-gold animate-pulse italic">CARREGANDO...</div>;

  if (cooldown) {
    const minutos = String(Math.floor(cooldown / 60)).padStart(2, '0');
    const segundos = String(cooldown % 60).padStart(2, '0');
    return (
      <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in zoom-in duration-500 italic">
        <div className="bg-slate-900 rounded-[3rem] p-10 border border-rose-500/30 text-center flex flex-col justify-center shadow-2xl">
          <BookOpen size={60} className="mx-auto text-rose-500 mb-6 animate-pulse" />
          <h2 className="text-3xl font-black text-white uppercase mb-2">Vá ler a Bíblia!</h2>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mb-6 leading-relaxed">Suas vidas acabaram. Estude a Palavra e tente novamente em:</p>
          <div className="text-5xl font-black text-rose-500 mb-8 tabular-nums text-center">{minutos}:{segundos}</div>
          <button onClick={carregarJogo} className="w-full bg-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white py-4 rounded-xl font-black uppercase text-xs transition-all flex items-center justify-center gap-2 shadow-xl">
            <RotateCcw size={18} /> Verificar
          </button>
        </div>

        <div className="bg-slate-900 rounded-[3rem] p-8 border border-white/5 shadow-2xl text-left">
          <h3 className="text-xl font-black text-white uppercase mb-6 flex items-center gap-2 text-left"><Medal className="text-gold" size={24} /> Ranking Global</h3>
          {renderUltimoCampeao()}
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
  }

  if (quizConcluido && !loading) return (
    <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in zoom-in duration-500 italic">
      <div className="bg-slate-900 rounded-[3rem] p-10 border border-emerald-500/20 shadow-2xl text-center flex flex-col justify-center">
        <Trophy size={60} className="text-emerald-400 mx-auto mb-4" />
        <h2 className="text-3xl font-black text-white uppercase mb-2">Quiz Conclui­do</h2>
        <p className="text-slate-300 font-bold uppercase text-[10px] tracking-widest leading-relaxed mb-8">
          Você já acertou todas as perguntas disponi­veis.
        </p>
        <button onClick={reiniciarProgresso} className="w-full bg-emerald-400 text-slate-950 font-black py-4 rounded-xl uppercase flex items-center justify-center gap-2 hover:bg-white transition-all shadow-xl">
          <RotateCcw size={18} /> Reiniciar Progresso
        </button>
      </div>

      <div className="bg-slate-900 rounded-[3rem] p-8 border border-white/5 shadow-2xl text-left">
        <h3 className="text-xl font-black text-white uppercase mb-6 flex items-center gap-2 text-left"><Medal className="text-gold" size={24} /> Ranking Global</h3>
        {renderUltimoCampeao()}
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
        {renderUltimoCampeao()}
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
          <p className="text-[10px] font-black text-gold uppercase tracking-[0.4em] mb-2 text-center leading-none">Dicas</p>
          {dicasCooldown !== null && dicasRestantes < 3 ? (
            <div className="flex flex-col items-center gap-1">
              <div className="flex justify-center items-center gap-1.5">
                {[...Array(3)].map((_, i) => (
                  <Lightbulb key={i} size={16} className={`${i < dicasRestantes ? 'text-yellow-400 fill-yellow-400/30' : 'text-slate-800'} transition-all`} />
                ))}
              </div>
              <span className="text-[9px] text-slate-500 font-bold tabular-nums flex items-center gap-1">
                <Timer size={10} /> {Math.floor(dicasCooldown / 60)}:{(dicasCooldown % 60).toString().padStart(2, '0')}
              </span>
            </div>
          ) : (
            <div className="flex justify-center items-center gap-1.5 h-[26px]">
              {[...Array(3)].map((_, i) => ( <Lightbulb key={i} size={16} className={`${i < dicasRestantes ? 'text-yellow-400 fill-yellow-400/30' : 'text-slate-800'} transition-all`} /> ))}
            </div>
          )}
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
        
        {/* DICA */}
        {perguntas[indiceAtual]?.dica && !respondido && (
          <div className="my-4 text-center">
            {!dicaRevelada ? (
              <button
                onClick={handleRevelarDica}
                disabled={dicasRestantes <= 0}
                className="bg-yellow-500/10 text-yellow-400 text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full border border-yellow-500/20 hover:bg-yellow-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
              >
                <Lightbulb size={14} />
                Usar Dica ({dicasRestantes} restantes)
              </button>
            ) : (
              <div className="p-3 bg-yellow-500/10 border-l-4 border-yellow-500 text-yellow-200 text-sm italic rounded-r-lg animate-in fade-in text-left">
                <p className="font-bold">{perguntas[indiceAtual]?.dica}</p>
              </div>
            )}
          </div>
        )}

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
            
            {usouDicaNestaQuestao && (
              <div 
                className="p-2.5 md:p-3 bg-yellow-500/10 rounded-xl border-l-4 border-yellow-500 text-left flex items-center gap-2"
              >
                <Lightbulb size={16} className="text-yellow-500 shrink-0" />
                <p className="text-yellow-300 font-bold italic text-xs md:text-sm leading-snug text-left">Você usou uma dica nesta questão.</p>
              </div>
            )}

            <div 
              className="p-2.5 md:p-3 bg-gold/5 rounded-xl border-l-4 border-gold text-left flex flex-col justify-center cursor-pointer hover:bg-gold/10 transition-colors shadow-sm"
              onClick={() => abrirModalVersiculo(perguntas[indiceAtual].referencia)}
            >
              <p className="text-gold text-[8px] md:text-[9px] font-black uppercase tracking-widest mb-0.5 text-left flex items-center gap-1">
                <BookOpen size={10} /> Fonte (Clique para ler)
              </p>
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

      {/* Modal de Versículo */}
      {modalVerseOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={() => setModalVerseOpen(false)}>
          <div className="bg-slate-900 border border-gold/30 p-6 md:p-8 rounded-[2rem] max-w-lg w-full shadow-2xl shadow-gold/10 relative animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setModalVerseOpen(false)}
              className="absolute top-5 right-5 text-slate-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-full"
            >
              <CircleX size={24} />
            </button>
            <h3 className="text-xl md:text-2xl font-black text-gold uppercase mb-6 tracking-wider flex items-center gap-3">
              <BookOpen size={24} className="text-gold" />
              {perguntas[indiceAtual]?.referencia}
            </h3>
            
            <div className="text-white/90 font-serif leading-relaxed text-left max-h-[50vh] md:max-h-[60vh] overflow-y-auto pr-3 custom-scrollbar">
              {verseLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <Loader2 className="animate-spin text-gold" size={40} />
                  <span className="text-xs uppercase tracking-widest text-gold/70 font-bold animate-pulse">Buscando na Bíblia...</span>
                </div>
              ) : (
                typeof verseData === 'string' ? (
                  <p className="text-rose-400 italic text-center py-8 font-sans font-bold">{verseData}</p>
                ) : (
                  <div className="space-y-4">
                    {verseData?.verses?.map((v, i) => (
                      <p key={i} className="text-sm md:text-base">
                        <sup className="text-gold font-bold mr-2 text-[10px] md:text-xs">{v.verse}</sup>
                        {v.text}
                      </p>
                    )) || <p className="italic text-center py-6 font-sans">{verseData?.text || 'Versículo não encontrado.'}</p>}
                  </div>
                )
              )}
            </div>
            
            <div className="mt-8 pt-4 border-t border-white/10 flex justify-end">
               <button onClick={() => setModalVerseOpen(false)} className="bg-white/10 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-white/20 transition-colors">
                 Fechar
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
