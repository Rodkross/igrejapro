import React, { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { db } from '../database/firebase';
import { doc, onSnapshot, collection, query, where, getDocs, updateDoc, arrayUnion } from 'firebase/firestore';
import {
  LayoutDashboard, Users, CreditCard, ChevronDown, ChevronUp,
  Settings, LogOut, User as UserIcon, CalendarDays, PlusCircle,
  ArrowRightLeft, BarChart3, Trophy, Gamepad2, ArrowLeft
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
        const q = query(collection(db, "programacaoSemanal"), where("isEspecial", "==", true));
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
    // A dependência foi alterada para reagir apenas a mudanças no ID do usuário ou na lista de avisos já vistos.
    // Isso impede que outras atualizações no perfil do usuário (como pontuação de jogos) reativem o modal desnecessariamente.
  }, [dadosSincronizados?.id, JSON.stringify(dadosSincronizados?.avisosVistos)]);

  const silenciarEvento = async (eventoId) => {
    if (dadosSincronizados?.id && eventoId) {
      try {
        const userRef = doc(db, "usuarios", String(dadosSincronizados.id));
        await updateDoc(userRef, { avisosVistos: arrayUnion(eventoId) });
      } catch (err) { console.error("Erro ao silenciar aviso:", err); }
    }
  };

  const fecharVariosModais = () => setExibirModalEspecial(false);

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
      inter = setInterval(verificarAoVivo, 60000);
    });
    return () => { unsub(); clearInterval(inter); };
  }, []);

  const temAcesso = (modulo) => {
    const userAtual = dadosSincronizados;
    const nome = userAtual?.nome?.toLowerCase() || '';
    const cargo = userAtual?.cargoNome?.toLowerCase() || '';
    if (String(userAtual?.id) === "1" || nome === 'rodrigo' || cargo.includes('pastor') || cargo.includes('admin')) return true;
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

  const toggleCadastroMenu = () => {
    setMenuCadastroAberto((prev) => {
      if (!prev) setMenuFinanceiroAberto(false);
      return !prev;
    });
  };

  const toggleFinanceiroMenu = () => {
    setMenuFinanceiroAberto((prev) => {
      if (!prev) setMenuCadastroAberto(false);
      return !prev;
    });
  };

  const fecharMenus = () => {
    setMenuCadastroAberto(false);
    setMenuFinanceiroAberto(false);
  };

  const isActive = (p) => (p === '/' ? location.pathname === '/' : location.pathname.startsWith(p));
  const navLinkClass = (p) => `group relative flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 ${
    isActive(p) ? 'bg-gradient-royal text-white shadow-royal' : 'text-slate-400 hover:bg-white/5 hover:text-white'
  }`;
  const subLinkClass = (p) => `flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-all rounded-xl ${
    location.pathname === p ? 'text-gold bg-gold/10 border border-gold/20' : 'text-slate-500 hover:text-white hover:bg-white/5'
  }`;

  return (
    <div className="flex min-h-screen bg-background font-sans overflow-x-hidden">
      
      {/* MODAIS GLOBAIS */}
      {exibirModalEspecial && !verificandoDestaques && (
        <ModalDestaque eventos={eventosEspeciais} aoSilenciar={silenciarEvento} aoFechar={fecharVariosModais} />
      )}

      {!verificandoDestaques && !exibirModalEspecial && exibirAniversario && (
        <AniversarioOverlay nome={formatarNome(dadosSincronizados?.nome)} onFinalizar={finalizarAniversario} DURACAO_MS={DURACAO_ANIMACAO} />
      )}

      {/* SIDEBAR ROYAL */}
      <aside className="w-64 flex-shrink-0 hidden md:flex flex-col h-screen sticky top-0 shadow-2xl z-50 text-left bg-gradient-sidebar relative overflow-hidden">
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
            <p className="text-[9px] font-bold text-gold uppercase tracking-[0.25em] mt-0.5 text-left">Gestão Pastoral</p>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto relative text-left">
<Link to="/" onClick={fecharMenus} className={navLinkClass('/')}> 
            <LayoutDashboard size={18} />
            <span className="font-bold uppercase text-[11px] tracking-widest leading-none text-left">Dashboard</span>
            {isActive('/') && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-gold text-left"></span>}
          </Link>

          {(temAcesso('usuarios') || temAcesso('cargos') || temAcesso('programacao')) && (
            <div className="space-y-1 pt-1.5 text-left">
              <button onClick={toggleCadastroMenu} className="w-full flex items-center justify-between px-3 py-2.5 text-slate-400 hover:bg-white/5 hover:text-white rounded-2xl transition-all outline-none">
                <div className="flex items-center gap-3"><Settings size={18} /><span className="font-bold uppercase text-[11px] tracking-widest text-left">Cadastros</span></div>
                {menuCadastroAberto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {menuCadastroAberto && (
                <div className="ml-4 pl-2 border-l border-white/10 py-1 space-y-0.5 text-left">
                  {temAcesso('programacao') && <Link to="/cadastro/programacao" className={subLinkClass('/cadastro/programacao')}>Programação</Link>}
                  {temAcesso('usuarios') && <Link to="/cadastro/usuarios" className={subLinkClass('/cadastro/usuarios')}>Membros</Link>}
                  {temAcesso('cargos') && <Link to="/cadastro/cargos" className={subLinkClass('/cadastro/cargos')}>Níveis de Acesso</Link>}
                  {temAcesso('planoContas') && <Link to="/cadastro/plano-contas" className={subLinkClass('/cadastro/plano-contas')}>Plano de Contas</Link>}
                  {temAcesso('contas') && <Link to="/cadastro/contas" className={subLinkClass('/cadastro/contas')}>Contas</Link>}
                  {temAcesso('cantina') && <Link to="/cadastro/cantina" className={subLinkClass('/cadastro/cantina')}>Cantina</Link>}
                </div>
              )}
            </div>
          )}

          {(temAcesso('fluxo') || temAcesso('lancamentos') || temAcesso('pagar') || temAcesso('receber') || temAcesso('convenio') || temAcesso('relatorios')) && (
            <div className="space-y-1 pt-1.5 text-left">
              <button onClick={toggleFinanceiroMenu} className="w-full flex items-center justify-between px-3 py-2.5 text-slate-400 hover:bg-white/5 hover:text-white rounded-2xl transition-all outline-none text-left">
                <div className="flex items-center gap-3"><CreditCard size={18} /><span className="font-bold uppercase text-[11px] tracking-widest text-left">Financeiro</span></div>
                {menuFinanceiroAberto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {menuFinanceiroAberto && (
                <div className="ml-4 pl-2 border-l border-white/10 py-1 space-y-0.5 text-left">
                  {temAcesso('fluxo') && <Link to="/financeiro/fluxo" className={subLinkClass('/financeiro/fluxo')}>Fluxo de Caixa</Link>}
                  {temAcesso('lancamentos') && <Link to="/financeiro/lancamentos" className={subLinkClass('/financeiro/lancamentos')}>Lançamentos</Link>}
                  {temAcesso('lancamentos') && <Link to="/financeiro/transferencias" className={subLinkClass('/financeiro/transferencias')}>Transferências</Link>}
                  {temAcesso('pagar') && <Link to="/financeiro/pagar" className={subLinkClass('/financeiro/pagar')}>Contas a Pagar</Link>}
                  {temAcesso('receber') && <Link to="/financeiro/receber" className={subLinkClass('/financeiro/receber')}>Contas a Receber</Link>}
                  {temAcesso('convenio') && <Link to="/financeiro/convenio" className={subLinkClass('/financeiro/convenio')}>Convênio</Link>}
                  {temAcesso('relatorios') && <Link to="/financeiro/relatorios" className={subLinkClass('/financeiro/relatorios')}>Relatórios</Link>}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* CARD DE ENTRETENIMENTO (QUIZ BÍBLICO) INTEGRADO NA SIDEBAR */}
        <div className="p-4 border-t border-white/5 relative">
          <div className="bg-slate-900 rounded-[2rem] p-5 relative overflow-hidden border border-white/5 shadow-2xl min-h-[160px] flex flex-col justify-center text-left group cursor-pointer hover:border-gold/30 transition-all">
            <div className="absolute -right-4 -bottom-4 opacity-10 pointer-events-none group-hover:scale-110 transition-transform duration-700">
              <PlusCircle size={100} strokeWidth={1} className="text-white" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse"></div>
                  <p className="text-[9px] font-bold text-gold uppercase tracking-[0.25em]">Quiz do Reino</p>
                </div>
                <span className="bg-gold text-navy text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter shadow-gold">Novo</span>
              </div>
              
              <h2 className="font-display text-lg font-black text-white leading-tight mb-2 italic uppercase tracking-tighter">
                Desafio<br/><span className="text-gold text-xl">Bíblico</span>
              </h2>
              
              <Link 
                to="/entretenimento/quiz" 
                className="mt-2 inline-flex items-center gap-2 bg-white text-navy font-black text-[9px] uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-gold transition-all shadow-xl active:scale-95"
              >
                <Gamepad2 size={12} /> Jogar Agora
              </Link>
            </div>
          </div>
        </div>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden text-left bg-background">
        <header className="h-20 bg-gradient-hero border-b border-white/5 flex items-center px-10 shrink-0 z-40 shadow-elegant relative">
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent"></div>

          {/* BOTÃO VOLTAR - ESQUERDA */}
          {location.pathname !== '/' && (
            <Link to="/" className={`flex items-center gap-2 hover:bg-white/10 p-2 rounded-2xl transition-all outline-none group relative z-10 ${
              location.pathname.startsWith('/entretenimento/quiz') ? 'md:hidden' : ''
            }`}>
              <ArrowLeft size={20} className="text-gold group-hover:text-white transition-colors" />
              <span className="text-[9px] font-bold text-gold uppercase tracking-widest group-hover:text-white transition-colors">Voltar</span>
            </Link>
          )}

          {/* EVENTO AO VIVO - ESQUERDA */}
          <div className={`flex items-center gap-1 relative z-10 text-left ${
            location.pathname.startsWith('/cadastro') || location.pathname.startsWith('/entretenimento/quiz')
              ? 'hidden md:flex'
              : 'flex'
          }`}>
            {eventoAoVivo ? (
              <>
                <div className="text-left flex flex-col justify-center">
                  <p className="text-[8px] font-bold text-gold uppercase tracking-[0.2em] leading-none mb-0.5 text-left"><span className="w-2 h-2 rounded-full bg-gold animate-pulse mr-0.5 inline-block"></span>Ao vivo</p>
                  <p className="font-display text-xs font-bold text-white leading-tight text-left">{eventoAoVivo.titulo}</p>
                </div>
              </>
            ) : (
              <>
                <div className="p-1.5 bg-white/10 backdrop-blur-md rounded-lg border border-white/10 text-left"><CalendarDays size={14} className="text-gold" /></div>
                <div className="text-left">
                  <p className="text-[7px] font-bold text-gold uppercase tracking-[0.15em] leading-none mb-0.5 text-left">
                    {(() => {
                      const h = new Date().getHours();
                      if (h < 12) return 'Bom dia';
                      if (h < 18) return 'Boa tarde';
                      return 'Boa noite';
                    })()}
                  </p>
                  <p className="text-xs font-bold text-white capitalize leading-tight text-left">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</p>
                </div>
              </>
            )}
          </div>

          {/* AVATAR DO USUÁRIO - DIREITA */}
          <div className="relative text-left ml-auto -mr-2" ref={userMenuRef}>
            <button onClick={() => setUserMenuAberto(!userMenuAberto)} className="flex items-center gap-2 hover:bg-white/10 p-2 rounded-2xl transition-all outline-none group relative z-50">
              <div className="relative shrink-0 text-left">
                <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm border-2 border-gold/40 text-white flex items-center justify-center shadow-gold overflow-hidden text-left">
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
                  <button onClick={() => { setConfigModalAberto(true); setUserMenuAberto(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-royal/5 hover:text-royal rounded-2xl transition-all font-bold text-[11px] uppercase tracking-wider text-left mb-1"><Settings size={16} /> Configurações</button>
                )}
                <button onClick={aoSair} className="w-full flex items-center gap-3 px-4 py-3 text-danger hover:bg-danger/5 rounded-2xl transition-all font-bold text-[11px] uppercase tracking-wider text-left"><LogOut size={16} /> Sair do Sistema</button>
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-8 py-4 text-left bg-background">
          <Outlet context={{ usuario: dadosSincronizados }} />
        </div>
      </main>

      {configModalAberto && <ModalConfiguracoes aoFechar={() => setConfigModalAberto(false)} />}
    </div>
  );
}
