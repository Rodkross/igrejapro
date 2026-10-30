import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
// CORREÇÃO: O caminho precisa subir duas pastas para achar o database
import { db } from '../../database/firebase'; 
import { 
  collection, 
  writeBatch, 
  serverTimestamp, 
  doc 
} from 'firebase/firestore';
import { 
  ArrowRightLeft, MoveRight,
  Banknote, Plus, ArrowRight, Wallet, CheckCircle2, Loader2, ArrowLeftRight, Landmark 
} from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';

export default function Transferencias() {
  // Pega o usuário logado via OutletContext (contexto do Layout.jsx)
  const { usuario } = useOutletContext();
  
  const [carregando, setCarregando] = useState(false);
  const [formData, setFormData] = useState({
    valor: '',
    data: new Date().toISOString().split('T')[0],
    origem: 'Dinheiro',
    destino: 'Banco',
    observacao: ''
  });

  const { alertModal } = useModal();

  const executarTransferencia = async (e) => {
    e.preventDefault();
    
    // Validações básicas
    const valorNumerico = Number(String(formData.valor).replace(',', '.'));
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
      return await alertModal("Atenção", "Insira um valor válido!", "warning");
    }
    if (formData.origem === formData.destino) return await alertModal("Atenção", "A conta de origem deve ser diferente da conta de destino!", "warning");

    setCarregando(true);

    try {
      // Batch garante que ou grava os dois (entrada e saída) ou não grava nada
      const batch = writeBatch(db);
      const transferenciaId = crypto.randomUUID();
      // 1. LANÇAMENTO DE SAÍDA (Tira da Origem)
      const refSaida = doc(collection(db, "financeiro"));
      batch.set(refSaida, {
        descricao: `TRANSFERÊNCIA PARA ${formData.destino.toUpperCase()}`,
        valor: valorNumerico,
        tipo: 'saida',
        status: 'pago',
        formaPagamento: formData.origem,
        vencimento: formData.data,
        dataBaixa: formData.data,
        categoria: 'Transferência Interna',
        origem: 'TRANSFERÊNCIA',
        transferenciaRef: transferenciaId,
        usuarioNome: usuario?.nome || 'Sistema',
        createdAt: serverTimestamp()
      });

      // 2. LANÇAMENTO DE ENTRADA (Coloca no Destino)
      const refEntrada = doc(collection(db, "financeiro"));
      batch.set(refEntrada, {
        descricao: `TRANSFERÊNCIA DE ${formData.origem.toUpperCase()}`,
        valor: valorNumerico,
        tipo: 'entrada',
        status: 'pago',
        formaPagamento: formData.destino,
        vencimento: formData.data,
        dataBaixa: formData.data,
        categoria: 'Transferência Interna',
        origem: 'TRANSFERÊNCIA',
        transferenciaRef: transferenciaId,
        usuarioNome: usuario?.nome || 'Sistema',
        createdAt: serverTimestamp()
      });

      await batch.commit();

      await alertModal("Sucesso", "Transferência realizada com sucesso!", "success");

      // Limpa o valor para evitar duplicidade acidental
      setFormData({
        origem: 'Dinheiro',
        destino: 'Banco',
        valor: '',
        data: new Date().toISOString().split('T')[0],
        observacao: ''
      });

    } catch (error) {
      console.error("Erro na transferência:", error);
      await alertModal("Erro", "Erro ao processar transferência no banco de dados.", "danger");
    } finally {
      setCarregando(false);
    }
  };

  // Atalho para inverter origem/destino rapidamente
  const inverterContas = () => {
    setFormData(prev => ({
      ...prev,
      origem: prev.destino,
      destino: prev.origem
    }));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 text-left italic">
      <header className="flex flex-col md:flex-row justify-between items-center gap-4 border-b-2 border-slate-100 pb-6 text-left">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3 uppercase italic leading-none text-left">
            <ArrowRightLeft className="text-blue-600" size={28} />
            Transferência entre Contas
          </h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 italic text-left">Movimentação interna de recursos</p>
        </div>
      </header>

      {/* FORMULÁRIO */}
      <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden">
        <form onSubmit={executarTransferencia} className="relative z-10 space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-8">
            {/* ORIGEM */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest block">Conta de Origem (Sai)</label>
              <div 
                onClick={inverterContas} 
                className="cursor-pointer p-6 rounded-3xl border-2 border-slate-50 bg-slate-50 hover:border-blue-500 transition-all flex items-center gap-4 group"
              >
                <div className="p-3 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                  {formData.origem === 'Dinheiro' ? <Banknote className="text-emerald-500" /> : <Landmark className="text-indigo-500" />}
                </div>
                <span className="font-black text-slate-700 uppercase">{formData.origem}</span>
              </div>
            </div>

            {/* SETA INTERATIVA */}
            <div className="flex justify-center text-slate-200">
              <MoveRight size={48} strokeWidth={3} className="animate-pulse" />
            </div>

            {/* DESTINO */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest block">Conta de Destino (Entra)</label>
              <div 
                onClick={inverterContas}
                className="cursor-pointer p-6 rounded-3xl border-2 border-blue-100 bg-blue-50 hover:border-blue-500 transition-all flex items-center gap-4 group"
              >
                <div className="p-3 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                  {formData.destino === 'Dinheiro' ? <Banknote className="text-emerald-500" /> : <Landmark className="text-indigo-500" />}
                </div>
                <span className="font-black text-blue-600 uppercase">{formData.destino}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-slate-50 pt-8">
            {/* DATA */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest block">Data da Transferência</label>
              <input 
                type="date" 
                className="w-full border-2 border-slate-50 rounded-2xl px-5 py-4 font-bold bg-slate-50 outline-none focus:bg-white focus:border-slate-900 transition-all italic" 
                value={formData.data} 
                onChange={e => setFormData({...formData, data: e.target.value})} 
              />
            </div>

            {/* VALOR */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest block">Valor a Transferir</label>
              <div className="relative">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">R$</span>
                <input 
                  type="number" 
                  step="0.01" 
                  className="w-full border-2 border-slate-50 rounded-2xl pl-12 pr-6 py-4 font-black text-slate-900 bg-slate-50 focus:bg-white focus:border-slate-900 outline-none text-xl transition-all" 
                  value={formData.valor} 
                  onChange={e => setFormData({...formData, valor: e.target.value})} 
                  placeholder="0,00" 
                />
              </div>
            </div>
          </div>

          {/* BOTÃO */}
          <button 
            disabled={carregando} 
            className={`w-full flex items-center justify-center gap-3 py-6 rounded-[2rem] font-black uppercase tracking-[0.3em] text-[11px] transition-all shadow-xl ${
              carregando 
              ? 'bg-slate-100 text-slate-300' 
              : 'bg-slate-900 text-white hover:bg-blue-600 shadow-slate-200'
            }`}
          >
            {carregando ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                <CheckCircle2 size={20} />
                Efetuar Transferência Interna
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}