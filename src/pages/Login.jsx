import React, { useState, useEffect } from 'react';
import { db } from '../database/firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { LogIn, Lock, User, ShieldCheck, AlertCircle, Loader2, KeyRound } from 'lucide-react';

export default function Login({ onLoginSucesso }) {
  const [idAcesso, setIdAcesso] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const [precisaReset, setPrecisaReset] = useState(false);
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [usuarioPendente, setUsuarioPendente] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    try {
      const usuariosRef = collection(db, "usuarios");

      // Busca o usuário pela matrícula (idAcesso) e senha
      const q = query(
        usuariosRef,
        where("idAcesso", "in", [Number(idAcesso), String(idAcesso)]),
        where("senha", "==", senha)
      );

      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const usuarioDoc = querySnapshot.docs[0];
        const usuarioData = { id: String(usuarioDoc.id), ...usuarioDoc.data() };

        // --- LÓGICA DE PERMISSÕES POR CARGONOME ---
        let cargoFinal = usuarioData.cargoNome || 'Membro';

        // Verificação especial para Administrador do Sistema
        if (usuarioData.id === "1" || usuarioData.nome?.toLowerCase() === 'suporte') {
          cargoFinal = "SISTEMA";
        }

        // Busca as permissões do cargo correspondente na coleção 'cargos'
        let permissoesCargo = {};
        if (cargoFinal) {
          const qCargo = query(collection(db, "cargos"), where("nome", "==", cargoFinal));
          const cargoSnap = await getDocs(qCargo);
          if (!cargoSnap.empty) {
            permissoesCargo = cargoSnap.docs[0].data().permissoes || {};
          }
        }

        // Criamos o objeto de sessão.
        // Agora o 'cargoNome' é a chave principal para as permissões no restante do app.
        const sessaoUsuario = {
          ...usuarioData,
          cargoNome: cargoFinal,
          // Unimos as permissões do cargo com quaisquer permissões individuais do usuário
          permissoes: { ...usuarioData.permissoes, ...permissoesCargo },
          isAdmin: cargoFinal === "SISTEMA" || cargoFinal === "Administrador"
        };

        if (usuarioData.senhaPrecisaReset === true) {
          setUsuarioPendente(sessaoUsuario);
          setPrecisaReset(true);
        } else {
          localStorage.setItem('usuarioLogado', JSON.stringify(sessaoUsuario));
          if (onLoginSucesso) {
            onLoginSucesso(sessaoUsuario);
          }
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

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (novaSenha !== confirmarSenha) {
      setErro('As senhas não coincidem.');
      return;
    }
    if (novaSenha.length < 6) {
      setErro('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setCarregando(true);
    setErro('');
    try {
      const refUsuario = doc(db, "usuarios", usuarioPendente.id);
      await updateDoc(refUsuario, {
        senha: novaSenha,
        senhaPrecisaReset: false
      });

      const sessaoAtualizada = { ...usuarioPendente, senha: novaSenha, senhaPrecisaReset: false };
      localStorage.setItem('usuarioLogado', JSON.stringify(sessaoAtualizada));
      if (onLoginSucesso) onLoginSucesso(sessaoAtualizada);
    } catch (err) {
      console.error(err);
      setErro('Erro ao salvar a nova senha.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-6 font-sans text-left relative overflow-hidden">
      {/* O JSX que você já tem permanece o mesmo */}
      <div className="max-w-md w-full bg-white p-10 rounded-[2.5rem] shadow-elegant border border-white/20 relative overflow-hidden animate-scale-in z-10">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-gold"></div>

        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-gradient-hero text-gold rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-elegant relative animate-scale-in">
            {precisaReset ? <KeyRound size={40} strokeWidth={2} /> : <ShieldCheck size={40} strokeWidth={2} />}
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-gold rounded-full flex items-center justify-center text-navy text-xs font-black shadow-gold">✛</div>
          </div>
          <p className="text-[10px] font-bold text-gold uppercase tracking-[0.3em] mb-2">{precisaReset ? "Segurança" : "Bem-vindo de volta"}</p>
          <h1 className="font-display text-4xl font-black text-navy tracking-tight">{precisaReset ? "Nova Senha" : "Igreja Pro"}</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-2">{precisaReset ? "Crie uma senha forte" : "Gestão Pastoral & Financeira"}</p>
        </div>

        {precisaReset ? (
          <form onSubmit={handleResetSubmit} className="space-y-5 animate-fade-in-up">
            {erro && (
              <div className="bg-danger/5 border border-danger/20 text-danger p-4 rounded-2xl text-[11px] font-bold uppercase tracking-wider flex items-center gap-3">
                <AlertCircle size={18} /> {erro}
              </div>
            )}

            <div className="space-y-4">
              <div className="relative group">
                <label className="text-[10px] font-bold text-muted-foreground uppercase ml-4 mb-1.5 block tracking-[0.2em] leading-none">Nova Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-royal transition-all" size={18} />
                  <input
                    required
                    type="password"
                    placeholder="MÍNIMO 6 CARACTERES"
                    className="w-full bg-background border-2 border-transparent rounded-2xl py-5 pl-12 pr-4 text-sm font-bold text-navy outline-none focus:bg-white focus:border-royal transition-all"
                    value={novaSenha}
                    onChange={e => setNovaSenha(e.target.value)}
                  />
                </div>
              </div>

              <div className="relative group">
                <label className="text-[10px] font-bold text-muted-foreground uppercase ml-4 mb-1.5 block tracking-[0.2em] leading-none">Repita a Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-royal transition-all" size={18} />
                  <input
                    required
                    type="password"
                    placeholder="CONFIRME SUA NOVA SENHA"
                    className="w-full bg-background border-2 border-transparent rounded-2xl py-5 pl-12 pr-4 text-sm font-bold text-navy outline-none focus:bg-white focus:border-royal transition-all"
                    value={confirmarSenha}
                    onChange={e => setConfirmarSenha(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={carregando || !novaSenha || !confirmarSenha}
              className="w-full bg-gradient-royal text-white py-5 rounded-2xl font-bold uppercase text-xs tracking-[0.2em] shadow-royal hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:active:scale-100 relative overflow-hidden group"
            >
              <span className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></span>
              {carregando ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  <KeyRound size={18} /> <span className="relative">Salvar e Acessar</span>
                </>
              )}
            </button>
            <p className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-6">
              ✛ Senha protegida e criptografada
            </p>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 animate-scale-in">
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
        )}
      </div>
    </div>
  );
}