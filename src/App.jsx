import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import { ModalProvider } from "./contexts/ModalContext";
import { db } from "./database/firebase";
import { doc, onSnapshot } from "firebase/firestore";

// --- PÁGINAS DE CADASTRO ---
import Dashboard from "./pages/Dashboard"; 
import Usuarios from "./pages/Cadastros/Usuarios";
import NiveisAcesso from "./pages/Cadastros/NiveisAcesso";
import PlanoContas from "./pages/Cadastros/PlanoContas";
import Contas from "./pages/Cadastros/Contas"; 
import Produtos from "./pages/Cadastros/Cantina";
import Programacao from './pages/Cadastros/Programacao'; 

// --- PÁGINAS FINANCEIRAS ---
import Convenio from './pages/Financeiro/Convenio';
import FluxoFinanceiro from './pages/Financeiro/FluxoFinanceiro';
import Transferencias from './pages/Financeiro/Transferencias';
import ContasPagar from './pages/Financeiro/ContasPagar';
import ContasReceber from './pages/Financeiro/ContasReceber';
import Lancamentos from './pages/Financeiro/Lancamentos'; 
import RelatoriosFinanceiros from "./pages/Relatorios/RelatoriosFinanceiros";

// --- ÁREA DE ENTRETENIMENTO E UTILITÁRIOS ---
import QuizGame from './pages/entretenimento/QuizGame';
import ImportadorQuiz from './pages/entretenimento/ImportadorQuiz'; // Importação do Importador
import EstudoPalavra from './pages/EstudoPalavra'; // Estudo Palavra (Sefaria)

// --- DEFINIÇÃO DA ROTA PRIVADA ---
const RotaPrivada = ({ usuario, modulo, children }) => {
  const userId = String(usuario?.id);
  const cargoUser = usuario?.cargoNome?.toLowerCase() || '';

  if (userId === "1" && modulo === 'convenio') return <Navigate to="/" replace />;

  const temAcessoMestre = 
    userId === "1" || 
    cargoUser.includes('pastor') || 
    cargoUser.includes('admin') || 
    cargoUser.includes('sistema') ||
    usuario?.nome?.toLowerCase() === 'rodrigo';

  const temPermissao = temAcessoMestre || (usuario?.permissoes && usuario?.permissoes[modulo] === true);

  return temPermissao ? children : <Navigate to="/" replace />;
};

const RotaMobilePermitida = ({ isMobile, allowMobile = false, children }) => {
  if (isMobile && !allowMobile) return <Navigate to="/" replace />;
  return children;
};

export default function App() {
  const [usuario, setUsuario] = useState(() => {
    try {
      const salvo = sessionStorage.getItem('usuarioLogado');
      return salvo ? JSON.parse(salvo) : null;
    } catch (error) {
      return null;
    }
  });
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 767px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const syncIsMobile = (event) => setIsMobile(event.matches);

    setIsMobile(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncIsMobile);
      return () => mediaQuery.removeEventListener('change', syncIsMobile);
    }

    mediaQuery.addListener(syncIsMobile);
    return () => mediaQuery.removeListener(syncIsMobile);
  }, []);

  useEffect(() => {
    if (!usuario?.id) return undefined;

    const unsubUsuario = onSnapshot(doc(db, "usuarios", String(usuario.id)), (docSnap) => {
      if (!docSnap.exists()) return;

      const dadosUsuario = { id: String(docSnap.id), ...docSnap.data() };
      setUsuario((atual) => {
        const proximo = { ...atual, ...dadosUsuario };
        sessionStorage.setItem('usuarioLogado', JSON.stringify(proximo));
        return proximo;
      });
    });

    return () => unsubUsuario();
  }, [usuario?.id]);

  useEffect(() => {
    if (!usuario?.cargoId) return undefined;

    const unsubCargo = onSnapshot(doc(db, "cargos", String(usuario.cargoId)), (cargoSnap) => {
      if (!cargoSnap.exists()) return;

      const cargoData = cargoSnap.data();

      setUsuario((atual) => {
        if (!atual) return atual;

        const proximo = {
          ...atual,
          cargoNome: cargoData.nome || atual.cargoNome || 'Membro',
          permissoes: cargoData.permissoes || {}
        };

        sessionStorage.setItem('usuarioLogado', JSON.stringify(proximo));
        return proximo;
      });
    });

    return () => unsubCargo();
  }, [usuario?.cargoId]);

  const logout = () => {
    sessionStorage.clear();
    setUsuario(null);
  };

  return (
    <ModalProvider>
      <BrowserRouter>
        <Routes>
          <Route 
            path="/login" 
            element={!usuario ? <Login onLoginSucesso={setUsuario} /> : <Navigate to="/" replace />} 
          />

          <Route 
            path="/estudo-palavra" 
            element={usuario ? <EstudoPalavra /> : <Navigate to="/login" replace />} 
          />

          <Route 
            path="/" 
            element={usuario ? <Layout usuario={usuario} aoSair={logout} onUsuarioAtualizado={setUsuario} /> : <Navigate to="/login" replace />}
          >
            <Route index element={<Dashboard />} />


            {/* Bloco de Entretenimento */}
            <Route path="entretenimento/quiz" element={
              <RotaMobilePermitida isMobile={isMobile} allowMobile>
                <QuizGame />
              </RotaMobilePermitida>
            } />
            
            {/* Rota temporária para importar os dados do Quiz */}
            <Route path="entretenimento/importar" element={
              <RotaMobilePermitida isMobile={isMobile}>
                <ImportadorQuiz />
              </RotaMobilePermitida>
            } />

            {/* Bloco de Cadastros */}
            <Route path="cadastro/programacao" element={
              <RotaMobilePermitida isMobile={isMobile} allowMobile>
                <Programacao />
              </RotaMobilePermitida>
            } />
            <Route path="cadastro/usuarios" element={
              <RotaMobilePermitida isMobile={isMobile}>
                <RotaPrivada usuario={usuario} modulo="usuarios"><Usuarios /></RotaPrivada>
              </RotaMobilePermitida>
            } />
            <Route path="cadastro/cargos" element={
              <RotaMobilePermitida isMobile={isMobile}>
                <RotaPrivada usuario={usuario} modulo="cargos"><NiveisAcesso /></RotaPrivada>
              </RotaMobilePermitida>
            } />
            <Route path="cadastro/plano-contas" element={
              <RotaMobilePermitida isMobile={isMobile}>
                <RotaPrivada usuario={usuario} modulo="planoContas"><PlanoContas /></RotaPrivada>
              </RotaMobilePermitida>
            } />
            <Route path="cadastro/contas" element={
              <RotaMobilePermitida isMobile={isMobile}>
                <RotaPrivada usuario={usuario} modulo="contas"><Contas /></RotaPrivada>
              </RotaMobilePermitida>
            } />
            <Route path="cadastro/cantina" element={
              <RotaMobilePermitida isMobile={isMobile}>
                <RotaPrivada usuario={usuario} modulo="cantina"><Produtos /></RotaPrivada>
              </RotaMobilePermitida>
            } />
            
            {/* Bloco Financeiro */}
            <Route path="financeiro/fluxo" element={
              <RotaMobilePermitida isMobile={isMobile}>
                <RotaPrivada usuario={usuario} modulo="fluxo"><FluxoFinanceiro /></RotaPrivada>
              </RotaMobilePermitida>
            } />
            
            <Route path="financeiro/lancamentos" element={
              <RotaMobilePermitida isMobile={isMobile}>
                <RotaPrivada usuario={usuario} modulo="lancamentos"><Lancamentos /></RotaPrivada>
              </RotaMobilePermitida>
            } />
            
            <Route path="financeiro/transferencias" element={
              <RotaMobilePermitida isMobile={isMobile}>
                <RotaPrivada usuario={usuario} modulo="lancamentos"><Transferencias /></RotaPrivada>
              </RotaMobilePermitida>
            } />

            <Route path="financeiro/pagar" element={
              <RotaMobilePermitida isMobile={isMobile}>
                <RotaPrivada usuario={usuario} modulo="pagar"><ContasPagar /></RotaPrivada>
              </RotaMobilePermitida>
            } />

            <Route path="financeiro/receber" element={
              <RotaMobilePermitida isMobile={isMobile}>
                <RotaPrivada usuario={usuario} modulo="receber"><ContasReceber /></RotaPrivada>
              </RotaMobilePermitida>
            } />

            <Route path="financeiro/convenio" element={
              <RotaMobilePermitida isMobile={isMobile}>
                <RotaPrivada usuario={usuario} modulo="convenio"><Convenio /></RotaPrivada>
              </RotaMobilePermitida>
            } />

            <Route path="financeiro/relatorios" element={
              <RotaMobilePermitida isMobile={isMobile}>
                <RotaPrivada usuario={usuario} modulo="relatorios"><RelatoriosFinanceiros /></RotaPrivada>
              </RotaMobilePermitida>
            } />

          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ModalProvider>
  );
}

//Deus seja louvado! Elohim! Adonai! Aleluia! Yeshua! Amém!!
