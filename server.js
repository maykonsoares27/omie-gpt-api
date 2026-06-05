import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const OMIE_CLIENTES_URL = "https://app.omie.com.br/api/v1/geral/clientes/";
const OMIE_PRODUTOS_URL = "https://app.omie.com.br/api/v1/geral/produtos/";

let produtosCache = null;
let produtosCacheHora = 0;
const CACHE_TEMPO_MS = 5 * 60 * 1000; // 5 minutos

async function chamarOmie(url, call, param) {
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

function resumirCliente(cliente) {
  return {
    codigo_cliente_omie: cliente.codigo_cliente_omie,
    razao_social: cliente.razao_social,
    nome_fantasia: cliente.nome_fantasia,
    cnpj_cpf: cliente.cnpj_cpf,
    cidade: cliente.cidade,
    estado: cliente.estado,
    email: cliente.email,
    telefone1_ddd: cliente.telefone1_ddd,
    telefone1_numero: cliente.telefone1_numero,
    endereco: cliente.endereco,
    endereco_numero: cliente.endereco_numero,
    bairro: cliente.bairro,
    cep: cliente.cep,
    tags: cliente.tags
  };
}

function resumirProduto(produto) {
  return {
    codigo: produto.codigo,
    codigo_produto: produto.codigo_produto,
    codigo_produto_integracao: produto.codigo_produto_integracao,
    descricao: produto.descricao,
    unidade: produto.unidade,
    valor_unitario: produto.valor_unitario,
    codigo_familia: produto.codigo_familia,
    descricao_familia: produto.descricao_familia,
    bloqueado: produto.bloqueado,
    inativo: produto.inativo,
    marca: produto.marca,
    modelo: produto.modelo,
    ncm: produto.ncm,
    ean: produto.ean
  };
}

async function buscarProdutosOmie() {
  const agora = Date.now();

  if (produtosCache && agora - produtosCacheHora < CACHE_TEMPO_MS) {
    return produtosCache;
  }

  const primeiraPagina = await chamarOmie(
    OMIE_PRODUTOS_URL,
    "ListarProdutos",
    {
      pagina: 1,
      registros_por_pagina: 50,
      filtrar_apenas_omiepdv: "N",
      apenas_importado_api: "N"
    }
  );

  const totalPaginas = primeiraPagina.total_de_paginas || 1;
  let todosProdutos = primeiraPagina.produto_servico_cadastro || [];

  for (let pagina = 2; pagina <= totalPaginas; pagina++) {
    const dados = await chamarOmie(
      OMIE_PRODUTOS_URL,
      "ListarProdutos",
      {
        pagina,
        registros_por_pagina: 50,
        filtrar_apenas_omiepdv: "N",
        apenas_importado_api: "N"
      }
    );

    todosProdutos = todosProdutos.concat(dados.produto_servico_cadastro || []);
  }

  produtosCache = todosProdutos;
  produtosCacheHora = agora;

  return todosProdutos;
}

app.get("/", (req, res) => {
  res.json({
    status: "online",
    empresa: "Industria de Cafe Nova Era",
    rotas: [
      "/clientes?nome=MARIANA",
      "/produtos",
      "/produtos?nome=ROMANO",
      "/proposta?cliente=MARIANA&produto=ROMANO&quantidade=10"
    ]
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

    const dados = await chamarOmie(
      OMIE_CLIENTES_URL,
      "ListarClientes",
      {
        pagina: 1,
        registros_por_pagina: 10,
        apenas_importado_api: "N",
        clientesFiltro: {
          razao_social: nome
        }
      }
    );

    const clientes = dados.clientes_cadastro || [];

    res.json({
      encontrados: clientes.length,
      clientes: clientes.map(resumirCliente),
      aviso:
        "Dados consultados no Omie. Confirme antes de usar em documento, proposta ou comunicação oficial."
    });
  } catch (error) {
    res.status(500).json({
      erro: true,
      mensagem: "Erro ao consultar clientes no Omie",
      detalhe: error.response?.data || error.message
    });
  }
});

app.get("/produtos", async (req, res) => {
  try {
    const nome = req.query.nome || "";
    const busca = limparTexto(nome);

    let produtos = await buscarProdutosOmie();

    produtos = produtos.filter((produto) => {
      const textoProduto = limparTexto(JSON.stringify(produto));

      const descricao = limparTexto(produto.descricao);
      const codigo = limparTexto(produto.codigo);
      const inativo = descricao.startsWith("INAT") || codigo.startsWith("INAT");

      if (inativo) return false;

      if (!busca) return true;

      return textoProduto.includes(busca);
    });

    res.json({
      encontrados: produtos.length,
      produtos: produtos.slice(0, 50).map(resumirProduto),
      aviso:
        "Produtos consultados no Omie. Preço, código e cadastro devem ser confirmados antes de proposta oficial."
    });
  } catch (error) {
    res.status(500).json({
      erro: true,
      mensagem: "Erro ao consultar produtos no Omie",
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

    const dadosCliente = await chamarOmie(
      OMIE_CLIENTES_URL,
      "ListarClientes",
      {
        pagina: 1,
        registros_por_pagina: 10,
        apenas_importado_api: "N",
        clientesFiltro: {
          razao_social: cliente
        }
      }
    );

    const clientes = dadosCliente.clientes_cadastro || [];

    const todosProdutos = await buscarProdutosOmie();
    const buscaProduto = limparTexto(produto);

    const produtos = todosProdutos
      .filter((item) => {
        const descricao = limparTexto(item.descricao);
        const codigo = limparTexto(item.codigo);
        const inativo = descricao.startsWith("INAT") || codigo.startsWith("INAT");

        if (inativo) return false;

        return limparTexto(JSON.stringify(item)).includes(buscaProduto);
      })
      .slice(0, 20);

    res.json({
      cliente_pesquisado: cliente,
      produto_pesquisado: produto,
      quantidade,
      clientes_encontrados: clientes.map(resumirCliente),
      produtos_encontrados: produtos.map(resumirProduto),
      orientacao_para_gpt:
        "Monte uma proposta comercial objetiva com os dados retornados. Se houver mais de um cliente ou produto, peça ao usuário para escolher. Nunca invente preço, desconto, prazo, brinde ou condição comercial. Informe que preço e cadastro foram consultados no Omie e devem ser revisados antes do envio oficial."
    });
  } catch (error) {
    res.status(500).json({
      erro: true,
      mensagem: "Erro ao montar proposta",
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
