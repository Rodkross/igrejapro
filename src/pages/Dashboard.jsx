import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { db } from '../database/firebase'; 
import { collection, query, onSnapshot } from 'firebase/firestore';
import MeuConvenio from '../components/MeuConvenio';
import { 
  Users, TrendingUp, UserCheck, PieChart, CalendarDays, 
  Cake, Loader2, Cross, Heart, X, HeartHandshake 
} from 'lucide-react';

export default function Dashboard() {
  const { usuario: usuarioLogado } = useOutletContext();
  const navigate = useNavigate();
  
  const [versiculo, setVersiculo] = useState({ texto: "Carregando palavra...", referencia: "" });
  const [usuarios, setUsuarios] = useState([]);
  const [programacao, setProgramacao] = useState([]);
  const [carregandoMembros, setCarregandoMembros] = useState(true);

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

  useEffect(() => {
    const obterVersiculo = async () => {
      const HOJE = new Date().toLocaleDateString('pt-BR');
      const cacheVersiculo = localStorage.getItem('versiculo_dia');
      const cacheData = localStorage.getItem('versiculo_data');
      if (cacheVersiculo && cacheData === HOJE) {
        try { setVersiculo(JSON.parse(cacheVersiculo)); return; } catch { }
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

  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-12 px-4 text-left animate-fade-in-up">
      
      {/* TICKER — AGENDA */}
      {programacao.length > 0 && (
        <div onClick={() => navigate('/cadastro/programacao')} className="w-full bg-gradient-hero border border-white/10 rounded-xl overflow-hidden shadow-elegant flex items-center h-10 group cursor-pointer">
           <div className="z-10 bg-navy-deep px-4 h-full flex items-center border-r border-gold/20">
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard onClick={() => abrirListagem('todos')} icon={<Users/>} label="Membros" value={carregandoMembros ? "..." : stats.totalAtivos} accent="royal" />
        <KpiCard onClick={() => abrirListagem('jovens')} icon={<TrendingUp/>} label="Jovens" value={carregandoMembros ? "..." : stats.jovens} accent="success" />
        <KpiCard onClick={() => abrirListagem('adultos')} icon={<UserCheck/>} label="Adultos" value={carregandoMembros ? "..." : stats.adultos} accent="navy" />
        <KpiCard onClick={() => abrirListagem('idosos')} icon={<PieChart/>} label="Melhor Idade" value={carregandoMembros ? "..." : stats.idosos} accent="gold" />
      </div>

      {/* MÉTRICAS SECUNDÁRIAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard icon={<Cross/>} label="Batizados" value={carregandoMembros ? "..." : stats.batizados} accent="royal" compact />
        <KpiCard icon={<Heart/>} label="Casados" value={carregandoMembros ? "..." : stats.casados} accent="danger" compact />
        
        {/* CARD ALMAS */}
        <div className="bg-gradient-hero rounded-2xl p-4 flex items-center justify-between border border-white/10 shadow-elegant relative overflow-hidden min-h-[110px]">
           <div className="relative z-10">
              <p className="text-[9px] font-bold text-gold uppercase tracking-widest mb-1">Almas / Ano</p>
              <p className="font-display text-4xl font-black text-white leading-none">{stats.almasAno}</p>
           </div>
           <div className="h-8 w-px bg-white/20 mx-2"></div>
           <div className="text-right relative z-10">
              <p className="text-[8px] font-bold text-slate-300 uppercase mb-1">Ganhos</p>
              <div className="text-lg font-bold text-white leading-none">
                <span className="text-gold">{stats.novosAno}</span>
                <span className="text-white/20 mx-1">/</span>
                <span className="text-green-400">{stats.retornoAno}</span>
              </div>
              <p className="text-[7px] text-slate-400 font-bold uppercase mt-1">Novo / Retorno</p>
           </div>
        </div>
      </div>

      {/* ANIVERSÁRIOS VERTICAIS COM FOTO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-100 shadow-soft flex flex-col max-h-[400px]">
          <h3 className="font-display text-lg font-black text-navy mb-4 flex items-center gap-2 shrink-0">
            <Cake size={18} className="text-gold" /> Aniversariantes do Mês
          </h3>
          <div className="overflow-y-auto space-y-2 pr-1 custom-scroll">
            {proximosAniversariantes.length > 0 ? (
              proximosAniversariantes.map(u => (
                <div key={u.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${u.diasPara === 0 ? 'bg-gold/5 border-gold/20' : 'bg-slate-50 border-transparent hover:border-slate-200'}`}>
                  <div className="flex items-center gap-3">
                    <div className="shrink-0">
                        {u.fotoUrl ? (
                            <img src={u.fotoUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-white shadow-sm" />
                        ) : (
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs ${u.diasPara === 0 ? 'bg-gold text-navy' : 'bg-navy text-white'}`}>
                              {u.nome?.charAt(0)}
                            </div>
                        )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-navy leading-tight">{u.nome}</p>
                      <p className="text-[10px] text-slate-500 font-medium uppercase italic">
                        {u.dataAlvo.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })} • {u.idadeNova} anos
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
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

        {/* PALAVRA DO DIA */}
        <div className="bg-navy-deep rounded-2xl p-6 text-white relative overflow-hidden flex flex-col justify-between min-h-[250px] shadow-elegant">
          <div className="relative z-10">
            <span className="text-gold font-bold text-[9px] uppercase tracking-widest border-b border-gold/30 pb-1">✦ Palavra do Dia</span>
            <p className="font-display italic text-base mt-4 text-slate-100 leading-relaxed">"{versiculo.texto}"</p>
          </div>
          <div className="relative z-10 pt-4"><p className="text-gold font-bold text-[10px] tracking-widest">— {versiculo.referencia}</p></div>
          <Cross className="absolute -bottom-6 -right-6 text-white opacity-[0.03]" size={150} />
        </div>
      </div>

      {/* MODAL — COM FOTO E BIO */}
      {isModalMembrosAberto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy-deep/80 backdrop-blur-md animate-fade-in">
            <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-elegant overflow-hidden flex flex-col max-h-[85vh] animate-scale-in">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-hero shrink-0">
                    <div className="relative z-10">
                        <p className="text-[10px] font-bold text-gold uppercase tracking-widest mb-1">Comunidade</p>
                        <h2 className="font-display text-2xl font-black text-white leading-none">{tituloModal}</h2>
                    </div>
                    <button onClick={() => setIsModalMembrosAberto(false)} className="p-2 hover:bg-white/10 rounded-full text-white transition-colors relative z-10"><X size={24} /></button>
                </div>
                <div className="overflow-y-auto p-4 space-y-3 bg-slate-50">
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
                                <p className="text-[9px] font-bold text-royal uppercase tracking-widest mt-0.5">{u.cargoNome || 'Membro'}</p>
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
    </div>
  );
}

function KpiCard({ icon, label, value, accent, compact, onClick }) {
  const accents = {
    royal:   { bg: 'bg-blue-50',  text: 'text-blue-600',  border: 'hover:border-blue-200' },
    success: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'hover:border-emerald-200' },
    navy:    { bg: 'bg-slate-100',  text: 'text-slate-900',  border: 'hover:border-slate-300' },
    gold:    { bg: 'bg-amber-50',   text: 'text-amber-600',  border: 'hover:border-amber-200' },
    danger:  { bg: 'bg-rose-50',    text: 'text-rose-600',   border: 'hover:border-rose-200' },
  };
  const a = accents[accent] || accents.royal;

  return (
    <div 
      onClick={onClick}
      className={`bg-white rounded-2xl border border-slate-100 p-4 shadow-soft transition-all flex flex-col justify-between min-h-[110px] ${onClick ? 'cursor-pointer hover:-translate-y-1' : ''} ${a.border}`}
    >
      <div className={`w-8 h-8 rounded-lg ${a.bg} ${a.text} flex items-center justify-center mb-2`}>
        {React.cloneElement(icon, { size: 16 })}
      </div>
      <div>
        <p className={`font-display font-black text-navy leading-none ${compact ? 'text-2xl' : 'text-3xl'}`}>{value}</p>
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">{label}</p>
      </div>
    </div>
  );
}