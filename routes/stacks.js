const express = require("express");
const axios = require("axios");
const router = express.Router();

// Proxy endpoint for Hiro Stacks API transaction status
// GET /api/stacks/tx/:txId
router.get("/tx/:txId", async (req, res) => {
  const { txId } = req.params;
  try {
    const hiroUrl = `https://api.testnet.hiro.so/extended/v1/tx/${txId}`;
    const response = await axios.get(hiroUrl);
    res.status(200).json(response.data);
  } catch (err) {
    const status = err.response?.status || 500;
    res.status(status).json({
      message: "Failed to fetch transaction status from Hiro API",
      error: err.message,
    });
  }
});

// Proxy endpoint for Hiro read-only contract calls to avoid browser CORS
// POST /api/stacks/call-read
router.post("/call-read", async (req, res) => {
  const {
    contractAddress,
    contractName,
    functionName,
    functionArgs,
    senderAddress,
  } = req.body;
  try {
    const hiroUrl = `https://api.testnet.hiro.so/v2/contracts/call-read/${contractAddress}/${contractName}/${functionName}`;
    const payload = { sender: senderAddress, arguments: functionArgs };
    const response = await axios.post(hiroUrl, payload, {
      headers: { "Content-Type": "application/json" },
    });
    res.status(200).json(response.data);
  } catch (err) {
    const status = err.response?.status || 500;
    res.status(status).json({
      message: "Failed to call-read via Hiro API",
      error: err.message,
      details: err.response?.data,
    });
  }
});

module.exports = router;
