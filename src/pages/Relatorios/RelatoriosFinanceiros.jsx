import React from 'react';
import { BarChart3, CalendarSearch, FileText, FilePieChart, TrendingUp } from 'lucide-react';

export default function RelatoriosFinanceiros() {
  const cards = [
    { title: 'Fechamento Mensal', desc: 'Resumo de entradas e saídas', icon: <CalendarSearch />, color: 'bg-blue-500' },
    { title: 'Dízimos e Ofertas', desc: 'Detalhamento por contribuinte', icon: <FileText />, color: 'bg-emerald-500' },
    { title: 'Gastos por Categoria', desc: 'Análise do Plano de Contas', icon: <FilePieChart />, color: 'bg-rose-500' },
    { title: 'Evolução Anual', desc: 'Comparativo de crescimento', icon: <TrendingUp />, color: 'bg-slate-900' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 text-left italic">
      <div className="flex items-center gap-4">
        <div className="bg-slate-900 p-3 rounded-[1.2rem] text-white shadow-lg">
          <BarChart3 size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter leading-none">Relatórios</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Inteligência de Dados</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
        {cards.map((card, idx) => (
          <div key={idx} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all cursor-pointer group">
            <div className={`w-12 h-12 ${card.color} text-white rounded-2xl flex items-center justify-center mb-4`}>
              {React.cloneElement(card.icon, { size: 24 })}
            </div>
            <h3 className="font-black text-slate-800 uppercase text-sm mb-2">{card.title}</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase">{card.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}