import React, { useState, useEffect } from 'react';
import { db } from '../../database/firebase'; // Conexão Cloud
import { 
    collection, query, orderBy, onSnapshot, 
    addDoc, deleteDoc, doc, where 
} from 'firebase/firestore';
import { Plus, Trash2, Building2, ShieldCheck, Loader2, X } from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';

export default function FornecedoresContas() {
    const [formData, setFormData] = useState({
        nome: '',
        planoContaId: '',
        recorrencia: 'Variavel'
    });

    const [fornecedores, setFornecedores] = useState([]);
    const [planoContasDespesas, setPlanoContasDespesas] = useState([]);
    const [carregando, setCarregando] = useState(true);
    const [isModalAberto, setIsModalAberto] = useState(false);

    // 1. BUSCA EM TEMPO REAL: FORNECEDORES E PLANO DE CONTAS (DESPESAS)
    useEffect(() => {
        // Busca Fornecedores
        const qFornecedores = query(collection(db, "fornecedores"), orderBy("nome", "asc"));
        const unsubFornecedores = onSnapshot(qFornecedores, (snapshot) => {
            setFornecedores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        // BUSCA PLANO DE CONTAS FILTRADO POR DESPESA NO FIREBASE
        const qPlano = query(
            collection(db, "planoContas"), 
            where("tipo", "==", "Despesa"),
            orderBy("codigoCustom", "asc")
        );
        
        const unsubPlano = onSnapshot(qPlano, (snapshot) => {
            setPlanoContasDespesas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setCarregando(false);
        });

        return () => { unsubFornecedores(); unsubPlano(); };
    }, []);

    const { confirmModal, alertModal } = useModal();

    const salvar = async (e) => {
        e.preventDefault();
        if (!formData.nome || !formData.planoContaId) {
            return await alertModal("Atenção", "Preencha o nome e selecione o plano de contas de despesa.", "warning");
        }

        try {
            // Busca o objeto completo da categoria para salvar o nome também (facilita listagens futuras)
            const categoriaSelecionada = planoContasDespesas.find(p => p.id === formData.planoContaId);

            await addDoc(collection(db, "fornecedores"), {
                nome: formData.nome.toUpperCase().trim(),
                planoContaId: formData.planoContaId,
                planoContaNome: categoriaSelecionada ? categoriaSelecionada.nome : '',
                recorrencia: formData.recorrencia,
                criadoEm: new Date().toISOString()
            });

            setFormData({ nome: '', planoContaId: '', recorrencia: 'Variavel' });
            setIsModalAberto(false);
            await alertModal("Sucesso", "Conta cadastrada com sucesso!", "success");
        } catch (error) {
            console.error(error);
            await alertModal("Erro", "Erro ao salvar no Firebase.", "danger");
        }
    };

    const excluir = async (id) => {
        if (await confirmModal("Excluir", "Excluir este fornecedor?", "danger")) {
            try {
                await deleteDoc(doc(db, "fornecedores", id));
            } catch (error) {
                console.error(error);
            }
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-10 text-left">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-left">
                    <div className="bg-blue-600 p-2.5 rounded-2xl text-white shadow-lg shadow-blue-100">
                        <Building2 size={24} />
                    </div>
                    <div className="text-left">
                        <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter text-left italic">
                            Contas / Fornecedores
                        </h1>
                        <p className="text-slate-500 text-xs font-bold flex items-center gap-1 text-left">
                            <ShieldCheck size={12} className="text-emerald-500"/> Vinculado apenas a Planos de Despesas
                        </p>
                    </div>
                </div>
                <button 
                    onClick={() => setIsModalAberto(true)} 
                    className="w-full md:w-auto bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl flex items-center justify-center gap-2 italic active:scale-95"
                >
                    <Plus size={18} strokeWidth={3}/> Adicionar
                </button>
            </div>

            {isModalAberto && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-lg font-black text-slate-800 uppercase italic flex items-center gap-2 leading-none">
                                <Building2 className="text-blue-600" size={24} /> 
                                Novo Fornecedor
                            </h2>
                            <button onClick={() => setIsModalAberto(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20}/></button>
                        </div>
                        
                        <form onSubmit={salvar} className="p-6 space-y-6 text-left">
                            <div className="space-y-2 text-left">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 text-left">Nome (Ex: CPFL, Água...)</label>
                                <input 
                                    className="w-full border-2 border-slate-100 rounded-2xl px-4 py-3 outline-none bg-slate-50 focus:bg-white focus:border-blue-500 transition-all font-bold uppercase italic"
                                    placeholder="Nome da conta..."
                                    value={formData.nome}
                                    onChange={e => setFormData({...formData, nome: e.target.value})}
                                />
                            </div>

                            <div className="space-y-2 text-left">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 text-blue-600 text-left italic">Plano de Contas</label>
                                <select 
                                    className="w-full border-2 border-blue-100 rounded-2xl px-4 py-3 outline-none bg-blue-50/30 focus:bg-white transition-all font-black text-blue-700 italic cursor-pointer"
                                    value={formData.planoContaId}
                                    onChange={e => setFormData({...formData, planoContaId: e.target.value})}
                                >
                                    <option value="">Selecione a categoria...</option>
                                    {planoContasDespesas.map(p => (
                                        <option key={p.id} value={p.id}>{p.codigoCustom} - {p.nome}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2 text-left">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 text-left">Tipo de Gasto</label>
                                <select 
                                    className="w-full border-2 border-slate-100 rounded-2xl px-4 py-3 outline-none bg-slate-50 font-bold italic cursor-pointer"
                                    value={formData.recorrencia}
                                    onChange={e => setFormData({...formData, recorrencia: e.target.value})}
                                >
                                    <option value="Variavel">Variável (Eventual)</option>
                                    <option value="Fixa">Fixa (Mensal)</option>
                                </select>
                            </div>

                            <button type="submit" className="w-full bg-slate-900 text-white px-8 py-4 rounded-2xl font-black uppercase text-[11px] tracking-wider hover:bg-blue-600 transition-all shadow-xl shadow-slate-200 italic active:scale-95 mt-4">
                                Cadastrar Conta
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-[2.5rem] border-2 border-slate-100 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                    <thead className="bg-slate-50/50 border-b border-slate-100 text-left">
                        <tr>
                            <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Nome / Fornecedor</th>
                            <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Recorrência</th>
                            <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Plano de Contas (Despesa)</th>
                            <th className="p-6 text-[10px] font-black text-slate-400 uppercase text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-left">
                        {carregando ? (
                            <tr><td colSpan="4" className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-blue-600"/></td></tr>
                        ) : fornecedores.map(f => (
                            <tr key={f.id} className="hover:bg-slate-50/50 transition-all group">
                                <td className="p-6 font-black text-slate-700 uppercase text-sm tracking-tighter italic text-left">{f.nome}</td>
                                <td className="p-6 text-center">
                                    <span className={`text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest italic ${
                                        f.recorrencia === 'Fixa' ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'
                                    }`}>
                                        {f.recorrencia}
                                    </span>
                                </td>
                                <td className="p-6 text-left">
                                    <div className="flex items-center gap-2 text-left">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                        <span className="text-xs font-black text-slate-500 uppercase italic text-left">
                                            {planoContasDespesas.find(p => p.id === f.planoContaId)?.nome || f.planoContaNome || 'Não definido'}
                                        </span>
                                    </div>
                                </td>
                                <td className="p-6 text-right">
                                    <button 
                                        onClick={() => excluir(f.id)} 
                                        className="text-slate-300 hover:text-rose-600 p-2 transition-colors"
                                    >
                                        <Trash2 size={20}/>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {!carregando && fornecedores.length === 0 && (
                    <div className="p-20 text-center text-slate-300 italic text-sm font-bold uppercase tracking-widest">Nenhuma conta cadastrada.</div>
                )}
            </div>
        </div>
    );
}