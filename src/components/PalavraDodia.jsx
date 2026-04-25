import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../database/firebase';
import { doc, onSnapshot, runTransaction, serverTimestamp, collection, getDocs, query, orderBy, getDoc } from 'firebase/firestore';
import { BookOpen, Cross, Heart, Loader2, X, Share2, Facebook, Instagram, Copy, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

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

function lerUsuarioLogado() {
  try {
    const salvo = sessionStorage.getItem('usuarioLogado');
    return salvo ? JSON.parse(salvo) : null;
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

  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const palavraDoDia = useMemo(() => obterPalavraDoDia(), []);
  const usuarioLogado = useMemo(() => lerUsuarioLogado(), []);
  const usuarioId = String(usuarioLogado?.id || '');

  useEffect(() => {
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

    return () => {
      unsubCurtidas();
      unsubUsuario();
    };
  }, [palavraDoDia.id, usuarioId]);

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
      
      const usersData = [];
      for (const docSnap of snap.docs) {
        const likeData = docSnap.data();
        let fotoUrl = null;

        try {
          const userDocRef = doc(db, 'usuarios', String(likeData.usuarioId));
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            fotoUrl = userDocSnap.data().fotoUrl;
          }
        } catch (err) {
          console.error('Erro ao buscar foto do usuario:', err);
        }

        usersData.push({
          ...likeData,
          fotoUrl: fotoUrl
        });
      }
      setUsuariosQueCurtiram(usersData);
    } catch (error) {
      console.error('Erro ao buscar usuarios que curtiram:', error);
    } finally {
      setCarregandoUsuarios(false);
    }
  };

  const handleShareWhatsApp = () => {
    const texto = `*Palavra do Dia*\n_"${palavraDoDia.texto}"_\n- ${palavraDoDia.referencia}\n\nConfira no nosso app!`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`, '_blank');
    setShowShareMenu(false);
  };

  const handleShareFacebook = () => {
    const url = window.location.origin;
    const texto = `Palavra do Dia: "${palavraDoDia.texto}" - ${palavraDoDia.referencia}`;
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(texto)}`, '_blank');
    setShowShareMenu(false);
  };

  const handleCopiarTexto = async () => {
    const texto = `Palavra do Dia: "${palavraDoDia.texto}" - ${palavraDoDia.referencia}\n\nConfira no nosso app!`;
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => {
        setCopiado(false);
        setShowShareMenu(false);
      }, 2000);
    } catch (err) {
      console.error('Erro ao copiar', err);
    }
  };

  if (carregando) {
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
        <div className={`flex items-center ${compactTablet ? 'gap-3' : 'gap-3'}`}>
          <div className={`bg-gold/20 rounded-lg flex items-center justify-center border border-gold/30 ${compactTablet ? 'w-10 h-10' : 'w-10 h-10'}`}>
            <BookOpen size={compactTablet ? 18 : 18} className="text-gold" />
          </div>
          <div>
            <p className={`font-bold text-gold uppercase tracking-widest ${compactTablet ? 'text-[9px]' : 'text-[9px]'}`}>Palavra do Dia</p>
            <p className={`font-bold text-white/80 ${compactTablet ? 'text-[11px]' : 'text-[11px]'}`}>{palavraDoDia.referencia}</p>
          </div>
        </div>

        <p className={`font-medium text-slate-100 italic ${compactTablet ? 'text-sm leading-relaxed' : 'text-sm leading-relaxed'}`}>
          "{palavraDoDia.texto}"
        </p>

        <div className={`flex items-center justify-between gap-3 ${compactTablet ? 'pt-1' : 'pt-1'}`}>
          <button 
            type="button"
            onClick={handleOpenLikesModal}
            className={`font-bold uppercase tracking-widest text-slate-300 hover:text-gold transition-colors text-left ${compactTablet ? 'text-[10px]' : 'text-[10px]'} ${totalCurtidas > 0 ? 'cursor-pointer' : 'cursor-default'}`}
          >
            {totalCurtidas} {totalCurtidas === 1 ? 'curtida' : 'curtidas'}
          </button>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className={`inline-flex items-center justify-center rounded-full transition-all bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#25D366] border border-[#25D366]/20 ${compactTablet ? 'w-8 h-8' : 'w-[34px] h-[34px]'}`}
              title="Compartilhar no WhatsApp"
            >
              <svg width={compactTablet ? "14" : "15"} height={compactTablet ? "14" : "15"} viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
              </svg>
            </button>

            <button
              type="button"
              onClick={handleShareFacebook}
              className={`inline-flex items-center justify-center rounded-full transition-all bg-[#1877F2]/15 hover:bg-[#1877F2]/25 text-[#1877F2] border border-[#1877F2]/20 ${compactTablet ? 'w-8 h-8' : 'w-[34px] h-[34px]'}`}
              title="Compartilhar no Facebook"
            >
              <Facebook size={compactTablet ? 14 : 15} />
            </button>

            <button
              type="button"
              onClick={handleCopiarTexto}
              className={`inline-flex items-center justify-center rounded-full transition-all ${
                copiado 
                  ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/20' 
                  : 'bg-[#E1306C]/15 hover:bg-[#E1306C]/25 text-[#E1306C] border border-[#E1306C]/20'
              } ${compactTablet ? 'w-8 h-8' : 'w-[34px] h-[34px]'}`}
              title="Copiar para o Instagram"
            >
              {copiado ? <CheckCircle2 size={compactTablet ? 14 : 15} /> : <Instagram size={compactTablet ? 14 : 15} />}
            </button>

            <div className="w-px h-6 bg-white/10 mx-1"></div>

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
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#0f172a] w-full max-w-sm rounded-[24px] shadow-2xl overflow-hidden flex flex-col border border-white/10 transform transition-all animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/5">
              <h3 className="font-bold text-white tracking-wide text-sm uppercase">Quem Curtiu</h3>
              <button onClick={() => setShowLikesModal(false)} className="text-white/50 hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-full p-1.5">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 max-h-[60vh] overflow-y-auto">
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
