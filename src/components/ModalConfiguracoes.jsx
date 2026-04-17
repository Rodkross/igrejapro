import React, { useState, useEffect } from 'react';
import { X, Image as ImageIcon, Loader2, Save, UploadCloud, Settings } from 'lucide-react';
import { db, storage } from '../database/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

export default function ModalConfiguracoes({ aoFechar }) {
  const [nome, setNome] = useState('');
  const [logoUrlAtual, setLogoUrlAtual] = useState('');
  const [novoArquivoFoto, setNovoArquivoFoto] = useState(null);
  
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [progressoUpload, setProgressoUpload] = useState(0);

  // 1. CARREGAR CONFIGURAÇÕES ATUAIS AO ABRIR O MODAL
  useEffect(() => {
    const carregarConfiguracoes = async () => {
      try {
        const docRef = doc(db, "configuracoes", "geral");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const dados = docSnap.data();
          setNome(dados.igrejaNome || '');
          setLogoUrlAtual(dados.igrejaLogo || '');
        }
      } catch (error) {
        console.error("Erro ao carregar configurações globais:", error);
      } finally {
        setCarregando(false);
      }
    };
    
    carregarConfiguracoes();
  }, []);

  const handleFotoMuda = (e) => {
    if (e.target.files && e.target.files[0]) {
      setNovoArquivoFoto(e.target.files[0]);
    }
  };

  const handleSalvar = async (e) => {
    e.preventDefault();
    setSalvando(true);
    
    try {
      let logoFinalUrl = logoUrlAtual;

      // Se selecionou foto nova, faz o upload para 'logosSistema'
      if (novoArquivoFoto) {
        const fileExtension = novoArquivoFoto.name.split('.').pop();
        const nomeArquivo = `logo_igreja_${Date.now()}.${fileExtension}`;
        const storageRef = ref(storage, `logosSistema/${nomeArquivo}`);
        
        const uploadTask = uploadBytesResumable(storageRef, novoArquivoFoto);

        // Aguarda o upload terminar usando uma Promise manual
        logoFinalUrl = await new Promise((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setProgressoUpload(Math.round(progress));
            },
            (err) => reject(err),
            async () => {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(url);
            }
          );
        });
      }

      // Salva no Firestore
      const docRef = doc(db, "configuracoes", "geral");
      await setDoc(docRef, {
        igrejaNome: nome.trim(),
        igrejaLogo: logoFinalUrl,
        atualizadoEm: new Date().toISOString()
      }, { merge: true }); // Usamos merge para preservar outras futuras configurações se houver

      aoFechar(); // Fecha e UI reflete
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      alert("Houve um problema ao salvar as configurações. Tente novamente.");
    } finally {
      setSalvando(false);
      setProgressoUpload(0);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col scale-in-95 animate-in duration-300">
        
        {/* Cabecalho Modal */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-3">
             <div className="p-2.5 bg-blue-100/50 text-blue-600 rounded-2xl">
               <Settings size={22} />
             </div>
             <div>
                <h2 className="text-xl font-black text-slate-800 uppercase italic leading-none">Configurações</h2>
                <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase mt-1">Identidade do Sistema</p>
             </div>
          </div>
          <button 
            onClick={aoFechar} 
            disabled={salvando}
            className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-full transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {carregando ? (
          <div className="p-20 flex flex-col items-center justify-center space-y-4">
             <Loader2 size={32} className="text-blue-500 animate-spin" />
             <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Carregando...</p>
          </div>
        ) : (
          <form onSubmit={handleSalvar} className="p-8 space-y-6 text-left">
            
            {/* Logo */}
            <div className="space-y-3">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Logo da Igreja</label>
              
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden relative group shrink-0">
                  {novoArquivoFoto ? (
                     <img src={URL.createObjectURL(novoArquivoFoto)} alt="Preview Nova Logo" className="w-full h-full object-contain p-2" />
                  ) : logoUrlAtual ? (
                     <img src={logoUrlAtual} alt="Logo Atual" className="w-full h-full object-contain p-2" />
                  ) : (
                     <ImageIcon size={32} className="text-slate-300" />
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <UploadCloud size={24} className="text-white" />
                  </div>
                </div>

                <div className="flex-1 space-y-2">
                    <input
                      type="file"
                      accept="image/*"
                      id="uploadLogo"
                      className="hidden"
                      onChange={handleFotoMuda}
                    />
                    <label 
                      htmlFor="uploadLogo" 
                      className="inline-flex items-center gap-2 px-5 py-3 bg-blue-50 text-blue-600 rounded-xl font-black text-[10px] uppercase tracking-widest cursor-pointer hover:bg-blue-100 transition-colors"
                    >
                      <UploadCloud size={16} /> Trocar Logo
                    </label>
                    <p className="text-[10px] text-slate-400 font-medium">Recomendado: Imagem PNG com fundo transparente. Proporção flexível.</p>
                </div>
              </div>
            </div>

            {/* Nome */}
            <div className="space-y-3">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome da Igreja (Texto)</label>
              <input 
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Igreja Metodista"
                className="w-full border-2 border-slate-100 rounded-2xl px-5 py-4 outline-none focus:border-blue-500 font-bold bg-slate-50 uppercase italic text-slate-800 transition-all"
              />
            </div>

            {/* Botão de Salvar */}
            <button 
              type="submit" 
              disabled={salvando}
              className="w-full py-5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[12px] tracking-widest transition-all flex items-center justify-center gap-3 shadow-lg shadow-blue-200 active:scale-95 disabled:opacity-75 disabled:active:scale-100 mt-4"
            >
              {salvando ? (
                <>
                  <Loader2 size={20} className="animate-spin"/> 
                  Salvando Identidade {progressoUpload > 0 ? `(${progressoUpload}%)` : '...'}
                </>
              ) : (
                <><Save size={20}/> Aplicar Nova Identidade</>
              )}
            </button>
            
          </form>
        )}
      </div>
    </div>
  );
}
