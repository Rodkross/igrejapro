import Dexie from 'dexie';

export const db = new Dexie('IgrejaFinanceiroDB');

db.version(10).stores({
  usuarios: '++id, nome, cargoId, dataNascimento, senha', 
  cargos: '++id, nome',
  planoContas: '++id, nome, tipo, codigoCustom',
  fornecedores: '++id, nome, planoContaId, recorrencia', 
  financeiro: '++id, uuid, loteId, tipo, fornecedorId, status, vencimento, valor, formaPagamento, dataBaixa, convenioUuid',
  estoqueCantina: '++id, nome, categoria, preco', 
  convenio: '++id, usuarioId, itemId, quantidade, valorTotal, data, status, uuid'
});

// --- TRAVA DE SEGURANÇA: IMPEDE EXCLUSÃO DO SUPORTE ---
db.cargos.hook('deleting', (primKey, obj) => {
  if (obj.nome.toLowerCase() === 'suporte') {
    throw new Error("O cargo de sistema não pode ser excluído.");
  }
});

db.usuarios.hook('deleting', (primKey, obj) => {
  if (primKey === 1 || obj.nome.toLowerCase() === 'suporte') {
    throw new Error("O usuário mestre de suporte não pode ser excluído.");
  }
});

// --- LÓGICA DE USUÁRIO MASTER NO ID 1 ---
db.on('ready', async () => {
  const masterSenha = import.meta.env.VITE_SUPORTE_SENHA || 'suporte180221';

  try {
    // 1. Definição das permissões do Suporte (Convênio desativado)
    const permissoesSuporte = { 
      dashboard: true, 
      usuarios: true, 
      cargos: true, 
      planoContas: true,
      contas: true, 
      cantina: true, 
      fluxo: true, 
      pagar: true,
      receber: true, 
      lancamentos: true, 
      relatorios: true,
      convenio: false 
    };

    // 2. Garante o Cargo de Suporte
    let cargoSuporte = await db.cargos.where('nome').equalsIgnoreCase('Suporte').first();
    let cargoId;

    if (!cargoSuporte) {
      cargoId = await db.cargos.add({ 
        nome: 'Suporte', 
        permissoes: permissoesSuporte 
      });
    } else {
      cargoId = cargoSuporte.id;
      // Garante que as permissões estejam sempre atualizadas conforme a regra de invisibilidade
      await db.cargos.update(cargoId, { permissoes: permissoesSuporte });
    }

    // 3. FORÇA O USUÁRIO SUPORTE NO ID 1
    await db.usuarios.put({
      id: 1, 
      nome: 'Suporte',
      senha: masterSenha,
      cargoId: cargoId,
      dataNascimento: '1900-01-01',
      cargoNome: 'SISTEMA' 
    });

    console.log("🛠️ Usuário Master consolidado no ID 1");
  } catch (e) {
    console.error("Erro ao configurar acesso mestre:", e);
  }
});

export const generateUUID = () => crypto.randomUUID();