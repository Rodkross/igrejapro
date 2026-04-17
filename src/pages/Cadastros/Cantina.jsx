import React, { useState, useEffect } from 'react';
import { db } from '../../database/firebase'; 
import { 
  collection, query, orderBy, onSnapshot, 
  addDoc, deleteDoc, doc, updateDoc, where 
} from 'firebase/firestore';
import { Utensils, Trash2, Edit3, Save, Search, Plus, DollarSign, Loader2, X } from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';

export default function Cantina() {
  // Estado para o formulário (Removido campos redundantes)
  const [form, setForm] = useState({ nome: '', preco: '', planoContaId: '' });
  const [editandoId, setEditandoId] = useState(null);
  const [filtro, setFiltro] = useState('');
  
  const [itens, setItens] = useState([]);
  const [planoContasReceitas, setPlanoContasReceitas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [isModalAberto, setIsModalAberto] = useState(false);

  // 1. BUSCA EM TEMPO REAL NO FIREBASE
  useEffect(() => {
    // Busca Itens da Cantina
    const qItens = query(collection(db, "estoqueCantina"), orderBy("nome", "asc"));
    const unsubItens = onSnapshot(qItens, (snapshot) => {
      setItens(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // BUSCA CATEGORIAS FINANCEIRAS (Somente Natureza: Receita)
    const qPlano = query(
      collection(db, "planoContas"), 
      where("tipo", "==", "Receita"),
      orderBy("codigoCustom", "asc")
    );
    const unsubPlano = onSnapshot(qPlano, (snapshot) => {
      setPlanoContasReceitas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setCarregando(false);
    });

    return () => { unsubItens(); unsubPlano(); };
  }, []);

  const { confirmModal, alertModal } = useModal();

  // 2. SALVAR OU ATUALIZAR ITEM
  const handleSalvar = async (e) => {
    e.preventDefault();
    if (!form.nome || !form.preco || !form.planoContaId) {
      await alertModal("Atenção", "Preencha Nome, Preço e selecione a Categoria Financeira.", "warning");
      return;
    }

    const categoriaFinanceira = planoContasReceitas.find(p => p.id === form.planoContaId);

    const dadosParaSalvar = {
      nome: form.nome.toUpperCase().trim(),
      preco: parseFloat(String(form.preco).replace(',', '.')),
      planoContaId: form.planoContaId,
      planoContaNome: categoriaFinanceira ? categoriaFinanceira.nome : '',
      naturezaFinanceira: 'Receita', // Definido automaticamente
      atualizadoEm: new Date().toISOString()
    };

    try {
      if (editandoId) {
        await updateDoc(doc(db, "estoqueCantina", editandoId), dadosParaSalvar);
        setEditandoId(null);
      } else {
        await addDoc(collection(db, "estoqueCantina"), dadosParaSalvar);
      }
      setForm({ nome: '', preco: '', planoContaId: '' });
      setIsModalAberto(false);
      await alertModal("Sucesso", "Item salvo com sucesso!", "success");
    } catch (error) {
      console.error(error);
      await alertModal("Erro", "Erro ao salvar no Firebase.", "danger");
    }
  };

  // 3. PREPARAR EDIÇÃO
  const prepararEdicao = (item) => {
    setEditandoId(item.id);
    setForm({ 
      nome: item.nome, 
      preco: item.preco, 
      planoContaId: item.planoContaId || ''
    });
    setIsModalAberto(true);
  };

  const abrirParaCriar = () => {
    setEditandoId(null);
    setForm({ nome: '', preco: '', planoContaId: '' });
    setIsModalAberto(true);
  };

  // 4. EXCLUIR ITEM
  const excluir = async (id) => {
    if (await confirmModal('Tem certeza?', 'Deseja realmente remover este item do cardápio?', 'danger')) {
      try {
        await deleteDoc(doc(db, "estoqueCantina", id));
      } catch (error) {
        await alertModal("Erro", "Erro ao excluir.", "danger");
      }
    }
  };

  // Filtro de busca simples
  const itensFiltrados = itens.filter(i => 
    i.nome?.toLowerCase().includes(filtro.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 text-left p-4 pb-20">
      
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 text-left">
        <div className="flex items-center gap-3 text-left">
          <div className="bg-orange-500 p-2.5 rounded-2xl text-white shadow-lg shadow-orange-100">
            <Utensils size={24} />
          </div>
          <div className="text-left">
            <h1 className="text-2xl font-black text-slate-800 uppercase italic leading-none text-left">Cardápio da Cantina</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 text-left">Sincronizado com Plano de Contas</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text"
                placeholder="Buscar lanche ou bebida..."
                className="pl-10 pr-4 py-2.5 border-2 border-slate-100 rounded-xl bg-white outline-none focus:border-orange-500 w-full sm:w-64 font-bold text-xs uppercase transition-all"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
              />
            </div>
            <button 
                onClick={abrirParaCriar} 
                className="w-full sm:w-auto bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-orange-600 transition-all shadow-xl flex items-center justify-center gap-2 italic active:scale-95"
            >
                <Plus size={18} strokeWidth={3}/> Adicionar
            </button>
        </div>
      </header>

      {/* MODAL DE CADASTRO E EDIÇÃO */}
      {isModalAberto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
                <div className={`p-6 border-b flex justify-between items-center ${editandoId ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
                    <h2 className={`text-lg font-black uppercase italic flex items-center gap-2 leading-none ${editandoId ? 'text-amber-600' : 'text-slate-800'}`}>
                        {editandoId ? <Edit3 size={24} /> : <Utensils className="text-orange-500" size={24} />} 
                        {editandoId ? 'Editar Item' : 'Novo Lanche/Bebida'}
                    </h2>
                    <button onClick={() => setIsModalAberto(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20}/></button>
                </div>
                
                <form onSubmit={handleSalvar} className="p-6 space-y-6 text-left">
                  <div className="space-y-2 text-left">
                    <label className="block text-[10px] font-black text-slate-400 uppercase ml-1">Descrição do Item</label>
                    <input 
                      className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 outline-none focus:border-orange-500 font-bold bg-slate-50 uppercase italic transition-all"
                      placeholder="Ex: COXINHA, MARMITEX..."
                      value={form.nome}
                      onChange={e => setForm({...form, nome: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2 text-left">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Preço Venda (R$)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xs">R$</span>
                      <input 
                        className="w-full border-2 border-slate-100 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-orange-500 font-bold bg-slate-50 italic transition-all"
                        placeholder="0,00"
                        value={form.preco}
                        onChange={e => setForm({...form, preco: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2 text-left">
                    <label className="block text-[10px] font-black text-blue-600 uppercase mb-2 ml-1 italic">Vincular Categoria</label>
                    <select 
                      className="w-full border-2 border-blue-100 rounded-xl px-4 py-3 bg-blue-50/30 font-black text-blue-700 outline-none focus:bg-white italic cursor-pointer transition-all"
                      value={form.planoContaId}
                      onChange={e => setForm({...form, planoContaId: e.target.value})}
                    >
                      <option value="">Selecione...</option>
                      {planoContasReceitas.map(p => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                    </select>
                  </div>

                  <button 
                    type="submit" 
                    className={`w-full py-4 rounded-xl text-white font-black uppercase text-[11px] tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95 mt-4 ${
                      editandoId ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200' : 'bg-orange-500 hover:bg-orange-600 shadow-orange-200'
                    }`}
                  >
                    {editandoId ? <><Save size={18}/> Atualizar Item</> : <><Plus size={18}/> Cadastrar Item</>}
                  </button>
                </form>
            </div>
        </div>
      )}

      {/* GRID DE LISTAGEM */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
        {carregando ? (
           <div className="col-span-full py-10 text-center text-orange-500 italic font-black uppercase text-xs tracking-widest">Sincronizando Cardápio...</div>
        ) : itensFiltrados.map(item => (
          <div key={item.id} className="bg-white p-6 rounded-[2rem] border-2 border-slate-100 shadow-sm hover:shadow-md transition-all group relative text-left">
            
            {/* Botões de Ação (Aparecem no Hover) */}
            <div className="absolute top-4 right-4 flex gap-1">
              <button onClick={() => prepararEdicao(item)} className="p-2 text-slate-300 hover:text-blue-600 transition-colors">
                <Edit3 size={16}/>
              </button>
              <button onClick={() => excluir(item.id)} className="p-2 text-slate-300 hover:text-rose-600 transition-colors">
                <Trash2 size={16}/>
              </button>
            </div>
            
            <h3 className="font-black text-slate-800 text-lg mb-4 truncate pr-12 uppercase italic leading-none text-left">
              {item.nome}
            </h3>
            
            <div className="flex items-center justify-between mt-auto border-t pt-4 border-slate-50 text-left">
              <div className="text-left">
                <p className="text-[8px] font-black text-slate-400 uppercase mb-1 italic text-left">Preço de Venda</p>
                <div className="flex items-baseline gap-1 leading-none text-left">
                  <span className="text-xs font-black text-slate-400 italic">R$</span>
                  <span className="text-2xl font-black text-slate-900 tracking-tighter italic">
                    {Number(item.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              <div className="bg-orange-50 p-2.5 rounded-2xl text-orange-500 shadow-inner">
                <DollarSign size={20} />
              </div>
            </div>

            <div className="mt-3 flex items-center gap-1.5 opacity-60">
                <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                <span className="text-[8px] font-black text-slate-400 uppercase italic truncate">
                    {item.planoContaNome || 'Geral'}
                </span>
            </div>
          </div>
        ))}

        {!carregando && itensFiltrados.length === 0 && (
          <div className="col-span-full p-20 text-center border-2 border-dashed border-slate-100 rounded-[2.5rem]">
            <p className="text-slate-300 font-black uppercase italic text-xs tracking-widest">Nenhum item encontrado no cardápio.</p>
          </div>
        )}
      </div>
    </div>
  );
}