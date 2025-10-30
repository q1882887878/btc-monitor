app.get('/api/btc-1h-data', async (req, res) => {
  console.log('API /1h called - starting fetch');  // 日志：确认路由击中
  try {
    const response = await axios.get('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=25', {
      timeout: 15000,  // 15s 超时（Vercel 默认 10s）
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Vercel-BTC-Monitor/1.0)'  // 伪装浏览器，防挡
      }
    });
    console.log('Binance response received, length:', response.data.length);  // 日志：成功？
    
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
    }).slice(0, 24);

    res.json(data);  // 确保返回数组
  } catch (error) {
    console.error('Detailed Binance error:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      data: error.response?.data  // 如果是 HTTP 错误
    });  // 关键：详细日志到 Vercel
    
    res.status(500).json({ error: `Failed to fetch data: ${error.message}` });  // 前端可见具体错
  }
});