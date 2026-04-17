import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { db, storage } from '../../database/firebase';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { 
  Calendar, Clock, Image as ImageIcon, Plus, Trash2, 
  Save, Loader2, X, Star, CalendarDays, Pencil, ZoomIn, Timer
} from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';

export default function Programacao() {
  const { usuario } = useOutletContext() || {};
  const isPodeEditar = (() => {
    const userId = String(usuario?.id);
    const cargoUser = usuario?.cargoNome?.toLowerCase() || '';
    const temAcessoMestre = userId === "1" || cargoUser.includes('pastor') || cargoUser.includes('admin') || cargoUser.includes('sistema') || usuario?.nome?.toLowerCase() === 'rodrigo';
    return temAcessoMestre || (usuario?.permissoes && usuario?.permissoes['programacao'] === true);
  })();

  const [loading, setLoading] = useState(false);
  const [programacoes, setProgramacoes] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isModalAberto, setIsModalAberto] = useState(false);
  const [imagemExpandida, setImagemExpandida] = useState(null);
  
  const formInicial = {
    id: null,
    titulo: '',
    diaSemana: 'DOMINGO',
    horario: '18:00',
    duracao: '2',
    tipoFrequencia: 'toda_semana',
    isEspecial: false,
    dataEspecífica: '',
    banner: null,
    bannerUrl: ''
  };
  
  const [formData, setFormData] = useState(formInicial);

  const abrirParaCriar = () => {
    setFormData(formInicial);
    setIsModalAberto(true);
  };

  const iniciarEdicao = (evento) => {
     setFormData({
       id: evento.id,
       titulo: evento.titulo || '',
       diaSemana: evento.diaSemana || 'DOMINGO',
       horario: evento.horario || '18:00',
       duracao: evento.duracao || '2',
       tipoFrequencia: evento.tipoFrequencia || 'toda_semana',
       isEspecial: evento.isEspecial || false,
       dataEspecífica: evento.dataEspecífica || '',
       banner: null,
       bannerUrl: evento.bannerUrl || ''
     });
     setIsModalAberto(true);
  };

  const diasOrdenados = ['SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO', 'DOMINGO'];
  
  const frequencias = [
    { id: 'toda_semana', label: 'TODA SEMANA' },
    { id: '1_semana', label: '1ª SEMANA DO MÊS' },
    { id: '2_semana', label: '2ª SEMANA DO MÊS' },
    { id: '3_semana', label: '3ª SEMANA DO MÊS' },
    { id: '4_semana', label: '4ª SEMANA DO MÊS' },
  ];

  // --- LÓGICA DE FILTRO TEMPO REAL (CORRIGIDA) ---
  useEffect(() => {
    const q = query(collection(db, "programacaoSemanal"), orderBy("horario", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const agora = new Date();
      
      const listaSincronizada = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(evento => {
          if (!evento.isEspecial) return true;

          try {
            // Criar objeto de data fim: data + hora + duracao
            const [ano, mes, dia] = evento.dataEspecífica.split('-');
            const [hora, minuto] = (evento.horario || "00:00").split(':');
            const dataInicio = new Date(ano, mes - 1, dia, hora, minuto);
            
            // Soma a duração (em horas) convertida para milissegundos
            const duracaoMs = (parseInt(evento.duracao) || 2) * 60 * 60 * 1000;
            const dataFim = new Date(dataInicio.getTime() + duracaoMs);

            // Se agora já passou do fim, não exibe
            return agora < dataFim;
          } catch (e) {
            return true;
          }
        });

      setProgramacoes(listaSincronizada);
    });
    return () => unsub();
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files[0]) setFormData({ ...formData, banner: e.target.files[0] });
  };

  const { confirmModal, alertModal } = useModal();

  const salvarProgramacao = async (e) => {
    e.preventDefault();
    if (!formData.titulo) return await alertModal("Atenção", "Título é obrigatório!", "warning");
    if (!formData.id && !formData.banner) return await alertModal("Atenção", "O Banner é obrigatório!", "warning");
    if (formData.isEspecial && !formData.dataEspecífica) return await alertModal("Atenção", "Informe a data do evento especial!", "warning");

    setLoading(true);

    const salvarNoBanco = async (downloadURL) => {
       const payload = {
            titulo: formData.titulo.toUpperCase(),
            diaSemana: formData.diaSemana,
            horario: formData.horario,
            duracao: formData.duracao,
            tipoFrequencia: formData.isEspecial ? 'unica' : formData.tipoFrequencia,
            isEspecial: formData.isEspecial,
            dataEspecífica: formData.dataEspecífica,
            bannerUrl: downloadURL
       };
       try {
           if (formData.id) {
                await updateDoc(doc(db, "programacaoSemanal", formData.id), payload);
           } else {
                await addDoc(collection(db, "programacaoSemanal"), {
                    ...payload,
                    criadoEm: serverTimestamp()
                });
           }
           setIsModalAberto(false);
           setLoading(false);
           setUploadProgress(0);
           setFormData(formInicial);
           await alertModal("Sucesso", "Programação salva!", "success");
       } catch (error) {
           await alertModal("Erro", "Erro ao salvar.", "danger");
           setLoading(false);
       }
    };

    if (formData.banner) {
      try {
        const storageRef = ref(storage, `programacao/${Date.now()}_${formData.banner.name}`);
        const uploadTask = uploadBytesResumable(storageRef, formData.banner);
        uploadTask.on('state_changed', 
          (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
          (err) => { setLoading(false); alertModal("Erro", "Upload falhou", "danger"); },
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            salvarNoBanco(downloadURL);
          }
        );
      } catch (err) { setLoading(false); }
    } else {
        salvarNoBanco(formData.bannerUrl);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto p-4 pb-32 space-y-8 text-left italic font-sans">
      
      <header className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4 text-left">
          <div className="p-3 bg-slate-900 rounded-2xl text-white shadow-xl">
            <CalendarDays size={32}/>
          </div>
          <div className="text-left">
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none italic">Agenda Oficial</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2 italic leading-none">Cultos e Eventos Especiais</p>
          </div>
        </div>
        {isPodeEditar && (
          <button onClick={abrirParaCriar} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl flex items-center gap-2 italic active:scale-95">
            <Plus size={18} strokeWidth={3}/> Configurar Agenda
          </button>
        )}
      </header>

      {/* MODAL DE CADASTRO */}
      {isModalAberto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-black text-slate-800 uppercase italic flex items-center gap-2 leading-none">
                <Star className={formData.isEspecial ? "text-amber-500 fill-amber-500" : "text-blue-600"}/> 
                {formData.isEspecial ? "Evento Especial" : "Programação Semanal"}
              </h2>
              <button onClick={() => setIsModalAberto(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={24}/></button>
            </div>
            
            <form onSubmit={salvarProgramacao} className="p-8 space-y-6 italic text-left overflow-y-auto max-h-[80vh]">
              <div className="flex items-center gap-4 bg-slate-50 p-5 rounded-3xl border border-slate-100 transition-colors hover:border-amber-200">
                <input type="checkbox" id="especial" className="w-6 h-6 rounded-lg accent-amber-500 cursor-pointer" checked={formData.isEspecial}
                  onChange={e => setFormData({...formData, isEspecial: e.target.checked})}/>
                <label htmlFor="especial" className="font-black text-xs text-slate-700 uppercase cursor-pointer select-none">Evento Especial</label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 italic">Título</label>
                  <input className="w-full border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold bg-slate-50 outline-none focus:bg-white focus:border-blue-600 transition-all uppercase italic"
                    placeholder="EX: CULTO DE DOUTRINA" value={formData.titulo} onChange={e => setFormData({...formData, titulo: e.target.value})}/>
                </div>
                {formData.isEspecial ? (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-amber-600 uppercase ml-1 italic">Data Exata</label>
                    <input type="date" className="w-full border-2 border-amber-100 rounded-2xl px-5 py-4 font-bold bg-amber-50 outline-none focus:bg-white focus:border-amber-500 transition-all italic"
                      value={formData.dataEspecífica} onChange={e => setFormData({...formData, dataEspecífica: e.target.value})}/>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1 italic">Dia da Semana</label>
                    <select className="w-full border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold bg-slate-50 outline-none focus:bg-white focus:border-blue-600 transition-all italic"
                      value={formData.diaSemana} onChange={e => setFormData({...formData, diaSemana: e.target.value})}>
                      {diasOrdenados.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 italic">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 italic">Horário</label>
                  <input type="time" className="w-full border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold bg-slate-50 outline-none focus:bg-white focus:border-blue-600 transition-all italic"
                    value={formData.horario} onChange={e => setFormData({...formData, horario: e.target.value})}/>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 italic">
                    {formData.isEspecial ? "Duração (Horas)" : "Frequência"}
                  </label>
                  {formData.isEspecial ? (
                    <select 
                      className="w-full border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold bg-slate-50 outline-none focus:bg-white focus:border-blue-600 transition-all italic"
                      value={formData.duracao} 
                      onChange={e => setFormData({...formData, duracao: e.target.value})}
                    >
                      {[1,2,3,4,5,6,12,24,48].map(h => (
                        <option key={h} value={h}>{h} {h === 1 ? 'HORA' : 'HORAS'}</option>
                      ))}
                    </select>
                  ) : (
                    <select className="w-full border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold bg-slate-50 outline-none focus:bg-white focus:border-blue-600 transition-all italic"
                      value={formData.tipoFrequencia} onChange={e => setFormData({...formData, tipoFrequencia: e.target.value})}>
                      {frequencias.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                    </select>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 italic">Banner</label>
                  <label className="w-full border-2 border-dashed border-slate-200 rounded-2xl px-5 py-4 font-bold bg-slate-50 hover:bg-slate-100 cursor-pointer transition-all flex items-center justify-center gap-2 italic text-slate-500">
                    <ImageIcon size={20}/>
                    <span className="text-[10px] uppercase truncate">{formData.banner ? formData.banner.name : "ANEXAR ARTE"}</span>
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange}/>
                  </label>
                </div>
              </div>

              <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-600 transition-all disabled:opacity-50 italic">
                {loading ? "SALVANDO..." : "SALVAR PROGRAMAÇÃO"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* LISTAGEM */}
      <div className="space-y-12">
        {programacoes.some(p => p.isEspecial) && (
          <div className="space-y-6">
            <h3 className="text-sm font-black text-amber-500 uppercase tracking-[0.3em] flex items-center gap-3 italic">
               <Star size={20} className="fill-amber-500"/> Destaques
            </h3>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-8">
              {programacoes.filter(p => p.isEspecial).map(evento => (
                <CardEvento key={evento.id} evento={evento} especial aoEditar={() => iniciarEdicao(evento)} isPodeEditar={isPodeEditar} onExpandirImagem={setImagemExpandida} />
              ))}
            </div>
          </div>
        )}

        {diasOrdenados.map(dia => {
          const eventosNoDia = programacoes.filter(p => p.diaSemana === dia && !p.isEspecial);
          if (eventosNoDia.length === 0) return null;
          return (
            <div key={dia} className="space-y-6 text-left">
              <div className="flex items-center gap-4 text-left">
                 <div className="h-1.5 w-10 bg-blue-500 rounded-full text-left"></div>
                 <h3 className="text-lg font-black text-slate-400 uppercase tracking-[0.3em] italic text-left">{dia}</h3>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-8 text-left">
                {eventosNoDia.map(evento => (
                  <CardEvento key={evento.id} evento={evento} aoEditar={() => iniciarEdicao(evento)} isPodeEditar={isPodeEditar} onExpandirImagem={setImagemExpandida} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {imagemExpandida && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md" onClick={() => setImagemExpandida(null)}>
          <img src={imagemExpandida} className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl animate-in zoom-in-95" />
        </div>
      )}
    </div>
  );
}

function CardEvento({ evento, especial, aoEditar, isPodeEditar, onExpandirImagem }) {
  const { confirmModal } = useModal();
  return (
    <div className={`group relative bg-white rounded-[3rem] overflow-hidden shadow-sm border transition-all hover:shadow-2xl italic flex flex-col h-full ${especial ? 'border-amber-200' : 'border-slate-100'}`}>
      <div className="relative h-64 overflow-hidden cursor-pointer" onClick={() => onExpandirImagem(evento.bannerUrl)}>
        <img src={evento.bannerUrl} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt="" />
        <div className="absolute top-6 left-6 bg-slate-900/90 text-white px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase italic">{evento.horario}</div>
        {especial && (
           <div className="absolute top-6 right-6 bg-amber-500 text-slate-950 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase italic shadow-xl">
             {new Date(evento.dataEspecífica + "T12:00:00").toLocaleDateString('pt-BR')}
           </div>
        )}
      </div>

      <div className="p-8 text-left flex-1 flex flex-col justify-between">
        <div>
          <h4 className="text-xl font-black text-slate-900 uppercase italic leading-tight mb-1 truncate">{evento.titulo}</h4>
          {evento.isEspecial && evento.duracao && (
            <p className="text-[10px] font-black text-amber-600 uppercase italic mb-4 flex items-center gap-1">
              <Timer size={12}/> Duração: {evento.duracao} {evento.duracao === '1' ? 'HORA' : 'HORAS'}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-50 pt-4">
           <div className="flex items-center gap-2 text-slate-400">
             <Clock size={14}/>
             <span className="text-[10px] font-black uppercase tracking-widest leading-none">{especial ? 'DATA ÚNICA' : 'SEMANAL'}</span>
           </div>
           {isPodeEditar && (
             <div className="flex items-center gap-2">
               <button onClick={aoEditar} className="p-3 bg-blue-50 text-blue-500 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><Pencil size={18}/></button>
               <button onClick={async () => { if (await confirmModal('Excluir?', 'Remover evento?', 'danger')) { deleteDoc(doc(db, "programacaoSemanal", evento.id)) } }} className="p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all"><Trash2 size={18}/></button>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}