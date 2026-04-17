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
      const q = query(
        usuariosRef,
        where("idAcesso", "in", [Number(idAcesso), String(idAcesso)]),
        where("senha", "==", senha)
      );

      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const usuarioDoc = querySnapshot.docs[0];
        const usuarioData = { id: String(usuarioDoc.id), ...usuarioDoc.data() };

        let permissoes = {};
        let cargoNome = usuarioData.cargoNome || 'Membro';

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
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-6 font-sans text-left relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-20 -left-32 w-96 h-96 rounded-full bg-royal/20 blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-32 -right-20 w-96 h-96 rounded-full bg-gold/10 blur-3xl pointer-events-none"></div>
      <div className="absolute inset-0 pattern-stained opacity-30 pointer-events-none"></div>

      <div className="max-w-md w-full bg-white p-10 rounded-[2.5rem] shadow-elegant border border-white/20 relative overflow-hidden animate-scale-in z-10">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-gold"></div>

        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-gradient-hero text-gold rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-elegant relative">
            <ShieldCheck size={40} strokeWidth={2} />
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-gold rounded-full flex items-center justify-center text-navy text-xs font-black shadow-gold">✛</div>
          </div>
          <p className="text-[10px] font-bold text-gold uppercase tracking-[0.3em] mb-2">Bem-vindo de volta</p>
          <h1 className="font-display text-4xl font-black text-navy tracking-tight">Igreja Pro</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-2">Gestão Pastoral & Financeira</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {erro && (
            <div className="bg-danger/5 border border-danger/20 text-danger p-4 rounded-2xl text-[11px] font-bold uppercase tracking-wider flex items-center gap-3 animate-fade-in">
              <AlertCircle size={18} /> {erro}
            </div>
          )}

          <div className="space-y-4">
            <div className="relative group">
              <label className="text-[10px] font-bold text-muted-foreground uppercase ml-4 mb-1.5 block tracking-[0.2em] leading-none">Matrícula</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-royal transition-all" size={18} />
                <input
                  required
                  type="number"
                  placeholder="ID DE ACESSO"
                  className="w-full bg-background border-2 border-transparent rounded-2xl py-5 pl-12 pr-4 text-sm font-bold text-navy outline-none focus:bg-white focus:border-royal transition-all"
                  value={idAcesso}
                  onChange={e => setIdAcesso(e.target.value)}
                />
              </div>
            </div>

            <div className="relative group">
              <label className="text-[10px] font-bold text-muted-foreground uppercase ml-4 mb-1.5 block tracking-[0.2em] leading-none">Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-royal transition-all" size={18} />
                <input
                  required
                  type="password"
                  placeholder="SUA SENHA"
                  className="w-full bg-background border-2 border-transparent rounded-2xl py-5 pl-12 pr-4 text-sm font-bold text-navy outline-none focus:bg-white focus:border-royal transition-all"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-gradient-hero text-white py-5 rounded-2xl font-bold uppercase text-xs tracking-[0.2em] shadow-elegant hover:shadow-gold active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:active:scale-100 relative overflow-hidden group"
          >
            <span className="absolute inset-0 bg-gradient-gold opacity-0 group-hover:opacity-10 transition-opacity"></span>
            {carregando ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                <LogIn size={18} /> <span className="relative">Entrar no Sistema</span>
              </>
            )}
          </button>

          <p className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-6">
            ✛ Sistema protegido por autenticação
          </p>
        </form>
      </div>
    </div>
  );
}
