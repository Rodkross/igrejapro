export function removerSenhaDoUsuario(usuario) {
  if (!usuario || typeof usuario !== 'object') return usuario;

  const usuarioSeguro = { ...usuario };
  delete usuarioSeguro.senha;
  return usuarioSeguro;
}

export function salvarUsuarioLocal(usuario) {
  const usuarioSeguro = removerSenhaDoUsuario(usuario);
  localStorage.setItem('usuarioLogado', JSON.stringify(usuarioSeguro));
  return usuarioSeguro;
}
