import React, { useState } from 'react';
import { db } from '../database/firebase'; 
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { LogIn, Lock, User, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';

export default function Login({ onLoginSucesso }) {
  const [idAcesso, setIdAcesso] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    try {
      const usuariosRef = collection(db, "usuarios");
      
      // BUSCA FLEXÍVEL: O operador 'in' permite testar se o idAcesso é 
      // o número 1 OU o texto "1". Isso resolve o conflito com int64.
      const q = query(
        usuariosRef, 
        where("idAcesso", "in", [Number(idAcesso), String(idAcesso)]), 
        where("senha", "==", senha)
      );

      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const usuarioDoc = querySnapshot.docs[0];
        
        // No Firebase, o ID do documento (a primeira coluna) é sempre String.
        // Convertemos para String para garantir que usuario.id === "1" funcione.
        const usuarioData = { id: String(usuarioDoc.id), ...usuarioDoc.data() };

        let permissoes = {};
        let cargoNome = usuarioData.cargoNome || 'Membro';

        // REGRA MESTRE: Suporte Master (Documento com ID "1")
        if (usuarioData.id === "1" || usuarioData.nome?.toLowerCase() === 'suporte') {
          cargoNome = "SISTEMA";
          permissoes = { admin: true }; 
        } else if (usuarioData.cargoId) {
          const cargoDocRef = doc(db, "cargos", String(usuarioData.cargoId));
          const cargoSnap = await getDoc(cargoDocRef);
          
          if (cargoSnap.exists()) {
            const dataCargo = cargoSnap.data();
            cargoNome = dataCargo.nome;
            permissoes = dataCargo.permissoes || {};
          }
        }

        const sessaoUsuario = { ...usuarioData, cargoNome, permissoes };
        sessionStorage.setItem('usuarioLogado', JSON.stringify(sessaoUsuario));
        
        if (onLoginSucesso) {
          onLoginSucesso(sessaoUsuario);
        }
      } else {
        setErro('MATRÍCULA OU SENHA INCORRETOS.');
      }
    } catch (err) {
      console.error("Erro detalhado do Firebase:", err);
      setErro('FALHA NA CONEXÃO. VERIFIQUE O CONSOLE (F12).');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6 font-sans text-left">
      <div className="max-w-md w-full bg-white p-10 rounded-[3.5rem] shadow-2xl border border-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-blue-600"></div>

        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
            <ShieldCheck size={40} strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Igreja Pro</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2 italic">Acesso Cloud</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {erro && (
            <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-2xl text-[10px] font-black uppercase flex items-center gap-3 animate-in fade-in slide-in-from-top-1 italic">
              <AlertCircle size={18} /> {erro}
            </div>
          )}

          <div className="space-y-4">
            <div className="relative group">
              <label className="text-[9px] font-black text-slate-400 uppercase ml-4 mb-1 block tracking-widest leading-none">Matrícula</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-all" size={20} />
                <input
                  required
                  type="number"
                  placeholder="ID DE ACESSO"
                  className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-5 pl-12 pr-4 text-xs font-black outline-none focus:bg-white focus:border-blue-500 transition-all"
                  value={idAcesso}
                  onChange={e => setIdAcesso(e.target.value)}
                />
              </div>
            </div>

            <div className="relative group">
              <label className="text-[9px] font-black text-slate-400 uppercase ml-4 mb-1 block tracking-widest leading-none">Segurança</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-all" size={20} />
                <input
                  required
                  type="password"
                  placeholder="SUA SENHA"
                  className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-5 pl-12 pr-4 text-xs font-black outline-none focus:bg-white focus:border-blue-500 transition-all"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-slate-900 text-white py-6 rounded-[2.5rem] font-black uppercase text-xs tracking-[0.2em] italic shadow-xl hover:bg-blue-600 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:active:scale-100"
          >
            {carregando ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                <LogIn size={20} /> Entrar no Sistema
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}