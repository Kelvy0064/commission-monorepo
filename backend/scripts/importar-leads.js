#!/usr/bin/env node
/*
 * Importa leads exportados do formulário da landing page (arquivo TSV) como clientes.
 *
 * Uso:
 *   node scripts/importar-leads.js <arquivo.tsv> [--api URL] [--executar]
 *
 * Sem --executar roda em modo simulação: valida, unifica e mostra o relatório
 * sem gravar nada. Com --executar, cadastra via API (POST /clientes).
 *
 * Regras:
 * - Ignora linhas de teste (nome "teste"/"test" ou UTM de teste).
 * - Um cliente por telefone: dados mais recentes, nome mais completo e
 *   data de cadastro do primeiro contato.
 * - Pula telefones que já existem no sistema (pode rodar de novo sem duplicar).
 * - Clientes entram com status "lead".
 */
const fs = require('fs');

const args = process.argv.slice(2);
const arquivo = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--api');
const executar = args.includes('--executar');
const apiIndex = args.indexOf('--api');
const API_URL = (apiIndex >= 0 ? args[apiIndex + 1] : process.env.API_URL || 'http://localhost:3001/api').replace(/\/$/, '');

if (!arquivo) {
  console.error('Uso: node scripts/importar-leads.js <arquivo.tsv> [--api URL] [--executar]');
  process.exit(1);
}

// Colunas esperadas na exportação (índice → trecho do cabeçalho)
const COLUNAS = {
  possuiPlano: [0, 'possui plano de saúde'],
  planoAtual: [1, 'plano de saúde atual'],
  custoAtual: [2, 'custo do seu plano'],
  investimento: [3, 'pretende investir'],
  idades: [4, 'idades'],
  hospitais: [5, 'hospitais'],
  nome: [6, 'seu nome'],
  telefone: [7, 'whatsapp'],
  utmSource: [8, 'utm_source'],
  utmMedium: [9, 'utm_medium'],
  utmCampaign: [10, 'utm_campaign'],
  utmTerm: [11, 'utm_term'],
  utmContent: [12, 'utm_content'],
  enviadoEm: [17, 'submitted at'],
};

// ---------- Normalização ----------

const limpar = (v) => (v || '').replace(/\s+/g, ' ').trim();

// Telefone nacional (DDD + número), sem o +55
const telefoneDigitos = (v) => {
  let d = (v || '').replace(/\D/g, '');
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  return d;
};

const maskTelefone = (d) => {
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
};

// "dd/mm/aaaa hh:mm:ss" → { iso: "aaaa-mm-dd", ordem: "aaaammddhhmmss" }
const parseData = (v) => {
  const m = limpar(v).match(/^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2}):(\d{2}))?/);
  if (!m) return null;
  const [, dd, mm, yyyy, h = '00', min = '00', s = '00'] = m;
  return { iso: `${yyyy}-${mm}-${dd}`, ordem: `${yyyy}${mm}${dd}${h}${min}${s}` };
};

// Extrai idades de respostas livres: "62 , 55 , 18", "72 e 75 anos", "2 pessoas 72 e 74".
// Retorna { idades, revisar } — revisar = texto que não deu para interpretar com segurança.
const parseIdades = (texto) => {
  const original = limpar(texto);
  // Remove contagens de pessoas: "2 pessoas", "2 vidas"
  const semContagem = original.toLowerCase().replace(/\d+\s*(pessoas?|vidas?)/g, ' ');
  const numeros = (semContagem.match(/\d+/g) || []).map(Number);
  const palavras = semContagem.replace(/[\d\s,;./e]+|anos?|cada|um/g, ' ').trim();

  if (numeros.length === 0) return { idades: [], revisar: original || null };
  if (numeros.some((n) => n > 130)) return { idades: [], revisar: original };
  return { idades: numeros, revisar: palavras ? original : null };
};

const isTeste = (nome, utmSource) =>
  /^(teste?|test)\b/i.test(nome) || /^x+$/i.test(utmSource) || /test_url/i.test(utmSource);

// ---------- Leitura ----------

const raw = fs.readFileSync(arquivo, 'utf8').replace(/^﻿/, '');
const [headerLine, ...linhas] = raw.split(/\r?\n/);
const header = headerLine.split('\t').map((h) => h.toLowerCase());

for (const [campo, [indice, trecho]] of Object.entries(COLUNAS)) {
  if (!(header[indice] || '').includes(trecho)) {
    console.error(`❌ Cabeçalho inesperado na coluna ${indice + 1} (${campo}): esperava conter "${trecho}", veio "${header[indice]}".`);
    console.error('   O formato da exportação mudou — ajuste COLUNAS no script.');
    process.exit(1);
  }
}

const col = (cells, campo) => limpar(cells[COLUNAS[campo][0]]);

const leads = [];
const descartados = [];

linhas.forEach((linha, i) => {
  const cells = linha.split('\t');
  if (!cells.some((c) => c.trim())) return;
  const numeroLinha = i + 2;

  const nome = col(cells, 'nome');
  const utmSource = col(cells, 'utmSource');
  if (isTeste(nome, utmSource)) {
    descartados.push({ linha: numeroLinha, nome, motivo: 'teste' });
    return;
  }

  const telefone = telefoneDigitos(col(cells, 'telefone'));
  const data = parseData(col(cells, 'enviadoEm'));
  if (!nome || telefone.length < 10 || !data) {
    descartados.push({ linha: numeroLinha, nome, motivo: 'sem nome, telefone ou data válidos' });
    return;
  }

  const possui = col(cells, 'possuiPlano').toLowerCase();
  const { idades, revisar } = parseIdades(col(cells, 'idades'));

  leads.push({
    linha: numeroLinha,
    ordem: data.ordem,
    revisarIdades: revisar,
    cliente: {
      nome,
      telefone: maskTelefone(telefone),
      idades,
      status: 'lead',
      data_cadastro: data.iso,
      possui_plano: possui.startsWith('tenho') ? true : possui.startsWith('não') || possui.startsWith('nao') ? false : null,
      plano_atual: col(cells, 'planoAtual') || null,
      custo_plano_atual: col(cells, 'custoAtual') || null,
      investimento_pretendido: col(cells, 'investimento') || null,
      hospitais_preferidos: col(cells, 'hospitais') || null,
      utm_source: utmSource || null,
      utm_medium: col(cells, 'utmMedium') || null,
      utm_campaign: col(cells, 'utmCampaign') || null,
      utm_term: col(cells, 'utmTerm') || null,
      utm_content: col(cells, 'utmContent') || null,
    },
  });
});

// ---------- Unificação por telefone ----------

const porTelefone = new Map();
for (const lead of [...leads].sort((a, b) => a.ordem.localeCompare(b.ordem))) {
  const chave = telefoneDigitos(lead.cliente.telefone);
  const atual = porTelefone.get(chave);
  if (!atual) {
    porTelefone.set(chave, { ...lead, linhas: [lead.linha] });
    continue;
  }
  // Lead mais recente sobrescreve, mas não apaga dados com vazio
  const merged = { ...atual.cliente };
  for (const [campo, valor] of Object.entries(lead.cliente)) {
    const vazio = valor === null || valor === '' || (Array.isArray(valor) && valor.length === 0);
    if (!vazio) merged[campo] = valor;
  }
  merged.data_cadastro = atual.cliente.data_cadastro; // primeiro contato
  merged.nome = lead.cliente.nome.length > atual.cliente.nome.length ? lead.cliente.nome : atual.cliente.nome;
  porTelefone.set(chave, {
    ...lead,
    cliente: merged,
    revisarIdades: lead.cliente.idades.length ? lead.revisarIdades : atual.revisarIdades,
    linhas: [...atual.linhas, lead.linha],
  });
}

const unificados = [...porTelefone.values()];

// ---------- Execução ----------

const main = async () => {
  console.log(`\n📄 Arquivo: ${arquivo}`);
  console.log(`🌐 API: ${API_URL}`);
  console.log(`⚙️  Modo: ${executar ? 'EXECUTAR (vai gravar)' : 'SIMULAÇÃO (nada será gravado)'}\n`);

  // Telefones que já existem no sistema
  let existentes = new Set();
  try {
    const res = await fetch(`${API_URL}/clientes`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const clientes = await res.json();
    existentes = new Set(clientes.map((c) => telefoneDigitos(c.telefone)).filter(Boolean));
  } catch (error) {
    console.error(`❌ Não foi possível consultar os clientes existentes em ${API_URL}/clientes: ${error.message}`);
    process.exit(1);
  }

  const novos = unificados.filter((u) => !existentes.has(telefoneDigitos(u.cliente.telefone)));
  const jaExistem = unificados.filter((u) => existentes.has(telefoneDigitos(u.cliente.telefone)));
  const repetidos = unificados.filter((u) => u.linhas.length > 1);
  const revisar = unificados.filter((u) => u.revisarIdades);

  console.log('Resumo');
  console.log(`  Leads no arquivo ........... ${leads.length + descartados.length}`);
  console.log(`  Descartados (teste/inválido) ${descartados.length}`);
  console.log(`  Unificados por telefone .... ${leads.length - unificados.length} (de ${repetidos.length} telefones repetidos)`);
  console.log(`  Já existem no sistema ...... ${jaExistem.length}`);
  console.log(`  A cadastrar ................ ${novos.length}`);

  if (descartados.length) {
    console.log('\nDescartados:');
    descartados.forEach((d) => console.log(`  linha ${d.linha}: ${d.nome || '(sem nome)'} — ${d.motivo}`));
  }
  if (repetidos.length) {
    console.log('\nUnificados (mesmo telefone):');
    repetidos.forEach((u) => console.log(`  ${u.cliente.nome} ${u.cliente.telefone} — linhas ${u.linhas.join(', ')}`));
  }
  if (revisar.length) {
    console.log('\nIdades para conferir (resposta livre não interpretada com segurança):');
    revisar.forEach((u) =>
      console.log(`  ${u.cliente.nome} — "${u.revisarIdades}" → ${u.cliente.idades.length ? u.cliente.idades.join(', ') : 'sem idades'}`)
    );
  }

  if (!executar) {
    console.log('\nExemplo dos primeiros 3 cadastros:');
    novos.slice(0, 3).forEach((u) => console.log(' ', JSON.stringify(u.cliente)));
    console.log('\nNada foi gravado. Para cadastrar, rode de novo com --executar.');
    return;
  }

  console.log('\nCadastrando...');
  let ok = 0;
  const falhas = [];
  for (const u of novos) {
    try {
      const res = await fetch(`${API_URL}/clientes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(u.cliente),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      ok++;
    } catch (error) {
      falhas.push({ nome: u.cliente.nome, telefone: u.cliente.telefone, erro: error.message });
    }
  }

  console.log(`\n✅ Cadastrados: ${ok}`);
  if (falhas.length) {
    console.log(`❌ Falhas: ${falhas.length}`);
    falhas.forEach((f) => console.log(`  ${f.nome} ${f.telefone} — ${f.erro}`));
    process.exitCode = 1;
  }
};

main();
