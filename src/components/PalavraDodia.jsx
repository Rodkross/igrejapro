import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../database/firebase';
import { removerSenhaDoUsuario } from '../utils/usuario';
import { doc, onSnapshot, runTransaction, serverTimestamp, collection, getDocs, query, orderBy, getDoc } from 'firebase/firestore';
import { BookOpen, Cross, Heart, Loader2, X, Trophy, Medal } from 'lucide-react';
import { Link } from 'react-router-dom';

import imgMedalPaper from '../assets/medal-paper.png';
import imgMedalWood from '../assets/medal-wood.png';
import imgMedalSteel from '../assets/medal-steel.png';
import imgMedalBronze from '../assets/medal-bronze.png';
import imgMedalSilver from '../assets/medal-silver.png';
import imgMedalGold from '../assets/medal-gold.png';
import imgMedalDiamond from '../assets/medal-diamond.png';

const PALAVRAS_DISPONIVEIS = [
  {
    texto: 'Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna.',
    referencia: 'João 3:16',
  },
  {
    texto: 'O Senhor é o meu pastor; nada me faltará.',
    referencia: 'Salmos 23:1',
  },
  {
    texto: 'Porque todos pecaram e destituídos estão da glória de Deus.',
    referencia: 'Romanos 3:23',
  },
  {
    texto: 'Porque pela graça sois salvos, por meio da fé; e isto não vem de vós; é dom de Deus.',
    referencia: 'Efésios 2:8',
  },
  {
    texto: 'Posso todas as coisas naquele que me fortalece.',
    referencia: 'Filipenses 4:13',
  },
  {
    texto: 'Bendito seja o Deus e Pai de nosso Senhor Jesus Cristo, que, segundo a sua grande misericórdia, nos gerou de novo para uma viva esperança.',
    referencia: '1 Pedro 1:3',
  },
  {
    texto: 'Vós sois a luz do mundo; não se pode esconder uma cidade edificada sobre um monte.',
    referencia: 'Mateus 5:14',
  },
  {
    texto: 'Se confessarmos os nossos pecados, ele é fiel e justo para nos perdoar os pecados e nos purificar de toda injustiça.',
    referencia: '1 João 1:9',
  },
  {
    texto: 'E sede cumpridores da palavra, e não somente ouvintes, enganando-vos a vós mesmos.',
    referencia: 'Tiago 1:22',
  },
  {
    texto: 'Por isso vos digo que todas as coisas que pedirdes, orando, crede receber, e tê-las-eis.',
    referencia: 'Marcos 11:24',
  },
];

function formatarChaveDia(data = new Date()) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function calcularIndiceDoDia(chaveDia) {
  return chaveDia
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0) % PALAVRAS_DISPONIVEIS.length;
}

function obterPalavraDoDia() {
  const chaveDia = formatarChaveDia();
  const indice = calcularIndiceDoDia(chaveDia);
  const palavra = PALAVRAS_DISPONIVEIS[indice];

  return {
    ...palavra,
    chaveDia,
    id: `${chaveDia}_${palavra.referencia.replace(/\s+/g, '_').replace(/[:]/g, '-')}`,
  };
}

async function gerarContextoGemini(referencia, texto) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const prompt = `Atue como um pastor e teólogo inspirador. Vou exibir o versículo bíblico "${referencia}": "${texto}".
Gere um devocional diário sobre ele, retornando estritamente um JSON com esta estrutura:
{
  "titulo": "Título curto e impactante (ex: A Promessa da Restauração)",
  "significado": "O significado teológico e contexto deste versículo (2 parágrafos envolventes)",
  "pratica": "Uma aplicação prática, clara e encorajadora para o cristão viver isso hoje (1 parágrafo)"
}`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });

    if (!res.ok) throw new Error('Falha na API do Gemini');
    const data = await res.json();
    const textoJson = data.candidates[0].content.parts[0].text;
    return JSON.parse(textoJson);
  } catch (err) {
    console.error('Erro ao gerar contexto com Gemini:', err);
    return null;
  }
}

function lerUsuarioLogado() {
  try {
    const salvo = localStorage.getItem('usuarioLogado');
    return salvo ? removerSenhaDoUsuario(JSON.parse(salvo)) : null;
  } catch (error) {
    console.error('Erro ao ler usuario da sessao:', error);
    return null;
  }
}

export default function PalavraDodia({ compactTablet = false }) {
  const [carregando, setCarregando] = useState(true);
  const [curtindo, setCurtindo] = useState(false);
  const [totalCurtidas, setTotalCurtidas] = useState(0);
  const [usuarioCurtiu, setUsuarioCurtiu] = useState(false);
  const [erroCurtida, setErroCurtida] = useState('');
  
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [usuariosQueCurtiram, setUsuariosQueCurtiram] = useState([]);
  const [carregandoUsuarios, setCarregandoUsuarios] = useState(false);
  const [devocionaisLidos, setDevocionaisLidos] = useState(0);

  const [palavraDoDia, setPalavraDoDia] = useState(null);
  const usuarioLogado = useMemo(() => lerUsuarioLogado(), []);
  const usuarioId = String(usuarioLogado?.id || '');

  useEffect(() => {
    let montado = true;
    const carregarPalavra = async () => {
      try {
        const chaveDia = formatarChaveDia();
        const docRef = doc(db, 'palavraDodiaGeral', chaveDia);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const dados = docSnap.data();
          
          // Fallback caso já exista o documento hoje, mas a IA falhou anteriormente ou a API key não estava presente
          if (!dados.aiTitulo && import.meta.env.VITE_GEMINI_API_KEY) {
            try {
              const aiContext = await gerarContextoGemini(dados.referencia, dados.texto);
              if (aiContext) {
                const novosDados = { 
                  ...dados, 
                  aiTitulo: aiContext.titulo, 
                  aiSignificado: aiContext.significado, 
                  aiPratica: aiContext.pratica 
                };
                
                await runTransaction(db, async (transaction) => {
                  transaction.update(docRef, {
                    aiTitulo: aiContext.titulo,
                    aiSignificado: aiContext.significado,
                    aiPratica: aiContext.pratica
                  });
                });
                
                if (montado) {
                  setPalavraDoDia(novosDados);
                  return;
                }
              }
            } catch (err) {
              console.error('Erro ao gerar contexto fallback:', err);
            }
          }
          
          if (montado) setPalavraDoDia(dados);
        } else {
          const res = await fetch('https://bible-api.com/?random=verse&translation=almeida');
          const data = await res.json();
          const textoLimpo = data.text.trim();
          
          let aiContext = null;
          if (import.meta.env.VITE_GEMINI_API_KEY) {
             aiContext = await gerarContextoGemini(data.reference, textoLimpo);
          }

          const novaPalavra = {
            texto: textoLimpo,
            referencia: data.reference,
            chaveDia,
            id: `${chaveDia}_${data.reference.replace(/\s+/g, '_').replace(/[:]/g, '-')}`,
            ...(aiContext ? { aiTitulo: aiContext.titulo, aiSignificado: aiContext.significado, aiPratica: aiContext.pratica } : {})
          };
          
          try {
            const finalPalavra = await runTransaction(db, async (transaction) => {
              const snap = await transaction.get(docRef);
              if (snap.exists()) {
                return snap.data();
              }
              transaction.set(docRef, novaPalavra);
              return novaPalavra;
            });
            if (montado) setPalavraDoDia(finalPalavra);
          } catch (txError) {
            console.error('Erro na transaction:', txError);
            if (montado) setPalavraDoDia(novaPalavra);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar palavra do dia:', error);
        if (montado) setPalavraDoDia(obterPalavraDoDia());
      }
    };

    carregarPalavra();
    return () => { montado = false; };
  }, []);

  useEffect(() => {
    if (!palavraDoDia) return;

    const curtidasRef = doc(db, 'palavraDodiaCurtidas', palavraDoDia.id);
    const unsubCurtidas = onSnapshot(curtidasRef, (docSnap) => {
      setTotalCurtidas(Number(docSnap.data()?.curtidas || 0));
      setCarregando(false);
    }, () => {
      setCarregando(false);
    });

    if (!usuarioId) {
      setUsuarioCurtiu(false);
      return () => unsubCurtidas();
    }

    const usuarioCurtiuRef = doc(db, 'palavraDodiaCurtidas', palavraDoDia.id, 'usuarios', usuarioId);
    const unsubUsuario = onSnapshot(usuarioCurtiuRef, (docSnap) => {
      setUsuarioCurtiu(docSnap.exists());
    });

    const usuarioRef = doc(db, 'usuarios', usuarioId);
    const unsubPerfil = onSnapshot(usuarioRef, (docSnap) => {
      if (docSnap.exists()) {
        setDevocionaisLidos(Number(docSnap.data()?.devocionaisLidos) || 0);
      }
    });

    return () => {
      unsubCurtidas();
      unsubUsuario();
      unsubPerfil();
    };
  }, [palavraDoDia, usuarioId]);

  const getMedalhaInfo = () => {
    if (devocionaisLidos >= 365) return { nome: 'Diamante', image: imgMedalDiamond, cor: 'text-cyan-400', next: null };
    if (devocionaisLidos >= 200) return { nome: 'Ouro', image: imgMedalGold, cor: 'text-yellow-400', next: 365 };
    if (devocionaisLidos >= 100) return { nome: 'Prata', image: imgMedalSilver, cor: 'text-slate-300', next: 200 };
    if (devocionaisLidos >= 30) return { nome: 'Bronze', image: imgMedalBronze, cor: 'text-amber-500', next: 100 };
    if (devocionaisLidos >= 25) return { nome: 'Aço', image: imgMedalSteel, cor: 'text-slate-400', next: 30 };
    if (devocionaisLidos >= 10) return { nome: 'Madeira', image: imgMedalWood, cor: 'text-orange-300', next: 25 };
    if (devocionaisLidos >= 5) return { nome: 'Papel', image: imgMedalPaper, cor: 'text-stone-300', next: 10 };
    return { nome: 'Iniciante', image: null, cor: 'text-white/60', next: 5 };
  };

  const renderMedalha = () => {
    if (devocionaisLidos === 0) return null;
    const info = getMedalhaInfo();
    const progresso = info.next ? Math.min(100, Math.max(0, Math.round((devocionaisLidos / info.next) * 100))) : 100;
    
    return (
      <div className="flex flex-col items-end shrink-0">
        <div className="flex flex-col items-center">
          {info.image ? (
            <img src={info.image} alt={info.nome} className="w-14 h-14 object-contain drop-shadow-xl" />
          ) : (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-white/10 border-white/10 ${info.cor}`}>
              <BookOpen size={14}/>
              <span className="text-[9px] font-black uppercase tracking-widest">{info.nome}</span>
            </div>
          )}
        </div>
        {info.next && (
          <div className="flex items-center gap-2 mt-1 w-full justify-end">
            <span className="text-[8px] font-bold text-white/40 uppercase">{devocionaisLidos}/{info.next}</span>
            <div className="w-12 h-1 bg-white/10 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${info.cor.replace('text-', 'bg-')}`} style={{ width: `${progresso}%` }} />
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleCurtir = async () => {
    if (!usuarioId || usuarioCurtiu || curtindo) return;

    setCurtindo(true);
    setErroCurtida('');

    const curtidasRef = doc(db, 'palavraDodiaCurtidas', palavraDoDia.id);
    const usuarioCurtiuRef = doc(db, 'palavraDodiaCurtidas', palavraDoDia.id, 'usuarios', usuarioId);

    try {
      await runTransaction(db, async (transaction) => {
        const curtidaUsuarioSnap = await transaction.get(usuarioCurtiuRef);
        if (curtidaUsuarioSnap.exists()) return;

        const curtidasSnap = await transaction.get(curtidasRef);
        const totalAtual = Number(curtidasSnap.data()?.curtidas || 0);

        transaction.set(curtidasRef, {
          curtidas: totalAtual + 1,
          referencia: palavraDoDia.referencia,
          texto: palavraDoDia.texto,
          chaveDia: palavraDoDia.chaveDia,
          updatedAt: serverTimestamp(),
        }, { merge: true });

        transaction.set(usuarioCurtiuRef, {
          usuarioId,
          usuarioNome: usuarioLogado?.nome || 'Usuario',
          curtidoEm: serverTimestamp(),
        });
      });
    } catch (error) {
      console.error('Erro ao curtir palavra do dia:', error);
      setErroCurtida('Nao foi possivel registrar sua curtida.');
    } finally {
      setCurtindo(false);
    }
  };

  const handleOpenLikesModal = async () => {
    if (totalCurtidas === 0) return;
    setShowLikesModal(true);
    setCarregandoUsuarios(true);

    try {
      const usuariosRef = collection(db, 'palavraDodiaCurtidas', palavraDoDia.id, 'usuarios');
      const q = query(usuariosRef, orderBy('curtidoEm', 'desc'));
      const snap = await getDocs(q);

      const userPromises = snap.docs.map(async (docSnap) => {
        const likeData = docSnap.data();
        let fotoUrl = null;
        try {
          if (likeData.usuarioId) {
            const userDocRef = doc(db, 'usuarios', String(likeData.usuarioId));
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
              fotoUrl = userDocSnap.data().fotoUrl;
            }
          }
        } catch (err) {
          console.error('Erro ao buscar foto do usuario:', err);
        }
        return { ...likeData, fotoUrl };
      });

      const usersData = await Promise.all(userPromises);
      setUsuariosQueCurtiram(usersData);
    } catch (error) {
      console.error('Erro ao buscar usuarios que curtiram:', error);
    } finally {
      setCarregandoUsuarios(false);
    }
  };

  if (carregando || !palavraDoDia) {
    return (
      <div className={`bg-gradient-hero rounded-2xl border border-white/10 shadow-elegant flex items-center justify-center ${compactTablet ? 'p-5 md:p-5 xl:p-6 min-h-[120px]' : 'p-6 min-h-[120px]'}`}>
        <Loader2 className="animate-spin text-gold" size={24} />
      </div>
    );
  }

  return (
    <div className={`bg-gradient-hero rounded-2xl border border-white/10 shadow-elegant overflow-hidden relative ${compactTablet ? 'p-5 md:p-5 xl:p-6' : 'p-6'}`}>
      <Cross
        size={compactTablet ? 112 : 120}
        className="absolute -right-4 -bottom-6 text-white/5 rotate-[-12deg] pointer-events-none"
      />
      <div className="absolute -bottom-8 -right-8 w-24 h-24 rounded-full bg-gold/10 blur-3xl"></div>

      <div className={`relative z-10 flex flex-col ${compactTablet ? 'gap-4' : 'gap-4'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className={`flex items-center ${compactTablet ? 'gap-3' : 'gap-3'}`}>
            <div className={`bg-gold/20 rounded-lg flex items-center justify-center border border-gold/30 ${compactTablet ? 'w-10 h-10' : 'w-10 h-10'}`}>
              <BookOpen size={compactTablet ? 18 : 18} className="text-gold" />
            </div>
            <div>
              <p className={`font-bold text-gold uppercase tracking-widest ${compactTablet ? 'text-[9px]' : 'text-[9px]'}`}>Palavra do Dia</p>
              <p className={`font-bold text-white/80 ${compactTablet ? 'text-[11px]' : 'text-[11px]'}`}>{palavraDoDia.referencia}</p>
            </div>
          </div>
          {renderMedalha()}
        </div>

        <p className={`font-medium text-slate-100 italic ${compactTablet ? 'text-sm leading-relaxed' : 'text-sm leading-relaxed'}`}>
          "{palavraDoDia.texto}"
        </p>

        <div className={`flex flex-wrap items-center justify-between gap-3 ${compactTablet ? 'pt-1' : 'pt-1'}`}>
          <button 
            type="button"
            onClick={handleOpenLikesModal}
            className={`font-bold uppercase tracking-widest text-slate-300 hover:text-gold transition-colors text-left ${compactTablet ? 'text-[10px]' : 'text-[10px]'} ${totalCurtidas > 0 ? 'cursor-pointer' : 'cursor-default'}`}
          >
            {totalCurtidas} {totalCurtidas === 1 ? 'curtida' : 'curtidas'}
          </button>

          <div className="flex items-center">
            <button
              type="button"
              onClick={handleCurtir}
              disabled={!usuarioId || usuarioCurtiu || curtindo}
              className={`inline-flex items-center gap-2 rounded-xl font-bold uppercase tracking-wider transition-all border h-[34px] ${compactTablet ? 'px-3 sm:px-4 text-[10px] sm:text-[11px]' : 'px-4 text-[11px]'} ${
                usuarioCurtiu
                  ? 'bg-rose-500/20 text-rose-200 border-rose-300/30'
                  : 'bg-white/10 text-white border-white/15 hover:bg-white/15'
              } disabled:opacity-70 disabled:cursor-not-allowed`}
            >
              {curtindo ? <Loader2 size={compactTablet ? 14 : 14} className="animate-spin" /> : <Heart size={compactTablet ? 14 : 14} className={usuarioCurtiu ? 'fill-current' : ''} />}
              <span className={compactTablet ? 'hidden sm:inline' : ''}>{usuarioCurtiu ? 'Curtido' : 'Curtir'}</span>
            </button>
          </div>
        </div>

        {erroCurtida && (
          <p className="text-[10px] font-bold uppercase tracking-wider text-rose-200">
            {erroCurtida}
          </p>
        )}

        <div className="pt-3 mt-1 border-t border-white/10">
          <Link
            to={`/estudo-palavra?ref=${encodeURIComponent(palavraDoDia.referencia)}&text=${encodeURIComponent(palavraDoDia.texto)}`}
            className="block text-center text-gold/80 hover:text-gold transition-colors font-semibold text-xs py-1"
          >
            Se aprofunde nesse versículo →
          </Link>
        </div>
      </div>

      {showLikesModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900/80 backdrop-blur-lg w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-white/10 transform transition-all animate-in zoom-in-95 duration-200 max-h-[calc(100vh-2rem)]">
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/5 shrink-0">
              <h3 className="font-bold text-white tracking-wide text-sm uppercase">Quem Curtiu</h3>
              <button onClick={() => setShowLikesModal(false)} className="text-white/50 hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-full p-1.5">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-5">
              {carregandoUsuarios ? (
                <div className="flex justify-center items-center py-8">
                   <Loader2 className="animate-spin text-gold" size={24} />
                </div>
              ) : usuariosQueCurtiram.length > 0 ? (
                <ul className="flex flex-col gap-3">
                  {usuariosQueCurtiram.map((u, i) => (
                    <li key={i} className="flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/5">
                       {u.fotoUrl ? (
                         <img 
                           src={u.fotoUrl} 
                           alt={`Foto de ${u.usuarioNome}`} 
                           className="w-10 h-10 rounded-full object-cover border border-white/10 shrink-0 shadow-sm"
                         />
                       ) : (
                         <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-gold/40 to-gold/10 flex items-center justify-center text-gold font-bold border border-gold/20 shrink-0 shadow-sm">
                            {u.usuarioNome?.charAt(0).toUpperCase() || 'U'}
                         </div>
                       )}
                       <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-slate-200 truncate">{u.usuarioNome}</p>
                       </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-center text-white/50 py-8 text-sm">Nenhuma curtida encontrada.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
