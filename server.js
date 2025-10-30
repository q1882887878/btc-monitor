const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;  // Vercel 用环境端口

app.use(cors());  // 启用 CORS
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));  // 服务根目录静态文件（如 index.html）

// 根路由：返回 index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API 路由：1小时数据（用 Axios 从币安拉取）
app.get('/api/btc-1h-data', async (req, res) => {
  try {
    const response = await axios.get('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=25');
    const klines = response.data;

    // 格式化为前端格式（从旧到新）
    const data = klines.map((kline, index) => {
      const time = new Date(kline[0]);
      const open = parseFloat(kline[1]);
      const high = parseFloat(kline[2]);
      const low = parseFloat(kline[3]);
      const close = parseFloat(kline[4]);
      const prevClose = index > 0 ? parseFloat(klines[index - 1][4]) : open;
      const change = close - open;
      const changePercent = (change / open) * 100;
      const changeAmount = change;

      return {
        time: time.toISOString(),
        open, high, low, close,
        prevClose,
        change, changePercent, changeAmount
      };
    }).slice(0, 24);

    res.json(data);
  } catch (error) {
    console.error('Error fetching 1h data:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// 类似：15分钟数据路由
app.get('/api/btc-15min-data', async (req, res) => {
  try {
    const response = await axios.get('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=15m&limit=97');
    const klines = response.data;

    const data = klines.map((kline, index) => {
      const time = new Date(kline[0]);
      const open = parseFloat(kline[1]);
      const high = parseFloat(kline[2]);
      const low = parseFloat(kline[3]);
      const close = parseFloat(kline[4]);
      const prevClose = index > 0 ? parseFloat(klines[index - 1][4]) : open;
      const change = close - open;
      const changePercent = (change / open) * 100;
      const changeAmount = change;

      return {
        time: time.toISOString(),
        open, high, low, close,
        prevClose,
        change, changePercent, changeAmount
      };
    }).slice(0, 96);

    res.json(data);
  } catch (error) {
    console.error('Error fetching 15m data:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});