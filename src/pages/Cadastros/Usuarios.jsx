import React, { useState, useEffect, useMemo } from 'react';
import { db, storage } from '../../database/firebase'; // Importado o storage
import { 
    collection, query, addDoc, updateDoc, deleteDoc, doc, 
    orderBy, onSnapshot, writeBatch 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
    Trash2, Edit3, Search, Mail,
    ChevronDown, ChevronUp, Cake, Loader2,
    Cross, Heart, Calendar, Link2, Plus, X, Phone, UserMinus, Users, UserX, ShieldCheck, Camera, Upload, ImageIcon, Settings
} from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';

export default function Usuarios() {
    const [usuarios, setUsuarios] = useState([]);
    const [cargos, setCargos] = useState([]);
    const [isModalAberto, setIsModalAberto] = useState(false);
    const [subindoImagem, setSubindoImagem] = useState(false);
    const [formData, setFormData] = useState({
        nome: '', telefone: '', cargoId: '', endereco: '', senha: '', 
        dataNascimento: '', email: '', idAcesso: '',
        batizado: false, casado: false, conjugeId: '', conjugeExterno: false,
        dataConversao: '', perfilMembro: 'Novo Convertido',
        fotoUrl: '', biografia: ''
    });
    const [editandoId, setEditandoId] = useState(null);
    const [filtro, setFiltro] = useState('');
    const [expandidoId, setExpandidoId] = useState(null);
    const [carregando, setCarregando] = useState(true);
    const { confirmModal, alertModal } = useModal();

    // 1. SINCRONIZAÇÃO EM TEMPO REAL
    useEffect(() => {
        const qUsuarios = query(collection(db, "usuarios"), orderBy("nome", "asc"));
        const qCargos = query(collection(db, "cargos"), orderBy("nome", "asc"));

        const unsubUsuarios = onSnapshot(qUsuarios, (snapshot) => {
            const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUsuarios(lista);
            setCarregando(false);
        });

        const unsubCargos = onSnapshot(qCargos, (snapshot) => {
            const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCargos(lista);
        });

        return () => { unsubUsuarios(); unsubCargos(); };
    }, []);

    // 2. ESTATÍSTICAS E ORDENAÇÃO (AFASTADOS POR ÚLTIMO)
    const stats = useMemo(() => {
        const membrosValidos = usuarios.filter(u => String(u.id) !== "1" && u.idAcesso !== 1);
        const ativos = membrosValidos.filter(u => u.perfilMembro !== 'Afastado');
        const afastados = membrosValidos.filter(u => u.perfilMembro === 'Afastado');
        
        const listaOrdenada = [...ativos, ...afastados].filter(u => 
            u.nome?.toLowerCase().includes(filtro.toLowerCase())
        );

        return {
            totalAtivos: ativos.length,
            totalAfastados: afastados.length,
            baseGeral: membrosValidos.length,
            listaExibicao: listaOrdenada
        };
    }, [usuarios, filtro]);

    // 3. LOGICA DE UPLOAD DE FOTO
    const handleUploadFoto = async (e) => {
        const arquivo = e.target.files[0];
        if (!arquivo) return;

        setSubindoImagem(true);
        try {
            const storageRef = ref(storage, `fotos_membros/${Date.now()}_${arquivo.name}`);
            await uploadBytes(storageRef, arquivo);
            const url = await getDownloadURL(storageRef);
            setFormData(prev => ({ ...prev, fotoUrl: url }));
        } catch (error) {
            console.error("Erro no upload:", error);
            await alertModal("Erro", "Falha ao subir imagem.", "danger");
        } finally {
            setSubindoImagem(false);
        }
    };

    // 4. FUNÇÕES DE MODAL E SALVAMENTO
    const abrirModalNovo = () => {
        const proximoId = usuarios.length > 0 
            ? Math.max(...usuarios.map(u => Number(u.idAcesso) || 0)) + 1 
            : 1;

        setEditandoId(null);
        setFormData({
            nome: '', telefone: '', cargoId: '', endereco: '', senha: '', 
            dataNascimento: '', email: '', idAcesso: proximoId,
            batizado: false, casado: false, conjugeId: '', conjugeExterno: false,
            dataConversao: '', perfilMembro: 'Novo Convertido',
            fotoUrl: '', biografia: ''
        });
        setIsModalAberto(true);
    };

    const fecharModal = () => {
        setIsModalAberto(false);
        setEditandoId(null);
    };

    const prepararEdicao = (u) => {
        setEditandoId(u.id);
        setFormData({ ...u });
        setIsModalAberto(true);
    };

    const salvar = async (e) => {
        e.preventDefault();
        if (!formData.nome || !formData.cargoId) return await alertModal("Atenção", "Preencha Nome e Cargo.", "warning");

        try {
            const batch = writeBatch(db);
            const cargoSelecionado = cargos.find(c => String(c.id) === String(formData.cargoId));
            const principalId = editandoId || doc(collection(db, "usuarios")).id;
            const refPrincipal = doc(db, "usuarios", principalId);

            const payload = { 
                ...formData,
                cargoNome: cargoSelecionado ? cargoSelecionado.nome : 'Membro',
                nome: formData.nome.toUpperCase(),
                id: principalId
            };

            batch.set(refPrincipal, payload, { merge: true });

            if (formData.casado && formData.conjugeId && !formData.conjugeExterno) {
                const refConjuge = doc(db, "usuarios", formData.conjugeId);
                batch.update(refConjuge, { casado: true, conjugeId: principalId, conjugeExterno: false });
            }

            await batch.commit();
            fecharModal();
            await alertModal("Sucesso", "Cadastro atualizado com sucesso!", "success");
        } catch (error) { await alertModal("Erro", "Erro ao processar.", "danger"); }
    };

    const aplicarMascaraTelefone = (valor) => {
        const v = valor.replace(/\D/g, "");
        if (v.length <= 10) return v.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
        return v.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3").substring(0, 15);
    };

    const abrirWhatsapp = (t) => {
        if (!t) return;
        const n = t.replace(/\D/g, "");
        window.open(`https://wa.me/${n.length === 11 ? '55' + n : n}`, '_blank');
    };

    const calcularIdade = (d) => {
        if (!d) return null;
        const partes = d.split('-');
        const nasc = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2]));
        const hoje = new Date();
        let idade = hoje.getFullYear() - nasc.getFullYear();
        if (hoje.getMonth() < nasc.getMonth() || (hoje.getMonth() === nasc.getMonth() && hoje.getDate() < nasc.getDate())) idade--;
        return idade;
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-20 p-4 font-sans italic relative text-left">
            <header className="flex flex-col md:flex-row justify-between items-center gap-4 border-b pb-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 uppercase leading-none italic">Membros</h1>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 italic">Gestão e Matrículas</p>
                </div>
                
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:flex-initial">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            className="pl-10 pr-4 py-3 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 w-full md:w-80 font-bold text-xs uppercase italic bg-white"
                            placeholder="Buscar membro..."
                            value={filtro}
                            onChange={e => setFiltro(e.target.value)}
                        />
                    </div>
                    <button onClick={abrirModalNovo} className="bg-slate-900 text-white p-3.5 rounded-2xl hover:bg-blue-600 transition-all shadow-lg active:scale-95 shrink-0">
                        <Plus size={24} strokeWidth={3} />
                    </button>
                </div>
            </header>

            {/* BARRA DE CONTAGEM */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 italic">
                <ContagemCard icon={<Users size={20}/>} label="Ativos" value={stats.totalAtivos} color="text-blue-600" bg="bg-blue-50" />
                <ContagemCard icon={<UserX size={20}/>} label="Afastados" value={stats.totalAfastados} color="text-amber-600" bg="bg-amber-50" />
                <div className="hidden md:flex bg-slate-900 p-4 rounded-2xl border-2 border-slate-800 items-center gap-3 shadow-sm italic">
                    <div className="w-10 h-10 bg-slate-800 text-white rounded-xl flex items-center justify-center shrink-0"><ShieldCheck size={20}/></div>
                    <div><p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1 italic">Base Geral</p><p className="text-lg font-black text-white italic">{stats.baseGeral}</p></div>
                </div>
            </div>

            {/* MODAL DE CADASTRO */}
            {isModalAberto && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col text-left italic">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 uppercase italic leading-none">{editandoId ? 'Atualizar Membro' : 'Novo Cadastro'}</h2>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1 italic">Dados, Foto e Biografia</p>
                            </div>
                            <button onClick={fecharModal} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><X size={24} /></button>
                        </div>

                        <form onSubmit={salvar} className="p-8 space-y-8 overflow-y-auto italic">
                            
                            {/* UPLOAD DE FOTO E BIOGRAFIA */}
                            <div className="flex flex-col md:flex-row gap-6 items-start p-6 bg-blue-50/50 rounded-[2rem] border border-blue-100 italic">
                                <div className="relative shrink-0">
                                    <div className="w-28 h-28 rounded-3xl bg-white border-4 border-white shadow-xl overflow-hidden flex items-center justify-center">
                                        {formData.fotoUrl ? (
                                            <img src={formData.fotoUrl} className="w-full h-full object-cover" alt="Perfil" />
                                        ) : (
                                            <Camera size={32} className="text-blue-200" />
                                        )}
                                        {subindoImagem && <div className="absolute inset-0 bg-white/60 flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>}
                                    </div>
                                    <label className="absolute -bottom-2 -right-2 bg-blue-600 text-white p-2 rounded-xl shadow-lg cursor-pointer hover:bg-blue-700 transition-all">
                                        <Upload size={14} />
                                        <input type="file" className="hidden" accept="image/*" onChange={handleUploadFoto} />
                                    </label>
                                </div>
                                <div className="flex-1 w-full italic">
                                    <label className="block text-[10px] font-black text-blue-600 uppercase mb-2 ml-1">Breve descrição sobre o membro</label>
                                    <textarea placeholder="Conte um pouco sobre este membro..." className="w-full border-2 border-white rounded-2xl px-4 py-3 font-bold bg-white focus:border-blue-300 outline-none resize-none italic" rows="3" value={formData.biografia || ''} onChange={e => setFormData({...formData, biografia: e.target.value})} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="md:col-span-2"><label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Nome Completo</label><input className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 font-bold bg-slate-50 uppercase focus:border-blue-500 outline-none italic" value={formData.nome || ''} onChange={e => setFormData({ ...formData, nome: e.target.value })} /></div>
                                <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Nascimento</label><input type="date" className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 font-bold bg-slate-50 focus:border-blue-500 outline-none italic" value={formData.dataNascimento || ''} onChange={e => setFormData({ ...formData, dataNascimento: e.target.value })} /></div>
                                <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Cargo</label><select className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 bg-slate-50 font-bold focus:border-blue-500 outline-none italic" value={formData.cargoId || ''} onChange={e => setFormData({ ...formData, cargoId: e.target.value })}><option value="">Selecionar...</option>{cargos?.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
                            </div>

                            <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-6 text-left">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center italic">
                                    <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" className="w-5 h-5 accent-blue-600" checked={formData.batizado || false} onChange={e => setFormData({...formData, batizado: e.target.checked})} /><span className="text-[10px] font-black text-slate-600 uppercase italic">Batizado?</span></label>
                                    <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" className="w-5 h-5 accent-rose-500" checked={formData.casado || false} onChange={e => setFormData({...formData, casado: e.target.checked})} /><span className="text-[10px] font-black text-slate-600 uppercase italic">Casado?</span></label>
                                    <input type="date" className="w-full border-2 border-white rounded-xl px-3 py-2 font-bold bg-white italic text-xs outline-none focus:border-blue-500" value={formData.dataConversao || ''} onChange={e => setFormData({ ...formData, dataConversao: e.target.value })} />
                                    <select className="w-full border-2 border-white rounded-xl px-3 py-2 bg-white font-bold text-xs italic outline-none" value={formData.perfilMembro || 'Novo Convertido'} onChange={e => setFormData({ ...formData, perfilMembro: e.target.value })}><option value="Novo Convertido">NOVO CONVERTIDO</option><option value="Retorno">RETORNO</option><option value="Transferência">TRANSFERÊNCIA</option><option value="Afastado">AFASTADO</option></select>
                                </div>
                                {formData.casado && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-200">
                                        <div className="space-y-3 italic">
                                            <label className="flex items-center gap-2 text-[10px] font-black text-rose-500 uppercase"><Link2 size={14}/> Vincular Cônjuge da Igreja</label>
                                            <select disabled={formData.conjugeExterno} className="w-full border-2 border-white rounded-xl px-4 py-3 font-bold bg-white italic outline-none focus:border-rose-300" value={formData.conjugeId || ''} onChange={e => setFormData({...formData, conjugeId: e.target.value})}>
                                                <option value="">Buscar esposo(a)...</option>
                                                {usuarios.filter(u => u.id !== editandoId).map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex items-end pb-3 italic">
                                            <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" className="w-5 h-5 accent-slate-900" checked={formData.conjugeExterno || false} onChange={e => setFormData({...formData, conjugeExterno: e.target.checked, conjugeId: e.target.checked ? '' : formData.conjugeId})} /><span className="text-[10px] font-black text-slate-500 uppercase italic">Não frequenta a igreja</span></label>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 italic">
                                <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Matrícula ID</label><input readOnly className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 font-bold bg-slate-200 text-slate-500 italic outline-none" value={formData.idAcesso || ''} /></div>
                                <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2">WhatsApp</label><input placeholder="WHATSAPP" className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 font-bold bg-slate-50 focus:border-blue-500 outline-none italic" value={formData.telefone || ''} onChange={e => setFormData({ ...formData, telefone: aplicarMascaraTelefone(e.target.value) })} /></div>
                                <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Senha</label><input type="password" placeholder="SENHA" className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 font-bold bg-slate-50 focus:border-blue-500 outline-none italic" value={formData.senha || ''} onChange={e => setFormData({ ...formData, senha: e.target.value })} /></div>
                                <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2">E-mail</label><input type="email" placeholder="E-MAIL" className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 font-bold bg-slate-50 uppercase focus:border-blue-500 outline-none italic" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} /></div>
                            </div>

                            <div className="flex gap-4 pt-4 shrink-0"><button type="button" onClick={fecharModal} className="flex-1 py-4 rounded-2xl bg-slate-100 text-slate-500 font-black uppercase text-xs tracking-widest italic">Cancelar</button><button type="submit" disabled={subindoImagem} className="flex-2 px-12 py-4 rounded-2xl bg-slate-900 text-white font-black uppercase text-xs shadow-lg hover:bg-blue-600 transition-all italic">{editandoId ? 'Atualizar Membro' : 'Finalizar Cadastro'}</button></div>
                        </form>
                    </div>
                </div>
            )}

            {/* LISTAGEM */}
            <div className="space-y-4">
                {carregando ? (
                    <div className="flex justify-center p-10"><Loader2 className="animate-spin text-blue-600" size={40} /></div>
                ) : stats.listaExibicao.map(u => {
                    const isExpandido = expandidoId === u.id;
                    const isAfastado = u.perfilMembro === 'Afastado';
                    const conjuge = usuarios.find(c => c.id === u.conjugeId);

                    return (
                        <div key={u.id} className={`bg-white border-2 rounded-[2rem] transition-all ${isExpandido ? 'border-blue-500 shadow-xl' : 'border-slate-100'} ${isAfastado ? 'opacity-60 grayscale-[0.3]' : ''}`}>
                            <div className="p-6 flex items-center justify-between cursor-pointer italic" onClick={() => setExpandidoId(isExpandido ? null : u.id)}>
                                <div className="flex items-center gap-5 min-w-0 italic">
                                    <div className="relative shrink-0 italic">
                                        {u.fotoUrl && !isAfastado ? (
                                            <img src={u.fotoUrl} className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-100 shadow-sm" alt="" />
                                        ) : (
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl ${isExpandido ? 'bg-blue-600 text-white' : isAfastado ? 'bg-slate-200 text-slate-500' : 'bg-slate-100 text-slate-400'}`}>
                                                {isAfastado ? <UserMinus size={24} /> : u.nome?.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div className="absolute -top-2 -right-2 bg-slate-900 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md border-2 border-white shadow-sm italic">MT: {u.idAcesso}</div>
                                        {u.batizado && !isAfastado && <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white p-1 rounded-lg border-2 border-white shadow-sm"><Cross size={10} /></div>}
                                    </div>
                                    <div className="text-left min-w-0 italic">
                                        <p className={`font-black uppercase text-lg leading-none truncate italic ${isAfastado ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{u.nome}</p>
                                        <div className="flex flex-wrap gap-2 mt-2 italic">
                                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border italic ${isAfastado ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>{u.cargoNome || 'MEMBRO'}</span>
                                            {u.casado && !isAfastado && <span className="bg-rose-50 text-rose-600 px-2 py-0.5 rounded-md border border-rose-100 flex items-center gap-1 italic"><Heart size={8} fill="currentColor"/> {u.conjugeExterno ? 'Externo' : conjuge?.nome?.split(' ')[0]}</span>}
                                            {isAfastado && <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 border border-amber-200 italic">INATIVO</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 relative z-10 italic">
                                    <button onClick={(e) => { e.stopPropagation(); abrirWhatsapp(u.telefone); }} className={`p-2.5 transition-transform ${isAfastado ? 'text-slate-300 pointer-events-none' : 'text-emerald-500 hover:scale-110'}`}><Phone size={20} /></button>
                                    <button onClick={(e) => { e.stopPropagation(); prepararEdicao(u); }} className="p-2.5 text-slate-400 bg-slate-50 border border-slate-100 rounded-[14px] hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm"><Settings size={20} /></button>
                                    <button onClick={async (e) => { e.stopPropagation(); if(await confirmModal("Excluir", `Excluir ${u.nome}?`, "danger")) deleteDoc(doc(db, "usuarios", u.id)) }} className="p-2.5 text-slate-300 hover:text-rose-600 transition-all"><Trash2 size={20} /></button>
                                    {isExpandido ? <ChevronUp size={24} className="text-blue-600 ml-2" /> : <ChevronDown size={24} className="text-slate-300 ml-2" />}
                                </div>
                            </div>
                            {isExpandido && (
                                <div className="px-10 pb-10 pt-4 bg-slate-50/50 rounded-b-[2rem] animate-in slide-in-from-top-2 text-left italic">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 italic">
                                        <Detail icon={<Mail size={18}/>} label="E-mail" value={u.email} color="text-indigo-500" />
                                        <Detail icon={<Cake size={18}/>} label="Idade" value={calcularIdade(u.dataNascimento) ? `${calcularIdade(u.dataNascimento)} ANOS` : '--'} color="text-pink-500" />
                                        <Detail icon={<Calendar size={18}/>} label="Conversão" value={u.dataConversao?.split('-').reverse().join('/') || '--'} color="text-blue-500" />
                                        <Detail icon={<ImageIcon size={18}/>} label="História" value={u.biografia || 'Sem biografia disponível.'} color="text-slate-500" />
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// COMPONENTES AUXILIARES
function ContagemCard({ icon, label, value, color, bg }) {
    return (
        <div className={`bg-white p-4 rounded-2xl border-2 border-slate-100 flex items-center gap-3 shadow-sm italic`}>
            <div className={`w-10 h-10 ${bg} ${color} rounded-xl flex items-center justify-center shrink-0`}>{icon}</div>
            <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1 italic">{label}</p><p className={`text-lg font-black text-slate-800 italic`}>{value}</p></div>
        </div>
    );
}

function Detail({ icon, label, value, color }) {
    return (
        <div className="flex items-center gap-3 h-14 min-w-0 italic">
            <div className={`shrink-0 p-3 bg-white rounded-2xl shadow-sm border border-slate-100 ${color}`}>{icon}</div>
            <div className="min-w-0 text-left">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1 truncate italic">{label}</p>
                <p className="text-xs text-slate-800 font-black truncate italic">{value || '--'}</p>
            </div>
        </div>
    );
}