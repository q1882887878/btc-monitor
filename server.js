const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// 全局异常捕获
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

// 中间件配置
app.use(cors({ origin: '*' }));
app.use(express.json());
// 静态文件服务（确保能访问 index.html 和前端资源）
app.use(express.static(path.join(__dirname, '.')));

// 根路由返回前端页面
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API: 1小时数据（修正路由路径，确保带 /api 前缀）
app.get('/api/btc-1h-data', async (req, res) => {
  console.log('1h API called');
  try {
    let response;
    try {
      // CoinGecko API
      response = await axios.get('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=1&interval=hourly', {
        timeout: 10000,
        headers: { 'User-Agent': 'Vercel-BTC-Monitor/1.0' }
      });
      const prices = response.data.prices;
      const data = prices.slice(-24).map((p, index) => {
        const time = new Date(p[0]);
        const open = index > 0 ? prices[index - 1][1] : p[1];
        const close = p[1];
        const change = close - open;
        const changePercent = (change / open) * 100;
        return {
          time: time.toISOString(),
          open, close,
          change, changePercent, changeAmount: change,
          prevClose: index > 0 ? prices[index - 1][1] : open // 补充 prevClose 字段
        };
      }).reverse();
      res.json(data);
    } catch (fallbackErr) {
      console.log('CoinGecko fallback to Binance');
      // Binance 备用 API
      response = await axios.get('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=25', {
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
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

// API: 15分钟数据（修正路由路径，确保带 /api 前缀）
app.get('/api/btc-15min-data', async (req, res) => {
  console.log('15min API called');
  try {
    let response;
    try {
      // CoinGecko API
      response = await axios.get('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=1&interval=minute', {
        timeout: 10000,
        headers: { 'User-Agent': 'Vercel-BTC-Monitor/1.0' }
      });
      const prices = response.data.prices.filter((_, i) => i % 15 === 0).slice(-96);
      const data = prices.map((p, index) => {
        const time = new Date(p[0]);
        const open = index > 0 ? prices[index - 1][1] : p[1];
        const close = p[1];
        const change = close - open;
        const changePercent = (change / open) * 100;
        return {
          time: time.toISOString(),
          open, close,
          change, changePercent, changeAmount: change,
          prevClose: index > 0 ? prices[index - 1][1] : open // 补充 prevClose 字段
        };
      }).reverse();
      res.json(data);
    } catch (fallbackErr) {
      // Binance 备用 API
      response = await axios.get('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=15m&limit=97', {
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
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
  console.log(`Server running on port ${PORT}`);
});