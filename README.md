# ⛪ Igreja Financeiro - Sistema de Gestão Congregacional

Sistema moderno e responsivo desenvolvido para facilitar a gestão administrativa e financeira de igrejas e congregações. Focado em usabilidade, o app oferece desde o controle de membros até dashboards estatísticos com animações interativas.

## 🚀 Funcionalidades Atuais

* **Dashboard da Secretaria:** * Métricas em tempo real (Total de membros, distribuição por faixa etária).
    * Cronograma de aniversariantes para os próximos 30 dias.
    * **Easter Egg de Aniversário:** Animação com confetes e saudação personalizada de 10 segundos para o usuário logado no dia do seu aniversário.
* **Gestão de Usuários:** Cadastro completo com nome, cargo, telefone, endereço, senha e data de nascimento.
* **Banco de Dados Local:** Utiliza IndexedDB (via Dexie.js) para garantir que os dados fiquem salvos no seu dispositivo (Mac mini/iPad) sem dependência de servidor externo.
* **Design Premium:** Interface construída com Tailwind CSS, ícones da Lucide React e suporte a fuso horário local.

## 🛠️ Tecnologias Utilizadas

* **Core:** [React.js](https://reactjs.org/) + [Vite](https://vitejs.dev/)
* **Banco de Dados:** [Dexie.js](https://dexie.org/) (Wrapper para IndexedDB)
* **Estilização:** [Tailwind CSS](https://tailwindcss.com/)
* **Ícones:** [Lucide React](https://lucide.dev/)
* **Animações:** [Canvas Confetti](https://www.npmjs.com/package/canvas-confetti)
* **Roteamento:** [React Router Dom](https://reactrouter.com/)

## 💻 Como Rodar o App no seu Mac mini

Siga os passos abaixo para executar o projeto localmente:

1.  **Clone o repositório:**
    ```bash
    git clone [https://github.com/Rodkross/igreja-financeiro.git](https://github.com/Rodkross/igreja-financeiro.git)
    cd igreja-financeiro
    ```

2.  **Instale as dependências:**
    ```bash
    npm install
    ```

3.  **Execute o projeto em modo de desenvolvimento:**
    ```bash
    npm run dev
    ```

4.  **Acesse no navegador:**
    O Vite geralmente disponibiliza o link `http://localhost:5173`.

## 📁 Estrutura do Projeto

* `/src/database`: Configuração do Dexie e esquemas do banco.
* `/src/pages`: Telas principais (Dashboard, Usuários, etc).
* `/src/components`: Componentes reutilizáveis (Layout, Overlays).
* `/src/hooks`: Lógica de negócio isolada (ex: gerenciamento de aniversários).

---
Desenvolvido por **Rodrigo** - 2026 🚀