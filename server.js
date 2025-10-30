// server.js - 比特币价格监控后端服务器 (Node.js + Express)
// 支持币安API获取BTC/USDT K线数据
// 端点：/btc-1h-data (1小时周期，过去24小时+当前) 和 /btc-15min-data (15分钟周期，过去24小时+当前)
// 运行：npm init -y; npm install express axios cors; node server.js

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = 3000;

// 中间件
app.use(cors()); // 允许跨域
app.use(express.json());

// 币安API基础URL
const BINANCE_API = 'https://api.binance.com/api/v3/klines';

// 获取K线数据的通用函数
async function fetchKlines(symbol, interval, limit) {
  try {
    const response = await axios.get(BINANCE_API, {
      params: {
        symbol: symbol,
        interval: interval,
        limit: limit
      }
    });

    if (!response.data || !Array.isArray(response.data)) {
      throw new Error('Invalid response from Binance API');
    }

    // 处理数据：从 [open_time, open, high, low, close, ...] 转换为对象
    const klines = response.data.map((kline, index) => {
      const openTime = parseInt(kline[0]); // 开盘时间戳 (ms)
      const open = parseFloat(kline[1]);
      const high = parseFloat(kline[2]);
      const low = parseFloat(kline[3]);
      const close = parseFloat(kline[4]);

      // 计算变化：需要前一周期的close
      let prevClose = null;
      let change = 0;
      let changePercent = 0;

      if (index > 0) {
        // 前一周期的close（数据从旧到新）
        prevClose = parseFloat(response.data[index - 1][4]);
        change = close - prevClose;
        changePercent = (change / prevClose) * 100;
      } else {
        // 第一个周期无变化
        prevClose = open; // 假设开盘=前收
      }

      return {
        time: new Date(openTime).toISOString(), // ISO字符串，便于前端解析
        open: open,
        high: high,
        low: low,
        close: close,
        prevClose: prevClose,
        change: parseFloat(change.toFixed(2)),
        changePercent: parseFloat(changePercent.toFixed(2)),
        changeAmount: parseFloat(change.toFixed(2)) // 额外添加changeAmount用于前端
      };
    });

    return klines;
  } catch (error) {
    console.error(`Error fetching ${interval} data:`, error.message);
    throw error;
  }
}

// 1小时周期端点 (过去24小时 + 当前，limit=25)
app.get('/btc-1h-data', async (req, res) => {
  try {
    const data = await fetchKlines('BTCUSDT', '1h', 25);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch 1h data' });
  }
});

// 15分钟周期端点 (过去24小时 + 当前，limit=97，24*4=96+1)
app.get('/btc-15min-data', async (req, res) => {
  try {
    const data = await fetchKlines('BTCUSDT', '15m', 97);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch 15m data' });
  }
});

// 健康检查端点 (可选)
app.get('/', (req, res) => {
  res.json({ message: 'Bitcoin Price Monitor Server is running!' });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Endpoints: /btc-1h-data, /btc-15min-data`);
});