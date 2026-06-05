import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const OMIE_CLIENTES_URL = "https://app.omie.com.br/api/v1/geral/clientes/";
const OMIE_PRODUTOS_URL = "https://app.omie.com.br/api/v1/geral/produtos/";

async function chamarOmie(url, call, param) {
  const response = await axios.post(url, {
    call,
    app_key: process.env.OMIE_APP_KEY,
    app_secret: process.env.OMIE_APP_SECRET,
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
    const nome = req.query.nome || "";

    const dados = await chamarOmie(
      OMIE_PRODUTOS_URL,
      "ListarProdutos",
      {
        pagina: 1,
        registros_por_pagina: 50,
        filtrar_apenas_omiepdv: "N",
        apenas_importado_api: "N"
      }
    );

    let produtos = dados.produto_servico_cadastro || [];

    if (nome) {
      produtos = produtos.filter((produto) =>
        JSON.stringify(produto)
          .toUpperCase()
          .includes(nome.toUpperCase())
      );
    }

    res.json({
      encontrados: produtos.length,
      total_omie: dados.total_de_registros,
      produtos
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

    const dadosProduto = await chamarOmie(
      OMIE_PRODUTOS_URL,
      "ListarProdutos",
      {
        pagina: 1,
        registros_por_pagina: 50,
        filtrar_apenas_omiepdv: "N",
        apenas_importado_api: "N"
      }
    );

    let produtos = dadosProduto.produto_servico_cadastro || [];

    produtos = produtos.filter((item) =>
      JSON.stringify(item)
        .toUpperCase()
        .includes(produto.toUpperCase())
    );

    res.json({
      cliente_pesquisado: cliente,
      produto_pesquisado: produto,
      quantidade,
      clientes_encontrados: dadosCliente.clientes_cadastro || [],
      produtos_encontrados: produtos,
      orientacao_para_gpt:
        "Use os dados retornados para montar uma proposta comercial objetiva. Se o preço não estiver claro no cadastro do produto, informe que o valor precisa ser confirmado antes do envio."
    });
  } catch (error) {
    res.status(500).json({
      erro: true,
      mensagem: "Erro ao montar proposta",
      detalhe: error.response?.data || error.message
    });
  }
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
