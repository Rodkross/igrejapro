import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { db } from '../database/firebase'; 
import { collection, query, onSnapshot } from 'firebase/firestore';
import MeuConvenio from '../components/MeuConvenio';
import { 
  Users, TrendingUp, UserCheck, PieChart, CalendarDays, 
  Cake, Loader2, Cross, Heart, UserPlus, X, HeartHandshake 
} from 'lucide-react';

export default function Dashboard() {
  const { usuario: usuarioLogado } = useOutletContext();
  const navigate = useNavigate();
  
  const [versiculo, setVersiculo] = useState({ texto: "Carregando palavra...", referencia: "" });
  const [usuarios, setUsuarios] = useState([]);
  const [programacao, setProgramacao] = useState([]);
  const [carregandoMembros, setCarregandoMembros] = useState(true);

  // Estados para o Modal de Membros
  const [isModalMembrosAberto, setIsModalMembrosAberto] = useState(false);
  const [tituloModal, setTituloModal] = useState("");
  const [membrosFiltrados, setMembrosFiltrados] = useState([]);

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
      let listaProg = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Ordenação: 
      // 1. Especiais (peso 1)
      // 2. Toda Semana (peso 2)
      // 3. Demais itens da Grade (peso 3)
      listaProg.sort((a, b) => {
        const pesoA = a.isEspecial ? 1 : (a.tipoFrequencia === 'toda_semana' ? 2 : 3);
        const pesoB = b.isEspecial ? 1 : (b.tipoFrequencia === 'toda_semana' ? 2 : 3);
        
        if (pesoA !== pesoB) return pesoA - pesoB;
        
        const diaA = dias[a.diaSemana] || 8;
        const diaB = dias[b.diaSemana] || 8;
        if (diaA !== diaB) return diaA - diaB;
        
        return (a.horario || '').localeCompare(b.horario || '');
      });

      setProgramacao(listaProg);
    });

    return () => {
      unsubUsers();
      unsubProg();
    };
  }, []);

  useEffect(() => {
    const obterVersiculo = async () => {
      const HOJE = new Date().toLocaleDateString('pt-BR');
      const cacheVersiculo = localStorage.getItem('versiculo_dia');
      const cacheData = localStorage.getItem('versiculo_data');

      if (cacheVersiculo && cacheData === HOJE) {
        try { setVersiculo(JSON.parse(cacheVersiculo)); return; } catch { console.error("Erro cache"); }
      }

      try {
        const res = await fetch('https://bible-api.com/?random=verse&translation=almeida');
        const data = await res.json();
        const novaPalavra = { texto: data.text.replace(/\n/g, ' '), referencia: data.reference };
        setVersiculo(novaPalavra);
        localStorage.setItem('versiculo_dia', JSON.stringify(novaPalavra));
        localStorage.setItem('versiculo_data', HOJE);
      } catch (err) {
        setVersiculo({ texto: "O SENHOR é o meu pastor; nada me faltará.", referencia: "Salmo 23:1" });
      }
    };
    obterVersiculo();
  }, []);

  const hojeZerado = useMemo(() => {
    const agora = new Date();
    return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  }, []);

  // --- LÓGICA DE FILTRO PARA O MODAL ---
  const abrirListagem = (tipo) => {
    const anoAtual = hojeZerado.getFullYear();
    const ativos = usuarios.filter(u => String(u.id) !== "1" && u.idAcesso !== 1 && u.perfilMembro !== 'Afastado');
    
    let lista = [];
    let titulo = "";

    switch (tipo) {
      case 'todos':
        lista = ativos;
        titulo = "Nossa Família";
        break;
      case 'jovens':
        lista = ativos.filter(u => u.dataNascimento && (anoAtual - parseInt(u.dataNascimento.split('-')[0])) < 25);
        titulo = "Nossos Jovens";
        break;
      case 'adultos':
        lista = ativos.filter(u => {
            if(!u.dataNascimento) return false;
            const idade = anoAtual - parseInt(u.dataNascimento.split('-')[0]);
            return idade >= 25 && idade < 60;
        });
        titulo = "Corpo de Adultos";
        break;
      case 'idosos':
        lista = ativos.filter(u => u.dataNascimento && (anoAtual - parseInt(u.dataNascimento.split('-')[0])) >= 60);
        titulo = "Melhor Idade";
        break;
      default:
        lista = ativos;
        titulo = "Membros";
    }

    setMembrosFiltrados(lista);
    setTituloModal(titulo);
    setIsModalMembrosAberto(true);
  };

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
      if (u.dataConversao) {
        const dataConv = new Date(u.dataConversao);
        if (dataConv.getFullYear() === anoAtual) {
          if (u.perfilMembro === 'Novo Convertido') d.novosAno++;
          if (u.perfilMembro === 'Retorno') d.retornoAno++;
        }
      }
    });

    d.almasAno = d.novosAno + d.retornoAno;
    return d;
  }, [usuarios, hojeZerado]);

  const proximosAniversariantes = useMemo(() => {
    if (!usuarios.length) return [];
    return usuarios
      .filter(u => u.dataNascimento && String(u.id) !== "1" && u.perfilMembro !== 'Afastado')
      .map(u => {
        const partes = u.dataNascimento.split('-'); 
        let dataAniv = new Date(hojeZerado.getFullYear(), parseInt(partes[1]) - 1, parseInt(partes[2]));
        if (dataAniv < hojeZerado) dataAniv.setFullYear(hojeZerado.getFullYear() + 1);
        const diffDays = Math.ceil((dataAniv - hojeZerado) / (1000 * 60 * 60 * 24));
        return { ...u, diasPara: diffDays, dataAlvo: dataAniv, idadeNova: dataAniv.getFullYear() - parseInt(partes[0]) };
      })
      .filter(u => u.diasPara >= 0 && u.diasPara <= 30)
      .sort((a, b) => a.diasPara - b.diasPara);
  }, [usuarios, hojeZerado]);

  const frequenciaTexto = {
    'toda_semana': '',
    '1_semana': '1ª SEMANA',
    '2_semana': '2ª SEMANA',
    '3_semana': '3ª SEMANA',
    '4_semana': '4ª SEMANA',
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 relative text-left animate-fade-in-up">
      {/* TICKER PREMIUM — AGENDA */}
      {programacao.length > 0 && (
        <div
           onClick={() => navigate('/cadastro/programacao')}
           className="-mt-6 mb-4 w-full bg-gradient-hero hover:shadow-elegant transition-all cursor-pointer border border-navy/10 rounded-3xl overflow-hidden shadow-elegant flex items-center relative h-14 group"
        >
           <div className="absolute left-0 top-0 bottom-0 z-10 bg-navy-deep flex items-center px-6 border-r border-gold/20 shadow-[10px_0_30px_-10px_rgba(11,30,63,1)]">
              <span className="flex items-center gap-2 text-[10px] font-bold text-gold tracking-[0.25em] uppercase">
                 <span className="w-2 h-2 rounded-full bg-gold animate-pulse"></span> Agenda
              </span>
           </div>

           <div className="relative w-full h-full overflow-hidden ml-28 whitespace-nowrap">
             <div className="animate-ticker inline-flex items-center flex-nowrap gap-10 whitespace-nowrap h-full pl-[100%] text-white">
               {[...programacao, ...programacao, ...programacao].map((p, i) => (
                 <div key={`${p.id}-${i}`} className="flex items-center gap-3 shrink-0 text-white">
                    <CalendarDays size={14} className="text-gold/70" />
                    <span className="font-display font-bold text-sm text-white">{p.titulo}</span>
                    <span className="text-[9px] text-slate-300 font-bold uppercase tracking-widest bg-white/10 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-white/10">
                       {p.isEspecial && p.dataEspecífica
                          ? new Date(p.dataEspecífica + "T12:00:00").toLocaleDateString('pt-BR')
                          : p.diaSemana}
                    </span>
                    <span className="text-[9px] text-gold font-bold px-2.5 py-1 bg-gold/10 rounded-lg border border-gold/20">
                       {p.horario}h
                    </span>
                    {!p.isEspecial && p.tipoFrequencia && p.tipoFrequencia !== 'toda_semana' && (
                       <span className="text-[9px] text-royal-glow font-bold px-2.5 py-1 bg-royal/20 rounded-lg border border-royal/30">
                          {frequenciaTexto[p.tipoFrequencia]}
                       </span>
                    )}
                    <span className="text-gold/30 font-black mx-2">✦</span>
                 </div>
               ))}
             </div>
           </div>
        </div>
      )}

      {String(usuarioLogado?.id) !== "1" && (
        <MeuConvenio usuarioNome={usuarioLogado?.nome} usuarioLogado={usuarioLogado} />
      )}

      {/* KPI HERO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div onClick={() => abrirListagem('todos')} className="cursor-pointer">
          <KpiCard icon={<Users/>} label="Membros Ativos" value={carregandoMembros ? "..." : stats.totalAtivos} accent="royal" />
        </div>
        <div onClick={() => abrirListagem('jovens')} className="cursor-pointer">
          <KpiCard icon={<TrendingUp/>} label="Jovens" value={carregandoMembros ? "..." : stats.jovens} accent="success" />
        </div>
        <div onClick={() => abrirListagem('adultos')} className="cursor-pointer">
          <KpiCard icon={<UserCheck/>} label="Adultos" value={carregandoMembros ? "..." : stats.adultos} accent="navy" />
        </div>
        <div onClick={() => abrirListagem('idosos')} className="cursor-pointer">
          <KpiCard icon={<PieChart/>} label="Melhor Idade" value={carregandoMembros ? "..." : stats.idosos} accent="gold" />
        </div>
      </div>

      {/* MÉTRICAS DA OBRA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <KpiCard icon={<Cross/>} label="Membros Batizados" value={carregandoMembros ? "..." : stats.batizados} accent="royal" compact />
        <KpiCard icon={<Heart/>} label="Casados" value={carregandoMembros ? "..." : stats.casados} accent="danger" compact />
        <div className="card-premium bg-gradient-hero text-white p-6 flex items-center justify-between gap-4 border-0 relative overflow-hidden">
           <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-gold/10 blur-2xl"></div>
           <div className="relative z-10">
              <p className="text-[9px] font-bold text-gold uppercase tracking-[0.25em] leading-none mb-2">Almas este ano</p>
              <p className="font-display text-5xl font-black text-white tracking-tighter leading-none">{stats.almasAno}</p>
           </div>
           <div className="text-right border-l border-white/10 pl-5 relative z-10">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-2">Ganhos no Ano</p>
              <p className="font-display text-base font-bold leading-tight">
                <span className="text-royal-glow">{stats.novosAno}</span>
                <span className="text-slate-500 mx-1.5">/</span>
                <span className="text-success">{stats.retornoAno}</span>
              </p>
              <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mt-1">Novos / Retorno</p>
           </div>
        </div>
      </div>

      {/* MODAL NOSSA FAMÍLIA (INTEGRAÇÃO DINÂMICA) */}
      {isModalMembrosAberto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy-deep/80 backdrop-blur-md animate-fade-in">
            <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-elegant overflow-hidden flex flex-col max-h-[85vh] text-left animate-scale-in">
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-gradient-hero shrink-0 relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-gold/10 blur-2xl"></div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-bold text-gold uppercase tracking-[0.25em] mb-2">Comunidade</p>
                        <h2 className="font-display text-3xl font-black text-white leading-none">{tituloModal}</h2>
                        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-2">Histórias e vidas transformadas</p>
                    </div>
                    <button onClick={() => setIsModalMembrosAberto(false)} className="p-2 hover:bg-white/10 rounded-full text-white transition-colors relative z-10"><X size={24} /></button>
                </div>
                <div className="overflow-y-auto p-6 space-y-3 bg-background">
                    {membrosFiltrados.length > 0 ? membrosFiltrados.map(u => (
                        <div key={u.id} className="flex items-center gap-5 p-5 bg-white rounded-3xl border border-slate-100 hover:shadow-soft hover:border-royal/20 transition-all">
                            <div className="shrink-0 relative">
                                {u.fotoUrl ? (
                                    <img src={u.fotoUrl} alt="" className="w-20 h-20 rounded-2xl object-cover border-2 border-white shadow-soft" />
                                ) : (
                                    <div className="w-20 h-20 rounded-2xl bg-gradient-royal flex items-center justify-center text-white font-display text-3xl font-black shadow-royal">{u.nome?.charAt(0)}</div>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="font-display font-bold text-navy text-lg leading-tight truncate">{u.nome}</p>
                                <p className="text-[10px] font-bold text-royal uppercase tracking-widest mt-1">{u.cargoNome || 'Membro'}</p>
                                <p className="text-xs text-muted-foreground font-medium leading-relaxed mt-2 line-clamp-2">{u.biografia || "Membro da nossa comunidade, escrevendo sua história com Deus."}</p>
                            </div>
                        </div>
                    )) : (
                      <div className="py-20 text-center opacity-40">
                        <Users className="mx-auto mb-4" size={48} />
                        <p className="font-bold uppercase text-xs tracking-widest">Nenhum membro nesta categoria.</p>
                      </div>
                    )}
                </div>
                <div className="p-5 bg-white border-t border-slate-100 text-center flex items-center justify-center gap-2">
                  <HeartHandshake size={14} className="text-gold"/>
                  <p className="font-display italic text-xs text-muted-foreground">"Alegrei-me quando me disseram: Vamos à casa do Senhor"</p>
                </div>
            </div>
        </div>
      )}

      {/* ANIVERSARIANTES + PALAVRA DO DIA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card-premium">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-[10px] font-bold text-gold uppercase tracking-[0.25em] mb-1.5">Celebração</p>
              <h3 className="font-display text-2xl font-black text-navy flex items-center gap-2 leading-none">
                <Cake className="text-gold" size={22}/> Aniversariantes
              </h3>
            </div>
            <span className="badge-gold">{proximosAniversariantes.length} próximos</span>
          </div>

          <div className="space-y-2.5">
            {carregandoMembros ? (
               <div className="flex justify-center py-10"><Loader2 className="animate-spin text-royal" /></div>
            ) : proximosAniversariantes.length > 0 ? (
              proximosAniversariantes.map(u => (
                <div key={u.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                  u.diasPara === 0
                    ? 'bg-gradient-to-r from-gold/10 to-transparent border-gold/30 shadow-gold'
                    : 'bg-background border-transparent hover:border-slate-200 hover:bg-slate-50'
                }`}>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      {u.fotoUrl ? (
                         <img src={u.fotoUrl} className="w-11 h-11 rounded-xl object-cover border-2 border-white shadow-soft" />
                      ) : (
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-display font-black transition-all ${
                          u.diasPara === 0 ? 'bg-gradient-gold text-navy' : 'bg-white text-royal shadow-soft border border-slate-100'
                        }`}>
                          {u.nome?.charAt(0)}
                        </div>
                      )}
                      {u.batizado && (
                        <div className="absolute -bottom-1 -right-1 bg-royal text-white p-0.5 rounded-md border-2 border-white">
                          <Cross size={8} />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-display font-bold text-navy text-sm leading-none">{u.nome}</p>
                        <span className="bg-white text-muted-foreground text-[8px] font-bold px-2 py-0.5 rounded-full border border-slate-200 uppercase tracking-wider">
                          {u.idadeNova} anos
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-1.5">
                        {u.dataAlvo.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {u.diasPara === 0 ? (
                      <span className="bg-gradient-gold text-navy px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-gold animate-pulse">Hoje 🎂</span>
                    ) : (
                      <div className="text-right">
                        <span className="font-display font-black text-royal text-2xl leading-none">{u.diasPara}</span>
                        <span className="block text-[9px] text-muted-foreground font-bold uppercase tracking-wider mt-1">dias</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-16 opacity-30">
                <Cake className="mx-auto text-muted-foreground mb-2" size={40} />
                <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">Nenhum aniversário próximo.</p>
              </div>
            )}
          </div>
        </div>

        {/* PALAVRA DO DIA — premium com pattern de vitral */}
        <div className="card-dark pattern-stained flex flex-col justify-between min-h-[400px] group">
          <div className="absolute inset-0 animate-shimmer pointer-events-none opacity-20"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-6">
              <span className="badge-gold">✛ Palavra do Dia</span>
            </div>
            <p className="font-display italic text-2xl leading-relaxed text-white">
              "{versiculo.texto}"
            </p>
          </div>
          <div className="relative z-10 mt-8">
            <div className="h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent mb-5"></div>
            <div className="flex items-center justify-between">
              <p className="text-gold font-bold uppercase text-[10px] tracking-[0.3em]">— {versiculo.referencia}</p>
              <button
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: 'Palavra do Dia', text: `"${versiculo.texto}" — ${versiculo.referencia}` });
                  } else {
                    navigator.clipboard.writeText(`"${versiculo.texto}" — ${versiculo.referencia}`);
                  }
                }}
                className="text-[9px] font-bold text-white/60 hover:text-gold uppercase tracking-widest transition-colors"
              >
                Compartilhar →
              </button>
            </div>
          </div>
          <div className="absolute -bottom-10 -right-10 opacity-[0.04] rotate-12 z-0">
            <Cross size={250} />
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, accent = 'royal', compact = false }) {
  const accents = {
    royal:   { bg: 'bg-royal/10',   text: 'text-royal',   ring: 'group-hover:shadow-royal' },
    success: { bg: 'bg-success/10', text: 'text-success', ring: 'group-hover:shadow-soft' },
    navy:    { bg: 'bg-navy/10',    text: 'text-navy',    ring: 'group-hover:shadow-elegant' },
    gold:    { bg: 'bg-gold/10',    text: 'text-gold',    ring: 'group-hover:shadow-gold' },
    danger:  { bg: 'bg-danger/10',  text: 'text-danger',  ring: 'group-hover:shadow-soft' },
  };
  const a = accents[accent] || accents.royal;

  return (
    <div className={`group bg-white rounded-3xl border border-slate-100 p-6 shadow-soft hover:-translate-y-1 transition-all duration-300 ${a.ring}`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 rounded-2xl ${a.bg} ${a.text} flex items-center justify-center group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
        <div className={`text-[9px] font-bold uppercase tracking-widest ${a.text} opacity-60`}>↗</div>
      </div>
      <p className={`font-display font-black text-navy tracking-tighter leading-none ${compact ? 'text-3xl' : 'text-5xl'}`}>
        {value}
      </p>
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-3">
        {label}
      </p>
    </div>
  );
}