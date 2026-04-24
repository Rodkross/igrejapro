import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../database/firebase';
import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { BookOpen, Cross, Heart, Loader2 } from 'lucide-react';

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
          <div className={`font-bold uppercase tracking-widest text-slate-300 ${compactTablet ? 'text-[10px]' : 'text-[10px]'}`}>
            {totalCurtidas} {totalCurtidas === 1 ? 'curtida' : 'curtidas'}
          </div>

          <button
            type="button"
            onClick={handleCurtir}
            disabled={!usuarioId || usuarioCurtiu || curtindo}
            className={`inline-flex items-center gap-2 rounded-xl font-bold uppercase tracking-wider transition-all border ${compactTablet ? 'px-4 py-2 text-[11px]' : 'px-4 py-2 text-[11px]'} ${
              usuarioCurtiu
                ? 'bg-rose-500/20 text-rose-200 border-rose-300/30'
                : 'bg-white/10 text-white border-white/15 hover:bg-white/15'
            } disabled:opacity-70 disabled:cursor-not-allowed`}
          >
            {curtindo ? <Loader2 size={compactTablet ? 14 : 14} className="animate-spin" /> : <Heart size={compactTablet ? 14 : 14} className={usuarioCurtiu ? 'fill-current' : ''} />}
            {usuarioCurtiu ? 'Curtido' : 'Curtir'}
          </button>
        </div>

        {erroCurtida && (
          <p className="text-[10px] font-bold uppercase tracking-wider text-rose-200">
            {erroCurtida}
          </p>
        )}
      </div>
    </div>
  );
}
