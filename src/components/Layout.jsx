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

  const navLinkClass = (p) => `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${location.pathname.startsWith(p) && p !== '/' || location.pathname === p ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`;
  const subLinkClass = (p) => `flex items-center gap-2 px-4 py-2 text-[11px] font-black uppercase italic transition-colors rounded-lg ${location.pathname === p ? 'text-blue-400 bg-blue-500/10' : 'text-slate-500 hover:text-white'}`;

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      
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

      <aside className="w-64 bg-slate-950 text-white hidden md:flex flex-col shadow-2xl z-50 text-left">
        <div className="p-6 border-b border-white/5 flex items-center gap-4">
          {configGeral?.igrejaLogo && (
             <img src={configGeral.igrejaLogo} alt="Logo da Igreja" className="w-12 h-12 object-contain rounded-xl bg-white/5" />
          )}
          <h1 className="text-lg font-black text-blue-500 tracking-tighter italic uppercase leading-none line-clamp-2">
            {configGeral?.igrejaNome || 'Igreja Pro'}
          </h1>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <Link to="/" className={navLinkClass('/')}>
            <LayoutDashboard size={20} />
            <span className="font-black uppercase text-[11px] tracking-widest italic text-left leading-none">Dashboard</span>
          </Link>

          {/* CADASTROS */}
          {(temAcesso('usuarios') || temAcesso('cargos') || temAcesso('planoContas') || temAcesso('contas') || temAcesso('cantina') || temAcesso('programacao')) && (
            <div className="space-y-1">
              <button 
                onClick={() => {
                  setMenuCadastroAberto(!menuCadastroAberto);
                  if (!menuCadastroAberto) setMenuFinanceiroAberto(false);
                }} 
                className="w-full flex items-center justify-between px-4 py-3 text-slate-400 hover:bg-slate-900 rounded-xl transition-all outline-none"
              >
                <div className="flex items-center gap-3"><Settings size={20} /><span className="font-black uppercase text-[11px] tracking-widest italic">Cadastros</span></div>
                {menuCadastroAberto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {menuCadastroAberto && (
                <div className="ml-6 border-l-2 border-slate-800 py-1 space-y-1 text-left italic">
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
                className="w-full flex items-center justify-between px-4 py-3 text-slate-400 hover:bg-slate-900 rounded-xl transition-all outline-none"
              >
                <div className="flex items-center gap-3"><CreditCard size={20} /><span className="font-black uppercase text-[11px] tracking-widest italic">Financeiro</span></div>
                {menuFinanceiroAberto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {menuFinanceiroAberto && (
                <div className="ml-6 border-l-2 border-slate-800 py-1 space-y-1 text-left italic">
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
              <BarChart3 size={20} />
              <span className="font-black uppercase text-[11px] tracking-widest italic text-left leading-none">Relatórios BI</span>
            </Link>
          )}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden text-left bg-slate-50/50">
        <header className="h-20 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 border-b border-transparent flex items-center justify-between px-10 shrink-0 z-40 shadow-md">
          <div className="flex items-center gap-3 text-left">
            {eventoAoVivo ? (
              <>
                <div className="relative w-11 h-11 rounded-xl overflow-hidden border-2 border-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.4)] shrink-0 flex items-center justify-center bg-rose-500/20 backdrop-blur-sm">
                  {eventoAoVivo.bannerUrl ? (
                    <>
                      <img src={eventoAoVivo.bannerUrl} alt="Ao Vivo" className="w-full h-full object-cover" />
                      <div className="absolute top-1 right-1 w-2 h-2 bg-rose-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.9)] border border-white"></div>
                    </>
                  ) : (
                    <div className="w-4 h-4 bg-rose-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.6)]"></div>
                  )}
                </div>
                <div className="text-left flex flex-col justify-center">
                  <p className="text-[9px] font-black text-rose-200 uppercase tracking-widest leading-none mb-1.5 text-left flex items-center gap-1">
                    {!eventoAoVivo.bannerUrl && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>}
                    Acontecendo agora
                  </p>
                  <p className="text-xs font-black text-white uppercase italic leading-none text-left truncate max-w-[200px]">
                    {eventoAoVivo.titulo}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-xl border border-white/10 shadow-inner">
                  <CalendarDays size={18} className="text-white" />
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-black text-blue-100 uppercase tracking-widest leading-none mb-1 text-left">Data de Hoje</p>
                  <p className="text-xs font-black text-white uppercase italic leading-none text-left">
                    {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="relative text-left" ref={userMenuRef}>
            <button onClick={() => setUserMenuAberto(!userMenuAberto)} className="flex items-center gap-4 hover:bg-white/10 p-2 rounded-2xl transition-all outline-none group">
              <div className="text-right leading-none">
                <p className="text-xs font-black text-white uppercase italic tracking-tighter leading-none">
                  Olá, {dadosSincronizados?.nome || 'Usuário'}
                </p>
                <p className="text-[9px] text-blue-200 font-black uppercase tracking-widest mt-1 leading-none">
                  {dadosSincronizados?.cargoNome || 'Membro'}
                </p>
              </div>
              <div className="relative shrink-0">
                <div className="w-12 h-12 rounded-2xl bg-indigo-900 border border-indigo-500/50 text-white flex items-center justify-center shadow-lg shadow-indigo-900/30 overflow-hidden">
                  {dadosSincronizados?.fotoUrl ? (
                    <img src={dadosSincronizados.fotoUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon size={24} />
                  )}
                </div>
                <div className={`absolute -bottom-1 -right-1 w-5 h-5 bg-white border-2 border-indigo-600 rounded-full flex items-center justify-center text-indigo-700 shadow-sm transition-transform duration-300 ${userMenuAberto ? 'bg-blue-100' : 'group-hover:scale-110'}`}>
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