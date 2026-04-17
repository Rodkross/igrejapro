import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../database/firebase'; 
import { 
  collection, query, where, onSnapshot, 
  addDoc, doc, updateDoc, getDocs, limit, writeBatch, serverTimestamp
} from 'firebase/firestore';
import { 
  Search, Banknote, Landmark, ChevronDown, ChevronRight, 
  ReceiptText, Wallet, Loader2, CheckSquare, Square, Star, AlertCircle
} from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';

export default function ContasReceber() {
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('aberto'); 
  const [pessoaAberta, setPessoaAberta] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [contas, setContas] = useState([]);
  const [selecionados, setSelecionados] = useState([]); 
  const [mapaSaldos, setMapaSaldos] = useState({});
  
  const [pagamento, setPagamento] = useState({
    valorPago: '', 
    forma: 'Dinheiro', 
    data: new Date().toISOString().split('T')[0],
    usarCredito: false
  });

  const { alertModal } = useModal();

  // 1. Monitoramento Realtime
  useEffect(() => {
    const q = query(collection(db, "financeiro"), where("status", "==", filtroStatus));
    const unsub = onSnapshot(q, (snapshot) => {
      const dados = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const filtrados = dados.filter(c => {
        const cat = c.categoria?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() || '';
        return (cat === 'convenio' || cat === 'fiado') && c.tipo === 'entrada';
      });
      setContas(filtrados);
      setCarregando(false);
    });
    return () => unsub();
  }, [filtroStatus]);

  // 2. Busca Saldo da Carteira (Global e Realtime)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "saldosCredito"), (snap) => {
      const mapa = {};
      snap.docs.forEach(d => { 
        const nomeChave = d.data().origem?.trim().toUpperCase();
        const valorSaldo = Number(d.data().saldo || 0);
        if(nomeChave && valorSaldo >= 0) {
          // Se já existir, podemos somar ou só manter o mais recente, ideal é manter o ID para update.
          if(mapa[nomeChave]) {
             mapa[nomeChave].saldo += valorSaldo;
          } else {
             mapa[nomeChave] = { saldo: valorSaldo, id: d.id };
          }
        }
      });
      setMapaSaldos(mapa);
    });
    return () => unsub();
  }, []);

  const saldoDisponivel = useMemo(() => {
    if (!pessoaAberta) return 0;
    return mapaSaldos[pessoaAberta.trim().toUpperCase()]?.saldo || 0;
  }, [pessoaAberta, mapaSaldos]);

  // CORREÇÃO: AGRUPAMENTO COM NORMALIZAÇÃO DE NOME
  const devedoresAgrupados = useMemo(() => {
    const termo = filtroNome.toLowerCase();
    const grupos = contas.reduce((acc, curr) => {
      // Normalizamos o nome para agrupar independente de como foi escrito
      const nomeOriginal = curr.origem || 'SEM NOME';
      const nomeChave = nomeOriginal.trim().toUpperCase();

      if (!nomeChave.toLowerCase().includes(termo)) return acc;

      if (!acc[nomeChave]) {
        acc[nomeChave] = { 
          nome: nomeChave, // Exibimos em caixa alta para padronizar
          total: 0, 
          itens: [] 
        };
      }
      
      acc[nomeChave].total += Number(curr.valor);
      acc[nomeChave].itens.push(curr);
      return acc;
    }, {});
    
    return Object.values(grupos).sort((a, b) => b.total - a.total);
  }, [contas, filtroNome]);

  const totalSelecionado = useMemo(() => 
    Number(selecionados.reduce((acc, cur) => acc + Number(cur.valor), 0).toFixed(2))
  , [selecionados]);

  // LÓGICA DE ABATIMENTO E DIFERENÇA
  const vAbatimentoCredito = useMemo(() => 
    pagamento.usarCredito ? Math.min(saldoDisponivel, totalSelecionado) : 0
  , [pagamento.usarCredito, saldoDisponivel, totalSelecionado]);

  const diferencaACobrar = useMemo(() => 
    Number((totalSelecionado - vAbatimentoCredito).toFixed(2))
  , [totalSelecionado, vAbatimentoCredito]);

  // 3. Função de Baixa
  const confirmarRecebimento = async () => {
    const vDinheiroEmMaos = Number(String(pagamento.valorPago).replace(',', '.')) || 0;
    const vTotalSendoPago = Number((vDinheiroEmMaos + vAbatimentoCredito).toFixed(2));

    if (vTotalSendoPago <= 0) return await alertModal("Atenção", "Informe um valor para o pagamento!", "warning");

    const nomeMembro = selecionados[0]?.origem.trim().toUpperCase();
    const batch = writeBatch(db);

    try {
      if (vTotalSendoPago >= (totalSelecionado - 0.01)) {
        const trocoParaCredito = Number((vTotalSendoPago - totalSelecionado).toFixed(2));

        for (const item of selecionados) {
          batch.update(doc(db, "financeiro", item.id), { status: 'pago', dataBaixa: pagamento.data });
          if (item.convenioUuid) {
            const qC = query(collection(db, "convenio"), where("uuid", "==", item.convenioUuid));
            const sC = await getDocs(qC);
            sC.forEach(d => batch.update(doc(db, "convenio", d.id), { status: 'pago' }));
          }
        }

        const novoSaldo = Number(((saldoDisponivel - vAbatimentoCredito) + trocoParaCredito).toFixed(2));
        const creditoDocId = mapaSaldos[nomeMembro]?.id;
        
        if (creditoDocId) {
            batch.update(doc(db, "saldosCredito", creditoDocId), { saldo: novoSaldo, ultimaAtualizacao: new Date().toISOString() });
        } else if (novoSaldo > 0) {
            batch.set(doc(collection(db, "saldosCredito")), { origem: nomeMembro, saldo: novoSaldo, ultimaAtualizacao: new Date().toISOString() });
        }
      } 
      else {
        const restoDevedor = Number((totalSelecionado - vTotalSendoPago).toFixed(2));

        for (const item of selecionados) {
          batch.update(doc(db, "financeiro", item.id), { status: 'pago', dataBaixa: pagamento.data, nota: 'Liquidado via Parcial' });
          if (item.convenioUuid) {
            const qC = query(collection(db, "convenio"), where("uuid", "==", item.convenioUuid));
            const sC = await getDocs(qC);
            sC.forEach(d => batch.update(doc(db, "convenio", d.id), { status: 'pago' }));
          }
        }

        batch.set(doc(collection(db, "financeiro")), {
          origem: nomeMembro,
          valor: restoDevedor,
          descricao: `RESTANTE PENDENTE (REF. BAIXA PARCIAL)`,
          categoria: 'Convenio',
          status: 'aberto',
          tipo: 'entrada',
          dataCriacao: serverTimestamp(),
          vencimento: new Date().toISOString().split('T')[0]
        });

        if (pagamento.usarCredito) {
           const creditoDocId = mapaSaldos[nomeMembro]?.id;
           if (creditoDocId) {
               batch.update(doc(db, "saldosCredito", creditoDocId), { saldo: Math.max(0, saldoDisponivel - vAbatimentoCredito), ultimaAtualizacao: new Date().toISOString() });
           }
        }
      }

      if (vDinheiroEmMaos > 0.01) {
        batch.set(doc(collection(db, "financeiro")), {
          origem: nomeMembro,
          valor: vDinheiroEmMaos,
          descricao: `PGTO CONVÊNIO: ${selecionados.length} ITENS`,
          tipo: 'entrada',
          status: 'pago',
          formaPagamento: pagamento.forma,
          dataBaixa: pagamento.data,
          categoria: 'Receita Cantina',
          dataCriacao: serverTimestamp()
        });
      }

      await batch.commit();
      await alertModal("Sucesso", "Recebimento processado!", "success");
      setSelecionados([]); setPessoaAberta(null); setPagamento({ ...pagamento, valorPago: '', usarCredito: false });
    } catch (e) { await alertModal("Erro", "Erro na operação.", "danger"); }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-32 p-4 text-left font-sans italic min-h-screen bg-slate-50/20">
      <header className="flex flex-col md:flex-row justify-between items-center gap-4 border-b-2 border-slate-100 pb-6 text-left">
        <div className="text-left flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 rounded-2xl text-white shadow-xl"><ReceiptText size={28} /></div>
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic">Contas a Receber</h1>
        </div>
        <div className="flex bg-white border border-slate-200 p-1.5 rounded-2xl gap-1 italic">
          {['aberto', 'pago'].map(s => (
            <button key={s} onClick={() => { setFiltroStatus(s); setSelecionados([]); setPessoaAberta(null); }}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all italic ${filtroStatus === s ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}>
              {s === 'aberto' ? 'Pendentes' : 'Histórico'}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start italic">
        <div className="lg:col-span-2 space-y-4 italic">
          <div className="bg-white p-5 rounded-[2rem] border-2 border-slate-50 shadow-sm flex items-center gap-4 italic">
            <Search className="text-slate-300" size={24} />
            <input type="text" placeholder="PESQUISAR..." className="flex-1 bg-transparent outline-none font-black text-slate-800 uppercase italic"
              value={filtroNome} onChange={e => setFiltroNome(e.target.value)} />
          </div>

          {devedoresAgrupados.map(grupo => (
            <div key={grupo.nome} className="bg-white rounded-[2.5rem] border-2 border-slate-50 shadow-sm overflow-hidden italic">
              <button onClick={() => setPessoaAberta(pessoaAberta === grupo.nome ? null : grupo.nome)} className="w-full p-7 flex items-center justify-between hover:bg-slate-50 transition-all text-left italic">
                <div className="flex items-center gap-5 italic">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl bg-slate-900 text-white shadow-xl italic">{grupo.nome.charAt(0)}</div>
                  <div className="text-left italic">
                    <p className="font-black text-slate-900 uppercase italic text-lg">{grupo.nome}</p>
                    {pessoaAberta === grupo.nome && saldoDisponivel > 0 && (
                        <div className="flex items-center gap-1 mt-2 bg-emerald-50 px-2 py-1 rounded-lg w-fit border border-emerald-100 text-emerald-600 italic">
                             <Star size={12} className="fill-emerald-500" />
                             <span className="text-[9px] font-black uppercase italic">Crédito: R$ {saldoDisponivel.toFixed(2)}</span>
                        </div>
                    )}
                  </div>
                </div>
                <div className="text-right italic">
                  <p className="text-2xl font-black italic text-rose-600">R$ {grupo.total.toFixed(2)}</p>
                </div>
              </button>

              {pessoaAberta === grupo.nome && (
                <div className="bg-slate-50/30 p-6 border-t border-slate-50 space-y-3 italic">
                  {grupo.itens.map(item => (
                    <div key={item.id} onClick={() => filtroStatus === 'aberto' && (selecionados.find(s => s.id === item.id) ? setSelecionados(selecionados.filter(s => s.id !== item.id)) : setSelecionados([...selecionados, item]))}
                      className={`flex items-center justify-between p-5 rounded-[2rem] border-2 transition-all cursor-pointer italic ${selecionados.find(s => s.id === item.id) ? 'border-emerald-500 bg-emerald-50 shadow-md' : 'border-white bg-white shadow-sm'}`}>
                      <div className="flex items-center gap-4 italic">
                        {filtroStatus === 'aberto' && (selecionados.find(s => s.id === item.id) ? <CheckSquare className="text-emerald-600"/> : <Square className="text-slate-200"/>)}
                        <p className="font-black text-slate-800 uppercase text-xs italic">{item.descricao}</p>
                      </div>
                      <p className="font-black text-slate-900 italic">R$ {Number(item.valor).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="lg:col-span-1 sticky top-4 italic">
          <div className={`bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl border-b-[12px] transition-all italic ${selecionados.length > 0 ? 'border-emerald-600 opacity-100 scale-100' : 'border-slate-800 opacity-50 scale-95 pointer-events-none'}`}>
            <h2 className="text-[10px] font-black uppercase text-emerald-400 tracking-[0.3em] mb-8 italic">Finalizar Baixa</h2>
            
            <div className="space-y-5 italic">
              <div className="flex justify-between items-end border-b border-slate-800 pb-3 italic">
                <span className="text-[10px] font-black text-slate-500 uppercase italic">Selecionado:</span>
                <span className="text-2xl font-black italic text-white">R$ {totalSelecionado.toFixed(2)}</span>
              </div>

              {saldoDisponivel > 0 && (
                <button onClick={() => setPagamento({...pagamento, usarCredito: !pagamento.usarCredito})}
                    className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between transition-all italic ${pagamento.usarCredito ? 'bg-emerald-600/20 border-emerald-500' : 'bg-slate-800 border-slate-700'}`}>
                    <div className="flex items-center gap-2 italic">
                        <Star size={18} className={pagamento.usarCredito ? 'text-emerald-400 fill-emerald-400' : 'text-slate-600'} />
                        <span className="text-[10px] font-black uppercase italic">Abater Crédito</span>
                    </div>
                    <span className="font-black text-xs italic">- R$ {vAbatimentoCredito.toFixed(2)}</span>
                </button>
              )}

              {pagamento.usarCredito && (
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 text-center animate-in fade-in zoom-in duration-300 italic">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1 italic">Diferença a Receber em Mãos</p>
                  <p className={`text-3xl font-black italic tracking-tighter ${diferencaACobrar > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    R$ {diferencaACobrar.toFixed(2)}
                  </p>
                </div>
              )}

              <div className="space-y-3 italic">
                <div className="grid grid-cols-2 gap-2 italic">
                  <button onClick={() => setPagamento({...pagamento, forma: 'Dinheiro'})} className={`py-4 rounded-xl font-black text-[9px] uppercase border-2 flex flex-col items-center gap-1 italic ${pagamento.forma === 'Dinheiro' ? 'bg-emerald-600 border-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}><Banknote size={18}/> Dinheiro</button>
                  <button onClick={() => setPagamento({...pagamento, forma: 'Banco'})} className={`py-4 rounded-xl font-black text-[9px] uppercase border-2 flex flex-col items-center gap-1 italic ${pagamento.forma === 'Banco' ? 'bg-blue-600 border-blue-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}><Landmark size={18}/> Pix</button>
                </div>
                
                <div className="relative italic">
                   <label className="text-[9px] font-black text-slate-500 uppercase mb-2 block ml-2 italic">Recebido em Dinheiro/Pix:</label>
                   <input type="text" placeholder="0,00" className="w-full bg-slate-800 border-none rounded-2xl p-5 text-4xl font-black text-emerald-400 outline-none text-center italic tracking-tighter" 
                    value={pagamento.valorPago} onChange={e => setPagamento({...pagamento, valorPago: e.target.value})} />
                   
                   {diferencaACobrar > 0 && !pagamento.valorPago && (
                    <button onClick={() => setPagamento({...pagamento, valorPago: diferencaACobrar.toString()})} className="absolute right-3 bottom-3 bg-slate-700 text-[8px] font-black uppercase px-2 py-1 rounded text-slate-300 italic">Copiar Diferença</button>
                   )}
                </div>
              </div>

              <button onClick={confirmarRecebimento} className="w-full bg-emerald-600 py-6 rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-2xl hover:bg-emerald-500 active:scale-95 transition-all italic">
                {Number(String(pagamento.valorPago).replace(',','.')) + vAbatimentoCredito < totalSelecionado && Number(String(pagamento.valorPago).replace(',','.')) + vAbatimentoCredito > 0 ? 'Confirmar Baixa Parcial' : 'Confirmar Pagamento'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}