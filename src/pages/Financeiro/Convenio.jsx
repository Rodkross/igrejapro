import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../database/firebase'; 
import { 
  collection, query, where, onSnapshot, 
  addDoc, deleteDoc, doc, updateDoc, serverTimestamp, orderBy, getDocs
} from 'firebase/firestore';
import { 
  ShoppingCart, Trash2, ChevronRight, ChevronDown, CreditCard,
  Minus, Plus, Edit3, Loader2, Wallet, Star, Search, ListFilter, AlertCircle, Eye, EyeOff, X
} from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';

export default function Convenio() {
  const [membroAberto, setMembroAberto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalAberto, setIsModalAberto] = useState(false);
  const [mostrarTotaisTopo, setMostrarTotaisTopo] = useState(false);
  
  const [membros, setMembros] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [pendenciasFinanceiro, setPendenciasFinanceiro] = useState([]); 
  const [saldosCredito, setSaldosCredito] = useState({});
  
  const [buscaNome, setBuscaNome] = useState('');
  const [mostrarTodos, setMostrarTodos] = useState(false);

  const [formData, setFormData] = useState({
    usuarioId: '', itemId: '', quantidade: 1, data: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    onSnapshot(query(collection(db, "usuarios"), orderBy("nome", "asc")), (snap) => {
      setMembros(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => String(m.id) !== "1"));
    });

    onSnapshot(query(collection(db, "estoqueCantina"), orderBy("nome", "asc")), (snap) => {
      setProdutos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    onSnapshot(query(collection(db, "convenio"), where("status", "==", "pendente")), (snap) => {
      setHistorico(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    const qFin = query(
      collection(db, "financeiro"), 
      where("status", "==", "aberto"),
      where("categoria", "in", ["Convenio", "Fiado"])
    );
    onSnapshot(qFin, (snap) => {
      const dados = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPendenciasFinanceiro(dados.filter(f => !f.convenioUuid));
    });

    onSnapshot(collection(db, "saldosCredito"), (snap) => {
      const mapa = {};
      snap.docs.forEach(d => { 
        const nomeChave = d.data().origem?.trim().toUpperCase();
        if(nomeChave) mapa[nomeChave] = Number(d.data().saldo || 0); 
      });
      setSaldosCredito(mapa);
    });
  }, []);

  const totais = useMemo(() => {
    const fiado = historico.reduce((acc, curr) => acc + (Number(curr.valorTotal) || 0), 0) + 
                  pendenciasFinanceiro.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
    const credito = Object.values(saldosCredito).reduce((acc, curr) => acc + curr, 0);
    return { fiado, credito, real: Math.max(0, fiado - credito) };
  }, [historico, pendenciasFinanceiro, saldosCredito]);

  const listaBase = useMemo(() => {
    const dados = {};

    historico.forEach(h => {
      const nome = h.usuarioNome?.trim().toUpperCase();
      if (!nome) return;
      if (!dados[nome]) dados[nome] = { nome, totalDivida: 0, itens: [] };
      dados[nome].totalDivida += Number(h.valorTotal);
      dados[nome].itens.push({ ...h, tipoRegistro: 'comum' });
    });

    pendenciasFinanceiro.forEach(p => {
      const nome = p.origem?.trim().toUpperCase();
      if (!nome) return;
      if (!dados[nome]) dados[nome] = { nome, totalDivida: 0, itens: [] };
      dados[nome].totalDivida += Number(p.valor);
      dados[nome].itens.push({
        id: p.id, produtoNome: p.descricao || "RESTANTE PENDENTE",
        valorTotal: p.valor, data: p.vencimento || new Date().toISOString().split('T')[0],
        tipoRegistro: 'financeiro'
      });
    });

    Object.keys(saldosCredito).forEach(nome => {
      const n = nome.trim().toUpperCase();
      if (saldosCredito[n] > 0 && !dados[n]) {
        dados[n] = { nome: n, totalDivida: 0, itens: [] };
      }
    });

    return Object.values(dados).sort((a, b) => b.totalDivida - a.totalDivida);
  }, [historico, pendenciasFinanceiro, saldosCredito]);

  const listaFiltrada = useMemo(() => {
    if (!mostrarTodos && buscaNome.trim() === '') return [];
    return listaBase.filter(p => p.nome.includes(buscaNome.toUpperCase()));
  }, [listaBase, buscaNome, mostrarTodos]);

  const { confirmModal, alertModal } = useModal();

  const salvarConsumo = async (e) => {
    e.preventDefault();
    if (!formData.usuarioId || !formData.itemId) return await alertModal('Atenção', 'Selecione Membro e Produto!', 'warning');
    const produto = produtos.find(p => p.id === formData.itemId);
    const membro = membros.find(m => m.id === formData.usuarioId);
    const valorTotal = Number((Number(produto?.preco || 0) * formData.quantidade).toFixed(2));
    const itemUuid = crypto.randomUUID();

    try {
      const nomeNormalizado = membro.nome.trim().toUpperCase();
      await addDoc(collection(db, "convenio"), { ...formData, usuarioNome: nomeNormalizado, produtoNome: produto.nome, valorTotal, status: 'pendente', uuid: itemUuid });
      await addDoc(collection(db, "financeiro"), { tipo: 'entrada', status: 'aberto', categoria: 'Convenio', origem: nomeNormalizado, valor: valorTotal, convenioUuid: itemUuid, vencimento: formData.data, descricao: `CONVÊNIO: ${produto.nome} (${formData.quantidade}x)`, dataCriacao: serverTimestamp() });
      setFormData({ ...formData, itemId: '', quantidade: 1, data: new Date().toISOString().split('T')[0] });
      setIsModalAberto(false);
      await alertModal("Sucesso", "Lançamento realizado!", "success");
    } catch (err) { await alertModal("Erro", "Erro ao salvar.", "danger"); }
  };

  const excluirLancamento = async (item) => {
    if (!(await confirmModal("Excluir", "Excluir este lançamento?", "warning"))) return;
    try {
      if (item.tipoRegistro === 'financeiro') {
        await deleteDoc(doc(db, "financeiro", item.id));
      } else {
        await deleteDoc(doc(db, "convenio", item.id));
        const qFin = query(collection(db, "financeiro"), where("convenioUuid", "==", item.uuid));
        const snapFin = await getDocs(qFin);
        if (!snapFin.empty) await deleteDoc(doc(db, "financeiro", snapFin.docs[0].id));
      }
    } catch (err) { await alertModal("Erro", "Erro ao excluir.", "danger"); }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 text-left font-sans italic">
      
      {/* HEADER INTEGRADO */}
      <header className="flex flex-col md:flex-row justify-between items-center gap-4 border-b-2 border-slate-100 pb-6 text-left">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3 uppercase italic leading-none text-left">
            <CreditCard className="text-blue-600" size={28} />
            Cantina Fiados
          </h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 italic text-left">Controle e Fechamento de Contas</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <button 
            onClick={() => setMostrarTotaisTopo(!mostrarTotaisTopo)} 
            className="flex items-center gap-2 px-5 py-3.5 rounded-2xl border-2 border-slate-50 text-slate-500 hover:text-blue-600 hover:border-blue-100 hover:bg-blue-50/30 transition-all group"
          >
            {mostrarTotaisTopo ? <EyeOff size={18} /> : <Eye size={18} />}
            <span className="text-[10px] font-black uppercase italic whitespace-nowrap">
              {mostrarTotaisTopo ? 'Ocultar Caixa' : 'Ver Caixa'}
            </span>
          </button>

          <button 
            onClick={() => setIsModalAberto(true)} 
            className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-blue-600 transition-all active:scale-95 whitespace-nowrap"
          >
            <Plus size={18} strokeWidth={3}/> Novo Registro
          </button>
        </div>
      </header>

      {/* CARDS DE TOTAIS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 italic">
        <div className="bg-white p-6 rounded-[1.5rem] border border-slate-100 shadow-sm text-right">
          <p className="text-[9px] font-black text-rose-400 uppercase mb-2 italic">Dívida Bruta</p>
          <p className={`text-2xl font-black italic transition-all ${mostrarTotaisTopo ? 'text-rose-600' : 'text-slate-100'}`}>
            {mostrarTotaisTopo ? `R$ ${totais.fiado.toFixed(2)}` : 'R$ ••••'}
          </p>
        </div>
        <div className="bg-white p-6 rounded-[1.5rem] border border-slate-100 shadow-sm text-right">
          <p className="text-[9px] font-black text-emerald-400 uppercase mb-2 italic">Créditos</p>
          <p className={`text-2xl font-black italic transition-all ${mostrarTotaisTopo ? 'text-emerald-600' : 'text-slate-100'}`}>
            {mostrarTotaisTopo ? `R$ ${totais.credito.toFixed(2)}` : 'R$ ••••'}
          </p>
        </div>
        <div className="bg-slate-900 p-6 rounded-[1.5rem] shadow-xl text-right border-b-4 border-blue-500 text-white">
          <p className="text-[9px] font-black text-slate-400 uppercase mb-2 italic">A Receber</p>
          <p className={`text-2xl font-black italic transition-all ${mostrarTotaisTopo ? 'text-white' : 'text-slate-700'}`}>
            {mostrarTotaisTopo ? `R$ ${totais.real.toFixed(2)}` : 'R$ ••••'}
          </p>
        </div>
      </div>

      {/* MODAL DE LANÇAMENTO */}
      {isModalAberto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300 text-left italic">
            <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col italic">
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50 italic">
                    <div className="flex items-center gap-3 italic">
                        <Plus className="text-blue-600" size={24}/>
                        <h2 className="text-xl font-black text-slate-800 uppercase italic">Lançar Consumo</h2>
                    </div>
                    <button onClick={() => setIsModalAberto(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={24}/></button>
                </div>
                <form onSubmit={salvarConsumo} className="p-8 space-y-6 italic">
                    <div className="space-y-2 text-left italic">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2 block italic">Membro Responsável</label>
                        <select className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold bg-slate-50 outline-none focus:bg-white focus:border-blue-600 italic uppercase" 
                            value={formData.usuarioId} onChange={e => setFormData({...formData, usuarioId: e.target.value})}>
                            <option value="">SELECIONAR...</option>
                            {membros.map(m => (
                            <option key={m.id} value={m.id}>{m.nome.toUpperCase()} {saldosCredito[m.nome.trim().toUpperCase()] > 0 ? '⭐' : ''}</option>
                            ))}
                        </select>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left italic">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 block italic">Produto</label>
                            <select className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold bg-slate-50 outline-none focus:bg-white focus:border-blue-600 italic uppercase" 
                                value={formData.itemId} onChange={e => setFormData({...formData, itemId: e.target.value})}>
                                <option value="">SELECIONAR...</option>
                                {produtos.map(p => <option key={p.id} value={p.id}>{p.nome} - R$ {Number(p.preco).toFixed(2)}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2 italic">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 block italic">Quantidade</label>
                            <div className="flex items-center justify-between bg-slate-50 rounded-2xl p-1.5 border-2 border-slate-100 h-[62px]">
                                <button type="button" onClick={() => setFormData({...formData, quantidade: Math.max(1, formData.quantidade - 1)})} className="w-12 h-12 bg-white rounded-xl shadow-sm text-rose-500 flex items-center justify-center border border-slate-100"><Minus size={20}/></button>
                                <input type="number" readOnly className="w-full bg-transparent text-center font-black text-2xl outline-none italic" value={formData.quantidade} />
                                <button type="button" onClick={() => setFormData({...formData, quantidade: formData.quantidade + 1})} className="w-12 h-12 bg-white rounded-xl shadow-sm text-emerald-500 flex items-center justify-center border border-slate-100"><Plus size={20}/></button>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-2 text-left italic">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2 block italic">Data da Venda</label>
                        <input type="date" className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold bg-slate-50 outline-none focus:bg-white italic" value={formData.data} onChange={e => setFormData({...formData, data: e.target.value})}/>
                    </div>
                    <button className="w-full h-[64px] bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-blue-600 shadow-xl transition-all italic mt-4">Confirmar Lançamento</button>
                </form>
            </div>
        </div>
      )}

      {/* BUSCADOR */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-5 rounded-[2rem] border-2 border-slate-50 shadow-sm italic">
        <div className="flex-1 flex items-center gap-4 bg-slate-50 rounded-2xl px-5 py-2 border-2 border-transparent focus-within:border-blue-500 focus-within:bg-white transition-all italic">
          <Search size={20} className="text-slate-400" />
          <input type="text" placeholder="BUSCAR POR NOME..." className="w-full bg-transparent outline-none font-black text-slate-700 uppercase italic"
            value={buscaNome} onChange={(e) => { setBuscaNome(e.target.value); if (e.target.value.length > 0) setMostrarTodos(false); }} />
        </div>
        <button 
          onClick={() => { setMostrarTodos(!mostrarTodos); setBuscaNome(''); }} 
          className={`flex items-center gap-2 px-8 h-14 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all italic shadow-sm border ${
            mostrarTodos 
              ? 'bg-blue-600 text-white border-blue-600' 
              : 'bg-slate-800 text-slate-200 border-slate-800 hover:bg-slate-700'
          }`}
        >
          <ListFilter size={18} /> {mostrarTodos ? 'Ocultar Lista' : 'Exibir Todos'}
        </button>
      </div>

      {/* LISTA DE CONVÊNIOS */}
      <div className="bg-white rounded-[2.5rem] border-2 border-slate-50 overflow-hidden shadow-sm min-h-[200px] italic">
        {loading ? <Loader2 className="animate-spin mx-auto my-10 text-blue-600"/> :
         listaFiltrada.map(pessoa => {
          const credito = saldosCredito[pessoa.nome.trim().toUpperCase()] || 0;
          const saldoLiquido = Number((pessoa.totalDivida - credito).toFixed(2));
          const valorExibido = saldoLiquido > 0 ? saldoLiquido : 0;

          return (
            <div key={pessoa.nome} className="border-b-2 border-slate-50 last:border-0 italic">
              <button onClick={() => setMembroAberto(membroAberto === pessoa.nome ? null : pessoa.nome)} className="w-full p-7 flex items-center justify-between hover:bg-slate-50/50 transition-all text-left italic">
                <div className="flex items-center gap-5 italic">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl transition-all ${membroAberto === pessoa.nome ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>{pessoa.nome.charAt(0)}</div>
                  <div className="italic">
                    <div className="flex items-center gap-2 italic">
                      <p className="font-black text-slate-800 uppercase text-lg italic">{pessoa.nome}</p>
                      {credito > 0 && <Star size={16} className="fill-amber-400 text-amber-400" />}
                    </div>
                    {credito > 0 && <p className="text-[10px] font-black text-emerald-600 uppercase mt-1 italic leading-none">Carteira: R$ {credito.toFixed(2)}</p>}
                  </div>
                </div>
                <div className="text-right italic">
                  <p className={`text-2xl font-black italic tracking-tighter leading-none transition-all ${valorExibido === 0 ? 'text-emerald-500' : 'text-rose-600'}`}>
                    R$ {valorExibido.toFixed(2)}
                  </p>
                  <p className="text-[9px] font-black text-slate-400 uppercase mt-1 italic">Saldo Líquido</p>
                </div>
              </button>
              
              {membroAberto === pessoa.nome && (
                <div className="bg-slate-50/30 p-8 space-y-4 animate-in slide-in-from-top-2 duration-300 italic">
                  {pessoa.itens.map(h => (
                    <div key={h.id} className={`flex items-center justify-between p-5 rounded-[2rem] border-2 transition-all italic ${h.tipoRegistro === 'financeiro' ? 'bg-amber-50 border-amber-200' : 'bg-white border-white shadow-sm hover:border-slate-200'}`}>
                      <div className="text-left italic">
                        <div className="flex items-center gap-2 italic">
                          <p className="font-black text-slate-800 uppercase text-sm italic">{h.produtoNome}</p>
                          {h.tipoRegistro === 'financeiro' && <span className="bg-amber-600 text-[8px] text-white px-2 py-0.5 rounded-full uppercase font-black italic">Restante</span>}
                        </div>
                        <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 italic">{new Date(h.data + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                      </div>
                      <div className="flex items-center gap-4 italic">
                        <p className="font-black text-rose-600 italic text-lg">R$ {Number(h.valorTotal).toFixed(2)}</p>
                        <button onClick={() => excluirLancamento(h)} className="p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-600 hover:text-white transition-all"><Trash2 size={18}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}