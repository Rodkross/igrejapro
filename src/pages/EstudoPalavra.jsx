import React, { useEffect, useState, useRef } from 'react';
import * as htmlToImage from 'html-to-image';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { db } from '../database/firebase';
import { doc, updateDoc, onSnapshot, collection, query, where, orderBy, getDoc } from 'firebase/firestore';
import { BookOpen, ArrowLeft, Loader2, Quote, ScrollText, AlertCircle, Info, User, MapPin, Users, Lightbulb, Sparkles, HeartHandshake, Share2, CheckCircle2, Trophy, Medal, Check, ChevronRight } from 'lucide-react';

import imgMedalPaper from '../assets/medal-paper.png';
import imgMedalWood from '../assets/medal-wood.png';
import imgMedalSteel from '../assets/medal-steel.png';
import imgMedalBronze from '../assets/medal-bronze.png';
import imgMedalSilver from '../assets/medal-silver.png';
import imgMedalGold from '../assets/medal-gold.png';
import imgMedalDiamond from '../assets/medal-diamond.png';

function lerUsuarioLogado() {
  try {
    const salvo = sessionStorage.getItem('usuarioLogado');
    return salvo ? JSON.parse(salvo) : null;
  } catch (error) {
    return null;
  }
}

function formatarChaveDia() {
  const data = new Date();
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

import { livrosMetadata, versiculosContexto } from '../data/bibliaMetadata';


export default function EstudoPalavra() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const refUrl = searchParams.get('ref') || 'Desconhecido';
  const txtUrl = searchParams.get('text') || '';

  const [loading, setLoading] = useState(true);
  const [capituloData, setCapituloData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [targetVerseArr, setTargetVerseArr] = useState([]);
  const [copiado, setCopiado] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [aiContext, setAiContext] = useState(null);
  
  // States para Gamificação e Leitura
  const [usuarioData, setUsuarioData] = useState(null);
  const [concluindo, setConcluindo] = useState(false);
  const [showCelebration, setShowCelebration] = useState(null); // { medalha: 'Bronze', dias: 30 }
  const [leitores, setLeitores] = useState([]);
  const scrollContainerRef = useRef(null);
  const usuarioLogado = lerUsuarioLogado();
  const hoje = formatarChaveDia();

  const printRef = useRef(null);

  // Extração do Nome do Livro e Dicionários
  const lastSpaceIdx = refUrl.lastIndexOf(' ');
  const livroPT = lastSpaceIdx !== -1 ? refUrl.substring(0, lastSpaceIdx) : refUrl;

  const metadataLivro = livrosMetadata[livroPT] || null;
  const contextMsg = versiculosContexto[refUrl] || null;

  useEffect(() => {
    const fetchAiContext = async () => {
      try {
        const docRef = doc(db, 'palavraDodiaGeral', hoje);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
           const data = docSnap.data();
           if (data.referencia === refUrl && data.aiTitulo) {
              setAiContext({
                titulo: data.aiTitulo,
                significado: data.aiSignificado,
                pratica: data.aiPratica
              });
           }
        }
      } catch (err) {
        console.error('Erro ao buscar AI context', err);
      }
    };
    fetchAiContext();
  }, [hoje, refUrl]);

  useEffect(() => {
    if (usuarioLogado?.id) {
      const unsub = onSnapshot(doc(db, "usuarios", String(usuarioLogado.id)), (docSnap) => {
        if (docSnap.exists()) {
          setUsuarioData(docSnap.data());
        }
      });
      return () => unsub();
    }
  }, [usuarioLogado?.id]);

  useEffect(() => {
    const q = query(
      collection(db, 'usuarios'),
      where('devocionaisLidos', '>', 0),
      orderBy('devocionaisLidos', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const users = [];
      snap.forEach(docSnap => {
        users.push({ id: docSnap.id, ...docSnap.data() });
      });
      setLeitores(users);
    }, (error) => {
      console.error('Erro ao buscar leitores:', error);
    });
    return () => unsub();
  }, []);

  // Auto-scroll para a posição do usuário logado na trilha
  useEffect(() => {
    if (leitores.length > 0 && usuarioLogado?.id && scrollContainerRef.current) {
      // Usar setTimeout para garantir que a renderização foi concluída
      const timeoutId = setTimeout(() => {
        const el = scrollContainerRef.current.querySelector('#nivel-usuario-logado');
        if (el && scrollContainerRef.current) {
          const container = scrollContainerRef.current;
          const scrollLeft = el.offsetLeft - container.clientWidth / 2 + el.clientWidth / 2;
          container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
        }
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [leitores, usuarioLogado?.id]);

  const handleConcluirDevocional = async () => {
    if (!usuarioLogado?.id || !usuarioData || concluindo) return;
    if (usuarioData.ultimoDevocionalLido === hoje) return;

    setConcluindo(true);
    try {
      const novosLidos = (Number(usuarioData.devocionaisLidos) || 0) + 1;
      await updateDoc(doc(db, "usuarios", String(usuarioLogado.id)), {
        devocionaisLidos: novosLidos,
        ultimoDevocionalLido: hoje
      });
      
      // Checar se bateu alguma meta
      if (novosLidos === 5) setShowCelebration({ nome: 'Papel', nivel: 'O primeiro passo', dias: novosLidos, cor: 'text-stone-300', bg: 'bg-stone-300/20', border: 'border-stone-300/30', img: imgMedalPaper });
      else if (novosLidos === 10) setShowCelebration({ nome: 'Madeira', nivel: 'Criando Raízes', dias: novosLidos, cor: 'text-orange-300', bg: 'bg-orange-300/20', border: 'border-orange-300/30', img: imgMedalWood });
      else if (novosLidos === 25) setShowCelebration({ nome: 'Aço', nivel: 'A força do hábito', dias: novosLidos, cor: 'text-slate-400', bg: 'bg-slate-400/20', border: 'border-slate-400/30', img: imgMedalSteel });
      else if (novosLidos === 30) setShowCelebration({ nome: 'Bronze', nivel: 'O primeiro pódio', dias: novosLidos, cor: 'text-amber-600', bg: 'bg-amber-100', border: 'border-amber-500', img: imgMedalBronze });
      else if (novosLidos === 100) setShowCelebration({ nome: 'Prata', nivel: 'O brilho da constância', dias: novosLidos, cor: 'text-slate-400', bg: 'bg-slate-100', border: 'border-slate-400', img: imgMedalSilver });
      else if (novosLidos === 200) setShowCelebration({ nome: 'Ouro', nivel: 'A maestria', dias: novosLidos, cor: 'text-yellow-500', bg: 'bg-yellow-100', border: 'border-yellow-500', img: imgMedalGold });
      else if (novosLidos === 365) setShowCelebration({ nome: 'Diamante', nivel: 'A perfeição e durabilidade', dias: novosLidos, cor: 'text-cyan-400', bg: 'bg-cyan-100', border: 'border-cyan-400', img: imgMedalDiamond });
    } catch (error) {
      console.error("Erro ao concluir devocional:", error);
    } finally {
      setConcluindo(false);
    }
  };

  useEffect(() => {
    const fetchCapitulo = async () => {
      try {
        setLoading(true);
        setErrorMsg('');

        if (lastSpaceIdx === -1) throw new Error('Referência inválida');

        const capituloVersiculo = refUrl.substring(lastSpaceIdx + 1); // "3:16" ou "3:16-18"

        let capituloStr = capituloVersiculo;
        let versiculosMapeados = [];

        if (capituloVersiculo.includes(':')) {
          const [cap, versos] = capituloVersiculo.split(':');
          capituloStr = cap;
          if (versos.includes('-')) {
            const [v1, v2] = versos.split('-');
            for (let i = Number(v1); i <= Number(v2); i++) versiculosMapeados.push(i);
          } else {
            versiculosMapeados.push(Number(versos));
          }
        }

        setTargetVerseArr(versiculosMapeados);

        const refFormatada = `${livroPT}+${capituloStr}`;
        const res = await fetch(`https://bible-api.com/${encodeURIComponent(refFormatada)}?translation=almeida`);
        if (!res.ok) throw new Error('Nenhum capítulo encontrado para essa referência. (Verifique sua conexão ou se a referência existe nesta tradução).');

        const data = await res.json();
        setCapituloData(data);
      } catch (err) {
        setErrorMsg(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (refUrl !== 'Desconhecido') fetchCapitulo();
  }, [refUrl, lastSpaceIdx, livroPT]);

  const linkCompartilhamento = typeof window !== 'undefined'
    ? `${window.location.origin}/estudo-palavra?ref=${encodeURIComponent(refUrl)}&text=${encodeURIComponent(txtUrl)}`
    : '';

  const textoCompartilhamento = `Palavra do Dia: "${txtUrl}" - ${refUrl}\n\nAprofunde-se nesse versículo: ${linkCompartilhamento}`;

  const handleCompartilhar = async () => {
    if (!printRef.current) return;
    try {
      setIsCapturing(true);
      
      // Aguardar render pra garantir font-serif carregada
      await new Promise(r => setTimeout(r, 100));

      const blob = await htmlToImage.toBlob(printRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#0A0F1C',
      });
      
      setIsCapturing(false);
      if (!blob) throw new Error('Falha ao gerar imagem');

      const file = new File([blob], `palavra-${Date.now()}.png`, { type: 'image/png' });

      // API Nativa para mobile (WhatsApp, Instagram, etc)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Palavra do Dia`,
        });
        return;
      }

      // Desktop / Navegadores não compatíveis baixam direto
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(a.href);
      
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);

    } catch (error) {
      setIsCapturing(false);
      if (error?.name !== 'AbortError') {
        console.error('Erro ao compartilhar imagem:', error);
        await navigator.clipboard.writeText(textoCompartilhamento).catch(e => null);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2200);
      }
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#0A0F1C] text-slate-200 font-sans pb-32 selection:bg-gold/30 selection:text-white">
      
      {/* Navbar Superior Branca/Translúcida */}
      <div className="sticky top-0 z-50 bg-[#0A0F1C]/80 backdrop-blur-xl border-b border-white/5 px-4 md:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-all border border-white/5 shadow-sm"
          >
            <ArrowLeft size={18} />
            <span className="font-medium text-sm">Voltar ao Painel</span>
          </button>
          
          <div className="flex items-center gap-2 text-gold">
            <BookOpen size={20} />
            <span className="font-bold tracking-widest uppercase text-xs">Estudo Bíblico</span>
          </div>
        </div>
      </div>

      {/* HERO SECTION: O Versículo Destacado */}
      <header className="relative pt-6 pb-12 md:pt-10 md:pb-16 px-4 text-center max-w-4xl mx-auto flex flex-col items-center">
        
        {/* A área a ser capturada e transformada em imagem */}
        <div ref={printRef} className="relative w-full py-10 md:py-14 px-6 md:px-12 flex flex-col items-center justify-center bg-[#0A0F1C] overflow-hidden rounded-3xl">
          {/* Fundo radiante */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] md:w-[800px] h-[300px] bg-gold/15 blur-[100px] rounded-full pointer-events-none -z-10" />
          
          <div 
            className="inline-flex w-max px-6 py-2 rounded-full bg-gold/10 border border-gold/20 text-gold font-bold tracking-[0.2em] text-[10px] md:text-xs uppercase mb-6 md:mb-8 shadow-[0_0_20px_rgba(212,175,55,0.1)]"
            style={{ whiteSpace: 'nowrap', width: 'max-content' }}
          >
            <span>Palavra do Dia &bull; <span className="ml-1">{refUrl}</span></span>
          </div>
          
          <div className="relative inline-block w-full max-w-3xl">
            <h1 className="text-2xl md:text-4xl lg:text-[2.75rem] font-medium text-white leading-snug md:leading-[1.3] italic relative z-10 px-2 md:px-6 font-serif text-center tracking-tight drop-shadow-md">
              "{txtUrl}"
            </h1>
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={handleCompartilhar}
            disabled={isCapturing}
            className={`inline-flex items-center gap-2.5 rounded-2xl border px-6 py-3.5 text-sm font-bold tracking-wide transition-all shadow-xl hover:scale-105 ${
              copiado
                ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200'
                : 'border-white/10 bg-white/5 text-white hover:bg-white/10 hover:border-gold/30 hover:text-gold'
            } ${isCapturing ? 'opacity-50 cursor-not-allowed scale-100 shadow-none' : ''}`}
          >
            {isCapturing ? <Loader2 size={18} className="animate-spin" /> : (copiado ? <CheckCircle2 size={18} /> : <Share2 size={18} />)}
            <span>{isCapturing ? 'Gerando imagem de alta qualidade...' : (copiado ? (navigator.canShare ? 'Compartilhado' : 'Imagem salva no dispositivo') : 'Compartilhar como Imagem')}</span>
          </button>
        </div>
      </header>

      {/* GRID INTELEGENTE: Mensagem + Contexto Histórico */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 mb-20 relative z-10">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          
          {/* Coluna Principal: Significado e Aplicação (Maior Impacto) */}
          <div className="xl:col-span-8 space-y-6">
            <div className="bg-gradient-to-br from-[#0A1128] to-[#121E3B] rounded-[2rem] p-8 md:p-10 border border-blue-500/15 shadow-2xl relative overflow-hidden group">
              {/* Efeitos de Luz de Fundo */}
              <div className="absolute top-0 right-0 w-72 h-72 bg-blue-500/10 blur-[80px] rounded-full pointer-events-none group-hover:bg-blue-500/20 transition-all duration-700" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/5 blur-[60px] rounded-full pointer-events-none group-hover:bg-emerald-500/15 transition-all duration-700" />
              
              <div className="flex items-center gap-3 mb-8 relative z-10">
                <div className="bg-gradient-to-tr from-blue-600/30 to-blue-400/10 p-2.5 rounded-xl border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                  <Sparkles className="text-blue-400" size={24} />
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                  {aiContext || contextMsg ? 'O Significado' : 'Meditação Diária'}
                </h3>
              </div>

              <h4 className="text-xl md:text-2xl font-bold text-blue-300 mb-4 relative z-10">
                {aiContext ? aiContext.titulo : (contextMsg ? contextMsg.titulo : 'Ouvindo a Voz de Deus')}
              </h4>
              <p className="text-lg md:text-xl text-slate-300 leading-relaxed font-medium mb-10 pb-8 border-b border-white/10 relative z-10">
                {aiContext ? aiContext.significado : (contextMsg 
                  ? contextMsg.significado 
                  : 'Deus fala conosco de maneira única todos os dias. Ao ler este versículo hoje, reserve um momento em silêncio. O que o Espírito Santo está ministrando ao seu coração através desta passagem específica? Toda a Escritura é viva e capaz de transformar nosso interior.')}
              </p>

              <div className="flex items-start gap-4 md:gap-5 relative z-10">
                <div className="bg-gradient-to-tr from-emerald-600/30 to-emerald-400/10 p-3 rounded-2xl shrink-0 mt-1 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                  <HeartHandshake className="text-emerald-400" size={28} />
                </div>
                <div>
                  <span className="block text-sm font-bold uppercase tracking-widest text-emerald-500 mb-2">Aplicação Prática em sua vida</span>
                  <p className="text-base md:text-lg text-slate-200 leading-relaxed">
                    {aiContext ? aiContext.pratica : (contextMsg 
                      ? contextMsg.pratica 
                      : 'Como você pode transformar a verdade que acabou de ler em atitudes reais ainda hoje? A fé genuína se revela em nossas obras. Pense em uma atitude simples, mas intencional, que você pode tomar hoje mesmo para viver o que está escrito neste versículo.')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Coluna Lateral: Metadados Históricos (Fixa ou Lado Direito) */}
          {metadataLivro && (
            <div className="xl:col-span-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-4">
              
              {/* Linha Fina de Título na Lateral */}
              <div className="col-span-full mb-1 xl:mb-3 flex items-center gap-2 px-2">
                <Info className="text-slate-400 shrink-0" size={18} />
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Panorama de {livroPT}</span>
              </div>

              {/* Cards Menores de Contexto */}
              <div className="bg-[#121E3B]/40 backdrop-blur-md p-5 rounded-2xl border border-white/5 hover:border-white/15 hover:shadow-lg hover:-translate-y-1 transform transition-all duration-300 flex gap-4 items-center group">
                <div className="bg-[#0A1128] p-3 rounded-xl shrink-0 border border-white/5 group-hover:border-blue-500/30 transition-colors">
                  <User className="text-blue-400" size={20} />
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Autor</span>
                  <p className="text-sm font-semibold text-slate-200">{metadataLivro.quem}</p>
                </div>
              </div>

              <div className="bg-[#121E3B]/40 backdrop-blur-md p-5 rounded-2xl border border-white/5 hover:border-white/15 hover:shadow-lg hover:-translate-y-1 transform transition-all duration-300 flex gap-4 items-center group">
                <div className="bg-[#0A1128] p-3 rounded-xl shrink-0 border border-white/5 group-hover:border-rose-400/30 transition-colors">
                  <MapPin className="text-rose-400" size={20} />
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Escrito Em</span>
                  <p className="text-sm font-semibold text-slate-200">{metadataLivro.onde}</p>
                </div>
              </div>

              <div className="bg-[#121E3B]/40 backdrop-blur-md p-5 rounded-2xl border border-white/5 hover:border-white/15 hover:shadow-lg hover:-translate-y-1 transform transition-all duration-300 flex gap-4 items-center md:col-span-2 xl:col-span-1 group">
                <div className="bg-[#0A1128] p-3 rounded-xl shrink-0 border border-white/5 group-hover:border-purple-400/30 transition-colors">
                  <Users className="text-purple-400" size={20} />
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Para Quem</span>
                  <p className="text-sm font-semibold text-slate-200">{metadataLivro.paraQuem}</p>
                </div>
              </div>

              {/* Curiosidade Destaque Menor */}
              <div className="bg-gradient-to-br from-gold/15 to-transparent p-6 rounded-2xl border border-gold/20 flex flex-col gap-3 mt-2 md:col-span-2 xl:col-span-1 hover:shadow-[0_0_20px_rgba(212,175,55,0.15)] transition-shadow duration-300">
                <div className="flex items-center gap-2 text-gold">
                  <Lightbulb size={20} className="drop-shadow-md" />
                  <span className="font-bold uppercase tracking-widest text-[11px]">Curiosidade</span>
                </div>
                <p className="text-sm md:text-base text-slate-300 italic leading-relaxed font-serif">
                  {metadataLivro.curiosidade}
                </p>
              </div>

            </div>
          )}

        </div>
      </section>

      {/* ÁREA DE LEITURA (O Capítulo Inteiro) */}
      <section className="max-w-4xl mx-auto px-4 md:px-8">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <ScrollText className="text-white/60" size={28} />
            <h3 className="text-2xl md:text-3xl font-bold text-white">Leitura do Capítulo</h3>
          </div>
          <span className="text-xs md:text-sm font-medium text-slate-500 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
            Tradução Almeida
          </span>
        </div>

        <div className="bg-slate-900/40 rounded-3xl border border-white/5 p-6 md:p-12 mb-12 shadow-inner">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Loader2 className="w-12 h-12 text-gold animate-spin mb-6" />
              <p className="font-medium tracking-wide uppercase text-sm animate-pulse">Preparando e lendo escrituras...</p>
            </div>
          ) : errorMsg ? (
            <div className="py-12 bg-rose-500/5 rounded-2xl flex flex-col items-center text-center px-6">
              <AlertCircle className="text-rose-400 mb-4 w-12 h-12" />
              <h4 className="text-rose-300 font-semibold text-lg mb-2">Falha na Leitura</h4>
              <p className="text-rose-200/70">{errorMsg}</p>
            </div>
          ) : capituloData && capituloData.verses ? (
            <div className="flex flex-col gap-3 md:gap-6 text-lg md:text-xl font-serif text-slate-300">
              {capituloData.verses.map((v) => {
                const isHighlighted = targetVerseArr.includes(v.verse);

                if (isHighlighted) {
                  return (
                    <div
                      key={v.verse}
                      className="my-4 md:my-6 block p-6 md:p-8 bg-gold/10 border-l-4 border-gold rounded-r-3xl shadow-[0_0_30px_rgba(212,175,55,0.08)] transition-all"
                    >
                      <span className="font-bold text-gold text-base md:text-lg mr-4 select-none drop-shadow-sm">
                        {v.verse}
                      </span>
                      <span className="text-white font-medium md:leading-[1.9] leading-[1.7]">
                        {v.text}
                      </span>
                    </div>
                  );
                }

                return (
                  <p key={v.verse} className="group hover:bg-white/5 rounded-2xl p-4 md:p-6 transition-colors duration-300 flex items-start gap-4">
                    <span className="font-bold text-slate-500 text-xs md:text-sm mt-1.5 shrink-0 select-none">
                      {v.verse}
                    </span>
                    <span className="group-hover:text-white transition-colors duration-300 md:leading-[1.9] leading-[1.7]">
                      {v.text}
                    </span>
                  </p>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* BOTÃO DE CONCLUSÃO DE DEVOCIONAL */}
        {!loading && capituloData && usuarioData && (
          <div className="mt-8 flex flex-col items-center justify-center pt-8 border-t border-white/10 pb-8">
            <h4 className="text-xl font-bold text-white mb-6 font-serif italic text-center">Encerre seu momento de reflexão</h4>
            <button
              onClick={handleConcluirDevocional}
              disabled={usuarioData.ultimoDevocionalLido === hoje || concluindo}
              className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-bold uppercase tracking-widest transition-all shadow-xl ${
                usuarioData.ultimoDevocionalLido === hoje 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-default' 
                  : 'bg-gold hover:bg-gold-light text-navy hover:-translate-y-1'
              }`}
            >
              {concluindo ? (
                <Loader2 size={24} className="animate-spin" />
              ) : usuarioData.ultimoDevocionalLido === hoje ? (
                <>
                  <Check size={24} />
                  <span>Devocional Concluído!</span>
                </>
              ) : (
                <>
                  <BookOpen size={24} />
                  <span>Concluir Devocional de Hoje</span>
                </>
              )}
            </button>
            <p className="text-slate-400 text-sm mt-4 font-medium">Você já leu {Number(usuarioData.devocionaisLidos) || 0} devocionais.</p>
          </div>
        )}

        {/* TRILHA DE PROGRESSO DOS LEITORES */}
        {leitores.length > 0 && (
          <div className="mt-16 border-t border-white/5 pt-12">
            <div className="flex flex-col items-center mb-10 text-center">
              <h3 className="text-2xl font-serif italic text-white mb-2">A Jornada da Congregação</h3>
              <p className="text-slate-400 text-sm max-w-lg">Acompanhe os irmãos que estão firmes no propósito de leitura diária da Palavra.</p>
            </div>

            <div ref={scrollContainerRef} className="relative w-full overflow-x-auto pb-8 hide-scrollbar">
              <div className="min-w-max px-4 flex items-start">
                
                {(() => {
                  const marcos = [
                    { min: 5, max: 9, nome: 'Papel', img: imgMedalPaper, cor: 'text-stone-300' },
                    { min: 10, max: 24, nome: 'Madeira', img: imgMedalWood, cor: 'text-orange-300' },
                    { min: 25, max: 29, nome: 'Aço', img: imgMedalSteel, cor: 'text-slate-400' },
                    { min: 30, max: 99, nome: 'Bronze', img: imgMedalBronze, cor: 'text-amber-500' },
                    { min: 100, max: 199, nome: 'Prata', img: imgMedalSilver, cor: 'text-slate-300' },
                    { min: 200, max: 364, nome: 'Ouro', img: imgMedalGold, cor: 'text-yellow-400' },
                    { min: 365, max: Infinity, nome: 'Diamante', img: imgMedalDiamond, cor: 'text-cyan-400' },
                  ];

                  // Também adicionar "Iniciante" (1-4) que não tem imagem de medalha
                  const niveis = [
                    { min: 1, max: 4, nome: 'Iniciante', img: null, cor: 'text-white/60' },
                    ...marcos
                  ];

                  return niveis.map((nivel, idx) => {
                    const usuariosNoNivel = leitores.filter(l => Number(l.devocionaisLidos) >= nivel.min && Number(l.devocionaisLidos) <= nivel.max);
                    
                    if (usuariosNoNivel.length === 0 && nivel.nome === 'Iniciante') return null;

                    const isLogadoAqui = usuariosNoNivel.some(u => String(u.id) === String(usuarioLogado?.id));

                    return (
                      <div key={idx} id={isLogadoAqui ? 'nivel-usuario-logado' : undefined} className="flex flex-col items-center relative group min-w-[140px]">
                        {/* Linha de conexão */}
                        {idx !== 0 && (
                          <div className="absolute top-8 -left-[50%] w-full h-[2px] bg-gradient-to-r from-transparent via-white/10 to-transparent -z-10" />
                        )}
                        
                        {/* Medalha / Ícone do Nível */}
                        <div className="h-20 flex items-center justify-center mb-4">
                          {nivel.img ? (
                            <img src={nivel.img} alt={nivel.nome} className="w-16 h-16 object-contain drop-shadow-lg" title={nivel.nome} />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                              <BookOpen size={20} className="text-white/40" />
                            </div>
                          )}
                        </div>
                        
                        <span className={`text-[10px] font-black uppercase tracking-widest ${nivel.cor} mb-4`}>
                          {nivel.nome}
                        </span>

                        {/* Avatares dos usuários (Apenas fotos sobrepostas) */}
                        <div className="flex justify-center -space-x-3 w-full px-2">
                          {usuariosNoNivel.map((u, i) => (
                            <div 
                              key={u.id} 
                              className="relative group/avatar"
                              style={{ zIndex: usuariosNoNivel.length - i }}
                            >
                              {u.fotoUrl ? (
                                <img src={u.fotoUrl} alt={u.nome} className="w-10 h-10 rounded-full object-cover shrink-0 border-2 border-[#0A0F1C] hover:scale-110 hover:-translate-y-2 transition-transform duration-200" title={u.nome} />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-300 shrink-0 border-2 border-[#0A0F1C] hover:scale-110 hover:-translate-y-2 transition-transform duration-200 cursor-default" title={u.nome}>
                                  {u.nome?.charAt(0).toUpperCase() || 'U'}
                                </div>
                              )}
                              
                              {/* Badge flutuante com o número de devocionais */}
                              <div className="absolute -top-2 -right-1.5 bg-black text-white text-[8px] font-black px-1.5 py-0.5 rounded-full border border-white/20 shadow-lg z-20 pointer-events-none group-hover/avatar:-translate-y-2 group-hover/avatar:scale-110 transition-transform duration-200">
                                {Number(u.devocionaisLidos)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  });
                })()}

              </div>
            </div>
          </div>
        )}

      </section>

      {/* Espaçador massivo ao final para garantir que o iPad permita a rolagem passando do limite do conteúdo */}
      <div className="h-48 md:h-64 w-full opacity-0 pointer-events-none" aria-hidden="true" />

      {/* MODAL DE CELEBRAÇÃO DE MEDALHA */}
      {showCelebration && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[#0A0F1C]/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-[#0A0F1C] border border-white/10 w-full max-w-md rounded-[2.5rem] p-8 shadow-[0_0_50px_rgba(212,175,55,0.15)] flex flex-col items-center text-center transform animate-in zoom-in-90 duration-500 relative overflow-hidden">
            <div className={`absolute top-0 inset-x-0 h-32 ${showCelebration.bg} opacity-10 blur-3xl rounded-full`} />
            
            {showCelebration.img ? (
              <img src={showCelebration.img} alt={showCelebration.nome} className="w-32 h-32 object-contain drop-shadow-2xl mb-4 relative z-10 hover:scale-110 transition-transform duration-500" />
            ) : (
              <div className={`w-24 h-24 rounded-full ${showCelebration.bg} border-4 ${showCelebration.border} flex items-center justify-center shadow-2xl mb-6 relative z-10`}>
                <Trophy size={48} className={showCelebration.cor} />
              </div>
            )}
            
            <span className={`text-[10px] font-black uppercase tracking-[0.3em] ${showCelebration.cor} mb-2 relative z-10`}>Nova Conquista Desbloqueada</span>
            <h2 className="text-4xl font-serif italic font-black text-white mb-2 relative z-10">{showCelebration.nome}</h2>
            <p className="text-gold font-bold text-lg mb-6 relative z-10">"{showCelebration.nivel}"</p>
            
            <p className="text-slate-300 mb-8 leading-relaxed relative z-10">
              Você atingiu a incrível marca de <strong className="text-white">{showCelebration.dias} dias</strong> ininterruptos ou acumulados de leitura e meditação na Palavra.
            </p>

            <button 
              onClick={() => setShowCelebration(null)}
              className="w-full py-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold uppercase tracking-widest transition-colors relative z-10"
            >
              Continuar Jornada
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
