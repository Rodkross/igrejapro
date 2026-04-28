import { useEffect, useRef } from 'react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../database/firebase';
import { useComunidadeAtividadeRecente } from './useComunidadeAtividadeRecente';

const getTimeValue = (timestamp) => {
  if (!timestamp) return null;
  if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
  if (timestamp instanceof Date) return timestamp.getTime();
  if (typeof timestamp?.seconds === 'number') {
    return (timestamp.seconds * 1000) + Math.floor((timestamp.nanoseconds || 0) / 1000000);
  }
  return null;
};

export function useComunidadeNaoVistos({ usuarioId, ultimaVisualizacao, estaNaComunidade }) {
  const marcouVisualizacaoRef = useRef(false);
  const atividadeRecente = useComunidadeAtividadeRecente({ usuarioId, ultimaVisualizacao });
  const naoVistos = estaNaComunidade
    ? 0
    : atividadeRecente.totalNovasPublicacoes + atividadeRecente.totalComentariosNovos;

  useEffect(() => {
    if (!usuarioId) {
      marcouVisualizacaoRef.current = false;
      return;
    }

    if (!estaNaComunidade) {
      marcouVisualizacaoRef.current = false;
      return;
    }

    if (marcouVisualizacaoRef.current) return;

    marcouVisualizacaoRef.current = true;

    const ultimaVisualizacaoAnterior = getTimeValue(ultimaVisualizacao);
    if (ultimaVisualizacaoAnterior) {
      sessionStorage.setItem('comunidadeUltimaVisualizacaoAnterior', String(ultimaVisualizacaoAnterior));
    } else {
      sessionStorage.removeItem('comunidadeUltimaVisualizacaoAnterior');
    }

    updateDoc(doc(db, 'usuarios', String(usuarioId)), {
      comunidadeUltimaVisualizacao: serverTimestamp()
    }).catch((error) => {
      console.error('Erro ao atualizar visualizacao da comunidade:', error);
      marcouVisualizacaoRef.current = false;
    });
  }, [estaNaComunidade, ultimaVisualizacao, usuarioId]);

  return naoVistos;
}
