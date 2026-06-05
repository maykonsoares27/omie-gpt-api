import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const OMIE_CLIENTES_URL = "https://app.omie.com.br/api/v1/geral/clientes/";
const OMIE_PRODUTOS_URL = "https://app.omie.com.br/api/v1/geral/produtos/";

function omieAuth() {
  return {
    app_key: process.env.OMIE_APP_KEY,
    app_secret: process.env.OMIE_APP_SECRET
  };
}

async function chamarOmie(url, call, param) {
  const response = await axios.post(url, {
    call,
    ...omieAuth(),
    param: [param]
  });

  return response.data;
}

app.get("/", (req, res) => {
  res.json({
    status: "online",
    empresa: "Industria de Cafe Nova Era",
    rotas: [
      "/clientes?nome=MARIANA",
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

    res.json(dados);
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
    const nome = req.query.nome;

    if (!nome) {
      return res.status(400).json({
        erro: true,
        mensagem: "Informe o nome do produto. Exemplo: /produtos?nome=ROMANO"
      });
    }

    const dados = await chamarOmie(
      OMIE_PRODUTOS_URL,
      "ListarProdutos",
      {
        pagina: 1,
        registros_por_pagina: 10,
        apenas_importado_api: "N",
        filtrar_apenas_omiepdv: "N",
        filtro: {
          descricao: nome
        }
      }
    );

    res.json(dados);
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
        mensagem: "Informe cliente e produto. Exemplo: /proposta?cliente=MARIANA&produto=ROMANO&quantidade=10"
      });
    }

    const clientes = await chamarOmie(
      OMIE_CLIENTES_URL,
      "ListarClientes",
      {
        pagina: 1,
        registros_por_pagina: 5,
        apenas_importado_api: "N",
        clientesFiltro: {
          razao_social: cliente
        }
      }
    );

    const produtos = await chamarOmie(
      OMIE_PRODUTOS_URL,
      "ListarProdutos",
      {
        pagina: 1,
        registros_por_pagina: 5,
        apenas_importado_api: "N",
        filtrar_apenas_omiepdv: "N",
        filtro: {
          descricao: produto
        }
      }
    );

    res.json({
      cliente_pesquisado: cliente,
      produto_pesquisado: produto,
      quantidade,
      clientes_encontrados: clientes.clientes_cadastro || [],
      produtos_encontrados:
        produtos.produto_servico_cadastro ||
        produtos.produtos ||
        produtos.cadastro ||
        [],
      orientacao_para_gpt:
        "Use os dados retornados para montar uma proposta comercial objetiva, com nome do cliente, produto, quantidade e condições comerciais. Se faltar preço, informe que o preço precisa ser confirmado no Omie."
    });
  } catch (error) {
    res.status(500).json({
      erro: true,
      mensagem: "Erro ao montar proposta com dados do Omie",
      detalhe: error.response?.data || error.message
    });
  }
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
