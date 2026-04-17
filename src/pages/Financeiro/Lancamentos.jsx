import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { db } from '../../database/firebase'; 
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  Plus, 
  CreditCard, 
  ArrowRightLeft, 
  Loader2,
  CheckCircle2,
  Banknote
} from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';

export default function Lancamentos() {
  const { usuario } = useOutletContext();
  
  const [carregando, setCarregando] = useState(false);
  const [planos, setPlanos] = useState([]);
  const [formData, setFormData] = useState({
    tipo: 'saida',
    descricao: '',
    valor: '',
    vencimento: new Date().toISOString().split('T')[0],
    planoContaId: '',
    formaPagamento: 'Dinheiro'
  });

  useEffect(() => {
    const q = query(collection(db, "planoContas"), orderBy("nome", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setPlanos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const planosFiltrados = planos.filter(p => 
    formData.tipo === 'saida' 
      ? (p.tipo?.toLowerCase().includes('despesa') || p.tipo?.toLowerCase().includes('saída'))
      : (p.tipo?.toLowerCase().includes('receita') || p.tipo?.toLowerCase().includes('entrada'))
  );

  const { alertModal } = useModal();

  const salvarLancamento = async (e) => {
    e.preventDefault();
    if (!formData.valor || !formData.planoContaId || !formData.descricao) {
      return await alertModal("Campos Incompletos", "Por favor, preencha todos os campos obrigatórios!", "warning");
    }
    
    setCarregando(true);
    try {
      const planoSelecionado = planos.find(p => p.id === formData.planoContaId);

      await addDoc(collection(db, "financeiro"), {
        ...formData,
        valor: parseFloat(formData.valor),
        status: 'pago',
        dataBaixa: formData.vencimento,
        origem: 'LANÇAMENTO MANUAL',
        categoria: planoSelecionado?.nome || 'Geral',
        usuarioId: usuario?.id || 'sistema',
        usuarioNome: usuario?.nome || 'Admin',
        uuid: crypto.randomUUID(),
        dataCriacao: serverTimestamp()
      });

      await alertModal("Sucesso", "Lançamento consolidado com sucesso!", "success");
      setFormData({ ...formData, descricao: '', valor: '' });

    } catch (error) {
      console.error("Erro:", error);
      await alertModal("Erro", "Erro ao gravar no banco de dados.", "danger");
    } finally {
      setCarregando(false);
    }
  };

  return (
    /* AJUSTE AQUI: Mudado de max-w-4xl para max-w-7xl para seguir o padrão do Dashboard */
    <div className="max-w-7xl mx-auto space-y-6 pb-12 text-left italic">
      
      {/* CABEÇALHO PADRONIZADO */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-slate-900 p-3 rounded-[1.2rem] text-white shadow-lg shadow-slate-200">
            <ArrowRightLeft size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter leading-none">Lançamentos Diretos</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
              Operador: <span className="text-blue-600">{usuario?.nome}</span>
            </p>
          </div>
        </div>
      </div>

      {/* BOX DE FORMULÁRIO AMPLO */}
      <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-[0.02] pointer-events-none">
          <Banknote size={180} />
        </div>

        <form onSubmit={salvarLancamento} className="relative z-10 space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Natureza da Operação */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest block">Natureza da Operação</label>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  type="button" 
                  onClick={() => setFormData({...formData, tipo: 'entrada'})}
                  className={`py-4 rounded-2xl font-black text-[11px] transition-all flex items-center justify-center gap-2 border-2 ${
                    formData.tipo === 'entrada' 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-600 shadow-sm' 
                    : 'bg-white border-slate-50 text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <Plus size={16}/> ENTRADA (+)
                </button>
                <button 
                  type="button" 
                  onClick={() => setFormData({...formData, tipo: 'saida'})}
                  className={`py-4 rounded-2xl font-black text-[11px] transition-all flex items-center justify-center gap-2 border-2 ${
                    formData.tipo === 'saida' 
                    ? 'bg-rose-50 border-rose-200 text-rose-600 shadow-sm' 
                    : 'bg-white border-slate-50 text-slate-400 hover:bg-slate-50'
                  }`}
                >
                   DÉBITO (-)
                </button>
              </div>
            </div>

            {/* Origem/Destino */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest block">Destino / Origem do Recurso</label>
              <select 
                className="w-full border-2 border-slate-50 rounded-2xl px-5 py-4 font-bold bg-slate-50 outline-none focus:bg-white focus:border-slate-900 transition-all italic"
                value={formData.formaPagamento}
                onChange={e => setFormData({...formData, formaPagamento: e.target.value})}
              >
                <option value="Dinheiro">💵 Dinheiro Vivo (Cofre)</option>
                <option value="Banco">🏛️ Conta Bancária (Pix/Cartão)</option>
              </select>
            </div>
          </div>

          {/* Descrição em linha inteira */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest block">Descrição Detalhada do Lançamento</label>
            <input 
              className="w-full border-2 border-slate-50 rounded-2xl px-6 py-5 outline-none focus:border-slate-900 bg-slate-50 focus:bg-white font-bold text-lg transition-all"
              value={formData.descricao}
              onChange={e => setFormData({...formData, descricao: e.target.value})}
              placeholder="Descreva o motivo deste lançamento..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Categoria */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest block">Categoria do Plano de Contas</label>
              <select 
                className="w-full border-2 border-slate-50 rounded-2xl px-5 py-4 outline-none font-bold bg-slate-50 focus:bg-white focus:border-slate-900 transition-all"
                value={formData.planoContaId}
                onChange={e => setFormData({...formData, planoContaId: e.target.value})}
              >
                <option value="">Selecione...</option>
                {planosFiltrados.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>

            {/* Data */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest block">Data do Movimento</label>
              <input 
                type="date" 
                className="w-full border-2 border-slate-50 rounded-2xl px-5 py-4 font-bold bg-slate-50 outline-none focus:bg-white focus:border-slate-900 transition-all" 
                value={formData.vencimento} 
                onChange={e => setFormData({...formData, vencimento: e.target.value})}
              />
            </div>

            {/* Valor */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest block">Valor do Lançamento</label>
              <div className="relative">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">R$</span>
                <input 
                  type="number" 
                  step="0.01" 
                  className="w-full border-2 border-slate-50 rounded-2xl pl-12 pr-6 py-4 font-black text-slate-900 bg-slate-50 focus:bg-white focus:border-slate-900 outline-none text-xl transition-all" 
                  value={formData.valor} 
                  onChange={e => setFormData({...formData, valor: e.target.value})}
                  placeholder="0,00"
                />
              </div>
            </div>
          </div>

          {/* BOTÃO FINAL */}
          <div className="pt-4">
            <button 
              disabled={carregando}
              className={`w-full flex items-center justify-center gap-3 py-6 rounded-[2rem] font-black uppercase tracking-[0.3em] text-[11px] transition-all shadow-xl ${
                carregando 
                ? 'bg-slate-100 text-slate-300 cursor-not-allowed' 
                : 'bg-slate-900 text-white hover:bg-blue-600 shadow-slate-200'
              }`}
            >
              {carregando ? (
                <Loader2 className="animate-spin" size={24} />
              ) : (
                <>
                  <CheckCircle2 size={20} />
                  Consolidar Lançamento no Caixa
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}