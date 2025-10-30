const express = require('express');  // 第一行：必须有
const cors = require('cors');
const path = require('path');
const axios = require('axios');

const app = express();  // 第二行：定义 app，防 ReferenceError

const PORT = process.env.PORT || 3000;

// 全局异常捕获（防未处理崩溃）
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

// 中间件（CORS + 静态文件）
app.use(cors({ origin: '*' }));  // 允许所有（生产可限域名）
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));  // 服务 index.html 等

// 根路由（发送 HTML）
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API: 1h 数据（加重试 + 错误处理）
app.get('/api/btc-1h-data', async (req, res) => {
  console.log('1h API called');
  try {
    // 先用备用 API（见步骤 2），fallback Binance
    let response;
    try {
      response = await axios.get('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=1&interval=hourly', {
        timeout: 10000,
        headers: { 'User-Agent': 'Vercel-BTC-Monitor/1.0' }
      });
      // CoinGecko 格式转换（prices: [[timestamp, price]]）
      const prices = response.data.prices;
      const data = prices.slice(-24).map((p, index) => {  // 最近 24 小时
        const time = new Date(p[0]);
        const open = index > 0 ? prices[index - 1][1] : p[1];
        const close = p[1];
        const change = close - open;
        const changePercent = (change / open) * 100;
        return {
          time: time.toISOString(),
          open, close,
          change, changePercent, changeAmount: change
        };
      }).reverse();  // 从过去到现在
      res.json(data);
    } catch (fallbackErr) {
      console.log('CoinGecko fallback to Binance');
      response = await axios.get('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=25', {
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }  // 伪装浏览器
      });
      const klines = response.data;
      const data = klines.slice(0, 24).map((kline, index) => {
        const time = new Date(kline[0]);
        const open = parseFloat(kline[1]);
        const close = parseFloat(kline[4]);
        const prevClose = index > 0 ? parseFloat(klines[index - 1][4]) : open;
        const change = close - open;
        const changePercent = (change / open) * 100;
        return {
          time: time.toISOString(),
          open, close, prevClose,
          change, changePercent, changeAmount: change
        };
      });
      res.json(data);
    }
  } catch (error) {
    console.error('API error:', error.message, error.response?.status);
    res.status(500).json({ error: `Data fetch failed: ${error.message}` });
  }
});

// API: 15min 数据（类似，调整 interval/days）
app.get('/api/btc-15min-data', async (req, res) => {
  console.log('15min API called');
  try {
    // 用 CoinGecko 小时数据近似 15min（或 Binance 15m）
    let response;
    try {
      response = await axios.get('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=1&interval=minute', {  // 分钟间隔，但限 1 天
        timeout: 10000,
        headers: { 'User-Agent': 'Vercel-BTC-Monitor/1.0' }
      });
      const prices = response.data.prices.filter((_, i) => i % 15 === 0).slice(-96);  // 每 15 分钟取一，最近 96
      const data = prices.map((p, index) => {
        const time = new Date(p[0]);
        const open = index > 0 ? prices[index - 1][1] : p[1];
        const close = p[1];
        const change = close - open;
        const changePercent = (change / open) * 100;
        return {
          time: time.toISOString(),
          open, close,
          change, changePercent, changeAmount: change
        };
      }).reverse();
      res.json(data);
    } catch (fallbackErr) {
      // Fallback to Binance 15m
      response = await axios.get('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=15m&limit=97', {
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      // ... 同上 map 逻辑，slice(0,96)
      const klines = response.data;
      const data = klines.slice(0, 96).map((kline, index) => {
        const time = new Date(kline[0]);
        const open = parseFloat(kline[1]);
        const close = parseFloat(kline[4]);
        const prevClose = index > 0 ? parseFloat(klines[index - 1][4]) : open;
        const change = close - open;
        const changePercent = (change / open) * 100;
        return {
          time: time.toISOString(),
          open, close, prevClose,
          change, changePercent, changeAmount: change
        };
      });
      res.json(data);
    }
  } catch (error) {
    console.error('15min API error:', error.message);
    res.status(500).json({ error: `Data fetch failed: ${error.message}` });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`Server on port ${PORT}`);
});