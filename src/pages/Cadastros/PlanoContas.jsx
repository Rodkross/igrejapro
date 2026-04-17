import React, { useState, useEffect } from 'react';
import { db } from '../../database/firebase'; 
import { 
    collection, query, orderBy, onSnapshot, 
    addDoc, deleteDoc, doc, getDocs, where, limit 
} from 'firebase/firestore';
import { Plus, Trash2, ListTree, Search, Loader2, X } from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';

export default function PlanoContas() {
    const [nome, setNome] = useState('');
    const [tipo, setTipo] = useState('Receita');
    const [filtro, setFiltro] = useState('');
    const [categorias, setCategorias] = useState([]);
    const [carregando, setCarregando] = useState(true);
    const [isModalAberto, setIsModalAberto] = useState(false);

    const { confirmModal, alertModal } = useModal();

    useEffect(() => {
        const q = query(collection(db, "planoContas"), orderBy("codigoCustom", "asc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const lista = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setCategorias(lista);
            setCarregando(false);
        });
        return () => unsubscribe();
    }, []);

    const handleSalvar = async (e) => {
        e.preventDefault();
        if (!nome) return;

        try {
            const prefixo = tipo === 'Receita' ? 1 : 2;
            let novoCodigo;

            try {
                // BUSCA O ÚLTIMO CÓDIGO (Requer o índice que você clicou no link)
                const q = query(
                    collection(db, "planoContas"), 
                    where("tipo", "==", tipo),
                    orderBy("codigoCustom", "desc"),
                    limit(1)
                );
                
                const querySnapshot = await getDocs(q);
                const ultimoDoc = querySnapshot.docs[0]?.data();

                if (ultimoDoc && ultimoDoc.codigoCustom) {
                    const partes = ultimoDoc.codigoCustom.split('.');
                    const sequencial = parseInt(partes[1]) + 1;
                    novoCodigo = `${prefixo}.${sequencial.toString().padStart(3, '0')}`;
                } else {
                    novoCodigo = `${prefixo}.001`;
                }
            } catch (error) {
                if (error.message.includes("failed-precondition")) {
                    await alertModal("Atenção", "O Firebase ainda está organizando os índices. Aguarde 2 minutos e tente novamente.", "warning");
                }
                return;
            }

            await addDoc(collection(db, "planoContas"), { 
                nome: nome.toUpperCase().trim(), 
                tipo, 
                codigoCustom: novoCodigo,
                criadoEm: new Date().toISOString()
            });

            setNome('');
            setIsModalAberto(false);
        } catch (error) {
            console.error("Erro ao salvar:", error);
            await alertModal("Erro", "Erro ao salvar categoria.", "danger");
        }
    };

    const excluir = async (id) => {
        if (await confirmModal('Tem certeza?', 'Deseja excluir esta categoria? Isso pode afetar lançamentos vinculados.', 'warning')) {
            try {
                await deleteDoc(doc(db, "planoContas", id));
            } catch (error) {
                await alertModal("Erro", "Erro ao excluir.", "danger");
            }
        }
    };

    const categoriasFiltradas = categorias.filter(c => 
        c.nome?.toLowerCase().includes(filtro.toLowerCase()) || 
        c.codigoCustom?.includes(filtro)
    );

    return (
        <div className="max-w-5xl mx-auto space-y-6 text-left p-4 pb-20">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
                <div className="text-left">
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2 uppercase italic leading-none">
                        <ListTree className="text-blue-600" size={28} />
                        Plano de Contas
                    </h1>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
                        Estruturação de Receitas (1.xxx) e Despesas (2.xxx)
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <div className="relative w-full sm:w-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="text"
                            placeholder="Buscar categoria..."
                            className="pl-10 pr-4 py-2.5 border-2 border-slate-100 rounded-xl bg-white outline-none focus:border-blue-500 w-full sm:w-64 font-bold text-xs uppercase"
                            value={filtro}
                            onChange={(e) => setFiltro(e.target.value)}
                        />
                    </div>
                    <button 
                        onClick={() => setIsModalAberto(true)} 
                        className="w-full sm:w-auto bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl flex items-center justify-center gap-2 italic active:scale-95"
                    >
                        <Plus size={18} strokeWidth={3}/> Adicionar
                    </button>
                </div>
            </header>

            {isModalAberto && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-lg font-black text-slate-800 uppercase italic flex items-center gap-2 leading-none">
                                <ListTree className="text-blue-600" size={24} /> 
                                Nova Categoria
                            </h2>
                            <button onClick={() => setIsModalAberto(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20}/></button>
                        </div>
                        
                        <form onSubmit={handleSalvar} className="p-6 space-y-6 text-left">
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase ml-1">Nome da Categoria</label>
                                <input 
                                    type="text" 
                                    className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 outline-none focus:border-blue-500 font-bold bg-slate-50 uppercase italic"
                                    placeholder="Ex: Ofertas Especiais..."
                                    value={nome}
                                    onChange={(e) => setNome(e.target.value)}
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase ml-1">Natureza</label>
                                <select 
                                    className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 bg-slate-50 outline-none focus:border-blue-500 font-bold cursor-pointer italic"
                                    value={tipo}
                                    onChange={(e) => setTipo(e.target.value)}
                                >
                                    <option value="Receita">RECEITA (1.XXX)</option>
                                    <option value="Despesa">DESPESA (2.XXX)</option>
                                </select>
                            </div>

                            <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg italic mt-4">
                                <Plus size={18}/> Salvar
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-[2.5rem] shadow-sm border-2 border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Código</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Descrição</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Natureza</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {carregando ? (
                                <tr>
                                    <td colSpan="4" className="px-8 py-10 text-center"><Loader2 className="animate-spin text-blue-600 mx-auto" /></td>
                                </tr>
                            ) : categoriasFiltradas.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-8 py-5">
                                        <span className="font-mono text-xs font-black bg-white text-slate-600 px-3 py-1.5 rounded-lg border-2 border-slate-100 group-hover:border-blue-200 group-hover:text-blue-600 transition-all italic">
                                            {item.codigoCustom}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5 font-black text-slate-700 uppercase italic text-xs">{item.nome}</td>
                                    <td className="px-8 py-5">
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase italic border ${
                                            item.tipo === 'Receita' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'
                                        }`}>
                                            {item.tipo}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <button onClick={() => excluir(item.id)} className="p-2 text-slate-300 hover:text-rose-600 transition-all"><Trash2 size={18}/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}