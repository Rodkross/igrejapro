import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../database/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import {
  ChevronDown, CreditCard,
  Package, Loader2, Wallet2, ReceiptText, HeartHandshake
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

  const getMensagemStatus = () => {
    if (resumo.total > 0) return "Há pendências para acertar";
    if (resumo.total < 0) return "Você possui saldo positivo";
    return "Sua conta está em dia";
  };

  if (!nomeReal) return null;

  // Estilos premium por status
  const status = resumo.total > 0 ? 'devedor' : resumo.total < 0 ? 'credito' : 'zerado';
  const estilo = {
    devedor: {
      bg: 'bg-gradient-to-br from-danger/5 to-white',
      iconBg: 'bg-danger/10 text-danger border border-danger/20',
      text: 'text-danger',
      label: 'A pagar',
    },
    credito: {
      bg: 'bg-gradient-to-br from-success/5 to-white',
      iconBg: 'bg-success/10 text-success border border-success/20',
      text: 'text-success',
      label: 'Crédito',
    },
    zerado: {
      bg: 'bg-gradient-to-br from-gold/5 to-white',
      iconBg: 'bg-gold/10 text-gold border border-gold/20',
      text: 'text-navy',
      label: 'Em dia',
    },
  };
  const config = estilo[status];

  return (
    <div className={`group rounded-3xl border transition-all duration-500 overflow-hidden ${expandido ? 'border-slate-200 shadow-elegant' : 'border-slate-100 shadow-soft'}`}>

      <div onClick={() => setExpandido(!expandido)} className={`p-6 flex items-center justify-between cursor-pointer transition-colors ${config.bg}`}>
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${config.iconBg}`}>
            {resumo.total === 0 ? <HeartHandshake size={24} /> : <Wallet2 size={24} />}
          </div>
          <div className="text-left">
            <p className="text-[10px] font-bold text-gold uppercase tracking-[0.25em] mb-1">Cantina</p>
            <h3 className="font-display text-xl font-bold text-navy leading-none">Meu Convênio</h3>
            <span className={`text-[10px] font-bold uppercase tracking-wider mt-1 inline-block ${config.text}`}>
              {getMensagemStatus()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className="text-right">
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1.5">
              {config.label}
            </p>
            <p className={`font-display text-3xl font-black tracking-tighter leading-none ${config.text}`}>
              R$ {Math.abs(resumo.total).toFixed(2)}
            </p>
          </div>
          <div className={`p-2 rounded-full bg-white/70 border border-slate-200 transition-transform duration-500 ${expandido ? 'rotate-180' : ''}`}>
            <ChevronDown size={16} className="text-muted-foreground" />
          </div>
        </div>
      </div>

      {expandido && (
        <div className="px-6 pb-6 pt-2 bg-white animate-fade-in">
          <div className="space-y-2 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <ReceiptText size={14} className="text-gold" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Extrato</span>
            </div>

            {carregando ? (
              <div className="py-4 flex justify-center"><Loader2 className="animate-spin text-royal" /></div>
            ) : resumo.itens.length > 0 ? (
              resumo.itens.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3.5 bg-background rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center text-royal border border-slate-100"><Package size={14} /></div>
                    <div className="text-left leading-tight">
                      <p className="font-display text-sm font-bold text-navy">{item.desc}</p>
                      <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">{item.data || 'Registrado'}</p>
                    </div>
                  </div>
                  <p className="font-display font-black text-navy tracking-tight">R$ {item.valor.toFixed(2)}</p>
                </div>
              ))
            ) : (
              <p className="text-center py-6 text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Nenhum lançamento pendente</p>
            )}

            {resumo.total > 0 && (
              <div className="mt-5 p-4 bg-gradient-hero rounded-2xl flex items-center gap-3 shadow-elegant relative overflow-hidden">
                <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-gold/10 blur-2xl"></div>
                <div className="w-10 h-10 bg-gold/20 text-gold rounded-xl flex items-center justify-center shrink-0 border border-gold/30 relative z-10">
                  <CreditCard size={18} />
                </div>
                <p className="text-[10px] font-bold text-slate-300 uppercase leading-snug tracking-wider relative z-10">
                  Valor total em aberto.<br/>
                  <span className="text-gold">Fale com a tesouraria para pagar.</span>
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
