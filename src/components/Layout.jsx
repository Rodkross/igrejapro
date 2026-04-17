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
  
  // Hook de Aniversário
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

  // --- 2. LÓGICA DO MODAL ESPECIAL (CORRIGIDA PARA SUMIR APÓS HORÁRIO) ---
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
                // Filtro 1: Já silenciado
                if (silenciados.includes(eve.id)) return false;

                // Filtro 2: Já passou do horário (Data + Hora)
                const [ano, mes, dia] = eve.dataEspecífica.split('-');
                const [hora, minuto] = (eve.horario || "00:00").split(':');
                const dataInicio = new Date(ano, mes - 1, dia, hora, minuto);
                
                // Calcula o fim (adicionando 2 horas como padrão)
                const dataFim = new Date(dataInicio.getTime() + 120 * 60000);

                return agora < dataFim; // Só exibe se ainda não terminou
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
        
        const ano = agora.getFullYear();
        const mes = String(agora.getMonth() + 1).padStart(2, '0');
        const dia = String(agora.getDate()).padStart(2, '0');
        const dataHojeIso = `${ano}-${mes}-${dia}`;
        
        const horaAtual = agora.getHours() * 60 + agora.getMinutes();

        const ativo = lista.find(p => {
          const mesmoDia = p.isEspecial ? p.dataEspecífica === dataHojeIso : p.diaSemana === hojeTexto;
          if (!mesmoDia || !p.horario) return false;

          const partes = p.horario.split(':');
          if (partes.length !== 2) return false;
          
          const h = parseInt(partes[0], 10);
          const m = parseInt(partes[1], 10);
          const minInicio = h * 60 + m;
          const minFim = minInicio + 120; // 2 horas de duração

          return horaAtual >= minInicio && horaAtual <= minFim;
        });

        setEventoAoVivo(ativo || null);
      };

      verificarAoVivo();
      if (inter) clearInterval(inter);
      inter = setInterval(verificarAoVivo, 60000); // 1 minuto
    });

    return () => {
      unsub();
      if (inter) clearInterval(inter);
    };
  }, []);

  // --- 3. LÓGICA DE ACESSO ---
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
    isActive(p)
      ? 'bg-gradient-royal text-white shadow-royal'
      : 'text-slate-400 hover:bg-white/5 hover:text-white'
  }`;
  const subLinkClass = (p) => `flex items-center gap-2 px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all rounded-xl ${
    location.pathname === p
      ? 'text-gold bg-gold/10 border border-gold/20'
      : 'text-slate-500 hover:text-white hover:bg-white/5'
  }`;

  return (
    <div className="flex min-h-screen bg-background font-sans">
      
      {/* 1º ORDEM: EVENTO ESPECIAL */}
      {exibirModalEspecial && !verificandoDestaques && (
        <ModalDestaque 
          eventos={eventosEspeciais} 
          aoSilenciar={silenciarEvento}
          aoFechar={fecharVariosModais} 
        />
      )}

      {/* 2º ORDEM: ANIVERSÁRIO (Só aparece se já verificou destaques e NÃO estiver exibindo especial) */}
      {!verificandoDestaques && !exibirModalEspecial && exibirAniversario && (
        <AniversarioOverlay 
          nome={formatarNome(dadosSincronizados?.nome)} 
          onFinalizar={finalizarAniversario} 
          DURACAO_MS={DURACAO_ANIMACAO} 
        />
      )}

      <aside className="w-64 hidden md:flex flex-col shadow-2xl z-50 text-left bg-gradient-sidebar relative overflow-hidden">
        {/* Decorative gold accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-gold"></div>
        <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full bg-royal/10 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-32 -left-16 w-40 h-40 rounded-full bg-gold/5 blur-3xl pointer-events-none"></div>

        <div className="p-6 border-b border-white/5 flex items-center gap-4 relative">
          {configGeral?.igrejaLogo ? (
             <img src={configGeral.igrejaLogo} alt="Logo da Igreja" className="w-12 h-12 object-contain rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 p-1.5" />
          ) : (
             <div className="w-12 h-12 rounded-2xl bg-gradient-gold flex items-center justify-center shadow-gold">
               <span className="font-display font-black text-navy text-xl">✛</span>
             </div>
          )}
          <div className="leading-tight">
            <h1 className="font-display text-xl font-black text-white tracking-tight line-clamp-1">
              {configGeral?.igrejaNome || 'Igreja Pro'}
            </h1>
            <p className="text-[9px] font-bold text-gold uppercase tracking-[0.25em] mt-0.5">Gestão Pastoral</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto relative">
          <Link to="/" className={navLinkClass('/')}>
            <LayoutDashboard size={18} />
            <span className="font-bold uppercase text-[11px] tracking-widest leading-none">Dashboard</span>
            {isActive('/') && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-gold"></span>}
          </Link>

          {/* CADASTROS */}
          {(temAcesso('usuarios') || temAcesso('cargos') || temAcesso('planoContas') || temAcesso('contas') || temAcesso('cantina') || temAcesso('programacao')) && (
            <div className="space-y-1 pt-2">
              <button
                onClick={() => {
                  setMenuCadastroAberto(!menuCadastroAberto);
                  if (!menuCadastroAberto) setMenuFinanceiroAberto(false);
                }}
                className="w-full flex items-center justify-between px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-white rounded-2xl transition-all outline-none"
              >
                <div className="flex items-center gap-3"><Settings size={18} /><span className="font-bold uppercase text-[11px] tracking-widest">Cadastros</span></div>
                {menuCadastroAberto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {menuCadastroAberto && (
                <div className="ml-5 pl-3 border-l border-white/10 py-1 space-y-0.5 animate-fade-in">
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

          {/* FINANCEIRO */}
          {temAcesso('fluxo') && (
            <div className="space-y-1">
              <button
                onClick={() => {
                  setMenuFinanceiroAberto(!menuFinanceiroAberto);
                  if (!menuFinanceiroAberto) setMenuCadastroAberto(false);
                }}
                className="w-full flex items-center justify-between px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-white rounded-2xl transition-all outline-none"
              >
                <div className="flex items-center gap-3"><CreditCard size={18} /><span className="font-bold uppercase text-[11px] tracking-widest">Financeiro</span></div>
                {menuFinanceiroAberto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {menuFinanceiroAberto && (
                <div className="ml-5 pl-3 border-l border-white/10 py-1 space-y-0.5 animate-fade-in">
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

        {/* Footer da sidebar com versículo */}
        <div className="p-5 border-t border-white/5 relative">
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
            <p className="text-[9px] font-bold text-gold uppercase tracking-[0.25em] mb-2">✛ Versículo</p>
            <p className="font-display italic text-[11px] text-slate-300 leading-relaxed">
              "Tudo posso naquele que me fortalece."
            </p>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-2">— Filipenses 4:13</p>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden text-left bg-background">
        <header className="h-20 bg-gradient-hero border-b border-white/5 flex items-center justify-between px-10 shrink-0 z-40 shadow-elegant relative overflow-hidden">
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent"></div>

          <div className="flex items-center gap-3 text-left relative z-10">
            {eventoAoVivo ? (
              <>
                <div className="relative w-12 h-12 rounded-2xl overflow-hidden border-2 border-gold shadow-gold shrink-0 flex items-center justify-center bg-gold/10 backdrop-blur-sm">
                  {eventoAoVivo.bannerUrl ? (
                    <>
                      <img src={eventoAoVivo.bannerUrl} alt="Ao Vivo" className="w-full h-full object-cover" />
                      <div className="absolute top-1 right-1 w-2 h-2 bg-gold rounded-full animate-pulse border border-white"></div>
                    </>
                  ) : (
                    <div className="w-3 h-3 bg-gold rounded-full animate-pulse"></div>
                  )}
                </div>
                <div className="text-left flex flex-col justify-center">
                  <p className="text-[9px] font-bold text-gold uppercase tracking-[0.25em] leading-none mb-1.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse"></span>
                    Acontecendo agora
                  </p>
                  <p className="font-display text-base font-bold text-white leading-none truncate max-w-[260px]">
                    {eventoAoVivo.titulo}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
                  <CalendarDays size={18} className="text-gold" />
                </div>
                <div className="text-left">
                  <p className="text-[9px] font-bold text-gold uppercase tracking-[0.25em] leading-none mb-1.5">
                    {(() => {
                      const h = new Date().getHours();
                      if (h < 12) return 'Bom dia';
                      if (h < 18) return 'Boa tarde';
                      return 'Boa noite';
                    })()}, {formatarNome(dadosSincronizados?.nome)}
                  </p>
                  <p className="font-display text-base font-bold text-white capitalize leading-none">
                    {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="relative text-left" ref={userMenuRef}>
            <button onClick={() => setUserMenuAberto(!userMenuAberto)} className="flex items-center gap-4 hover:bg-white/10 p-2 rounded-2xl transition-all outline-none group">
              <div className="text-right leading-none">
                <p className="font-display text-sm font-bold text-white leading-none">
                  {dadosSincronizados?.nome || 'Usuário'}
                </p>
                <p className="text-[9px] text-gold font-bold uppercase tracking-[0.25em] mt-1.5 leading-none">
                  {dadosSincronizados?.cargoNome || 'Membro'}
                </p>
              </div>
              <div className="relative shrink-0">
                <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm border-2 border-gold/40 text-white flex items-center justify-center shadow-gold overflow-hidden">
                  {dadosSincronizados?.fotoUrl ? (
                    <img src={dadosSincronizados.fotoUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon size={22} />
                  )}
                </div>
                <div className={`absolute -bottom-1 -right-1 w-5 h-5 bg-gradient-gold border-2 border-navy rounded-full flex items-center justify-center text-navy shadow-sm transition-transform duration-300 ${userMenuAberto ? '' : 'group-hover:scale-110'}`}>
                   <ChevronDown size={10} className={`transition-transform duration-300 ${userMenuAberto ? 'rotate-180' : ''}`} />
                </div>
              </div>
            </button>
            {userMenuAberto && (
              <div className="absolute right-0 mt-4 w-56 bg-white rounded-3xl shadow-2xl border border-slate-100 p-2 text-left z-50">
                {(String(dadosSincronizados?.id) === "1" || dadosSincronizados?.nome?.toLowerCase() === 'suporte' || dadosSincronizados?.cargoNome === "SISTEMA") && (
                  <button 
                    onClick={() => {
                       setConfigModalAberto(true);
                       setUserMenuAberto(false);
                    }} 
                    className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 hover:text-blue-600 rounded-2xl transition-all font-black text-[10px] uppercase italic text-left mb-1"
                  >
                    <Settings size={18} /> Configurações
                  </button>
                )}
                <button onClick={aoSair} className="w-full flex items-center gap-3 px-4 py-3 text-rose-500 hover:bg-rose-50 rounded-2xl transition-all font-black text-[10px] uppercase italic text-left">
                  <LogOut size={18} /> Sair do Sistema
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 text-left bg-slate-50/50">
          <Outlet context={{ usuario: dadosSincronizados }} />
        </div>
      </main>

      {configModalAberto && (
         <ModalConfiguracoes aoFechar={() => setConfigModalAberto(false)} />
      )}
    </div>
  );
}