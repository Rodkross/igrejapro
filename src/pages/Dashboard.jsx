import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { db } from '../database/firebase'; 
import { collection, query, onSnapshot } from 'firebase/firestore';
import MeuConvenio from '../components/MeuConvenio';
import PalavraDodia from '../components/PalavraDodia';
import { 
  Users, TrendingUp, UserCheck, PieChart, CalendarDays, 
  Cake, Loader2, Cross, Heart, X, HeartHandshake, Gamepad2, BookOpen, Church, PlusCircle
} from 'lucide-react';

export default function Dashboard() {
  const { usuario: usuarioLogado, configGeral } = useOutletContext();
  const navigate = useNavigate();
  
  const [usuarios, setUsuarios] = useState([]);
  const [programacao, setProgramacao] = useState([]);
  const [carregandoMembros, setCarregandoMembros] = useState(true);

  const [isModalMembrosAberto, setIsModalMembrosAberto] = useState(false);
  const [tituloModal, setTituloModal] = useState("");
  const [membrosFiltrados, setMembrosFiltrados] = useState([]);

  useEffect(() => {
    if (!isModalMembrosAberto) return;

    const overflowAnterior = document.body.style.overflow;
    const overscrollAnterior = document.body.style.overscrollBehavior;

    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';

    return () => {
      document.body.style.overflow = overflowAnterior;
      document.body.style.overscrollBehavior = overscrollAnterior;
    };
  }, [isModalMembrosAberto]);

  useEffect(() => {
    const qUsers = query(collection(db, "usuarios"));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsuarios(lista);
      setCarregandoMembros(false);
    });

    const qProg = query(collection(db, "programacaoSemanal"));
    const unsubProg = onSnapshot(qProg, (snapshot) => {
      const dias = { 'DOMINGO': 1, 'SEGUNDA': 2, 'TERÇA': 3, 'QUARTA': 4, 'QUINTA': 5, 'SEXTA': 6, 'SÁBADO': 7 };
      const agora = new Date();
      let listaProg = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      listaProg = listaProg.filter(p => {
        if (p.isEspecial) {
          // CORREÇÃO: Exibir eventos especiais apenas se a data/hora atual for ANTERIOR à data de INÍCIO.
          if (!p.dataEspecífica) return false;
          try {
            const [ano, mes, dia] = p.dataEspecífica.split('-');
            const [hora, minuto] = (p.horario || "00:00").split(':');
            const dataInicio = new Date(ano, mes - 1, dia, hora, minuto);
            
            // CORREÇÃO: Considerar a duração do evento.
            const duracaoHoras = parseInt(p.duracao) || 2; // Duração padrão de 2h se não especificado
            const dataFim = new Date(dataInicio.getTime() + duracaoHoras * 60 * 60 * 1000);
            return agora < dataFim;
          } catch {
            return true; // Mantém o evento se houver erro no parsing, para não sumir da lista.
          }
        } else {
          // CORREÇÃO: Eventos semanais (recorrentes) devem sempre ser exibidos na agenda,
          // pois representam a programação fixa da semana. A ordenação cuidará de mostrá-los
          // na sequência correta.
          return true;
        }
      });
      // Remover duplicatas por titulo (ignorando case)
      const seen = new Set();
      listaProg = listaProg.filter(p => {
        const tituloLower = p.titulo.toLowerCase();
        if (seen.has(tituloLower)) return false;
        seen.add(tituloLower);
        return true;
      });
      listaProg.sort((a, b) => {
        const pesoA = a.isEspecial ? 1 : (a.tipoFrequencia === 'toda_semana' ? 2 : 3);
        const pesoB = b.isEspecial ? 1 : (b.tipoFrequencia === 'toda_semana' ? 2 : 3);
        if (pesoA !== pesoB) return pesoA - pesoB;
        const diaA = dias[a.diaSemana] || 8;
        const diaB = dias[b.diaSemana] || 8;
        return diaA !== diaB ? diaA - diaB : (a.horario || '').localeCompare(b.horario || '');
      });
      setProgramacao(listaProg);
    });
    return () => { unsubUsers(); unsubProg(); };
  }, []);

  const hojeZerado = useMemo(() => {
    const agora = new Date();
    return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  }, []);

  const stats = useMemo(() => {
    const anoAtual = hojeZerado.getFullYear();
    const d = { totalAtivos: 0, jovens: 0, adultos: 0, idosos: 0, batizados: 0, casados: 0, novosAno: 0, retornoAno: 0, almasAno: 0 };
    const membrosAtivos = usuarios.filter(u => String(u.id) !== "1" && u.idAcesso !== 1 && u.perfilMembro !== 'Afastado');

    d.totalAtivos = membrosAtivos.length;
    membrosAtivos.forEach(u => {
      if (u.dataNascimento) {
        const idade = anoAtual - parseInt(u.dataNascimento.split('-')[0]);
        if (idade < 25) d.jovens++;
        else if (idade < 60) d.adultos++;
        else d.idosos++;
      }
      if (u.batizado) d.batizados++;
      if (u.casado) d.casados++;
    });

    usuarios.forEach(u => {
      if (u.dataConversao && new Date(u.dataConversao).getFullYear() === anoAtual) {
        if (u.perfilMembro === 'Novo Convertido') d.novosAno++;
        if (u.perfilMembro === 'Retorno') d.retornoAno++;
      }
    });
    d.almasAno = d.novosAno + d.retornoAno;
    return d;
  }, [usuarios, hojeZerado]);

  const abrirListagem = (tipo) => {
    const anoAtual = hojeZerado.getFullYear();
    const ativos = usuarios.filter(u => String(u.id) !== "1" && u.idAcesso !== 1 && u.perfilMembro !== 'Afastado');
    let lista = [];
    let titulo = "";

    switch (tipo) {
      case 'todos': lista = ativos; titulo = "Nossa Família"; break;
      case 'jovens': lista = ativos.filter(u => u.dataNascimento && (anoAtual - parseInt(u.dataNascimento.split('-')[0])) < 25); titulo = "Nossos Jovens"; break;
      case 'adultos': lista = ativos.filter(u => {
            if(!u.dataNascimento) return false;
            const idade = anoAtual - parseInt(u.dataNascimento.split('-')[0]);
            return idade >= 25 && idade < 60;
      }); titulo = "Corpo de Adultos"; break;
      case 'idosos': lista = ativos.filter(u => u.dataNascimento && (anoAtual - parseInt(u.dataNascimento.split('-')[0])) >= 60); titulo = "Melhor Idade"; break;
      case 'batizados': lista = ativos.filter(u => u.batizado); titulo = "Membros Batizados"; break;
      case 'casados': lista = ativos.filter(u => u.casado); titulo = "Membros Casados"; break;
      default: lista = ativos; titulo = "Membros";
    }
    setMembrosFiltrados(lista);
    setTituloModal(titulo);
    setIsModalMembrosAberto(true);
  };

  const proximosAniversariantes = useMemo(() => {
    if (!usuarios.length) return [];
    return usuarios
      .filter(u => u.dataNascimento && String(u.id) !== "1" && u.perfilMembro !== 'Afastado')
      .map(u => {
        const partes = u.dataNascimento.split('-'); 
        let dataAniv = new Date(hojeZerado.getFullYear(), parseInt(partes[1]) - 1, parseInt(partes[2]));
        if (dataAniv < hojeZerado) dataAniv.setFullYear(hojeZerado.getFullYear() + 1);
        return { ...u, diasPara: Math.ceil((dataAniv - hojeZerado) / (1000 * 60 * 60 * 24)), dataAlvo: dataAniv, idadeNova: dataAniv.getFullYear() - parseInt(partes[0]) };
      })
      .filter(u => u.diasPara >= 0 && u.diasPara <= 30)
      .sort((a, b) => a.diasPara - b.diasPara);
  }, [usuarios, hojeZerado]);

  const modalMembros = isModalMembrosAberto ? createPortal(
    <div className="fixed inset-0 z-[100] h-[100svh] max-h-[100svh] flex items-stretch justify-center overflow-hidden overscroll-none bg-navy-deep/80 backdrop-blur-md animate-fade-in p-0 xl:h-auto xl:max-h-none xl:items-center xl:p-4">
      <div className="bg-white w-full h-full max-h-full rounded-none shadow-elegant overflow-hidden flex flex-col animate-scale-in xl:w-full xl:max-w-2xl xl:h-auto xl:max-h-[calc(100dvh-2rem)] xl:rounded-[2rem]">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-hero shrink-0">
          <div className="relative z-10">
            <p className="text-[10px] font-bold text-gold uppercase tracking-widest mb-1">Comunidade</p>
            <h2 className="font-display text-2xl font-black text-white leading-none">{tituloModal}</h2>
          </div>
          <button onClick={() => setIsModalMembrosAberto(false)} className="p-2 hover:bg-white/10 rounded-full text-white transition-colors relative z-10"><X size={24} /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-pb-8 px-4 pt-4 pb-[max(2rem,calc(1rem+env(safe-area-inset-bottom)))] space-y-3 bg-slate-50">
          {membrosFiltrados.length > 0 ? (() => {
             if (tituloModal === "Membros Casados") {
                 const processados = new Set();
                 const elementos = [];
                 membrosFiltrados.forEach(u => {
                     if (processados.has(u.id)) return;
                     processados.add(u.id);

                     let conjuge = null;
                     if (u.conjugeId && !u.conjugeExterno) {
                         conjuge = membrosFiltrados.find(c => c.id === u.conjugeId);
                     }
                     
                     if (conjuge) {
                         processados.add(conjuge.id);
                         elementos.push(
                             <div key={`${u.id}-${conjuge.id}`} className="relative p-1 bg-gradient-to-br from-gold/10 to-amber-100/50 rounded-[1.5rem] border border-gold/30 shadow-soft mb-5 mt-4">
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center justify-center bg-white rounded-full px-2.5 py-1 shadow-sm border border-gold/20 z-10 transition-transform hover:scale-105 cursor-default">
                                   <div className="relative w-7 h-4 flex items-center justify-center">
                                      <div className="absolute w-4 h-4 rounded-full border-[1.5px] border-gold transform -translate-x-[5px]"></div>
                                      <div className="absolute w-4 h-4 rounded-full border-[1.5px] border-gold transform translate-x-[5px]"></div>
                                   </div>
                                   <span className="text-[8px] font-black tracking-[0.2em] uppercase text-gold ml-1.5">Enlace</span>
                                </div>
                                <div className="space-y-1 relative">
                                    <MembroCard u={u} isCasal />
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
                                        <div className="bg-white p-1.5 rounded-full border border-gold/20 shadow-sm">
                                            <Heart size={14} className="text-gold fill-gold/20" />
                                        </div>
                                    </div>
                                    <MembroCard u={conjuge} isCasal />
                                </div>
                             </div>
                         );
                     } else {
                         elementos.push(<MembroCard key={u.id} u={u} />);
                     }
                 });
                 return elementos;
             }

             return membrosFiltrados.map(u => <MembroCard key={u.id} u={u} />);
          })() : (
            <div className="py-20 text-center opacity-30">
              <Users className="mx-auto mb-4" size={40} />
              <p className="font-bold uppercase text-[10px] tracking-widest">Nenhum membro nesta categoria.</p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="space-y-4 pb-12 px-4 text-left animate-fade-in-up">
      
      {/* HEADER MOBILE - ÍCONE DA CONGREGAÇÃO E NOME */}
      <div className="hidden md:flex flex-col gap-4">
        {/* Desktop view mantém layout original */}
      </div>

      {/* MOBILE VIEW - OPTIMIZADO */}
      <div className="block md:hidden space-y-4">
        {/* Ícone da Congregação e Nome */}
        <div className="bg-gradient-hero rounded-2xl p-4 flex items-center gap-4 border border-white/10 shadow-elegant">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center overflow-hidden border border-white/10 shrink-0">
            {configGeral?.igrejaLogo ? (
              <img src={configGeral.igrejaLogo} alt="Logo da igreja" className="w-full h-full object-contain p-1.5" />
            ) : (
              <Church size={24} className="text-gold" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-gold uppercase tracking-widest">Igreja</p>
            <h2 className="font-display text-lg font-black text-white leading-tight truncate">
              {configGeral?.igrejaNome || 'Igreja Pro'}
            </h2>
          </div>
          <button 
            onClick={() => navigate('/cadastro/programacao')}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            title="Ver Programação"
          >
            <CalendarDays size={18} className="text-gold" />
          </button>
        </div>

        {/* KPI GRID MOBILE */}
        <div className="grid grid-cols-3 gap-2">
          <KpiCard onClick={() => abrirListagem('todos')} icon={<Users/>} label="Membros" value={carregandoMembros ? "..." : stats.totalAtivos} accent="royal" compact inline />
          <KpiCard onClick={() => abrirListagem('jovens')} icon={<TrendingUp/>} label="Jovens" value={carregandoMembros ? "..." : stats.jovens} accent="success" compact inline />
          <KpiCard onClick={() => abrirListagem('adultos')} icon={<UserCheck/>} label="Adultos" value={carregandoMembros ? "..." : stats.adultos} accent="navy" compact inline />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <KpiCard onClick={() => abrirListagem('idosos')} icon={<PieChart/>} label="Melhor Idade" value={carregandoMembros ? "..." : stats.idosos} accent="gold" compact inline />
          <KpiCard onClick={() => abrirListagem('batizados')} icon={<Cross/>} label="Batizados" value={carregandoMembros ? "..." : stats.batizados} accent="royal" compact inline />
          <KpiCard onClick={() => abrirListagem('casados')} icon={<Heart/>} label="Casados" value={carregandoMembros ? "..." : stats.casados} accent="danger" compact inline />
        </div>

        {/* CARD ALMAS */}
        <div className="bg-gradient-hero rounded-2xl p-4 flex items-center justify-between border border-white/10 shadow-elegant relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-[8px] font-bold text-gold uppercase tracking-widest mb-1">Almas / Ano</p>
            <p className="font-display text-3xl font-black text-white leading-none">{stats.almasAno}</p>
          </div>
          <div className="h-8 w-px bg-white/20 mx-2"></div>
          <div className="text-right relative z-10">
            <p className="text-[7px] font-bold text-slate-300 uppercase mb-1">Ganhos</p>
            <div className="text-base font-bold text-white leading-none">
              <span className="text-gold">{stats.novosAno}</span>
              <span className="text-white/20 mx-1">/</span>
              <span className="text-green-400">{stats.retornoAno}</span>
            </div>
          </div>
        </div>

        {/* MEU CONVÊNIO */}
        {String(usuarioLogado?.id) !== "1" && <MeuConvenio usuarioNome={usuarioLogado?.nome} usuarioLogado={usuarioLogado} />}

        {/* ANIVERSARIANTES */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-soft flex flex-col">
          <h3 className="font-display text-base font-black text-navy mb-3 flex items-center gap-2 shrink-0">
            <Cake size={16} className="text-gold" /> Aniversários
          </h3>
          <div className="max-h-[38vh] overflow-y-auto space-y-2 pr-1 custom-scroll">
            {proximosAniversariantes.length > 0 ? (
              proximosAniversariantes.slice(0, 5).map(u => (
                <div key={u.id} className={`flex items-center justify-between p-2 rounded-lg border text-[10px] transition-all ${u.diasPara === 0 ? 'bg-gold/5 border-gold/20' : 'bg-slate-50 border-transparent'}`}>
                  <div className="flex items-center gap-2">
                    <div className="shrink-0">
                      {u.fotoUrl ? (
                        <img src={u.fotoUrl} alt="" className="w-8 h-8 rounded-lg object-cover border border-white shadow-sm" />
                      ) : (
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${u.diasPara === 0 ? 'bg-gold text-navy' : 'bg-navy text-white'}`}>
                          {u.nome?.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-navy leading-tight truncate">{u.nome}</p>
                      <p className="text-[8px] text-slate-400 uppercase">{u.idadeNova} anos</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {u.diasPara === 0 ? (
                      <span className="text-[8px] font-black text-gold bg-gold/20 px-1.5 py-0.5 rounded">HOJE 🎂</span>
                    ) : (
                      <span className="font-black text-royal">{u.diasPara}d</span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center py-4 text-slate-400 text-[9px] font-bold uppercase">Nenhum aniversário próximo</p>
            )}
          </div>
        </div>

        {/* PALAVRA DO DIA */}
        <PalavraDodia />

        {/* CARD DO DESAFIO BÍBLICO */}
        <div
          onClick={() => navigate('/entretenimento/quiz')}
          className="bg-slate-900 rounded-[2rem] p-5 relative overflow-hidden border border-white/5 shadow-2xl text-left group cursor-pointer hover:border-gold/30 transition-all"
        >
          <div className="absolute -right-4 -bottom-4 opacity-10 pointer-events-none group-hover:scale-110 transition-transform duration-700">
            <BookOpen size={100} strokeWidth={1.2} className="text-white" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse shrink-0"></div>
                <p className="text-[10px] font-bold text-gold uppercase tracking-[0.22em] truncate">Quiz do Reino</p>
              </div>
              <span className="bg-gold text-navy text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-tight shadow-gold shrink-0">
                Novo
              </span>
            </div>

            <h3 className="font-display text-[1.3rem] font-black text-white leading-tight mb-2 italic uppercase tracking-tight">
              Desafio
              <br />
              <span className="text-gold text-[1.5rem]">Bíblico</span>
            </h3>

            <div className="mt-2 inline-flex items-center gap-2 bg-white text-navy font-black text-[10px] uppercase tracking-[0.16em] px-4 py-2 rounded-xl group-hover:bg-gold transition-all shadow-xl self-start">
              <Gamepad2 size={13} /> Jogar Agora
            </div>
          </div>
        </div>
      </div>

      {/* DESKTOP VIEW - LAYOUT ORIGINAL */}
      <div className="hidden md:block space-y-4">
        {/* TICKER — AGENDA */}
        {programacao.length > 0 && (
          <div onClick={() => navigate('/cadastro/programacao')} className="w-full bg-gradient-hero border border-white/10 rounded-xl overflow-hidden shadow-elegant flex items-center h-10 group cursor-pointer -mt-1 mb-0">
            <div className="z-10 bg-navy-deep px-2 h-full flex items-center border-r border-gold/20">
              <span className="text-[9px] font-bold text-gold tracking-widest uppercase">AGENDA</span>
            </div>
            <div className="relative w-full overflow-hidden whitespace-nowrap">
              <div className="animate-ticker inline-flex items-center gap-8 h-full text-white">
                {[...programacao, ...programacao].map((p, i) => (
                  <div key={`${p.id}-${i}`} className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-xs text-white">{p.titulo}</span>
                    <span className="text-[8px] font-bold bg-white/10 px-1.5 py-0.5 rounded text-slate-200">{p.horario}h</span>
                    <span className="text-gold/30 text-[10px]">✦</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {String(usuarioLogado?.id) !== "1" && <MeuConvenio usuarioNome={usuarioLogado?.nome} usuarioLogado={usuarioLogado} />}

        {/* KPI GRID COMPACTO */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          <KpiCard onClick={() => abrirListagem('todos')} icon={<Users/>} label="Membros" value={carregandoMembros ? "..." : stats.totalAtivos} accent="royal" compact inline />
          <KpiCard onClick={() => abrirListagem('jovens')} icon={<TrendingUp/>} label="Jovens" value={carregandoMembros ? "..." : stats.jovens} accent="success" compact inline />
          <KpiCard onClick={() => abrirListagem('adultos')} icon={<UserCheck/>} label="Adultos" value={carregandoMembros ? "..." : stats.adultos} accent="navy" compact inline />
          <KpiCard onClick={() => abrirListagem('idosos')} icon={<PieChart/>} label="Melhor Idade" value={carregandoMembros ? "..." : stats.idosos} accent="gold" compact inline />
          <KpiCard onClick={() => abrirListagem('batizados')} icon={<Cross/>} label="Batizados" value={carregandoMembros ? "..." : stats.batizados} accent="royal" compact inline />
          <KpiCard onClick={() => abrirListagem('casados')} icon={<Heart/>} label="Casados" value={carregandoMembros ? "..." : stats.casados} accent="danger" compact inline />
          <div className="hidden md:flex md:col-span-2 xl:hidden bg-gradient-hero rounded-2xl p-3 border border-white/10 shadow-elegant relative overflow-hidden min-h-[80px] items-center justify-between gap-3">
            <div className="relative z-10">
              <p className="text-[8px] font-bold text-gold uppercase tracking-[0.18em] mb-1">Almas / Ano</p>
              <p className="font-display text-2xl font-black text-white leading-none">{stats.almasAno}</p>
            </div>
            <div className="text-right relative z-10 shrink-0">
              <div className="text-sm font-bold text-white leading-none">
                <span className="text-gold">{stats.novosAno}</span>
                <span className="text-white/20 mx-1">/</span>
                <span className="text-green-400">{stats.retornoAno}</span>
              </div>
              <p className="text-[7px] text-slate-300 font-bold uppercase mt-1">Novo / Retorno</p>
            </div>
          </div>
        </div>

        {/* ANIVERSÁRIOS E PALAVRA DO DIA */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 bg-white rounded-2xl p-4 md:p-5 border border-slate-100 shadow-soft flex flex-col min-w-0 md:h-[min(40dvh,24rem)] xl:h-auto">
            <h3 className="font-display text-lg font-black text-navy mb-4 flex items-center gap-2 shrink-0">
              <Cake size={18} className="text-gold" /> Aniversariantes do Mês
            </h3>
            <div className="flex-1 min-h-0 max-h-[40dvh] md:max-h-none overflow-y-auto space-y-2 pr-1 custom-scroll min-w-0">
              {proximosAniversariantes.length > 0 ? (
                proximosAniversariantes.map(u => (
                  <div key={u.id} className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-all ${u.diasPara === 0 ? 'bg-gold/5 border-gold/20' : 'bg-slate-50 border-transparent hover:border-slate-200'}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="shrink-0">
                        {u.fotoUrl ? (
                          <img src={u.fotoUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-white shadow-sm" />
                        ) : (
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs ${u.diasPara === 0 ? 'bg-gold text-navy' : 'bg-navy text-white'}`}>
                            {u.nome?.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-navy leading-tight truncate">{u.nome}</p>
                        <p className="text-[10px] text-slate-500 font-medium uppercase italic truncate">
                          {u.dataAlvo.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })} • {u.idadeNova} anos
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {u.diasPara === 0 ? (
                        <span className="text-[10px] font-black text-gold-dark bg-gold/20 px-2 py-1 rounded-lg animate-pulse">HOJE! 🎂</span>
                      ) : (
                        <div className="flex flex-col items-end leading-none">
                          <span className="text-xs font-black text-royal">{u.diasPara}</span>
                          <span className="text-[8px] text-slate-400 font-bold uppercase">dias</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center py-10 text-slate-400 text-[10px] font-bold uppercase tracking-widest">Nenhum aniversário próximo</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4 min-w-0">
            {/* CARD ALMAS */}
            <div className="hidden xl:flex bg-gradient-hero rounded-2xl p-3 md:p-4 items-center justify-between gap-3 border border-white/10 shadow-elegant relative overflow-hidden min-h-[90px] min-w-0">
              <div className="relative z-10">
                <p className="text-[9px] font-bold text-gold uppercase tracking-widest mb-1">Almas / Ano</p>
                <p className="font-display text-3xl xl:text-4xl font-black text-white leading-none">{stats.almasAno}</p>
              </div>
              <div className="h-8 w-px bg-white/20 mx-2"></div>
              <div className="text-right relative z-10 shrink-0">
                <p className="text-[8px] font-bold text-slate-300 uppercase mb-1">Ganhos</p>
                <div className="text-base xl:text-lg font-bold text-white leading-none">
                  <span className="text-gold">{stats.novosAno}</span>
                  <span className="text-white/20 mx-1">/</span>
                  <span className="text-green-400">{stats.retornoAno}</span>
                </div>
                <p className="text-[7px] text-slate-400 font-bold uppercase mt-1">Novo / Retorno</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-4 min-w-0">
              <div
                onClick={() => navigate('/entretenimento/quiz')}
                className="hidden md:flex xl:hidden min-h-[160px] rounded-[2rem] p-5 relative overflow-hidden border border-white/5 shadow-2xl bg-slate-900 text-left group cursor-pointer hover:border-gold/30 transition-all"
              >
                <div className="absolute -right-4 -bottom-4 opacity-10 pointer-events-none group-hover:scale-110 transition-transform duration-700">
                  <BookOpen size={100} strokeWidth={1.2} className="text-white" />
                </div>

                <div className="relative z-10 flex h-full flex-col justify-center min-w-0">
                  <div>
                    <div className="flex items-center justify-between gap-5 mb-5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-gold animate-pulse shrink-0"></div>
                        <p className="text-[11px] font-bold text-gold uppercase tracking-[0.24em] truncate">Quiz do Reino</p>
                      </div>
                      <span className="bg-gold text-navy text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tight shadow-gold shrink-0">
                        Novo
                      </span>
                    </div>

                    <h3 className="font-display text-[1.45rem] font-black text-white leading-tight mb-3 italic uppercase tracking-tight">
                      Desafio
                      <br />
                      <span className="text-gold text-[1.85rem]">Bíblico</span>
                    </h3>
                  </div>

                  <div className="mt-3 inline-flex items-center gap-2 bg-white text-navy font-black text-[11px] uppercase tracking-[0.18em] px-4 py-2.5 rounded-xl group-hover:bg-gold transition-all shadow-xl self-start">
                    <Gamepad2 size={14} /> Jogar Agora
                  </div>
                </div>
              </div>

              {/* PALAVRA DO DIA */}
              <PalavraDodia compactTablet />
            </div>
          </div>
        </div>
      </div>

      {/* MODAL — COM FOTO E BIO */}
      {false && (
        <div className="fixed inset-0 z-[100] h-[100svh] max-h-[100svh] flex items-stretch justify-center overflow-hidden overscroll-none bg-navy-deep/80 backdrop-blur-md animate-fade-in p-0 lg:h-auto lg:max-h-none lg:items-center lg:p-4">
            <div className="bg-white w-full h-full max-h-full rounded-none shadow-elegant overflow-hidden flex flex-col animate-scale-in lg:w-full lg:max-w-2xl lg:h-auto lg:max-h-[calc(100dvh-2rem)] lg:rounded-[2rem]">
                <div className="p-5 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-hero shrink-0">
                    <div className="relative z-10">
                        <p className="text-[10px] font-bold text-gold uppercase tracking-widest mb-1">Comunidade</p>
                        <h2 className="font-display text-2xl font-black text-white leading-none">{tituloModal}</h2>
                    </div>
                    <button onClick={() => setIsModalMembrosAberto(false)} className="p-2 hover:bg-white/10 rounded-full text-white transition-colors relative z-10"><X size={24} /></button>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-pb-8 px-4 pt-4 pb-[max(2rem,calc(1rem+env(safe-area-inset-bottom)))] space-y-3 bg-slate-50">
                    {membrosFiltrados.length > 0 ? membrosFiltrados.map(u => (
                        <div key={u.id} className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 hover:shadow-soft hover:border-royal/20 transition-all">
                            <div className="shrink-0">
                                {u.fotoUrl ? (
                                    <img src={u.fotoUrl} alt="" className="w-16 h-16 rounded-xl object-cover border-2 border-white shadow-soft" />
                                ) : (
                                    <div className="w-16 h-16 rounded-xl bg-gradient-royal flex items-center justify-center text-white font-display text-2xl font-black shadow-royal">{u.nome?.charAt(0)}</div>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="font-display font-bold text-navy text-base leading-tight truncate">{u.nome}</p>
                                <p className="text-[9px] font-bold text-royal uppercase tracking-widest mt-0.5">{u.funcaoEclesiastica || 'Membro'}</p>
                                <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1 line-clamp-2 italic">
                                  {u.biografia || "Sem biografia disponível."}
                                </p>
                            </div>
                        </div>
                    )) : (
                      <div className="py-20 text-center opacity-30">
                        <Users className="mx-auto mb-4" size={40} />
                        <p className="font-bold uppercase text-[10px] tracking-widest">Nenhum membro nesta categoria.</p>
                      </div>
                    )}
                </div>
            </div>
        </div>
      )}
      {modalMembros}
    </div>
  );
}

function KpiCard({ icon, label, value, accent, compact, inline, onClick }) {
  const accents = {
    royal:   { bg: 'bg-blue-50',  text: 'text-blue-600',  border: 'hover:border-blue-200' },
    success: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'hover:border-emerald-200' },
    navy:    { bg: 'bg-slate-100',  text: 'text-slate-900',  border: 'hover:border-slate-300' },
    gold:    { bg: 'bg-amber-50',   text: 'text-amber-600',  border: 'hover:border-amber-200' },
    danger:  { bg: 'bg-rose-50',    text: 'text-rose-600',   border: 'hover:border-rose-200' },
  };
  const a = accents[accent] || accents.royal;
  const cardPadding = inline ? 'p-2' : compact ? 'p-3' : 'p-4';
  const cardMinHeight = inline ? 'min-h-[72px]' : compact ? 'min-h-[80px]' : 'min-h-[110px]';

  return (
    <div 
      onClick={onClick}
      className={`bg-white rounded-2xl border border-slate-100 ${cardPadding} shadow-soft transition-all flex flex-col justify-between ${cardMinHeight} ${onClick ? 'cursor-pointer hover:-translate-y-1' : ''} ${a.border}`}
    >
      {inline ? (
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-8 h-8 rounded-lg ${a.bg} ${a.text} flex items-center justify-center`}>
            {React.cloneElement(icon, { size: 16 })}
          </div>
          <p className={`font-display font-black text-navy leading-none ${compact ? 'text-2xl' : 'text-3xl'}`}>{value}</p>
        </div>
      ) : (
        <div className={`w-8 h-8 rounded-lg ${a.bg} ${a.text} flex items-center justify-center mb-2`}>
          {React.cloneElement(icon, { size: 16 })}
        </div>
      )}
      <div>
        {!inline && <p className={`font-display font-black text-navy leading-none ${compact ? 'text-2xl' : 'text-3xl'}`}>{value}</p>}
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">{label}</p>
      </div>
    </div>
  );
}

function MembroCard({ u, isCasal }) {
  return (
    <div className={`flex items-center gap-4 p-4 bg-white ${isCasal ? 'rounded-[1.3rem]' : 'rounded-2xl border border-slate-100 hover:shadow-soft hover:border-royal/20'} transition-all`}>
      <div className="shrink-0">
        {u.fotoUrl ? (
          <img src={u.fotoUrl} alt="" className="w-16 h-16 rounded-xl object-cover border-2 border-white shadow-soft" />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-gradient-royal flex items-center justify-center text-white font-display text-2xl font-black shadow-royal">{u.nome?.charAt(0)}</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display font-bold text-navy text-base leading-tight truncate">{u.nome}</p>
        <p className="text-[9px] font-bold text-royal uppercase tracking-widest mt-0.5">{u.funcaoEclesiastica || 'Membro'}</p>
        <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1 line-clamp-2 italic">
          {u.biografia || "Sem biografia disponível."}
        </p>
      </div>
    </div>
  );
}
