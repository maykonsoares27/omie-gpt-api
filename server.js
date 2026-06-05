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
      "/teste-produtos"
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
      etapa: "clientes",
      detalhe: error.response?.data || error.message
    });
  }
});

app.get("/teste-produtos", async (req, res) => {
  try {
    const dados = await chamarOmie(
      OMIE_PRODUTOS_URL,
      "ListarProdutos",
      {
        pagina: 1,
        registros_por_pagina: 10,
        apenas_importado_api: "N"
      }
    );

    res.json(dados);
  } catch (error) {
    res.status(500).json({
      erro: true,
      etapa: "teste-produtos",
      detalhe: error.response?.data || error.message
    });
  }
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
