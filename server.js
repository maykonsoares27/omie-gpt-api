import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const URLS = {
  clientes: "https://app.omie.com.br/api/v1/geral/clientes/",
  produtos: "https://app.omie.com.br/api/v1/geral/produtos/",
  estoque: "https://app.omie.com.br/api/v1/estoque/consulta/",
  pedidos: "https://app.omie.com.br/api/v1/produtos/pedido/",
  receber: "https://app.omie.com.br/api/v1/financas/contareceber/",
  ordemProducao: "https://app.omie.com.br/api/v1/produtos/op/"
};

let produtosCache = null;
let produtosCacheHora = 0;
const CACHE_TEMPO_MS = 5 * 60 * 1000;

async function chamarOmie(url, call, param = {}) {
  const response = await axios.post(url, {
    call,
    app_key: process.env.OMIE_APP_KEY,
    app_secret: process.env.OMIE_APP_SECRET,
    param: [param]
  });

  return response.data;
}

function limparTexto(texto) {
  return String(texto || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hojeBR() {
  const hoje = new Date();
  const dia = String(hoje.getDate()).padStart(2, "0");
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const ano = hoje.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

function inicioMesBR() {
  const hoje = new Date();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const ano = hoje.getFullYear();
  return `01/${mes}/${ano}`;
}

function resumirCliente(c) {
  return {
    codigo_cliente_omie: c.codigo_cliente_omie,
    razao_social: c.razao_social,
    nome_fantasia: c.nome_fantasia,
    cnpj_cpf: c.cnpj_cpf,
    cidade: c.cidade,
    estado: c.estado,
    email: c.email,
    telefone1_ddd: c.telefone1_ddd,
    telefone1_numero: c.telefone1_numero,
    endereco: c.endereco,
    endereco_numero: c.endereco_numero,
    bairro: c.bairro,
    cep: c.cep,
    tags: c.tags
  };
}

function resumirProduto(p) {
  return {
    codigo: p.codigo,
    codigo_produto: p.codigo_produto,
    codigo_produto_integracao: p.codigo_produto_integracao,
    descricao: p.descricao,
    unidade: p.unidade,
    valor_unitario: p.valor_unitario,
    codigo_familia: p.codigo_familia,
    descricao_familia: p.descricao_familia,
    bloqueado: p.bloqueado,
    inativo: p.inativo,
    marca: p.marca,
    modelo: p.modelo,
    ncm: p.ncm,
    ean: p.ean
  };
}

async function buscarProdutosOmie() {
  const agora = Date.now();

  if (produtosCache && agora - produtosCacheHora < CACHE_TEMPO_MS) {
    return produtosCache;
  }

  const primeira = await chamarOmie(URLS.produtos, "ListarProdutos", {
    pagina: 1,
    registros_por_pagina: 50,
    filtrar_apenas_omiepdv: "N",
    apenas_importado_api: "N"
  });

  const totalPaginas = primeira.total_de_paginas || 1;
  let produtos = primeira.produto_servico_cadastro || [];

  for (let pagina = 2; pagina <= totalPaginas; pagina++) {
    const dados = await chamarOmie(URLS.produtos, "ListarProdutos", {
      pagina,
      registros_por_pagina: 50,
      filtrar_apenas_omiepdv: "N",
      apenas_importado_api: "N"
    });

    produtos = produtos.concat(dados.produto_servico_cadastro || []);
  }

  produtosCache = produtos;
  produtosCacheHora = agora;

  return produtos;
}

async function buscarProdutoPorNome(nome) {
  const busca = limparTexto(nome);
  const produtos = await buscarProdutosOmie();

  return produtos
    .filter((p) => {
      const descricao = limparTexto(p.descricao);
      const codigo = limparTexto(p.codigo);
      const inativo = descricao.startsWith("INAT") || codigo.startsWith("INAT");

      if (inativo) return false;

      return limparTexto(JSON.stringify(p)).includes(busca);
    })
    .slice(0, 20);
}

app.get("/", (req, res) => {
  res.json({
    status: "online",
    empresa: "Industria de Cafe Nova Era",
    rotas: [
      "/clientes?nome=MARIANA",
      "/produtos?nome=ROMANO",
      "/estoque?produto=ROMANO",
      "/estoque?id_prod=8795450590",
      "/pedidos",
      "/receber",
      "/ordens-producao",
      "/proposta?cliente=MARIANA&produto=ROMANO&quantidade=10",
      "/limpar-cache"
    ],
    removido: "/financeiro-resumo removido por falta de estrutura correta no Omie"
  });
});

app.get("/clientes", async (req, res) => {
  try {
    const nome = req.query.nome;

    if (!nome) {
      return res.status(400).json({
        erro: true,
        mensagem: "Informe o nome do cliente. Exemplo: /clientes?nome=MARIANA"
      });
    }

    const dados = await chamarOmie(URLS.clientes, "ListarClientes", {
      pagina: 1,
      registros_por_pagina: 10,
      apenas_importado_api: "N",
      clientesFiltro: {
        razao_social: nome
      }
    });

    const clientes = dados.clientes_cadastro || [];

    res.json({
      encontrados: clientes.length,
      clientes: clientes.map(resumirCliente),
      aviso: "Dados consultados no Omie."
    });
  } catch (error) {
    res.status(500).json({
      erro: true,
      rota: "clientes",
      detalhe: error.response?.data || error.message
    });
  }
});

app.get("/produtos", async (req, res) => {
  try {
    const nome = req.query.nome || "";
    let produtos = nome ? await buscarProdutoPorNome(nome) : await buscarProdutosOmie();

    produtos = produtos.filter((p) => {
      const descricao = limparTexto(p.descricao);
      const codigo = limparTexto(p.codigo);
      return !descricao.startsWith("INAT") && !codigo.startsWith("INAT");
    });

    res.json({
      encontrados: produtos.length,
      produtos: produtos.slice(0, 50).map(resumirProduto),
      aviso: "Produtos consultados no Omie. Confirme preço e cadastro antes de proposta oficial."
    });
  } catch (error) {
    res.status(500).json({
      erro: true,
      rota: "produtos",
      detalhe: error.response?.data || error.message
    });
  }
});

app.get("/estoque", async (req, res) => {
  try {
    const produto = req.query.produto || "";
    let id_prod = req.query.id_prod || req.query.codigo_produto || "";
    const data = req.query.data || hojeBR();

    if (!id_prod && produto) {
      const encontrados = await buscarProdutoPorNome(produto);

      if (encontrados.length === 0) {
        return res.status(404).json({
          erro: true,
          mensagem: "Produto não encontrado para consultar estoque.",
          produto_pesquisado: produto
        });
      }

      if (encontrados.length > 1) {
        return res.json({
          escolha_necessaria: true,
          mensagem:
            "Encontrei mais de um produto. Escolha um id_prod para consultar o estoque.",
          produtos: encontrados.map(resumirProduto)
        });
      }

      id_prod = encontrados[0].codigo_produto;
    }

    if (!id_prod) {
      return res.status(400).json({
        erro: true,
        mensagem:
          "Informe id_prod ou produto. Exemplo: /estoque?id_prod=8795450590"
      });
    }

    const dados = await chamarOmie(URLS.estoque, "PosicaoEstoque", {
      id_prod: Number(id_prod),
      data
    });

    res.json({
      consulta: "estoque",
      id_prod,
      data,
      dados
    });
  } catch (error) {
    res.status(500).json({
      erro: true,
      rota: "estoque",
      call_testado: "PosicaoEstoque",
      detalhe: error.response?.data || error.message
    });
  }
});

app.get("/pedidos", async (req, res) => {
  try {
    const data_inicio = req.query.data_inicio || inicioMesBR();
    const data_fim = req.query.data_fim || hojeBR();
    const pagina = Number(req.query.pagina || 1);

    const dados = await chamarOmie(URLS.pedidos, "ListarPedidos", {
      pagina,
      registros_por_pagina: 20,
      apenas_importado_api: "N",
      filtrar_por_data_de: data_inicio,
      filtrar_por_data_ate: data_fim
    });

    res.json({
      consulta: "pedidos",
      periodo: { data_inicio, data_fim },
      dados
    });
  } catch (error) {
    res.status(500).json({
      erro: true,
      rota: "pedidos",
      call_testado: "ListarPedidos",
      detalhe: error.response?.data || error.message
    });
  }
});

app.get("/receber", async (req, res) => {
  try {
    const data_inicio = req.query.data_inicio || inicioMesBR();
    const data_fim = req.query.data_fim || hojeBR();
    const pagina = Number(req.query.pagina || 1);

    const dados = await chamarOmie(URLS.receber, "ListarContasReceber", {
      pagina,
      registros_por_pagina: 20,
      filtrar_por_data_de: data_inicio,
      filtrar_por_data_ate: data_fim
    });

    res.json({
      consulta: "contas-a-receber",
      periodo: { data_inicio, data_fim },
      dados
    });
  } catch (error) {
    res.status(500).json({
      erro: true,
      rota: "receber",
      call_testado: "ListarContasReceber",
      detalhe: error.response?.data || error.message
    });
  }
});

app.get("/ordens-producao", async (req, res) => {
  try {
    const pagina = Number(req.query.pagina || 1);

    const dados = await chamarOmie(URLS.ordemProducao, "ListarOrdemProducao", {
      pagina,
      registros_por_pagina: 20
    });

    res.json({
      consulta: "ordens-producao",
      dados
    });
  } catch (error) {
    res.status(500).json({
      erro: true,
      rota: "ordens-producao",
      call_testado: "ListarOrdemProducao",
      detalhe: error.response?.data || error.message
    });
  }
});

app.get("/proposta", async (req, res) => {
  try {
    const cliente = req.query.cliente;
    const produto = req.query.produto;
    const quantidade = Number(req.query.quantidade || 1);

    if (!cliente || !produto) {
      return res.status(400).json({
        erro: true,
        mensagem:
          "Informe cliente e produto. Exemplo: /proposta?cliente=MARIANA&produto=ROMANO&quantidade=10"
      });
    }

    const dadosCliente = await chamarOmie(URLS.clientes, "ListarClientes", {
      pagina: 1,
      registros_por_pagina: 10,
      apenas_importado_api: "N",
      clientesFiltro: {
        razao_social: cliente
      }
    });

    const clientes = dadosCliente.clientes_cadastro || [];
    const produtos = await buscarProdutoPorNome(produto);

    res.json({
      cliente_pesquisado: cliente,
      produto_pesquisado: produto,
      quantidade,
      clientes_encontrados: clientes.map(resumirCliente),
      produtos_encontrados: produtos.map(resumirProduto),
      orientacao_para_gpt:
        "Monte uma proposta comercial objetiva. Se houver mais de um cliente ou produto, peça escolha. Nunca invente preço, desconto, prazo, brinde ou condição comercial."
    });
  } catch (error) {
    res.status(500).json({
      erro: true,
      rota: "proposta",
      detalhe: error.response?.data || error.message
    });
  }
});

app.get("/limpar-cache", (req, res) => {
  produtosCache = null;
  produtosCacheHora = 0;

  res.json({
    status: "cache_limpo",
    mensagem: "Cache de produtos limpo. A próxima consulta buscará novamente no Omie."
  });
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
