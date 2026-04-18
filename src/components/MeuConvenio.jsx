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
    
    // O sistema de gestão do convênio (admin) salva o nome sempre em MAIÚSCULO.
    // É obrigatório fazer a query com a string em .toUpperCase() para haver MATCH perfeito.
    const nomeNormalizado = nomeReal.toUpperCase();

    const qConv = query(collection(db, "convenio"), where("usuarioNome", "==", nomeNormalizado), where("status", "==", "pendente"));
    const qFin = query(collection(db, "financeiro"), where("origem", "==", nomeNormalizado), where("status", "==", "aberto"), where("categoria", "in", ["Convenio", "Fiado"]));
    const qCred = collection(db, "saldosCredito"); // Busca tolerante

    const unsubConv = onSnapshot(qConv, (snap) => setItensConvenio(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubFin = onSnapshot(qFin, (snap) => {
      setRestosFinanceiro(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(f => !f.convenioUuid));
      setCarregando(false);
    });
    
    // Filtro manual + Captura e exibição de falhas silenciosas do Firebase
    const unsubCred = onSnapshot(qCred, (snap) => {
      const docsDoUsuario = snap.docs.filter(d => {
        const origemDb = d.data().origem || "";
        return origemDb.trim().toUpperCase() === nomeNormalizado;
      });
      const somaCreditos = docsDoUsuario.reduce((acc, d) => acc + Number(d.data().saldo || 0), 0);
      setValorCredito(somaCreditos);
    }, (error) => {
      alert("ERRO FIREBASE SALDOS: " + error.message);
      console.error("ERRO AO LER SALDOS: ", error);
    });

    return () => { unsubConv(); unsubFin(); unsubCred(); };
  }, [nomeReal]);

  const resumo = useMemo(() => {
    const lista = [];
    let totalDividas = 0;

    itensConvenio.forEach(i => {
      const v = Number(i.valorTotal);
      lista.push({ id: i.id, desc: i.produtoNome, valor: v, data: i.data, isCredito: false });
      totalDividas += v;
    });

    restosFinanceiro.forEach(r => {
      const v = Number(r.valor);
      lista.push({ id: r.id, desc: r.descricao || "Restante Pendente", valor: v, data: r.vencimento, isCredito: false });
      totalDividas += v;
    });

    if (valorCredito > 0) {
      lista.push({ 
        id: 'credito-abater', 
        desc: "Saldo de Crédito a Abater", 
        valor: -Math.abs(valorCredito), 
        data: new Date().toISOString().split('T')[0], 
        isCredito: true 
      });
    }

    const saldoLiquido = Number((totalDividas - valorCredito).toFixed(2));
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

      <div onClick={() => setExpandido(!expandido)} className={`p-4 md:p-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between cursor-pointer transition-colors ${config.bg}`}>
        <div className="flex items-center gap-3 md:gap-4 min-w-0 w-full md:w-auto">
          <div className={`hidden md:flex w-11 h-11 md:w-14 md:h-14 rounded-2xl items-center justify-center shrink-0 ${config.iconBg}`}>
            {resumo.total === 0 ? <HeartHandshake size={20} className="md:w-6 md:h-6" /> : <Wallet2 size={20} className="md:w-6 md:h-6" />}
          </div>
          <div className="text-left flex flex-col items-start gap-0.5 md:gap-1 min-w-0">
            <p className="text-[9px] md:text-[10px] font-bold text-gold uppercase tracking-[0.22em] md:tracking-[0.25em] leading-none mt-1">Cantina</p>
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="font-display text-lg md:text-xl font-bold text-navy leading-none truncate">Meu Convênio</h3>
            </div>
            <span className={`text-[9px] md:text-[10px] font-bold uppercase tracking-wide md:tracking-wider inline-block leading-tight mt-0.5 break-words ${config.text}`}>
              {getMensagemStatus()}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 md:gap-5 w-full md:w-auto shrink-0">
          <div className="text-left md:text-right min-w-0">
            <p className="text-[8px] md:text-[9px] font-bold text-muted-foreground uppercase tracking-[0.18em] md:tracking-widest leading-none mb-1">
              {config.label}
            </p>
            <p className={`font-display text-xl md:text-3xl font-black tracking-tight md:tracking-tighter leading-none break-words ${config.text}`}>
              R$ {Math.abs(resumo.total).toFixed(2)}
            </p>
          </div>
          <div className={`p-1.5 md:p-2 rounded-full bg-white/70 border border-slate-200 transition-transform duration-500 ${expandido ? 'rotate-180' : ''}`}>
            <ChevronDown size={14} className="text-muted-foreground md:w-4 md:h-4" />
          </div>
        </div>
      </div>

      {expandido && (
        <div className="px-4 md:px-6 pb-4 md:pb-6 pt-2 bg-white animate-fade-in">
          <div className="space-y-2 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <ReceiptText size={14} className="text-gold" />
              <span className="text-[9px] md:text-[10px] font-bold text-muted-foreground uppercase tracking-[0.18em] md:tracking-[0.2em]">Extrato</span>
            </div>

            {carregando ? (
              <div className="py-4 flex justify-center"><Loader2 className="animate-spin text-royal" /></div>
            ) : resumo.itens.length > 0 ? (
              resumo.itens.map((item) => (
                <div key={item.id} className={`flex items-center justify-between gap-3 p-3 md:p-3.5 bg-background rounded-2xl border ${item.isCredito ? 'border-success/20 bg-success/5 shadow-sm' : 'border-slate-100'}`}>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-9 h-9 bg-white rounded-xl flex items-center justify-center border border-slate-100 ${item.isCredito ? 'text-success' : 'text-royal'}`}>
                      {item.isCredito ? <Wallet2 size={14} /> : <Package size={14} />}
                    </div>
                    <div className="text-left leading-tight min-w-0 flex-1">
                      <p className={`font-display text-[13px] md:text-sm font-bold truncate ${item.isCredito ? 'text-success' : 'text-navy'}`}>{item.desc}</p>
                      <p className="text-[8px] md:text-[9px] text-muted-foreground font-bold uppercase tracking-wide md:tracking-wider mt-0.5">{item.data || 'Registrado'}</p>
                    </div>
                  </div>
                  <p className={`font-display text-sm md:text-base font-black tracking-tight shrink-0 whitespace-nowrap ${item.isCredito ? 'text-success' : 'text-navy'}`}>
                    {item.isCredito ? '-' : ''}R$ {Math.abs(item.valor).toFixed(2)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-center py-6 text-muted-foreground font-bold uppercase text-[9px] md:text-[10px] tracking-[0.18em] md:tracking-widest">Nenhum lançamento pendente</p>
            )}

            {resumo.total > 0 && (
              <div className="mt-5 p-4 bg-gradient-hero rounded-2xl flex items-center gap-3 shadow-elegant relative overflow-hidden">
                <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-gold/10 blur-2xl"></div>
                <div className="w-10 h-10 bg-gold/20 text-gold rounded-xl flex items-center justify-center shrink-0 border border-gold/30 relative z-10">
                  <CreditCard size={18} />
                </div>
                <p className="text-[9px] md:text-[10px] font-bold text-slate-300 uppercase leading-snug tracking-wide md:tracking-wider relative z-10">
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
