import React, { useState, useEffect } from 'react';
import { db } from '../../database/firebase';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, deleteDoc, doc, writeBatch
} from 'firebase/firestore';
import {
  CheckCircle, Trash2, Plus, Loader2,
  Search, CreditCard, CheckSquare, Square,
  MessageSquare, Hash, X, Calendar
} from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';

export default function ContasPagar() {
  const [loading, setLoading] = useState(true);
  const [contas, setContas] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [selecionadas, setSelecionadas] = useState([]);
  const [isModalAberto, setIsModalAberto] = useState(false);

  const [filtroNome, setFiltroNome] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('pendente');
  const [dataInicioFiltro, setDataInicioFiltro] = useState('');
  const [dataFimFiltro, setDataFimFiltro] = useState('');
  const [dataInicioAplicada, setDataInicioAplicada] = useState('');
  const [dataFimAplicada, setDataFimAplicada] = useState('');
  const [pesquisou, setPesquisou] = useState(false);
  const [dataBaixaLote, setDataBaixaLote] = useState(new Date().toISOString().split('T')[0]);
  const [formaPagamentoLote, setFormaPagamentoLote] = useState('Banco');

  const [formData, setFormData] = useState({
    fornecedorId: '',
    descricao: '',
    observacoes: '',
    valorUnitario: '',
    parcelas: '1',
    vencimentoBase: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    const qFornecedores = query(collection(db, 'fornecedores'), orderBy('nome', 'asc'));
    const unsubFornecedores = onSnapshot(qFornecedores, (snapshot) => {
      setFornecedores(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    });

    const qContas = query(collection(db, 'contasPagar'), orderBy('vencimento', 'asc'));
    const unsubContas = onSnapshot(qContas, (snapshot) => {
      setContas(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      setLoading(false);
    });

    return () => {
      unsubFornecedores();
      unsubContas();
    };
  }, []);

  const { confirmModal, alertModal } = useModal();

  const handleSalvar = async (e) => {
    e.preventDefault();
    const nParcelas = parseInt(formData.parcelas, 10) || 1;

    if (!formData.fornecedorId || !formData.valorUnitario) {
      return alertModal('Atenção', 'Preencha Fornecedor e Valor!', 'warning');
    }

    const fornecedorSel = fornecedores.find((fornecedor) => fornecedor.id === formData.fornecedorId);
    const valorParcela = parseFloat(String(formData.valorUnitario).replace(',', '.'));

    try {
      const batch = writeBatch(db);
      const [ano, mes, dia] = formData.vencimentoBase.split('-').map(Number);

      for (let i = 0; i < nParcelas; i += 1) {
        const dataVenc = new Date(ano, (mes - 1) + i, dia);
        const novaContaRef = doc(collection(db, 'contasPagar'));

        batch.set(novaContaRef, {
          fornecedorId: formData.fornecedorId,
          fornecedorNome: fornecedorSel.nome,
          planoContaId: fornecedorSel.planoContaId,
          planoContaNome: fornecedorSel.planoContaNome,
          descricao: nParcelas > 1
            ? `${formData.descricao.toUpperCase()} (${i + 1}/${nParcelas})`
            : formData.descricao.toUpperCase(),
          observacoes: formData.observacoes.toUpperCase(),
          valor: valorParcela,
          vencimento: dataVenc.toISOString().split('T')[0],
          status: 'pendente',
          criadoEm: new Date().toISOString(),
        });
      }

      await batch.commit();
      setFormData((prev) => ({
        ...prev,
        fornecedorId: '',
        descricao: '',
        observacoes: '',
        valorUnitario: '',
        parcelas: '1',
      }));
      setIsModalAberto(false);
      await alertModal('Sucesso', 'Parcelas geradas com sucesso!', 'success');
    } catch (err) {
      await alertModal('Erro', 'Erro ao salvar.', 'danger');
    }
  };

  const toggleSelecao = (id) => {
    setSelecionadas((prev) => (
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    ));
  };

  const processarBaixaEmLote = async () => {
    if (selecionadas.length === 0) return;

    const itensParaBaixar = contas.filter((conta) => selecionadas.includes(conta.id));
    const totalLote = itensParaBaixar.reduce((acc, cur) => acc + cur.valor, 0);
    const loteId = `LOTE-${Date.now()}`;

    if (!(await confirmModal('Baixa em Lote', `Confirmar a baixa de ${selecionadas.length} contas? Total: R$ ${totalLote.toFixed(2)}`, 'info'))) {
      return;
    }

    try {
      const batch = writeBatch(db);

      itensParaBaixar.forEach((item) => {
        batch.update(doc(db, 'contasPagar', item.id), {
          status: 'pago',
          dataPagamento: dataBaixaLote,
          formaPagamento: formaPagamentoLote,
          loteId,
        });
      });

      await addDoc(collection(db, 'financeiro'), {
        origem: 'PAGAMENTO EM LOTE',
        descricao: `PGTO LOTE: ${itensParaBaixar.length} ITENS`,
        valor: totalLote,
        tipo: 'saida',
        status: 'pago',
        formaPagamento: formaPagamentoLote,
        dataBaixa: dataBaixaLote,
        categoria: 'DIVERSOS (LOTE)',
        loteId,
      });

      await batch.commit();
      setSelecionadas([]);
      await alertModal('Sucesso', 'Baixa em lote realizada!', 'success');
    } catch (err) {
      await alertModal('Erro', 'Erro na baixa.', 'danger');
    }
  };

  const aplicarFiltroPeriodo = () => {
    setDataInicioAplicada(dataInicioFiltro);
    setDataFimAplicada(dataFimFiltro);
    setPesquisou(true);
  };

  const contasFiltradas = contas.filter((conta) => {
    const termoBusca = filtroNome.trim().toLowerCase();
    const fornecedor = conta.fornecedorNome?.toLowerCase() || '';
    const descricao = conta.descricao?.toLowerCase() || '';
    const bateNome = !termoBusca || fornecedor.includes(termoBusca) || descricao.includes(termoBusca);
    const bateStatus = filtroStatus === 'todos' ? true : conta.status === filtroStatus;
    const bateDataInicio = !dataInicioAplicada || conta.vencimento >= dataInicioAplicada;
    const bateDataFim = !dataFimAplicada || conta.vencimento <= dataFimAplicada;
    return bateNome && bateStatus && bateDataInicio && bateDataFim;
  });

  return (
    <div className="max-w-7xl mx-auto p-4 pb-32 space-y-8 text-left bg-slate-50/30 min-h-screen font-sans italic">
      <header className="flex flex-col lg:flex-row justify-between items-center border-b-2 border-slate-100 pb-6 gap-4 italic">
        <div className="flex items-center gap-4 w-full lg:w-auto">
          <div className="p-3 bg-slate-900 rounded-2xl text-white shadow-xl">
            <CreditCard size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">Contas a Pagar</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2 italic">Fluxo de Saídas e Compromissos</p>
          </div>
        </div>
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full lg:w-auto lg:min-w-[520px]">
          <div className="relative flex-1 italic">
            <Search className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              className="w-full bg-transparent border-b-2 border-slate-200 text-slate-900 font-black italic outline-none py-3 pl-8 uppercase text-sm focus:border-blue-600 transition-all"
              placeholder="BUSCAR FORNECEDOR OU CONTA..."
              value={filtroNome}
              onChange={(e) => setFiltroNome(e.target.value)}
            />
          </div>
          <button onClick={() => setIsModalAberto(true)} className="w-full md:w-auto bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl flex items-center justify-center gap-2 active:scale-95 italic">
            <Plus size={18} strokeWidth={3} /> Novo Lançamento
          </button>
        </div>
      </header>

      {isModalAberto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <Plus className="text-blue-600" size={24} />
                <h2 className="text-xl font-black text-slate-800 uppercase italic">Lançar Nova Conta</h2>
              </div>
              <button onClick={() => setIsModalAberto(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSalvar} className="p-8 space-y-6 overflow-y-auto italic text-left">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 italic">
                <div className="text-left italic">
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-1 italic">Fornecedor</label>
                  <select
                    className="w-full border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold bg-slate-50 outline-none focus:bg-white focus:border-blue-600 transition-all italic"
                    value={formData.fornecedorId}
                    onChange={(e) => setFormData({ ...formData, fornecedorId: e.target.value })}
                  >
                    <option value="">SELECIONE O FORNECEDOR...</option>
                    {fornecedores.map((fornecedor) => (
                      <option key={fornecedor.id} value={fornecedor.id}>{fornecedor.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="text-left italic">
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-1 italic">Descrição da Conta</label>
                  <input
                    className="w-full border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold bg-slate-50 outline-none focus:bg-white focus:border-blue-600 transition-all uppercase italic"
                    placeholder="EX: ALUGUEL, LUZ, INTERNET..."
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 italic">
                <div className="text-left italic">
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-1 italic">Valor da Parcela (R$)</label>
                  <input
                    className="w-full border-2 border-slate-100 rounded-2xl px-5 py-4 font-black text-blue-600 bg-slate-50 outline-none focus:bg-white focus:border-blue-600 transition-all italic text-lg"
                    placeholder="0,00"
                    value={formData.valorUnitario}
                    onChange={(e) => setFormData({ ...formData, valorUnitario: e.target.value })}
                  />
                </div>
                <div className="text-left italic">
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-1 italic">Quantidade de Parcelas</label>
                  <div className="flex items-center bg-slate-50 border-2 border-slate-100 rounded-2xl focus-within:bg-white focus-within:border-blue-600 transition-all">
                    <Hash size={18} className="ml-4 text-slate-400" />
                    <input
                      type="number"
                      min="1"
                      className="w-full bg-transparent px-3 py-4 font-bold outline-none italic"
                      value={formData.parcelas}
                      onChange={(e) => setFormData({ ...formData, parcelas: e.target.value })}
                    />
                  </div>
                </div>
                <div className="text-left italic">
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-1 italic">Vencimento da 1ª Parcela</label>
                  <input
                    type="date"
                    className="w-full border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold bg-slate-50 outline-none focus:bg-white focus:border-blue-600 transition-all italic"
                    value={formData.vencimentoBase}
                    onChange={(e) => setFormData({ ...formData, vencimentoBase: e.target.value })}
                  />
                </div>
              </div>

              <div className="text-left italic">
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-1 flex items-center gap-1 italic">
                  <MessageSquare size={12} /> Observações Internas
                </label>
                <textarea
                  className="w-full border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold bg-slate-50 outline-none focus:bg-white focus:border-blue-600 transition-all uppercase italic h-24"
                  placeholder="DIGITE INFORMAÇÕES ADICIONAIS..."
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                />
              </div>

              <div className="flex gap-4 pt-4 italic">
                <button type="button" onClick={() => setIsModalAberto(false)} className="flex-1 py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all italic">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest bg-slate-900 text-white hover:bg-blue-600 transition-all shadow-xl italic">
                  Lançar em Lote
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-slate-900 p-7 rounded-[2.5rem] flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 shadow-2xl italic overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:flex-wrap items-stretch lg:items-center gap-4 lg:gap-3 w-full min-w-0">
          <select
            className="w-full lg:w-auto bg-slate-800 text-white rounded-xl px-5 py-3 text-[11px] font-black outline-none border border-slate-700 uppercase italic cursor-pointer shadow-inner"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
          >
            <option value="pendente">PENDENTES</option>
            <option value="pago">PAGOS</option>
            <option value="todos">TODOS</option>
          </select>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto lg:flex-wrap">
            <input
              type="date"
              className="w-full sm:w-auto bg-slate-800 text-white rounded-xl px-4 py-3 text-[11px] font-black outline-none border border-slate-700 italic"
              value={dataInicioFiltro}
              onChange={(e) => setDataInicioFiltro(e.target.value)}
            />
            <span className="hidden sm:block text-slate-500 text-xs font-black italic">até</span>
            <input
              type="date"
              className="w-full sm:w-auto bg-slate-800 text-white rounded-xl px-4 py-3 text-[11px] font-black outline-none border border-slate-700 italic"
              value={dataFimFiltro}
              onChange={(e) => setDataFimFiltro(e.target.value)}
            />
            <button
              onClick={aplicarFiltroPeriodo}
              className="w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase hover:bg-blue-500 transition-all flex items-center justify-center gap-2 italic shadow-lg"
            >
              <Search size={14} /> Pesquisar
            </button>
          </div>
        </div>

        {selecionadas.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:flex-wrap xl:flex-nowrap items-stretch sm:items-center gap-3 animate-in fade-in slide-in-from-right-4 duration-300 w-full xl:w-auto xl:justify-end xl:shrink-0">
            <div className="h-[1px] w-full bg-slate-800 my-1 xl:hidden"></div>
            <div className="h-10 w-[1px] bg-slate-800 mx-2 hidden xl:block"></div>
            <input
              type="date"
              className="w-full sm:w-auto bg-slate-800 text-white rounded-xl px-4 py-2.5 text-xs font-black outline-none border border-slate-700 italic"
              value={dataBaixaLote}
              onChange={(e) => setDataBaixaLote(e.target.value)}
            />
            <select
              className="w-full sm:w-auto bg-slate-800 text-white rounded-xl px-4 py-2.5 text-xs font-black outline-none border border-slate-700 italic"
              value={formaPagamentoLote}
              onChange={(e) => setFormaPagamentoLote(e.target.value)}
            >
              <option value="Banco">BANCO (PIX)</option>
              <option value="Dinheiro">DINHEIRO</option>
            </select>
            <button onClick={processarBaixaEmLote} className="w-full sm:w-auto bg-blue-600 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase hover:bg-blue-500 transition-all flex items-center justify-center gap-2 italic shadow-lg">
              <CheckCircle size={16} /> BAIXAR ({selecionadas.length})
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2.5 italic">
        {loading && (
          <div className="flex flex-col items-center py-20 gap-4">
            <Loader2 className="animate-spin text-slate-300" size={40} />
          </div>
        )}
        {!loading && pesquisou && contasFiltradas.map((conta) => (
            <div
              key={conta.id}
              onClick={() => conta.status === 'pendente' && toggleSelecao(conta.id)}
              className={`bg-white px-3 py-2.5 md:px-4 md:py-2 rounded-[1.5rem] border-2 transition-all grid items-center gap-3 cursor-pointer shadow-sm group overflow-hidden grid-cols-[20px_110px_minmax(180px,1fr)_92px_150px_150px_32px] ${selecionadas.includes(conta.id) ? 'border-blue-600 ring-4 ring-blue-50' : 'border-white hover:border-slate-200'} ${conta.status === 'pago' ? 'opacity-60 grayscale-[0.5]' : ''}`}
            >
              <div className="transition-all shrink-0">
                {conta.status === 'pago'
                  ? <CheckCircle className="text-emerald-500" size={20} />
                  : (selecionadas.includes(conta.id)
                    ? <CheckSquare className="text-blue-600" size={20} />
                    : <Square className="text-slate-200" size={20} />)}
              </div>

              <div className="flex items-center gap-1.5 justify-center px-2 py-1.5 bg-slate-50 rounded-xl border border-slate-100 italic">
                <Calendar size={10} className="text-slate-500 shrink-0" />
                <p className="text-[10px] font-black text-slate-900 italic leading-none whitespace-nowrap">
                  {new Date(`${conta.vencimento}T12:00:00`).toLocaleDateString('pt-BR')}
                </p>
              </div>

              <div className="min-w-0 flex items-center gap-2 overflow-hidden">
                <p className="font-black text-slate-900 uppercase italic text-sm md:text-[15px] leading-none tracking-tight truncate min-w-0">{conta.fornecedorNome}</p>
                {conta.observacoes && (
                  <p className="hidden lg:flex text-[8px] text-blue-500 font-black uppercase items-center gap-1 italic leading-none opacity-80 truncate max-w-[180px] shrink-0">
                    <MessageSquare size={10} /> {conta.observacoes}
                  </p>
                )}
              </div>

              <div className="flex justify-center">
                <span className="text-[8px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded-lg italic uppercase border border-slate-200 tracking-tight leading-none truncate w-[92px] text-center">{conta.descricao}</span>
              </div>

              <div className="flex justify-center">
                <span className="text-[8px] font-black bg-blue-50 text-blue-600 px-2 py-1 rounded-lg italic border border-blue-100 uppercase tracking-tight leading-none truncate w-[150px] text-center">{conta.planoContaNome}</span>
              </div>

              <div className="text-right italic flex flex-col items-end gap-1 pl-3">
                <div className="flex items-baseline justify-end gap-1 text-slate-900 leading-none">
                  <span className="text-[9px] font-black italic">R$</span>
                  <span className="text-lg md:text-xl font-black italic tracking-tight whitespace-nowrap">
                    {Number(conta.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {conta.status === 'pago' && (
                  <div className="flex items-center justify-end gap-1">
                    <div className="w-1 h-1 rounded-full bg-emerald-500"></div>
                    <p className="text-[8px] font-black text-emerald-600 uppercase italic leading-none">PAGO</p>
                  </div>
                )}
              </div>

              <div className="w-8 flex justify-end">
                {conta.status === 'pendente' && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (await confirmModal('Deletar', 'Excluir este lançamento?', 'danger')) {
                        deleteDoc(doc(db, 'contasPagar', conta.id));
                      }
                    }}
                    className="text-slate-200 hover:text-rose-500 p-1.5 transition-colors opacity-0 group-hover:opacity-100 bg-slate-50 rounded-lg hover:bg-rose-50"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
        ))}

        {!loading && pesquisou && contasFiltradas.length === 0 && (
          <div className="py-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100 italic">
            <CreditCard size={48} className="mx-auto text-slate-200 mb-4" />
            <p className="font-black text-slate-300 uppercase italic text-sm tracking-widest">Nenhuma conta encontrada</p>
          </div>
        )}
        {!loading && !pesquisou && (
          <div className="py-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100 italic">
            <Search size={40} className="mx-auto text-slate-200 mb-4" />
            <p className="font-black text-slate-300 uppercase italic text-sm tracking-widest">Selecione os filtros e clique em pesquisar</p>
          </div>
        )}
      </div>
    </div>
  );
}
