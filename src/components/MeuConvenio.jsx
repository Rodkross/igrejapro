import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../database/firebase'; 
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { 
  ChevronDown, CreditCard, History, 
  Package, Star, Loader2, Wallet2, ReceiptText, HeartHandshake
} from 'lucide-react';

export default function MeuConvenio({ usuarioNome, usuarioLogado }) {
  const [expandido, setExpandido] = useState(false);
  const [carregando, setCarregando] = useState(true);
  
  const [itensConvenio, setItensConvenio] = useState([]);
  const [restosFinanceiro, setRestosFinanceiro] = useState([]);
  const [valorCredito, setValorCredito] = useState(0);

  const nomeReal = useMemo(() => {
    return (usuarioNome || usuarioLogado?.nome || "").trim();
  }, [usuarioNome, usuarioLogado]);

  useEffect(() => {
    if (!nomeReal) return;

    const qConv = query(collection(db, "convenio"), where("usuarioNome", "==", nomeReal), where("status", "==", "pendente"));
    const qFin = query(collection(db, "financeiro"), where("origem", "==", nomeReal), where("status", "==", "aberto"), where("categoria", "in", ["Convenio", "Fiado"]));
    const qCred = query(collection(db, "saldosCredito"), where("origem", "==", nomeReal));

    const unsubConv = onSnapshot(qConv, (snap) => setItensConvenio(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubFin = onSnapshot(qFin, (snap) => {
      setRestosFinanceiro(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(f => !f.convenioUuid));
      setCarregando(false);
    });
    const unsubCred = onSnapshot(qCred, (snap) => setValorCredito(!snap.empty ? Number(snap.docs[0].data().saldo || 0) : 0));

    return () => { unsubConv(); unsubFin(); unsubCred(); };
  }, [nomeReal]);

  const resumo = useMemo(() => {
    const lista = [];
    itensConvenio.forEach(i => lista.push({ id: i.id, desc: i.produtoNome, valor: Number(i.valorTotal), data: i.data }));
    restosFinanceiro.forEach(r => lista.push({ id: r.id, desc: r.descricao || "Restante Pendente", valor: Number(r.valor), data: r.vencimento }));
    
    const saldoLiquido = Number((lista.reduce((acc, cur) => acc + cur.valor, 0) - valorCredito).toFixed(2));
    return { total: saldoLiquido, itens: lista.sort((a, b) => new Date(b.data) - new Date(a.data)), temCredito: saldoLiquido < 0 };
  }, [itensConvenio, restosFinanceiro, valorCredito]);

  // --- LÓGICA DE RESPOSTAS DINÂMICAS ---
  const getMensagemStatus = () => {
    if (resumo.total > 0) return "Há pendências para acertar";
    if (resumo.total < 0) return "Você possui saldo positivo";
    return "Sua conta está em dia";
  };

  if (!nomeReal) return null;

  const estilo = {
    devedor: { bg: 'bg-rose-50', icon: 'bg-white text-rose-500', text: 'text-rose-600', border: 'border-rose-100' },
    credito: { bg: 'bg-emerald-50', icon: 'bg-white text-emerald-500', text: 'text-emerald-600', border: 'border-emerald-100' },
    zerado: { bg: 'bg-slate-50', icon: 'bg-white text-slate-400', text: 'text-slate-600', border: 'border-slate-100' }
  };

  const status = resumo.total > 0 ? 'devedor' : resumo.total < 0 ? 'credito' : 'zerado';
  const config = estilo[status];

  return (
    <div className={`group bg-white rounded-[2.5rem] border transition-all duration-500 overflow-hidden italic ${expandido ? 'border-slate-300 shadow-2xl' : 'border-slate-100 shadow-sm'}`}>
      
      <div onClick={() => setExpandido(!expandido)} className={`p-5 flex items-center justify-between cursor-pointer transition-colors ${config.bg}`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${config.icon}`}>
            {resumo.total === 0 ? <HeartHandshake size={22} /> : <Wallet2 size={22} />}
          </div>
          <div className="text-left">
            <h3 className="font-black text-slate-700 uppercase tracking-tighter text-base leading-none">Cantina</h3>
            <span className={`text-[10px] font-bold uppercase tracking-tight ${config.text}`}>
              {getMensagemStatus()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className="text-right">
            <p className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">
              {resumo.temCredito ? 'Crédito' : 'A pagar'}
            </p>
            <p className={`text-xl font-black tracking-tighter flex items-center gap-1.5 justify-end ${config.text}`}>
              R$ {Math.abs(resumo.total).toFixed(2)}
            </p>
          </div>
          <div className={`p-2 rounded-full bg-white/50 border ${config.border} transition-transform duration-500 ${expandido ? 'rotate-180' : ''}`}>
            <ChevronDown size={16} className="text-slate-400" />
          </div>
        </div>
      </div>

      {expandido && (
        <div className="px-6 pb-6 bg-white animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="space-y-2 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <ReceiptText size={14} className="text-slate-300" />
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Extrato Simples</span>
            </div>

            {carregando ? (
              <div className="py-4 flex justify-center"><Loader2 className="animate-spin text-slate-200" /></div>
            ) : resumo.itens.length > 0 ? (
              resumo.itens.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3.5 bg-slate-50/50 rounded-2xl border border-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-300 border border-slate-100"><Package size={14} /></div>
                    <div className="text-left leading-tight">
                      <p className="text-[11px] font-black text-slate-700 uppercase tracking-tight">{item.desc}</p>
                      <p className="text-[8px] text-slate-400 font-bold uppercase">{item.data || 'Registrado'}</p>
                    </div>
                  </div>
                  <p className="text-xs font-black text-slate-800 tracking-tighter">R$ {item.valor.toFixed(2)}</p>
                </div>
              ))
            ) : (
              <p className="text-center py-6 text-slate-300 font-black uppercase text-[9px]">Nenhum lançamento pendente</p>
            )}

            {resumo.total > 0 && (
              <div className="mt-5 p-4 bg-slate-900 rounded-[1.8rem] flex items-center gap-3 shadow-lg">
                <div className="w-9 h-9 bg-rose-500/10 text-rose-400 rounded-xl flex items-center justify-center shrink-0 border border-rose-500/20">
                  <CreditCard size={18} />
                </div>
                <p className="text-[9px] font-black text-slate-400 uppercase leading-snug">
                  Valor total em aberto. <br/>
                  <span className="text-white">Fale com a tesouraria para pagar.</span>
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}