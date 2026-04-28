import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { db, storage } from '../database/firebase';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, increment, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { MessageSquare, Send, X, UserCircle, Heart, MessageCircle, Loader2, ImagePlus, Trash2 } from 'lucide-react';

export default function Comunidade() {
  const { usuario } = useOutletContext();
  const [posts, setPosts] = useState([]);
  const [textoPost, setTextoPost] = useState('');
  const [fotoPost, setFotoPost] = useState(null);
  const [previewFoto, setPreviewFoto] = useState(null);
  const [enviandoPost, setEnviandoPost] = useState(false);
  const [progressoUpload, setProgressoUpload] = useState(0);

  const [postAberto, setPostAberto] = useState(null);
  const [comentarios, setComentarios] = useState([]);
  const [textoComentario, setTextoComentario] = useState('');
  const [enviandoComentario, setEnviandoComentario] = useState(false);

  const [itemParaDeletar, setItemParaDeletar] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    const q = query(collection(db, 'comunidade_posts'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!postAberto) return;
    const q = query(collection(db, 'comunidade_posts', postAberto.id, 'comentarios'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setComentarios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [postAberto]);

  const handleFotoChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFotoPost(file);
      setPreviewFoto(URL.createObjectURL(file));
    }
  };

  const removerFoto = () => {
    setFotoPost(null);
    setPreviewFoto(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const publicarPost = async (e) => {
    e.preventDefault();
    if (!textoPost.trim() && !fotoPost) return;

    setEnviandoPost(true);
    try {
      let fotoUrl = null;
      if (fotoPost) {
        const fileExt = fotoPost.name.split('.').pop();
        const fileName = `comunidade/${usuario?.id}_${Date.now()}.${fileExt}`;
        const storageRef = ref(storage, fileName);
        const uploadTask = uploadBytesResumable(storageRef, fotoPost);

        fotoUrl = await new Promise((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => setProgressoUpload(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
            (err) => reject(err),
            async () => resolve(await getDownloadURL(uploadTask.snapshot.ref))
          );
        });
      }

      await addDoc(collection(db, 'comunidade_posts'), {
        texto: textoPost.trim(),
        fotoUrl: fotoUrl,
        autorId: String(usuario?.id || 'desconhecido'),
        autorNome: usuario?.nome || 'Usuário',
        autorFoto: usuario?.fotoUrl || null,
        comentariosCount: 0,
        likesCount: 0,
        likedBy: [],
        createdAt: serverTimestamp()
      });

      setTextoPost('');
      removerFoto();
    } catch (error) {
      console.error("Erro ao publicar:", error);
      alert("Erro ao publicar. Tente novamente.");
    } finally {
      setEnviandoPost(false);
      setProgressoUpload(0);
    }
  };

  const curtirPost = async (e, post) => {
    e.stopPropagation();
    if (!usuario) return;
    const postRef = doc(db, 'comunidade_posts', post.id);
    const uid = String(usuario.id);
    
    if (post.likedBy?.includes(uid)) {
      // Se já curtiu, descurte
      await updateDoc(postRef, { likesCount: increment(-1), likedBy: arrayRemove(uid) });
    } else {
      // Se não curtiu, curte
      await updateDoc(postRef, { likesCount: increment(1), likedBy: arrayUnion(uid) });
    }
  };

  const enviarComentario = async (e) => {
    e.preventDefault();
    if (!textoComentario.trim() || !postAberto) return;

    setEnviandoComentario(true);
    try {
      await addDoc(collection(db, 'comunidade_posts', postAberto.id, 'comentarios'), {
        texto: textoComentario.trim(),
        autorId: String(usuario?.id || 'desconhecido'),
        autorNome: usuario?.nome || 'Usuário',
        autorFoto: usuario?.fotoUrl || null,
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'comunidade_posts', postAberto.id), {
        comentariosCount: increment(1)
      });

      setTextoComentario('');
    } catch (error) {
      console.error("Erro ao comentar:", error);
    } finally {
      setEnviandoComentario(false);
    }
  };

  const deletarPost = async (e, post) => {
    e.stopPropagation();
    setItemParaDeletar({ tipo: 'post', data: post });
  };

  const deletarComentario = async (comentario) => {
    setItemParaDeletar({ tipo: 'comentario', data: comentario });
  };

  const executarDelecao = async () => {
    if (!itemParaDeletar) return;
    const { tipo, data } = itemParaDeletar;

    if (tipo === 'post') {
      try {
        if (data.fotoUrl) {
          const fotoRef = ref(storage, data.fotoUrl);
          await deleteObject(fotoRef).catch(err => console.log("Erro ao deletar foto:", err));
        }
        await deleteDoc(doc(db, 'comunidade_posts', data.id));
        if (postAberto?.id === data.id) setPostAberto(null);
      } catch (error) {
        console.error("Erro ao deletar post:", error);
      }
    } else if (tipo === 'comentario') {
      try {
        await deleteDoc(doc(db, 'comunidade_posts', postAberto.id, 'comentarios', data.id));
        await updateDoc(doc(db, 'comunidade_posts', postAberto.id), { comentariosCount: increment(-1) });
      } catch (error) { console.error("Erro ao deletar comentário:", error); }
    }
    setItemParaDeletar(null);
  };

  const formatarData = (timestamp) => {
    if (!timestamp) return 'Agora mesmo';
    const date = timestamp.toDate();
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12 italic text-left">
      <header className="flex flex-col justify-center items-start gap-2 border-b-2 border-slate-100 pb-6">
        <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3 uppercase leading-none">
          <MessageSquare className="text-blue-600" size={28} />
          Comunidade
        </h1>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Compartilhe dúvidas, fotos e interaja com os irmãos</p>
      </header>

      {/* CREATE POST */}
      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden">
        <form onSubmit={publicarPost} className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center">
               {usuario?.fotoUrl ? <img src={usuario.fotoUrl} alt="Avatar" className="w-full h-full object-cover" /> : <UserCircle size={32} className="text-slate-300" />}
            </div>
            <div className="flex-1 space-y-3">
              <textarea
                value={textoPost}
                onChange={(e) => setTextoPost(e.target.value)}
                placeholder="No que você está pensando, ou qual a sua dúvida?"
                className="w-full border-none bg-slate-50 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700 resize-none transition-all"
                rows={3}
              />
              {previewFoto && (
                <div className="relative inline-block">
                  <img src={previewFoto} alt="Preview" className="max-h-64 rounded-xl border border-slate-200 object-cover" />
                  <button type="button" onClick={removerFoto} className="absolute -top-3 -right-3 bg-rose-500 text-white p-1.5 rounded-full shadow-lg hover:bg-rose-600 transition-colors">
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <div className="flex items-center gap-2">
              <input type="file" id="fotoPost" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFotoChange} />
              <label htmlFor="fotoPost" className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-blue-100 transition-colors">
                <ImagePlus size={16} /> Adicionar Foto
              </label>
            </div>

            <button 
              type="submit" 
              disabled={enviandoPost || (!textoPost.trim() && !fotoPost)}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-200"
            >
              {enviandoPost ? (
                <><Loader2 size={16} className="animate-spin" /> {progressoUpload > 0 ? `${progressoUpload}%` : 'Enviando...'}</>
              ) : (
                <><Send size={16} /> Publicar</>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* FEED */}
      <div className="space-y-6">
        {posts.map(post => (
          <div key={post.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setPostAberto(post)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center">
                   {post.autorFoto ? <img src={post.autorFoto} alt="Avatar" className="w-full h-full object-cover" /> : <UserCircle size={28} className="text-slate-300" />}
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm leading-none">{post.autorNome}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{formatarData(post.createdAt)}</p>
                </div>
              </div>
              {String(usuario?.id) === String(post.autorId) && (
                <button onClick={(e) => deletarPost(e, post)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors" title="Excluir">
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            {post.texto && <p className="text-slate-700 font-medium whitespace-pre-wrap">{post.texto}</p>}
            
            {post.fotoUrl && (
              <div className="rounded-2xl overflow-hidden border border-slate-100 bg-slate-50">
                <img src={post.fotoUrl} alt="Post anexo" className="w-full max-h-[500px] object-contain" />
              </div>
            )}

            <div className="flex items-center gap-6 pt-4 border-t border-slate-50">
              <button onClick={(e) => curtirPost(e, post)} className={`flex items-center gap-2 transition-colors font-bold text-xs uppercase tracking-widest group ${post.likedBy?.includes(String(usuario?.id)) ? 'text-rose-500' : 'text-slate-400 hover:text-rose-500'}`}>
                <Heart size={18} className={`${post.likedBy?.includes(String(usuario?.id)) ? 'fill-rose-500' : 'group-hover:fill-rose-500'} transition-all`} /> {post.likesCount || 0}
              </button>
              <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest">
                <MessageCircle size={18} /> {post.comentariosCount || 0} Comentários
              </div>
            </div>
          </div>
        ))}
        {posts.length === 0 && (
          <div className="text-center py-12 text-slate-400 font-bold uppercase tracking-widest text-xs">
            Nenhuma publicação ainda. Seja o primeiro a postar!
          </div>
        )}
      </div>

      {/* MODAL DE POST / COMENTÁRIOS */}
      {postAberto && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setPostAberto(null)}>
          <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col scale-in-95 animate-in duration-300" onClick={e => e.stopPropagation()}>
            
            <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
              <h2 className="font-black text-slate-800 uppercase tracking-widest text-xs">Publicação de {postAberto.autorNome}</h2>
              <button onClick={() => setPostAberto(null)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scroll">
              {/* O Post */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center">
                       {postAberto.autorFoto ? <img src={postAberto.autorFoto} alt="Avatar" className="w-full h-full object-cover" /> : <UserCircle size={28} className="text-slate-300" />}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm leading-none">{postAberto.autorNome}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{formatarData(postAberto.createdAt)}</p>
                    </div>
                  </div>
                  {String(usuario?.id) === String(postAberto.autorId) && (
                    <button onClick={(e) => deletarPost(e, postAberto)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors" title="Excluir">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                {postAberto.texto && <p className="text-slate-700 font-medium whitespace-pre-wrap">{postAberto.texto}</p>}
                
                {postAberto.fotoUrl && (
                  <div className="rounded-2xl overflow-hidden border border-slate-100 bg-slate-50">
                    <img src={postAberto.fotoUrl} alt="Post anexo" className="w-full max-h-[400px] object-contain" />
                  </div>
                )}
              </div>

              {/* Comentários */}
              <div className="pt-6 border-t border-slate-100 space-y-4">
                <h3 className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Comentários ({comentarios.length})</h3>
                
                {comentarios.map(com => (
                  <div key={com.id} className="flex gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="w-8 h-8 rounded-full bg-white overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center">
                       {com.autorFoto ? <img src={com.autorFoto} alt="Avatar" className="w-full h-full object-cover" /> : <UserCircle size={20} className="text-slate-300" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-bold text-slate-800 text-xs">{com.autorNome}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">{formatarData(com.createdAt)}</p>
                          {String(usuario?.id) === String(com.autorId) && (
                            <button onClick={() => deletarComentario(com)} className="text-slate-300 hover:text-rose-500 transition-colors" title="Excluir"><Trash2 size={12} /></button>
                          )}
                        </div>
                      </div>
                      <p className="text-slate-600 text-sm mt-1">{com.texto}</p>
                    </div>
                  </div>
                ))}
                
                {comentarios.length === 0 && (
                  <p className="text-center py-4 text-slate-400 font-bold text-[10px] uppercase tracking-widest">Nenhum comentário ainda.</p>
                )}
              </div>
            </div>

            {/* Input Comentário */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-[2.5rem] shrink-0">
              <form onSubmit={enviarComentario} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center">
                   {usuario?.fotoUrl ? <img src={usuario.fotoUrl} alt="Avatar" className="w-full h-full object-cover" /> : <UserCircle size={20} className="text-slate-300" />}
                </div>
                <input
                  type="text"
                  value={textoComentario}
                  onChange={(e) => setTextoComentario(e.target.value)}
                  placeholder="Escreva um comentário..."
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors"
                />
                <button 
                  type="submit" 
                  disabled={!textoComentario.trim() || enviandoComentario}
                  className="bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {enviandoComentario ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE DELEÇÃO */}
      {itemParaDeletar && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setItemParaDeletar(null)}>
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 text-center scale-in-95 animate-in duration-300" onClick={e => e.stopPropagation()}>
            <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 size={40} />
            </div>
            <h3 className="font-black text-slate-800 text-xl uppercase tracking-tight mb-3">Excluir {itemParaDeletar.tipo === 'post' ? 'Publicação' : 'Comentário'}?</h3>
            <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed">
              Esta ação não pode ser desfeita. Tem certeza que deseja remover este conteúdo definitivamente?
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setItemParaDeletar(null)}
                className="flex-1 py-3.5 rounded-2xl bg-slate-50 text-slate-600 font-black uppercase tracking-widest text-[10px] hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={executarDelecao}
                className="flex-1 py-3.5 rounded-2xl bg-rose-500 text-white font-black uppercase tracking-widest text-[10px] hover:bg-rose-600 transition-colors shadow-lg shadow-rose-200"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}