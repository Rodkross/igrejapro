import React, { useState } from 'react';
import { X, Loader2, Save, UploadCloud, UserCircle, KeyRound, CheckCircle2 } from 'lucide-react';
import { db, storage } from '../database/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

export default function ModalMeuPerfil({ usuario, aoFechar }) {
  const [biografia, setBiografia] = useState(usuario?.biografia || '');
  const [senhaNova, setSenhaNova] = useState('');
  const [fotoUrlAtual] = useState(usuario?.fotoUrl || '');
  const [novoArquivoFoto, setNovoArquivoFoto] = useState(null);
  
  const [salvando, setSalvando] = useState(false);
  const [progressoUpload, setProgressoUpload] = useState(0);

  const handleFotoMuda = (e) => {
    if (e.target.files && e.target.files[0]) {
      const arquivo = e.target.files[0];
      if (!arquivo.type.startsWith('image/')) {
        alert('Selecione um arquivo de imagem válido.');
        e.target.value = '';
        return;
      }
      if (arquivo.size > 5 * 1024 * 1024) {
        alert('A imagem deve ter no máximo 5 MB.');
        e.target.value = '';
        return;
      }
      setNovoArquivoFoto(arquivo);
    }
  };

  const handleSalvar = async (e) => {
    e.preventDefault();

    if (senhaNova.trim() !== '' && senhaNova.length < 6) {
      alert('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setSalvando(true);

    try {
      let fotoFinalUrl = fotoUrlAtual;

      if (novoArquivoFoto) {
        const fileExtension = novoArquivoFoto.name.split('.').pop();
        const nomeArquivo = `perfil_${usuario.id}_${Date.now()}.${fileExtension}`;
        const storageRef = ref(storage, `fotos_membros/${nomeArquivo}`);

        const uploadTask = uploadBytesResumable(storageRef, novoArquivoFoto);

        fotoFinalUrl = await new Promise((resolve, reject) => {
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

      const payload = {
        biografia: biografia,
        fotoUrl: fotoFinalUrl,
      };

      if (senhaNova.trim() !== '') {
        payload.senha = senhaNova;
        payload.senhaPrecisaReset = false; // Se ele trocou por conta própria, não exigimos reset.
      }

      const docRef = doc(db, "usuarios", String(usuario.id));
      await setDoc(docRef, payload, { merge: true });

      aoFechar();
    } catch (error) {
      console.error("Erro ao salvar perfil:", error);
      alert("Houve um problema ao salvar seu perfil. Tente novamente.");
    } finally {
      setSalvando(false);
      setProgressoUpload(0);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col scale-in-95 animate-in duration-300">
        
        {/* Cabecalho Modal */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-3">
             <div className="p-2.5 bg-blue-100/50 text-blue-600 rounded-2xl">
               <UserCircle size={22} />
             </div>
             <div>
                <h2 className="text-xl font-black text-slate-800 uppercase italic leading-none">Meu Perfil</h2>
                <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase mt-1">Identidade Pessoal</p>
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

        <form onSubmit={handleSalvar} className="p-8 space-y-6 text-left max-h-[80vh] overflow-y-auto custom-scroll">
          
          {/* Foto de Perfil */}
          <div className="space-y-3">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Foto de Perfil</label>
            
            <div className="flex items-center gap-6 bg-slate-50 p-4 rounded-3xl border border-slate-100">
              <div className="w-24 h-24 rounded-[1.5rem] bg-white border-4 border-white shadow-soft flex items-center justify-center overflow-hidden relative group shrink-0">
                {novoArquivoFoto ? (
                   <img src={URL.createObjectURL(novoArquivoFoto)} alt="Preview Nova Foto" className="w-full h-full object-cover" />
                ) : fotoUrlAtual ? (
                   <img src={fotoUrlAtual} alt="Foto Atual" className="w-full h-full object-cover" />
                ) : (
                   <div className="w-full h-full bg-gradient-royal flex items-center justify-center text-white font-display text-4xl font-black">{usuario?.nome?.charAt(0) || 'U'}</div>
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <UploadCloud size={24} className="text-white" />
                </div>
              </div>

              <div className="flex-1 space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    id="uploadFotoPerfil"
                    className="hidden"
                    onChange={handleFotoMuda}
                  />
                  <label 
                    htmlFor="uploadFotoPerfil" 
                    className="inline-flex items-center gap-2 px-5 py-3 bg-blue-50 text-blue-600 rounded-xl font-black text-[10px] uppercase tracking-widest cursor-pointer hover:bg-blue-100 transition-colors shadow-sm"
                  >
                    <UploadCloud size={16} /> Trocar Foto
                  </label>
                  <p className="text-[10px] text-slate-400 font-medium">Recomendado: Imagem Rosto. Proporção quadrada ou câmera livre.</p>
              </div>
            </div>
          </div>

          {/* Biografia */}
          <div className="space-y-3">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sua Biografia / Sobre Você</label>
            <textarea 
              value={biografia}
              onChange={(e) => setBiografia(e.target.value)}
              placeholder="Conte um pouco sobre a sua vida para as outras pessoas..."
              rows={3}
              className="w-full border-2 border-slate-100 rounded-2xl px-5 py-4 outline-none resize-none focus:border-blue-500 font-bold bg-slate-50 text-sm italic text-slate-800 transition-all custom-scroll"
            />
          </div>

          {/* Senha */}
          <div className="space-y-3 pt-2">
            <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              <KeyRound size={12} className="text-slate-400" />
              Segurança
            </label>
            <div className="relative">
              <input 
                type="password"
                value={senhaNova}
                onChange={(e) => setSenhaNova(e.target.value)}
                placeholder="Deixar em branco para manter a senha atual"
                className="w-full border-2 border-slate-100 rounded-2xl px-5 py-4 outline-none focus:border-blue-500 font-bold bg-slate-50 text-sm text-slate-800 transition-all"
              />
              {senhaNova.length > 0 && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[9px] font-black text-green-500 uppercase tracking-widest bg-green-50 px-2 py-1 rounded-lg">
                  <CheckCircle2 size={12} /> Senha Alterada
                </div>
              )}
            </div>
          </div>

          {/* Botão de Salvar */}
          <button 
            type="submit" 
            disabled={salvando}
            className="w-full py-5 rounded-2xl bg-gradient-royal text-white font-black uppercase text-[12px] tracking-widest transition-all flex items-center justify-center gap-3 shadow-royal active:scale-95 disabled:opacity-75 disabled:active:scale-100 mt-4 border border-white/20"
          >
            {salvando ? (
              <>
                <Loader2 size={20} className="animate-spin"/> 
                Salvando suas preferências {progressoUpload > 0 ? `(${progressoUpload}%)` : '...'}
              </>
            ) : (
              <><Save size={20}/> Atualizar Meu Perfil</>
            )}
          </button>
          
        </form>

      </div>
    </div>
  );
}
