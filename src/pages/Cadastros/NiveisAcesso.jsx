import React, { useState, useEffect } from 'react';
import { db } from '../../database/firebase'; 
import { 
    collection, query, orderBy, onSnapshot, 
    doc, addDoc, updateDoc, deleteDoc 
} from 'firebase/firestore';
import { 
    ShieldCheck, Trash2, Edit3, Loader2, 
    CheckCircle2, Circle, Plus, Search, X, AlertTriangle, ListChecks, Info, ChevronRight, Activity 
} from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';

export default function NiveisAcesso() {
    // Lista de módulos atualizada com as novas telas/sub-rotas
    const modulosDoSistema = [
        { id: 'usuarios', nome: 'Gestão de Membros' },
        { id: 'programacao', nome: 'Programação de Cultos' },
        { id: 'cargos', nome: 'Níveis de Acesso' },
        { id: 'planoContas', nome: 'Plano de Contas' },
        { id: 'contas', nome: 'Bancos / Fornecedores' },
        { id: 'produtos', nome: 'Produtos Cantina' },
        { id: 'fluxo', nome: 'Fluxo de Caixa' },
        { id: 'lancamentos', nome: 'Lançamentos Avulsos' },
        { id: 'transferencias', nome: 'Transferências' },
        { id: 'pagar', nome: 'Contas a Pagar' },
        { id: 'receber', nome: 'Contas a Receber' },
        { id: 'convenio', nome: 'Convênio Cantina' },
        { id: 'relatorios', nome: 'Relatórios BI' }
    ];

    const gerarPermissoesVazias = () => {
        return modulosDoSistema.reduce((acc, modulo) => {
            acc[modulo.id] = false;
            return acc;
        }, {});
    };

    const [cargos, setCargos] = useState([]);
    const [carregando, setCarregando] = useState(true);
    const [isModalAberto, setIsModalAberto] = useState(false);
    const [filtro, setFiltro] = useState('');
    const [editandoId, setEditandoId] = useState(null);
    const [formData, setFormData] = useState({
        nome: '',
        permissoes: gerarPermissoesVazias()
    });

    useEffect(() => {
        const q = query(collection(db, "cargos"), orderBy("nome", "asc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setCargos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setCarregando(false);
        });
        return () => unsubscribe();
    }, []);

    const abrirModalNovo = () => {
        setEditandoId(null);
        setFormData({ nome: '', permissoes: gerarPermissoesVazias() });
        setIsModalAberto(true);
    };

    const fecharModal = () => {
        setIsModalAberto(false);
        setEditandoId(null);
    };

    const togglePermissao = (moduloId) => {
        setFormData(prev => ({
            ...prev,
            permissoes: { ...prev.permissoes, [moduloId]: !prev.permissoes[moduloId] }
        }));
    };

    const { confirmModal, alertModal } = useModal();

    const salvar = async (e) => {
        e.preventDefault();
        if (!formData.nome) return await alertModal("Atenção", "Defina um nome para o cargo.", "warning");

        try {
            const dadosParaSalvar = {
                nome: formData.nome.toUpperCase().trim(),
                permissoes: formData.permissoes,
                atualizadoEm: new Date().toISOString()
            };

            if (editandoId) {
                await updateDoc(doc(db, "cargos", editandoId), dadosParaSalvar);
            } else {
                await addDoc(collection(db, "cargos"), dadosParaSalvar);
            }

            await alertModal("Sucesso", "Sucesso!", "success");
            fecharModal();
        } catch (error) {
            await alertModal("Erro", "Erro ao salvar: " + error.message, "danger");
        }
    };

    const prepararEdicao = (cargo) => {
        setEditandoId(cargo.id);
        setFormData({
            nome: cargo.nome,
            permissoes: { ...gerarPermissoesVazias(), ...(cargo.permissoes || {}) }
        });
        setIsModalAberto(true);
    };

    const filtrados = cargos.filter(c => 
        c.nome?.toLowerCase().includes(filtro.toLowerCase())
    );

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-20 p-4 font-sans italic relative text-left">
            
            {/* HEADER COM BUSCA E BOTÃO NOVO */}
            <header className="flex flex-col md:flex-row justify-between items-center gap-4 border-b-2 border-slate-100 pb-6 text-left">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3 uppercase italic leading-none text-left">
                        <ShieldCheck className="text-blue-600" size={28} />
                        Níveis de Acesso
                    </h1>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 italic text-left">Configuração de Permissões Cloud</p>
                </div>
                
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:flex-initial">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            className="pl-10 pr-4 py-3 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 w-full md:w-80 font-bold text-xs uppercase italic bg-white"
                            placeholder="Buscar nível de acesso..."
                            value={filtro}
                            onChange={e => setFiltro(e.target.value)}
                        />
                    </div>
                    <button 
                        onClick={abrirModalNovo}
                        className="bg-slate-900 text-white p-3.5 rounded-2xl hover:bg-blue-600 transition-all shadow-lg active:scale-95 shrink-0"
                    >
                        <Plus size={24} strokeWidth={3} />
                    </button>
                </div>
            </header>

            {/* MODAL DE CADASTRO / EDIÇÃO */}
            {isModalAberto && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
                        
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 uppercase italic leading-none">
                                    {editandoId ? 'Editar Nível' : 'Novo Nível de Acesso'}
                                </h2>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Configure as permissões de módulo</p>
                            </div>
                            <button onClick={fecharModal} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <X size={24} className="text-slate-500" />
                            </button>
                        </div>

                        <form onSubmit={salvar} className="p-6 space-y-4 overflow-y-auto custom-scroll">
                            <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Nome do Nível Sistêmico / Perfil</label>
                                <input 
                                    className="w-full border-2 border-white rounded-xl px-4 py-2 font-bold bg-white uppercase italic text-sm focus:border-blue-500 outline-none shadow-sm" 
                                    value={formData.nome} 
                                    onChange={e => setFormData({...formData, nome: e.target.value})} 
                                    placeholder="EX: ACESSO BASICO, ACESSO COMPLETO..."
                                />
                            </div>

                            <div className="pt-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1 italic">Permissões de Acesso</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                                    {modulosDoSistema.map((m) => (
                                        <button 
                                            key={m.id} 
                                            type="button" 
                                            onClick={() => togglePermissao(m.id)} 
                                            className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-left ${formData.permissoes[m.id] ? 'border-blue-600 bg-blue-600 text-white shadow-md' : 'border-slate-100 bg-white text-slate-400'}`}
                                        >
                                            <div className="shrink-0">{formData.permissoes[m.id] ? <CheckCircle2 size={16} /> : <Circle size={16} />}</div>
                                            <span className="font-black uppercase text-[9px] tracking-wider italic leading-tight truncate">{m.nome}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-4 pt-2 shrink-0">
                                <button type="button" onClick={fecharModal} className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-500 font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
                                <button type="submit" className="flex-2 px-12 py-3 rounded-2xl bg-slate-900 text-white font-black uppercase text-xs tracking-widest shadow-lg hover:bg-blue-600 transition-all">
                                    {editandoId ? 'Salvar Alterações' : 'Criar Nível'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* LISTAGEM DE CARGOS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {carregando ? (
                    <div className="col-span-full flex justify-center p-10"><Loader2 className="animate-spin text-blue-600" size={40} /></div>
                ) : filtrados.map(cargo => (
                    <div key={cargo.id} className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-100 flex items-center justify-between shadow-sm hover:border-blue-100 transition-all group">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                                <ShieldCheck size={24} />
                            </div>
                            <div>
                                <p className="font-black text-slate-800 uppercase italic leading-none">{cargo.nome}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">
                                    {Object.values(cargo.permissoes || {}).filter(v => v).length} Módulos Ativos
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            <button onClick={() => prepararEdicao(cargo)} className="p-2.5 text-slate-300 hover:text-blue-600 transition-colors"><Edit3 size={18} /></button>
                            <button onClick={async () => { if(await confirmModal("Excluir", `Excluir ${cargo.nome}?`, "danger")) deleteDoc(doc(db, "cargos", cargo.id)) }} className="p-2.5 text-slate-300 hover:text-rose-600 transition-colors"><Trash2 size={18} /></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}