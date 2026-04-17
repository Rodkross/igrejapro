import { useState, useEffect } from 'react';
import { format } from 'date-fns';

const DURACAO_ANIMACAO = 25000; // 25 segundos
const CHAVE_STORAGE_PREFIX = 'igreja_pro_aniv_visto_';

export function useAniversarioAcesso(usuarioLogado) {
  const [exibirAniversario, setExibirAniversario] = useState(false);

  useEffect(() => {
    // Se não houver usuário ou ele já estiver vendo o modal, não faz nada
    if (!usuarioLogado || !usuarioLogado.dataNascimento || exibirAniversario) {
      return;
    }

    // CORREÇÃO DE FUSO: Split manual para evitar que o JS mude o dia no parseISO
    const partes = usuarioLogado.dataNascimento.split('-');
    const diaNasc = parseInt(partes[2], 10);
    const mesNasc = parseInt(partes[1], 10) - 1; // Meses no JS são 0-11

    const hoje = new Date();
    
    // 1. É aniversário HOJE?
    const eAniversarioHoje = diaNasc === hoje.getDate() && 
                             mesNasc === hoje.getMonth();

    if (eAniversarioHoje) {
      // 2. Verificou se já pediu para não mostrar HOJE?
      const hojeFormatado = format(hoje, 'yyyy-MM-dd');
      const chaveStorage = `${CHAVE_STORAGE_PREFIX}${usuarioLogado.id}`;
      const dataVisto = localStorage.getItem(chaveStorage);

      if (dataVisto !== hojeFormatado) {
        setExibirAniversario(true);
      }
    }
  }, [usuarioLogado]); // Removida a dependência de exibirAniversario para não entrar em loop

  const finalizarAniversario = (naoMostrarMaisHabilitado) => {
    setExibirAniversario(false);

    if (naoMostrarMaisHabilitado && usuarioLogado) {
      // Salva no localStorage que o usuário não quer ver mais HOJE
      const hojeFormatado = format(new Date(), 'yyyy-MM-dd');
      const chaveStorage = `${CHAVE_STORAGE_PREFIX}${usuarioLogado.id}`;
      localStorage.setItem(chaveStorage, hojeFormatado);
    }
  };

  return {
    exibirAniversario,
    finalizarAniversario,
    DURACAO_ANIMACAO
  };
}