import React, { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { db } from '../database/firebase';
import { doc, onSnapshot, collection, query, where, getDocs, updateDoc, arrayUnion } from 'firebase/firestore';
import {
  LayoutDashboard, Users, CreditCard, ChevronDown, ChevronUp,
  Settings, LogOut, User as UserIcon, CalendarDays, PlusCircle,
  ArrowRightLeft, BarChart3
} from 'lucide-react';
import AniversarioOverlay from './AniversarioOverlay';
import ModalDestaque from './ModalDestaque';
import { useAniversarioAcesso } from '../hooks/useAniversarioAcesso';
import ModalConfiguracoes from './ModalConfiguracoes';

export default function Layout({ usuario, aoSair }) {
  const [dadosSincronizados, setDadosSincronizados] = useState(usuario);
  const [menuCadastroAberto, setMenuCadastroAberto] = useState(false);
  const [menuFinanceiroAberto, setMenuFinanceiroAberto] = useState(false);
  const [userMenuAberto, setUserMenuAberto] = useState(false);
  
  const [eventosEspeciais, setEventosEspeciais] = useState([]);
  const [exibirModalEspecial, setExibirModalEspecial] = useState(false);
  const [eventoAoVivo, setEventoAoVivo] = useState(null);
  const [verificandoDestaques, setVerificandoDestaques] = useState(true);

  const [configModalAberto, setConfigModalAberto] = useState(false);
  const [configGeral, setConfigGeral] = useState(null);

  const location = useLocation();
  const userMenuRef = useRef(null);
  
  const { exibirAniversario, finalizarAniversario, DURACAO_ANIMACAO } = useAniversarioAcesso(dadosSincronizados);

  // --- 1. SINCRONIZAÇÃO COM FIREBASE ---
  useEffect(() => {
    if (!usuario?.id) return;
    const unsub = onSnapshot(doc(db, "usuarios", String(usuario.id)), (docSnap) => {
      if (docSnap.exists()) {
        const novosDados = { id: docSnap.id, ...docSnap.data() };
        setDadosSincronizados(novosDados);
        sessionStorage.setItem('usuarioLogado', JSON.stringify(novosDados));
      }
    });

    const unsubConfig = onSnapshot(doc(db, "configuracoes", "geral"), (docSnap) => {
       if (docSnap.exists()) {
         setConfigGeral(docSnap.data());
       } else {
         setConfigGeral(null);
       }
    });

    return () => { unsub(); unsubConfig(); };
  }, [usuario?.id]);

  // --- 2. LÓGICA DO MODAL ESPECIAL ---
  useEffect(() => {
    const buscarDestaques = async () => {
      if (!dadosSincronizados?.id) {
        setVerificandoDestaques(false);
        return;
      }

      try {
        const q = query(
          collection(db, "programacaoSemanal"), 
          where("isEspecial", "==", true)
        );
        
        const querySnapshot = await getDocs(q);
        const agora = new Date();
        const listaCompleta = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (listaCompleta.length > 0) {
          const silenciados = Array.isArray(dadosSincronizados?.avisosVistos) 
             ? dadosSincronizados.avisosVistos 
             : (dadosSincronizados?.avisoVistoId ? [dadosSincronizados.avisoVistoId] : []);
             
          const eventosParaExibir = listaCompleta
              .filter(eve => {
                if (silenciados.includes(eve.id)) return false;
                const [ano, mes, dia] = eve.dataEspecífica.split('-');
                const [hora, minuto] = (eve.horario || "00:00").split(':');
                const dataInicio = new Date(ano, mes - 1, dia, hora, minuto);
                const dataFim = new Date(dataInicio.getTime() + 120 * 60000);
                return agora < dataFim;
              })
              .sort((a, b) => new Date(a.dataEspecífica) - new Date(b.dataEspecífica));

          if (eventosParaExibir.length > 0) {
            setEventosEspeciais(eventosParaExibir);
            setExibirModalEspecial(true);
          } else {
            setExibirModalEspecial(false);
          }
        }
      } catch (error) {
        console.error("Erro busca modal:", error);
      } finally {
        setVerificandoDestaques(false);
      }
    };

    buscarDestaques();
  }, [dadosSincronizados?.id, dadosSincronizados?.avisoVistoId, dadosSincronizados?.avisosVistos]);

  const silenciarEvento = async (eventoId) => {
    if (dadosSincronizados?.id && eventoId) {
      try {
        const userRef = doc(db, "usuarios", String(dadosSincronizados.id));
        await updateDoc(userRef, {
          avisosVistos: arrayUnion(eventoId)
        });
      } catch (err) {
        console.error("Erro ao silenciar aviso:", err);
      }
    }
  };

  const fecharVariosModais = () => {
    setExibirModalEspecial(false);
  };

  // --- VERIFICAÇÃO DE EVENTO AO VIVO ---
  useEffect(() => {
    let inter;
    const q = query(collection(db, "programacaoSemanal"));
    const unsub = onSnapshot(q, (snap) => {
      const lista = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const verificarAoVivo = () => {
        const agora = new Date();
        const diasSemana = ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'];
        const hojeTexto = diasSemana[agora.getDay()];
        const dataHojeIso = agora.toISOString().split('T')[0];
        const horaAtual = agora.getHours() * 60 + agora.getMinutes();

        const ativo = lista.find(p => {
          const mesmoDia = p.isEspecial ? p.dataEspecífica === dataHojeIso : p.diaSemana === hojeTexto;
          if (!mesmoDia || !p.horario) return false;
          const partes = p.horario.split(':');
          if (partes.length !== 2) return false;
          const minInicio = parseInt(partes[0], 10) * 60 + parseInt(partes[1], 10);
          const minFim = minInicio + 120;
          return horaAtual >= minInicio && horaAtual <= minFim;
        });
        setEventoAoVivo(ativo || null);
      };
      verificarAoVivo();
      if (inter) clearInterval(inter);
      inter = setInterval(verificarAoVivo, 60000);
    });
    return () => { unsub(); if (inter) clearInterval(inter); };
  }, []);

  const temAcesso = (modulo) => {
    const userAtual = dadosSincronizados;
    if (String(userAtual?.id) === "1" && modulo === 'convenio') return false;
    const nome = userAtual?.nome?.toLowerCase() || '';
    const cargo = userAtual?.cargoNome?.toLowerCase() || '';
    if (String(userAtual?.id) === "1" || nome === 'rodrigo' || cargo.includes('pastor') || cargo.includes('admin')) {
      return true;
    }
    return userAtual?.permissoes && userAtual?.permissoes[modulo] === true;
  };

  const formatarNome = (n) => n ? n.split(' ')[0] : 'Usuário';

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuAberto(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActive = (p) => (p === '/' ? location.pathname === '/' : location.pathname.startsWith(p));
  const navLinkClass = (p) => `group relative flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 ${
    isActive(p) ? 'bg-gradient-royal text-white shadow-royal' : 'text-slate-400 hover:bg-white/5 hover:text-white'
  }`;
  const subLinkClass = (p) => `flex items-center gap-2 px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all rounded-xl ${
    location.pathname === p ? 'text-gold bg-gold/10 border border-gold/20' : 'text-slate-500 hover:text-white hover:bg-white/5'
  }`;

  return (
    <div className="flex min-h-screen bg-background font-sans">
      
      {exibirModalEspecial && !verificandoDestaques && (
        <ModalDestaque eventos={eventosEspeciais} aoSilenciar={silenciarEvento} aoFechar={fecharVariosModais} />
      )}

      {!verificandoDestaques && !exibirModalEspecial && exibirAniversario && (
        <AniversarioOverlay nome={formatarNome(dadosSincronizados?.nome)} onFinalizar={finalizarAniversario} DURACAO_MS={DURACAO_ANIMACAO} />
      )}

      <aside className="w-64 hidden md:flex flex-col shadow-2xl z-50 text-left bg-gradient-sidebar relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-gold"></div>
        <div className="p-6 border-b border-white/5 flex items-center gap-4 relative">
          {configGeral?.igrejaLogo ? (
             <img src={configGeral.igrejaLogo} alt="Logo" className="w-12 h-12 object-contain rounded-2xl bg-white/10 p-1.5 border border-white/10" />
          ) : (
             <div className="w-12 h-12 rounded-2xl bg-gradient-gold flex items-center justify-center shadow-gold">
               <span className="font-display font-black text-navy text-xl">✛</span>
             </div>
          )}
          <div className="leading-tight">
            <h1 className="font-display text-xl font-black text-white tracking-tight line-clamp-1">{configGeral?.igrejaNome || 'Igreja Pro'}</h1>
            <p className="text-[9px] font-bold text-gold uppercase tracking-[0.25em] mt-0.5">Gestão Pastoral</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto relative text-left">
          <Link to="/" className={navLinkClass('/')}>
            <LayoutDashboard size={18} />
            <span className="font-bold uppercase text-[11px] tracking-widest leading-none">Dashboard</span>
            {isActive('/') && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-gold"></span>}
          </Link>

          {(temAcesso('usuarios') || temAcesso('cargos') || temAcesso('planoContas') || temAcesso('contas') || temAcesso('cantina') || temAcesso('programacao')) && (
            <div className="space-y-1 pt-2 text-left">
              <button onClick={() => setMenuCadastroAberto(!menuCadastroAberto)} className="w-full flex items-center justify-between px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-white rounded-2xl transition-all outline-none">
                <div className="flex items-center gap-3"><Settings size={18} /><span className="font-bold uppercase text-[11px] tracking-widest">Cadastros</span></div>
                {menuCadastroAberto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {menuCadastroAberto && (
                <div className="ml-5 pl-3 border-l border-white/10 py-1 space-y-0.5 text-left">
                  {temAcesso('programacao') && <Link to="/cadastro/programacao" className={subLinkClass('/cadastro/programacao')}>Programação</Link>}
                  {temAcesso('usuarios') && <Link to="/cadastro/usuarios" className={subLinkClass('/cadastro/usuarios')}>Membros</Link>}
                  {temAcesso('cargos') && <Link to="/cadastro/cargos" className={subLinkClass('/cadastro/cargos')}>Cargos</Link>}
                  {temAcesso('planoContas') && <Link to="/cadastro/plano-contas" className={subLinkClass('/cadastro/plano-contas')}>Plano Contas</Link>}
                  {temAcesso('contas') && <Link to="/cadastro/contas" className={subLinkClass('/cadastro/contas')}>Fornecedores</Link>}
                  {temAcesso('cantina') && <Link to="/cadastro/cantina" className={subLinkClass('/cadastro/cantina')}>Produtos Cantina</Link>}
                </div>
              )}
            </div>
          )}

          {temAcesso('fluxo') && (
            <div className="space-y-1 pt-2 text-left">
              <button onClick={() => setMenuFinanceiroAberto(!menuFinanceiroAberto)} className="w-full flex items-center justify-between px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-white rounded-2xl transition-all outline-none text-left">
                <div className="flex items-center gap-3"><CreditCard size={18} /><span className="font-bold uppercase text-[11px] tracking-widest">Financeiro</span></div>
                {menuFinanceiroAberto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {menuFinanceiroAberto && (
                <div className="ml-5 pl-3 border-l border-white/10 py-1 space-y-0.5 text-left">
                  <Link to="/financeiro/fluxo" className={subLinkClass('/financeiro/fluxo')}>Fluxo de Caixa</Link>
                  <Link to="/financeiro/lancamentos" className={subLinkClass('/financeiro/lancamentos')}>Lançamentos</Link>
                  <Link to="/financeiro/transferencias" className={subLinkClass('/financeiro/transferencias')}>Transferências</Link>
                  <Link to="/financeiro/pagar" className={subLinkClass('/financeiro/pagar')}>Contas a Pagar</Link>
                  <Link to="/financeiro/receber" className={subLinkClass('/financeiro/receber')}>Contas a Receber</Link>
                  <Link to="/financeiro/convenio" className={subLinkClass('/financeiro/convenio')}>Convênio Cantina</Link>
                </div>
              )}
            </div>
          )}

          {temAcesso('relatorios') && (
            <Link to="/financeiro/relatorios" className={navLinkClass('/financeiro/relatorios')}>
              <BarChart3 size={18} />
              <span className="font-bold uppercase text-[11px] tracking-widest leading-none">Relatórios BI</span>
              {isActive('/financeiro/relatorios') && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-gold"></span>}
            </Link>
          )}
        </nav>

        {/* CARD PALAVRA DO DIA ESTILO DASHBOARD */}
        <div className="p-4 border-t border-white/5 relative">
          <div className="bg-slate-900 rounded-[2rem] p-5 relative overflow-hidden border border-white/5 shadow-2xl min-h-[160px] flex flex-col justify-center text-left">
            <div className="absolute -right-4 -bottom-4 opacity-10 pointer-events-none">
              <PlusCircle size={100} strokeWidth={1} className="text-white" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse"></div>
                <p className="text-[9px] font-bold text-gold uppercase tracking-[0.25em]">Palavra do Dia</p>
              </div>
              <p className="font-display italic text-[11.5px] text-white/90 leading-relaxed font-medium mb-3">
                "Depois me levou ao átrio interior, que olha para o oriente; e mediu a porta conforme estas medidas;"
              </p>
              <div className="flex items-center gap-2">
                <div className="h-[1px] w-4 bg-gold/50"></div>
                <p className="text-[10px] text-gold font-bold uppercase tracking-widest leading-none">Ezequiel 40:32</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden text-left bg-background">
        <header className="h-20 bg-gradient-hero border-b border-white/5 flex items-center justify-between px-10 shrink-0 z-40 shadow-elegant relative text-left">
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent"></div>

          <div className="flex items-center gap-3 relative z-10 text-left">
            {eventoAoVivo ? (
              <>
                <div className="relative w-12 h-12 rounded-2xl overflow-hidden border-2 border-gold shadow-gold flex items-center justify-center bg-gold/10 backdrop-blur-sm">
                  {eventoAoVivo.bannerUrl ? <img src={eventoAoVivo.bannerUrl} alt="Ao Vivo" className="w-full h-full object-cover" /> : <div className="w-3 h-3 bg-gold rounded-full animate-pulse"></div>}
                </div>
                <div className="text-left flex flex-col justify-center">
                  <p className="text-[9px] font-bold text-gold uppercase tracking-[0.25em] leading-none mb-1.5 flex items-center gap-1.5 text-left"><span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse"></span>Acontecendo agora</p>
                  <p className="font-display text-base font-bold text-white leading-none truncate max-w-[260px] text-left">{eventoAoVivo.titulo}</p>
                </div>
              </>
            ) : (
              <>
                <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
                  <CalendarDays size={18} className="text-gold" />
                </div>
                <div className="text-left">
                  <p className="text-[9px] font-bold text-gold uppercase tracking-[0.25em] leading-none mb-1.5 text-left">
                    {(() => {
                      const h = new Date().getHours();
                      if (h < 12) return 'Bom dia';
                      if (h < 18) return 'Boa tarde';
                      return 'Boa noite';
                    })()}
                  </p>
                  <p className="font-display text-base font-bold text-white capitalize leading-none text-left">
                    {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="relative text-left" ref={userMenuRef}>
            <button 
              onClick={() => setUserMenuAberto(!userMenuAberto)} 
              className="flex items-center gap-4 hover:bg-white/10 p-2 rounded-2xl transition-all outline-none group relative z-50"
            >
              <div className="text-right leading-none text-left">
                <p className="font-display text-sm font-bold text-white leading-none text-left">{dadosSincronizados?.nome || 'Usuário'}</p>
                <p className="text-[9px] text-gold font-bold uppercase tracking-[0.25em] mt-1.5 leading-none text-right">{dadosSincronizados?.cargoNome || 'Membro'}</p>
              </div>
              <div className="relative shrink-0 text-left">
                <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm border-2 border-gold/40 text-white flex items-center justify-center shadow-gold overflow-hidden">
                  {dadosSincronizados?.fotoUrl ? <img src={dadosSincronizados.fotoUrl} alt="Avatar" className="w-full h-full object-cover" /> : <UserIcon size={22} />}
                </div>
                <div className={`absolute -bottom-1 -right-1 w-5 h-5 bg-gradient-gold border-2 border-navy rounded-full flex items-center justify-center text-navy shadow-sm transition-transform duration-300 ${userMenuAberto ? 'rotate-180' : ''}`}>
                   <ChevronDown size={10} />
                </div>
              </div>
            </button>
            
            {userMenuAberto && (
              <div className="absolute right-0 mt-4 w-64 bg-white rounded-3xl shadow-2xl border border-slate-100 p-3 text-left z-[100] animate-scale-in origin-top-right">
                {(String(dadosSincronizados?.id) === "1" || dadosSincronizados?.nome?.toLowerCase() === 'suporte' || dadosSincronizados?.cargoNome === "SISTEMA") && (
                  <button
                    onClick={() => { setConfigModalAberto(true); setUserMenuAberto(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-royal/5 hover:text-royal rounded-2xl transition-all font-bold text-[11px] uppercase tracking-wider text-left mb-1"
                  >
                    <Settings size={16} /> Configurações
                  </button>
                )}
                <button onClick={aoSair} className="w-full flex items-center gap-3 px-4 py-3 text-danger hover:bg-danger/5 rounded-2xl transition-all font-bold text-[11px] uppercase tracking-wider text-left">
                  <LogOut size={16} /> Sair do Sistema
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 text-left bg-background">
          <Outlet context={{ usuario: dadosSincronizados }} />
        </div>
      </main>

      {configModalAberto && <ModalConfiguracoes aoFechar={() => setConfigModalAberto(false)} />}
    </div>
  );
}