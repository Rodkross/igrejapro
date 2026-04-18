import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../database/firebase'; 
import { 
    collection, query, where, onSnapshot, 
    doc, updateDoc, getDocs, writeBatch, serverTimestamp
} from 'firebase/firestore';
import { 
    Wallet, Landmark, Banknote, RotateCcw, 
    ArrowRightLeft, ShoppingCart, 
    Loader2, Ban, Search, History, Activity
} from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';

export default function FluxoFinanceiro() {
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [filtroForma, setFiltroForma] = useState('Todos');
    const [filtroStatus, setFiltroStatus] = useState('pago'); // 'pago', 'cancelado' ou 'todos'
    const [pesquisou, setPesquisou] = useState(false);
    const [historicoFiltrado, setHistoricoFiltrado] = useState([]);
    
    const [movimentacoes, setMovimentacoes] = useState([]);
    const [todosConvenios, setTodosConvenios] = useState([]);
    const [todosCreditos, setTodosCreditos] = useState([]);
    const [carregando, setCarregando] = useState(true);

    useEffect(() => {
        // Escuta Financeiro Geral
        const qFinanceiro = query(collection(db, "financeiro"));
        const unsubFinanceiro = onSnapshot(qFinanceiro, (snapshot) => {
            setMovimentacoes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setCarregando(false);
        });

        // Escuta Convênio Pendente (Para o card de saldo a receber)
        const qConvenio = query(collection(db, "convenio"), where("status", "==", "pendente"));
        const unsubConvenio = onSnapshot(qConvenio, (snapshot) => {
            setTodosConvenios(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        // Escuta Saldos de Crédito (Para o card de saldo a receber)
        const unsubCreditos = onSnapshot(collection(db, "saldosCredito"), (snapshot) => {
            setTodosCreditos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => { unsubFinanceiro(); unsubConvenio(); unsubCreditos(); };
    }, []);

    // CÁLCULO DE SALDOS (IGNORA CANCELADOS)
    const saldos = useMemo(() => {
        const ativos = movimentacoes.filter(m => m.status === 'pago' && !m.cancelado && !m.convenioUuid);
        
        const calc = (list) => list.reduce((acc, cur) => 
            cur.tipo === 'entrada' ? acc + Number(cur.valor) : acc - Number(cur.valor), 0
        );

        const dividaBruta = todosConvenios.reduce((acc, cur) => acc + (Number(cur.valorTotal) || 0), 0);
        const totalCreditos = todosCreditos.reduce((acc, cur) => acc + (Number(cur.saldo) || 0), 0);
        const cantinaLiquida = dividaBruta - totalCreditos;

        return {
            banco: calc(ativos.filter(l => l.formaPagamento === 'Banco')),
            dinheiro: calc(ativos.filter(l => l.formaPagamento === 'Dinheiro')),
            total: calc(ativos),
            convenio: cantinaLiquida > 0 ? cantinaLiquida : 0
        };
    }, [movimentacoes, todosConvenios, todosCreditos]);

    const realizarBusca = () => {
        let result = movimentacoes.filter(l => !l.convenioUuid);
        
        if (dataInicio) result = result.filter(l => l.dataBaixa >= dataInicio);
        if (dataFim) result = result.filter(l => l.dataBaixa <= dataFim);
        if (filtroForma !== 'Todos') result = result.filter(l => l.formaPagamento === filtroForma);
        if (filtroStatus !== 'todos') result = result.filter(l => l.status === filtroStatus);
        
        setHistoricoFiltrado(result.sort((a, b) => new Date(b.dataBaixa + "T12:00:00") - new Date(a.dataBaixa + "T12:00:00")));
        setPesquisou(true);
    };

    const { confirmModal, alertModal } = useModal();

    const processarAcaoFinanceira = async (item) => {
        const isAvulso = item.origem === 'LANÇAMENTO MANUAL';
        const msg = isAvulso 
            ? "CANCELAR LANÇAMENTO MANUAL? Este valor será anulado permanentemente." 
            : "ESTORNAR PAGAMENTO? A conta original será REABERTA para novo pagamento.";

        if (!(await confirmModal('Confirmação de Estorno', msg, 'warning'))) return;

        try {
            const batch = writeBatch(db);

            if (!isAvulso) {
                // REGRA DE ESTORNO: Reabre a pendência original
                if (item.convenioUuid) {
                    const qConv = query(collection(db, "convenio"), where("uuid", "==", item.convenioUuid));
                    const snapConv = await getDocs(qConv);
                    snapConv.forEach(cd => batch.update(doc(db, "convenio", cd.id), { status: 'pendente' }));
                }
                
                // Volta o status para aberto para ser pago em outra data/forma
                batch.update(doc(db, "financeiro", item.id), { 
                    status: 'aberto', 
                    dataBaixa: null, 
                    cancelado: false 
                });
            } else {
                // REGRA DE CANCELAMENTO: Anula o registro manual definitivamente
                batch.update(doc(db, "financeiro", item.id), { 
                    status: 'cancelado', 
                    cancelado: true,
                    dataCancelamento: serverTimestamp() 
                });
            }

            await batch.commit();
            await alertModal("Operação Concluída", isAvulso ? "Lançamento cancelado!" : "Pagamento estornado e conta reaberta!", "success");
            realizarBusca();
        } catch (err) { await alertModal("Erro na Operação", "Ocorreu um erro no estorno.", "danger"); }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-12 p-4 text-left bg-slate-50/30 min-h-screen font-sans italic">
            {/* HEADER COM FILTRO DE AUDITORIA */}
            <header className="flex flex-col md:flex-row justify-between items-center gap-4 border-b-2 border-slate-100 pb-6 text-left">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3 uppercase italic leading-none text-left">
                        <Activity className="text-blue-600" size={28} />
                        Fluxo de Caixa
                    </h1>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 italic text-left">Auditoria e Conciliação</p>
                </div>

                <div className="flex bg-white border-2 border-slate-100 p-1.5 rounded-2xl gap-1">
                    {[
                        {id: 'todos', label: 'Histórico'},
                        {id: 'pago', label: 'Consolidados'},
                        {id: 'cancelado', label: 'Anulados'}
                    ].map(s => (
                        <button key={s.id} onClick={() => setFiltroStatus(s.id)}
                            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${filtroStatus === s.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}>
                            {s.label}
                        </button>
                    ))}
                </div>
            </header>

            {/* CARDS DE SALDO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-slate-900 p-7 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
                    <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Saldo Líquido (Realizado)</p>
                    <p className="text-3xl font-black tracking-tighter leading-none">R$ {saldos.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <Wallet className="absolute -right-4 -bottom-4 text-white/10" size={100} />
                </div>
                <div className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-100 flex items-center gap-4 shadow-sm">
                    <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl"><Landmark size={24} /></div>
                    <div className="text-left">
                        <p className="text-[10px] font-black text-slate-400 uppercase leading-none">Banco</p>
                        <p className="text-xl font-black text-slate-800 mt-1">R$ {saldos.banco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-100 flex items-center gap-4 shadow-sm">
                    <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl"><Banknote size={24} /></div>
                    <div className="text-left">
                        <p className="text-[10px] font-black text-slate-400 uppercase leading-none">Dinheiro</p>
                        <p className="text-xl font-black text-slate-800 mt-1">R$ {saldos.dinheiro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-[2.5rem] border-2 border-dashed border-slate-200 flex items-center gap-4 shadow-sm">
                    <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl"><ShoppingCart size={24} /></div>
                    <div className="text-left">
                        <p className="text-[10px] font-black text-rose-500 uppercase leading-none">A Receber Cantina</p>
                        <p className="text-xl font-black text-slate-800 mt-1">R$ {saldos.convenio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>
            </div>

            {/* FILTROS DE BUSCA */}
            <div className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex bg-slate-50 border-2 border-slate-50 p-1.5 rounded-2xl gap-1">
                        {['Todos', 'Banco', 'Dinheiro'].map(f => (
                            <button key={f} onClick={() => setFiltroForma(f)}
                                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${filtroForma === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>
                                {f}
                            </button>
                        ))}
                    </div>
                    <input type="date" className="bg-slate-50 border-2 border-slate-50 rounded-xl px-4 py-3 text-xs font-black outline-none" value={dataInicio} onChange={e => setDataInicio(e.target.value)}/>
                    <span className="text-slate-300 font-black">➔</span>
                    <input type="date" className="bg-slate-50 border-2 border-slate-50 rounded-xl px-4 py-3 text-xs font-black outline-none" value={dataFim} onChange={e => setDataFim(e.target.value)}/>
                </div>
                <button onClick={realizarBusca} className="w-full md:w-auto bg-slate-900 text-white px-10 py-4 rounded-2xl font-black uppercase text-xs tracking-widest italic shadow-xl shadow-slate-200">Consultar Fluxo</button>
            </div>

            {/* TABELA DE MOVIMENTAÇÕES */}
            <div className="bg-white rounded-[2.5rem] border-2 border-slate-100 overflow-hidden shadow-sm">
                {carregando ? (
                    <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-slate-900" size={40}/></div>
                ) : pesquisou && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                    <th className="p-7">Data / Meio</th>
                                    <th className="p-7">Descrição / Origem</th>
                                    <th className="p-7 text-right">Valor</th>
                                    <th className="p-7 text-center">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {historicoFiltrado.map(l => (
                                    <tr key={l.id} className={`transition-all ${l.status === 'cancelado' ? 'bg-slate-50 opacity-40' : 'hover:bg-slate-50/50 group'}`}>
                                        <td className="p-7">
                                            <p className="text-xs font-black text-slate-800">{new Date(l.dataBaixa + "T12:00:00").toLocaleDateString('pt-BR')}</p>
                                            <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase mt-1 inline-block ${l.formaPagamento === 'Banco' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>{l.formaPagamento}</span>
                                        </td>
                                        <td className="p-7">
                                            <p className={`font-black uppercase italic text-xs leading-none ${l.status === 'cancelado' ? 'line-through text-slate-400' : 'text-slate-900'}`}>{l.origem}</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-2">{l.descricao}</p>
                                        </td>
                                        <td className={`p-7 text-right font-black italic text-lg ${l.status === 'cancelado' ? 'text-slate-300' : l.tipo === 'entrada' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {l.tipo === 'entrada' ? '+ ' : '- '} R$ {Number(l.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-7 text-center">
                                            {l.status === 'cancelado' ? (
                                                <span className="text-[10px] font-black text-slate-300 uppercase border border-slate-200 px-3 py-1 rounded-lg">Anulado</span>
                                            ) : (
                                                <button onClick={() => processarAcaoFinanceira(l)} className="opacity-0 group-hover:opacity-100 p-2.5 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm">
                                                    <RotateCcw size={18}/>
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}