import React, { useState } from 'react';
// Certifique-se de que está importando o db do arquivo que tem a config do Firebase
import { db } from '../../database/firebase'; 
import { collection, doc, setDoc } from 'firebase/firestore';
// Importação do seu JSON
import quizData from '../../database/quiz_biblico_250.json';
import { UploadCloud, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';

export default function ImportadorQuiz() {
  const [status, setStatus] = useState('parado');
  const [progresso, setProgresso] = useState(0);

  const importarUmPorUm = async () => {
    // Validação inicial para evitar erro se o JSON falhar
    if (!quizData || quizData.length === 0) {
      console.error("Arquivo JSON não carregado corretamente.");
      setStatus('erro');
      return;
    }

    setStatus('subindo');
    console.log("Iniciando gravação individual no Firestore...");
    
    try {
      let contador = 0;
      const total = quizData.length;

      // Loop assíncrono para gravar cada pergunta
      for (const item of quizData) {
        // Criando a referência do documento na coleção 'quiz_biblico'
        // Usamos String(item.id) para o Firestore aceitar como ID de documento
        const docRef = doc(db, "quiz_biblico", String(item.id));
        
        await setDoc(docRef, {
          pergunta: item.pergunta,
          opcoes: item.opcoes,
          resposta_correta: item.resposta_correta,
          referencia: item.referencia,
          ativo: true,
          sincronizadoEm: new Date().toISOString()
        });

        contador++;
        // Atualiza o progresso visualmente
        setProgresso(Math.round((contador / total) * 100));
      }

      console.log("Importação concluída com sucesso!");
      setStatus('sucesso');
    } catch (error) {
      console.error("ERRO CRÍTICO AO SALVAR NO FIRESTORE:", error);
      setStatus('erro');
    }
  };

  return (
    <div className="p-10 bg-slate-900 rounded-[3rem] border border-gold/20 text-center max-w-xl mx-auto italic shadow-2xl">
      <h2 className="text-white text-2xl font-black mb-6 uppercase tracking-tighter">Sincronizar Quiz</h2>
      
      {status === 'parado' && (
        <div className="space-y-4">
          <button 
            onClick={importarUmPorUm} 
            className="bg-gold text-navy px-10 py-5 rounded-2xl font-black uppercase flex items-center gap-3 mx-auto hover:bg-white transition-all shadow-xl active:scale-95"
          >
            <UploadCloud size={20} /> Iniciar Gravação ({quizData?.length || 0} itens)
          </button>
          <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">
            Destino: Google Firestore
          </p>
        </div>
      )}

      {status === 'subindo' && (
        <div className="flex flex-col items-center gap-4 py-4">
          <Loader2 className="text-gold animate-spin" size={40} />
          <p className="text-gold font-bold uppercase animate-pulse tracking-widest">
            Sincronizando: {progresso}%
          </p>
          <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden border border-white/5">
            <div 
              className="bg-gradient-to-r from-gold to-yellow-500 h-full transition-all duration-300 shadow-gold" 
              style={{ width: `${progresso}%` }}
            ></div>
          </div>
        </div>
      )}

      {status === 'sucesso' && (
        <div className="text-emerald-400 space-y-4 animate-in zoom-in duration-300">
          <CheckCircle size={50} className="mx-auto" />
          <p className="font-black uppercase tracking-widest text-lg">Sucesso!</p>
          <p className="text-slate-400 text-xs italic">A coleção 'quiz_biblico' foi populada corretamente.</p>
        </div>
      )}

      {status === 'erro' && (
        <div className="text-rose-500 space-y-4">
          <AlertTriangle size={50} className="mx-auto" />
          <p className="font-black uppercase tracking-widest text-lg">Erro na Gravação</p>
          <p className="text-white/40 text-[10px] mb-4">Verifique o console do navegador e as regras do Firebase.</p>
          <button 
            onClick={() => { setStatus('parado'); setProgresso(0); }} 
            className="bg-white/10 px-6 py-2 rounded-xl text-white text-xs uppercase font-bold hover:bg-white/20 transition-all"
          >
            Tentar de novo
          </button>
        </div>
      )}
    </div>
  );
}