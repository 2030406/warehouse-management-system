const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// 初始化数据结构（使用内存存储）
let data = {
  products: [],
  inbound_records: [],
  outbound_records: []
};

// 保存数据（内存模式）
function saveData() {
  console.log('数据已更新');
}

// ==================== 商品管理API ====================

// 获取所有商品
app.get('/api/products', (req, res) => {
  res.json(data.products);
});

// 获取单个商品
app.get('/api/products/:id', (req, res) => {
  const product = data.products.find(p => p.id === req.params.id);
  if (!product) {
    res.status(404).json({ error: '商品不存在' });
    return;
  }
  res.json(product);
});

// 添加商品
app.post('/api/products', (req, res) => {
  const { name, category, unit, price, min_stock } = req.body;
  
  if (!name || !category || !unit || price === undefined) {
    res.status(400).json({ error: '缺少必要字段' });
    return;
  }

  const product = {
    id: uuidv4(),
    name,
    category,
    unit,
    price: parseFloat(price),
    stock: 0,
    min_stock: parseInt(min_stock) || 10,
    created_at: new Date().toISOString()
  };

  data.products.push(product);
  saveData();
  res.json(product);
});

// 更新商品
app.put('/api/products/:id', (req, res) => {
  const { name, category, unit, price, min_stock } = req.body;
  const index = data.products.findIndex(p => p.id === req.params.id);
  
  if (index === -1) {
    res.status(404).json({ error: '商品不存在' });
    return;
  }

  data.products[index] = {
    ...data.products[index],
    name,
    category,
    unit,
    price: parseFloat(price),
    min_stock: parseInt(min_stock)
  };

  saveData();
  res.json({ success: true });
});

// 删除商品
app.delete('/api/products/:id', (req, res) => {
  const index = data.products.findIndex(p => p.id === req.params.id);
  
  if (index === -1) {
    res.status(404).json({ error: '商品不存在' });
    return;
  }

  data.products.splice(index, 1);
  saveData();
  res.json({ success: true });
});

// ==================== 入库管理API ====================

// 获取入库记录
app.get('/api/inbound', (req, res) => {
  res.json(data.inbound_records);
});

// 添加入库记录
app.post('/api/inbound', (req, res) => {
  const { product_id, quantity, supplier, operator, note } = req.body;
  
  if (!product_id || !quantity || !supplier || !operator) {
    res.status(400).json({ error: '缺少必要字段' });
    return;
  }

  const product = data.products.find(p => p.id === product_id);
  if (!product) {
    res.status(404).json({ error: '商品不存在' });
    return;
  }

  const record = {
    id: uuidv4(),
    product_id,
    product_name: product.name,
    quantity: parseInt(quantity),
    supplier,
    operator,
    note: note || '',
    created_at: new Date().toISOString()
  };

  data.inbound_records.unshift(record);
  product.stock += parseInt(quantity);
  saveData();
  res.json({ id: record.id, success: true });
});

// ==================== 出库管理API ====================

// 获取出库记录
app.get('/api/outbound', (req, res) => {
  res.json(data.outbound_records);
});

// 添加出库记录
app.post('/api/outbound', (req, res) => {
  const { product_id, quantity, customer, operator, note } = req.body;
  
  if (!product_id || !quantity || !customer || !operator) {
    res.status(400).json({ error: '缺少必要字段' });
    return;
  }

  const product = data.products.find(p => p.id === product_id);
  if (!product) {
    res.status(404).json({ error: '商品不存在' });
    return;
  }

  if (product.stock < parseInt(quantity)) {
    res.status(400).json({ error: '库存不足' });
    return;
  }

  const record = {
    id: uuidv4(),
    product_id,
    product_name: product.name,
    quantity: parseInt(quantity),
    customer,
    operator,
    note: note || '',
    created_at: new Date().toISOString()
  };

  data.outbound_records.unshift(record);
  product.stock -= parseInt(quantity);
  saveData();
  res.json({ id: record.id, success: true });
});

// ==================== 统计API ====================

// 获取库存统计
app.get('/api/statistics', (req, res) => {
  const stats = {};
  
  // 总商品数
  stats.totalProducts = data.products.length;
  
  // 库存不足商品数
  stats.lowStockProducts = data.products.filter(p => p.stock < p.min_stock).length;
  
  // 总库存价值
  stats.totalValue = data.products.reduce((sum, p) => sum + (p.stock * p.price), 0);
  
  // 今日入库数量
  const today = new Date().toISOString().split('T')[0];
  stats.todayInbound = data.inbound_records.filter(r => r.created_at.startsWith(today)).length;
  
  // 今日出库数量
  stats.todayOutbound = data.outbound_records.filter(r => r.created_at.startsWith(today)).length;
  
  res.json(stats);
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`仓库管理系统运行在 http://localhost:${PORT}`);
});
