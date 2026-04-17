import { useState, useEffect, useMemo } from 'react';
import { db } from '../database/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export function useSaldoConvenio(usuarioNome) {
  const [historico, setHistorico] = useState([]);
  const [pendenciasFin, setPendenciasFin] = useState([]);
  const [credito, setCredito] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!usuarioNome) return;
    const nomeLimpo = usuarioNome.trim();

    const unsubConv = onSnapshot(query(collection(db, "convenio"), where("usuarioNome", "==", nomeLimpo), where("status", "==", "pendente")), (snap) => {
      setHistorico(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubFin = onSnapshot(query(collection(db, "financeiro"), where("origem", "==", nomeLimpo), where("status", "==", "aberto"), where("categoria", "in", ["Convenio", "Fiado"])), (snap) => {
      setPendenciasFin(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(f => !f.convenioUuid));
      setLoading(false);
    });

    const unsubCred = onSnapshot(query(collection(db, "saldosCredito"), where("origem", "==", nomeLimpo)), (snap) => {
      setCredito(!snap.empty ? Number(snap.docs[0].data().saldo || 0) : 0);
    });

    return () => { unsubConv(); unsubFin(); unsubCred(); };
  }, [usuarioNome]);

  const saldoReal = useMemo(() => {
    const dividaTotal = historico.reduce((acc, h) => acc + Number(h.valorTotal), 0) + 
                        pendenciasFin.reduce((acc, p) => acc + Number(p.valor), 0);
    return Number((dividaTotal - credito).toFixed(2));
  }, [historico, pendenciasFin, credito]);

  return { saldoReal, historico, pendenciasFin, credito, loading };
}