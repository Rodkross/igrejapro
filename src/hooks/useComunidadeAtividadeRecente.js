import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../database/firebase';

const getTimeValue = (timestamp) => {
  if (!timestamp) return null;
  if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
  if (timestamp instanceof Date) return timestamp.getTime();
  if (typeof timestamp?.seconds === 'number') {
    return (timestamp.seconds * 1000) + Math.floor((timestamp.nanoseconds || 0) / 1000000);
  }
  return null;
};

const isMaisRecenteQue = (timestamp, referencia) => {
  const valorTimestamp = getTimeValue(timestamp);
  const valorReferencia = getTimeValue(referencia);

  if (valorTimestamp === null) return false;
  if (valorReferencia === null) return true;

  return valorTimestamp > valorReferencia;
};

export function useComunidadeAtividadeRecente({ usuarioId, ultimaVisualizacao }) {
  const [atividade, setAtividade] = useState({
    novasPublicacoesIds: new Set(),
    comentariosNovosPorPost: {},
    totalNovasPublicacoes: 0,
    totalComentariosNovos: 0,
    totalPostsComNovosComentarios: 0
  });

  useEffect(() => {
    if (!usuarioId) {
      setAtividade({
        novasPublicacoesIds: new Set(),
        comentariosNovosPorPost: {},
        totalNovasPublicacoes: 0,
        totalComentariosNovos: 0,
        totalPostsComNovosComentarios: 0
      });
      return undefined;
    }

    const postsRef = collection(db, 'comunidade_posts');
    const postsQuery = query(postsRef, orderBy('createdAt', 'desc'));
    const postsDoUsuarioQuery = query(postsRef, where('autorId', '==', String(usuarioId)));
    const unsubComentariosPorPost = new Map();
    const comentariosNovosPorPost = {};

    const atualizarResumo = (novasPublicacoesIds) => {
      const totalComentariosNovos = Object.values(comentariosNovosPorPost).reduce((acc, item) => acc + item.total, 0);
      const totalPostsComNovosComentarios = Object.values(comentariosNovosPorPost).filter((item) => item.total > 0).length;

      setAtividade({
        novasPublicacoesIds,
        comentariosNovosPorPost: { ...comentariosNovosPorPost },
        totalNovasPublicacoes: novasPublicacoesIds.size,
        totalComentariosNovos,
        totalPostsComNovosComentarios
      });
    };

    let novasPublicacoesIdsAtual = new Set();

    const unsubPosts = onSnapshot(
      postsQuery,
      (snapshot) => {
        novasPublicacoesIdsAtual = new Set(
          snapshot.docs
            .filter((postDoc) => {
              const post = postDoc.data();
              if (String(post.autorId) === String(usuarioId)) return false;
              return isMaisRecenteQue(post.createdAt, ultimaVisualizacao);
            })
            .map((postDoc) => postDoc.id)
        );

        atualizarResumo(novasPublicacoesIdsAtual);
      },
      (error) => {
        console.error('Erro ao carregar publicacoes recentes da comunidade:', error);
      }
    );

    const unsubPostsDoUsuario = onSnapshot(
      postsDoUsuarioQuery,
      (snapshot) => {
        const postIdsAtuais = new Set(snapshot.docs.map((postDoc) => postDoc.id));

        unsubComentariosPorPost.forEach((unsubComentario, postId) => {
          if (postIdsAtuais.has(postId)) return;
          unsubComentario();
          unsubComentariosPorPost.delete(postId);
          delete comentariosNovosPorPost[postId];
        });

        snapshot.docs.forEach((postDoc) => {
          const postId = postDoc.id;
          if (unsubComentariosPorPost.has(postId)) return;

          const comentariosRef = collection(db, 'comunidade_posts', postId, 'comentarios');
          const comentariosQuery = query(comentariosRef, orderBy('createdAt', 'asc'));

          const unsubComentarios = onSnapshot(
            comentariosQuery,
            (comentariosSnapshot) => {
              const comentariosNovos = comentariosSnapshot.docs
                .map((comentarioDoc) => ({ id: comentarioDoc.id, ...comentarioDoc.data() }))
                .filter((comentario) => {
                  if (String(comentario.autorId) === String(usuarioId)) return false;
                  return isMaisRecenteQue(comentario.createdAt, ultimaVisualizacao);
                });

              comentariosNovosPorPost[postId] = {
                total: comentariosNovos.length,
                comentarioIds: comentariosNovos.map((comentario) => comentario.id)
              };

              atualizarResumo(novasPublicacoesIdsAtual);
            },
            (error) => {
              console.error('Erro ao carregar comentarios recentes da comunidade:', error);
            }
          );

          unsubComentariosPorPost.set(postId, unsubComentarios);
        });
      },
      (error) => {
        console.error('Erro ao carregar posts do usuario na comunidade:', error);
      }
    );

    return () => {
      unsubPosts();
      unsubPostsDoUsuario();
      unsubComentariosPorPost.forEach((unsubComentario) => unsubComentario());
    };
  }, [ultimaVisualizacao, usuarioId]);

  return atividade;
}
