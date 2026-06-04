import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const OMIE_CLIENTES_URL = "https://app.omie.com.br/api/v1/geral/clientes/";

app.get("/", (req, res) => {
  res.json({
    status: "online",
    empresa: "Industria de Cafe Nova Era",
    rotas: ["/clientes?nome=MARIANA"]
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

    const response = await axios.post(OMIE_CLIENTES_URL, {
      call: "ListarClientes",
      app_key: process.env.OMIE_APP_KEY,
      app_secret: process.env.OMIE_APP_SECRET,
      param: [
        {
          pagina: 1,
          registros_por_pagina: 10,
          apenas_importado_api: "N",
          clientesFiltro: {
            razao_social: nome
          }
        }
      ]
    });

    res.json(response.data);
  } catch (error) {
    res.status(500).json({
      erro: true,
      mensagem: "Erro ao consultar Omie",
      detalhe: error.response?.data || error.message
    });
  }
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
