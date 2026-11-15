#!/usr/bin/env node
/*
 * Importa leads exportados (arquivo TSV) como clientes, cada um com uma negociação
 * em "Sem contato" no quadro de negociações.
 *
 * Formatos reconhecidos automaticamente pelo cabeçalho:
 * - Landing page (formulário do site): perguntas como colunas + utm_* + "Submitted At"
 * - Meta Lead Ads (formulário instantâneo do Facebook/Instagram): full_name, phone_number, ...
 *
 * Uso:
 *   API_TOKEN=<token de login> node scripts/importar-leads.js <arquivo.tsv> [--api URL] [--executar]
 *   node scripts/importar-leads.js <arquivo.tsv> --offline      (só lê e valida o arquivo, sem API)
 *
 * Sem --executar roda em modo simulação: valida, unifica e mostra o relatório sem gravar nada.
 *
 * Regras:
 * - Ignora linhas de teste.
 * - Um cliente por telefone: dados mais recentes, nome mais completo, data do primeiro contato.
 * - Pula telefones que já existem no sistema (pode rodar de novo sem duplicar).
 * - Clientes entram com status "lead" e ganham uma negociação em "Sem contato".
 */
const fs = require('fs');

const args = process.argv.slice(2);
const arquivo = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--api');
const executar = args.includes('--executar');
const offline = args.includes('--offline');
const apiIndex = args.indexOf('--api');
const API_URL = (apiIndex >= 0 ? args[apiIndex + 1] : process.env.API_URL || 'http://localhost:3001/api').replace(/\/$/, '');
const AUTH_HEADERS = process.env.API_TOKEN ? { Authorization: `Bearer ${process.env.API_TOKEN}` } : {};

if (!arquivo || (offline && executar)) {
  console.error('Uso: API_TOKEN=<token> node scripts/importar-leads.js <arquivo.tsv> [--api URL] [--executar | --offline]');
  process.exit(1);
}

// ---------- Utilidades ----------

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

// TSV com campos entre aspas que podem conter tab, quebra de linha e "" escapado
const parseTSV = (text) => {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === '\t') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim()));
};

// Extrai idades de respostas livres: "62 , 55 , 18", "72 e 75 anos", "2 pessoas 72 e 74".
// Faixas ("60 anos ou mais", "51+") não são idades — são descartadas.
// Retorna { idades, revisar } — revisar = texto que não deu para interpretar com segurança.
const parseIdades = (texto, pessoasEsperadas = null) => {
  const original = limpar(texto);
  const semFaixas = original
    .toLowerCase()
    .replace(/\d+\s*(anos?)?\s*ou\s+mais/g, ' ')
    .replace(/\d+\s*\+/g, ' ');
  const semContagem = semFaixas.replace(/\d+\s*(pessoas?|vidas?)/g, ' ');
  const numeros = (semContagem.match(/\d+/g) || []).map(Number);
  const palavras = semContagem.replace(/[\d\s,;./e]+|anos?|cada|um/g, ' ').trim();
  const temFaixa = semFaixas !== original.toLowerCase();

  if (numeros.length === 0) return { idades: [], revisar: original || null };
  if (numeros.some((n) => n > 130)) return { idades: [], revisar: original };
  const contagemDiferente = pessoasEsperadas && numeros.length !== pessoasEsperadas;
  return { idades: numeros, revisar: palavras || temFaixa || contagemDiferente ? original : null };
};

// ---------- Formatos ----------

// Landing page: colunas por posição, conferidas pelo texto do cabeçalho
const LANDING = {
  nome: 'Landing page',
  detecta: (header) => (header[0] || '').toLowerCase().includes('possui plano de saúde'),
  colunas: {
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
  },
  validaCabecalho(header) {
    for (const [campo, [i, trecho]] of Object.entries(this.colunas)) {
      if (!(header[i] || '').toLowerCase().includes(trecho)) {
        return `coluna ${i + 1} (${campo}): esperava conter "${trecho}", veio "${header[i]}"`;
      }
    }
    return null;
  },
  // "dd/mm/aaaa hh:mm:ss" (horário de Brasília)
  converte(cells) {
    const col = (campo) => limpar(cells[this.colunas[campo][0]]);
    const nome = col('nome');
    const utmSource = col('utmSource');
    const teste = /^(teste?|test)\b/i.test(nome) || /^x+$/i.test(utmSource) || /test_url/i.test(utmSource);
    const m = col('enviadoEm').match(/^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2}):(\d{2}))?/);
    const data = m ? { iso: `${m[3]}-${m[2]}-${m[1]}`, ordem: `${m[3]}${m[2]}${m[1]}${m[4] || '00'}${m[5] || '00'}${m[6] || '00'}` } : null;
    const possui = col('possuiPlano').toLowerCase();
    const { idades, revisar } = parseIdades(col('idades'));
    return {
      teste,
      data,
      revisarIdades: revisar,
      cliente: {
        nome,
        telefone: telefoneDigitos(col('telefone')),
        idades,
        possui_plano: possui.startsWith('tenho') ? true : possui.startsWith('não') || possui.startsWith('nao') ? false : null,
        plano_atual: col('planoAtual') || null,
        custo_plano_atual: col('custoAtual') || null,
        investimento_pretendido: col('investimento') || null,
        hospitais_preferidos: col('hospitais') || null,
        utm_source: utmSource || null,
        utm_medium: col('utmMedium') || null,
        utm_campaign: col('utmCampaign') || null,
        utm_term: col('utmTerm') || null,
        utm_content: col('utmContent') || null,
      },
    };
  },
};

// Meta Lead Ads: colunas pelo nome
const META = {
  nome: 'Meta Lead Ads (Facebook/Instagram)',
  obrigatorias: [
    'created_time', 'full_name', 'phone_number', 'email', 'campaign_name', 'adset_name', 'ad_name', 'platform',
    'is_organic', 'possui_plano_de_saúde_ativo?', 'até_quanto_pretende_investir?',
    'quantas_pessoas_pessoas_para_a_cotação?', 'quais_as_idades_das_pessoas?',
  ],
  detecta: (header) => header.includes('full_name') && header.includes('phone_number'),
  validaCabecalho(header) {
    const faltando = this.obrigatorias.filter((c) => !header.includes(c));
    if (faltando.length) return `colunas ausentes: ${faltando.join(', ')}`;
    this.idx = Object.fromEntries(header.map((h, i) => [h, i]));
    return null;
  },
  converte(cells) {
    const col = (campo) => limpar(cells[this.idx[campo]]);
    const nome = col('full_name');
    const teste = /^(teste?|test)\b/i.test(nome) || col('lead_status') === 'TEST';

    // "2026-08-07T08:48:33-05:00" → data/hora em Brasília (UTC-3)
    const ms = Date.parse(col('created_time'));
    let data = null;
    if (!Number.isNaN(ms)) {
      const brt = new Date(ms - 3 * 60 * 60 * 1000).toISOString(); // horário de Brasília expresso como "UTC"
      data = { iso: brt.slice(0, 10), ordem: brt.replace(/\D/g, '').slice(0, 14) };
    }

    const possui = col('possui_plano_de_saúde_ativo?');
    // "até_r$_2.000" → "Até R$ 2.000"
    const invest = col('até_quanto_pretende_investir?').replace(/_/g, ' ').replace(/^até r\$/i, 'Até R$');
    const pessoas = Number((col('quantas_pessoas_pessoas_para_a_cotação?').match(/^(\d+)_pessoa/) || [])[1]) || null;
    const { idades, revisar } = parseIdades(col('quais_as_idades_das_pessoas?'), pessoas);
    const plataforma = { ig: 'Instagram', fb: 'Facebook' }[col('platform')] || col('platform') || null;

    return {
      teste,
      data,
      revisarIdades: revisar,
      cliente: {
        nome,
        telefone: telefoneDigitos(col('phone_number')),
        email: col('email') || null,
        idades,
        possui_plano: possui === 'possuo_plano_de_saúde' ? true : possui === 'não_possuo_plano_de_saúde' ? false : null,
        investimento_pretendido: invest || null,
        utm_source: col('is_organic') === 'true' ? 'META LEAD ADS (orgânico)' : 'META LEAD ADS',
        utm_medium: col('adset_name') || null,
        utm_campaign: col('campaign_name') || null,
        utm_term: plataforma,
        utm_content: col('ad_name') || null,
      },
    };
  },
};

// ---------- Leitura ----------

const [header, ...linhas] = parseTSV(fs.readFileSync(arquivo, 'utf8').replace(/^﻿/, ''));
const headerNormalizado = header.map((h) => h.trim());
const formato = [LANDING, META].find((f) => f.detecta(headerNormalizado.map((h) => h.toLowerCase())) || f.detecta(headerNormalizado));
if (!formato) {
  console.error('❌ Formato de arquivo não reconhecido (nem landing page, nem Meta Lead Ads).');
  process.exit(1);
}
const erroCabecalho = formato.validaCabecalho(headerNormalizado.map((h) => (formato === LANDING ? h.toLowerCase() : h)));
if (erroCabecalho) {
  console.error(`❌ Cabeçalho inesperado para ${formato.nome}: ${erroCabecalho}`);
  process.exit(1);
}

const leads = [];
const descartados = [];

linhas.forEach((cells, i) => {
  const numero = i + 2;
  const lead = formato.converte(cells);
  const { nome, telefone } = lead.cliente;
  if (lead.teste) {
    descartados.push({ linha: numero, nome, motivo: 'teste' });
  } else if (!nome || telefone.length < 10 || !lead.data) {
    descartados.push({ linha: numero, nome, motivo: 'sem nome, telefone ou data válidos' });
  } else {
    lead.cliente.telefone = maskTelefone(telefone);
    lead.cliente.status = 'lead';
    lead.cliente.data_cadastro = lead.data.iso;
    leads.push({ linha: numero, ordem: lead.data.ordem, revisarIdades: lead.revisarIdades, cliente: lead.cliente });
  }
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

// ---------- API ----------

const api = async (method, path, body) => {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...AUTH_HEADERS },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error('não autorizado — defina API_TOKEN com um token de login válido');
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
};

// ---------- Execução ----------

const main = async () => {
  console.log(`\n📄 Arquivo: ${arquivo}`);
  console.log(`🗂️  Formato: ${formato.nome}`);
  console.log(`🌐 API: ${offline ? '(offline — não consulta o sistema)' : API_URL}`);
  console.log(`⚙️  Modo: ${executar ? 'EXECUTAR (vai gravar)' : 'SIMULAÇÃO (nada será gravado)'}\n`);

  let existentes = new Set();
  if (!offline) {
    try {
      const clientes = await api('GET', '/clientes');
      existentes = new Set(clientes.map((c) => telefoneDigitos(c.telefone)).filter(Boolean));
    } catch (error) {
      console.error(`❌ Não foi possível consultar os clientes existentes: ${error.message}`);
      process.exit(1);
    }
  }

  const novos = unificados.filter((u) => !existentes.has(telefoneDigitos(u.cliente.telefone)));
  const jaExistem = unificados.filter((u) => existentes.has(telefoneDigitos(u.cliente.telefone)));
  const repetidos = unificados.filter((u) => u.linhas.length > 1);
  const revisar = unificados.filter((u) => u.revisarIdades);
  const datas = unificados.map((u) => u.cliente.data_cadastro).sort();

  console.log('Resumo');
  console.log(`  Leads no arquivo ........... ${leads.length + descartados.length}`);
  console.log(`  Período .................... ${datas[0] || '-'} → ${datas[datas.length - 1] || '-'}`);
  console.log(`  Descartados (teste/inválido) ${descartados.length}`);
  console.log(`  Unificados por telefone .... ${leads.length - unificados.length} (de ${repetidos.length} telefones repetidos)`);
  console.log(`  Já existem no sistema ...... ${offline ? '(não verificado — offline)' : jaExistem.length}`);
  console.log(`  A cadastrar ................ ${novos.length}${offline ? ' (antes de checar o sistema)' : ''}`);

  if (descartados.length) {
    console.log('\nDescartados:');
    descartados.forEach((d) => console.log(`  linha ${d.linha}: ${d.nome || '(sem nome)'} — ${d.motivo}`));
  }
  if (jaExistem.length) {
    console.log('\nJá existem no sistema (pulados):');
    jaExistem.forEach((u) => console.log(`  ${u.cliente.nome} ${u.cliente.telefone}`));
  }
  if (repetidos.length) {
    console.log('\nUnificados (mesmo telefone):');
    repetidos.forEach((u) => console.log(`  ${u.cliente.nome} ${u.cliente.telefone} — linhas ${u.linhas.join(', ')}`));
  }
  if (revisar.length) {
    console.log('\nIdades para conferir (resposta livre, faixa etária ou quantidade diferente do informado):');
    revisar.forEach((u) =>
      console.log(`  ${u.cliente.nome} — "${u.revisarIdades}" → ${u.cliente.idades.length ? u.cliente.idades.join(', ') : 'sem idades'}`)
    );
  }

  if (!executar) {
    console.log('\nExemplo dos primeiros 3 cadastros:');
    novos.slice(0, 3).forEach((u) => console.log(' ', JSON.stringify(u.cliente)));
    console.log(`\nNada foi gravado.${offline ? '' : ' Para cadastrar, rode de novo com --executar.'}`);
    return;
  }

  console.log('\nCadastrando...');
  let ok = 0;
  let semNegociacao = 0;
  const falhas = [];
  for (const u of novos) {
    try {
      const cliente = await api('POST', '/clientes', u.cliente);
      ok++;
      try {
        await api('POST', '/negociacoes', { cliente_id: cliente.id, etapa: 'sem_contato', status: 'em_andamento' });
      } catch (error) {
        semNegociacao++;
        falhas.push({ nome: u.cliente.nome, telefone: u.cliente.telefone, erro: `cliente criado, negociação não: ${error.message}` });
      }
    } catch (error) {
      falhas.push({ nome: u.cliente.nome, telefone: u.cliente.telefone, erro: error.message });
    }
  }

  console.log(`\n✅ Clientes cadastrados: ${ok} (com negociação em "Sem contato": ${ok - semNegociacao})`);
  if (falhas.length) {
    console.log(`❌ Falhas: ${falhas.length}`);
    falhas.forEach((f) => console.log(`  ${f.nome} ${f.telefone} — ${f.erro}`));
    process.exitCode = 1;
  }
};

main();
