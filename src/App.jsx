import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import { ModalProvider } from "./contexts/ModalContext";

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

export default function App() {
  const [usuario, setUsuario] = useState(() => {
    try {
      const salvo = sessionStorage.getItem('usuarioLogado');
      return salvo ? JSON.parse(salvo) : null;
    } catch (error) {
      return null;
    }
  });

  const logout = () => {
    sessionStorage.removeItem('usuarioLogado');
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
            path="/" 
            element={usuario ? <Layout usuario={usuario} aoSair={logout} /> : <Navigate to="/login" replace />}
          >
            <Route index element={<Dashboard />} />
            
            {/* Bloco de Entretenimento */}
            <Route path="entretenimento/quiz" element={<QuizGame />} />
            
            {/* Rota temporária para importar os dados do Quiz */}
            <Route path="entretenimento/importar" element={
              <RotaPrivada usuario={usuario} modulo="usuarios">
                <ImportadorQuiz />
              </RotaPrivada>
            } />

            {/* Bloco de Cadastros */}
            <Route path="cadastro/programacao" element={<Programacao />} />
            <Route path="cadastro/usuarios" element={
              <RotaPrivada usuario={usuario} modulo="usuarios"><Usuarios /></RotaPrivada>
            } />
            <Route path="cadastro/cargos" element={
              <RotaPrivada usuario={usuario} modulo="cargos"><NiveisAcesso /></RotaPrivada>
            } />
            <Route path="cadastro/plano-contas" element={
              <RotaPrivada usuario={usuario} modulo="planoContas"><PlanoContas /></RotaPrivada>
            } />
            <Route path="cadastro/contas" element={
              <RotaPrivada usuario={usuario} modulo="contas"><Contas /></RotaPrivada>
            } />
            <Route path="cadastro/cantina" element={
              <RotaPrivada usuario={usuario} modulo="cantina"><Produtos /></RotaPrivada>
            } />
            
            {/* Bloco Financeiro */}
            <Route path="financeiro/fluxo" element={
              <RotaPrivada usuario={usuario} modulo="fluxo"><FluxoFinanceiro /></RotaPrivada>
            } />
            
            <Route path="financeiro/lancamentos" element={
              <RotaPrivada usuario={usuario} modulo="lancamentos"><Lancamentos /></RotaPrivada>
            } />
            
            <Route path="financeiro/transferencias" element={
              <RotaPrivada usuario={usuario} modulo="lancamentos"><Transferencias /></RotaPrivada>
            } />

            <Route path="financeiro/pagar" element={
              <RotaPrivada usuario={usuario} modulo="pagar"><ContasPagar /></RotaPrivada>
            } />

            <Route path="financeiro/receber" element={
              <RotaPrivada usuario={usuario} modulo="receber"><ContasReceber /></RotaPrivada>
            } />

            <Route path="financeiro/convenio" element={
              <RotaPrivada usuario={usuario} modulo="convenio"><Convenio /></RotaPrivada>
            } />

            <Route path="financeiro/relatorios" element={
              <RotaPrivada usuario={usuario} modulo="relatorios"><RelatoriosFinanceiros /></RotaPrivada>
            } />

          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ModalProvider>
  );
}

//Deus seja louvado! Elohim! Adonai! Aleluia! Yeshua! Amém!!