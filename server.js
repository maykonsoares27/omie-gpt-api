import express from "express";

const app = express();

app.get("/", (req, res) => {
  res.json({
    status: "online",
    empresa: "Industria de Cafe Nova Era"
  });
});

const PORT = process.env.PORT || 100
