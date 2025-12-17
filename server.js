const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// 数据文件路径
const DATA_FILE = path.join(__dirname, 'warehouse-data.json');

// 初始化数据结构
let data = {
  products: [],
  inbound_records: [],
  outbound_records: []
};

// 加载数据
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const fileData = fs.readFileSync(DATA_FILE, 'utf8');
      data = JSON.parse(fileData);
      console.log('✅ 数据加载成功');
    } else {
      console.log('📝 数据文件不存在，使用空数据');
    }
  } catch (err) {
    console.error('❌ 加载数据失败:', err);
  }
}

// 保存数据
function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log('✅ 数据已保存');
  } catch (err) {
    console.error('❌ 保存数据失败:', err);
  }
}

// 启动时加载数据
loadData();

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

// ==================== 导出Excel API ====================

// 导出库存数据为Excel
app.get('/api/export/inventory', (req, res) => {
  try {
    // 准备库存数据
    const inventoryData = data.products.map((p, index) => ({
      '序号': index + 1,
      '商品名称': p.name,
      '分类': p.category,
      '单位': p.unit,
      '单价': p.price,
      '当前库存': p.stock,
      '最低库存': p.min_stock,
      '库存状态': p.stock < p.min_stock ? '库存不足' : '正常',
      '库存价值': (p.stock * p.price).toFixed(2),
      '创建时间': new Date(p.created_at).toLocaleString('zh-CN')
    }));

    // 创建工作簿
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(inventoryData);

    // 设置列宽
    ws['!cols'] = [
      { wch: 6 },  // 序号
      { wch: 20 }, // 商品名称
      { wch: 12 }, // 分类
      { wch: 8 },  // 单位
      { wch: 10 }, // 单价
      { wch: 10 }, // 当前库存
      { wch: 10 }, // 最低库存
      { wch: 10 }, // 库存状态
      { wch: 12 }, // 库存价值
      { wch: 20 }  // 创建时间
    ];

    XLSX.utils.book_append_sheet(wb, ws, '库存信息');

    // 生成Excel文件
    const fileName = `库存数据_${new Date().toISOString().split('T')[0]}.xlsx`;
    const filePath = path.join(__dirname, fileName);
    XLSX.writeFile(wb, filePath);

    // 发送文件
    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('发送文件失败:', err);
      }
      // 删除临时文件
      fs.unlinkSync(filePath);
    });
  } catch (err) {
    console.error('导出Excel失败:', err);
    res.status(500).json({ error: '导出失败' });
  }
});

// 导出出入库记录为Excel
app.get('/api/export/records', (req, res) => {
  try {
    // 准备入库数据
    const inboundData = data.inbound_records.map((r, index) => ({
      '序号': index + 1,
      '类型': '入库',
      '商品名称': r.product_name,
      '数量': r.quantity,
      '供应商/客户': r.supplier,
      '操作员': r.operator,
      '备注': r.note,
      '操作时间': new Date(r.created_at).toLocaleString('zh-CN')
    }));

    // 准备出库数据
    const outboundData = data.outbound_records.map((r, index) => ({
      '序号': index + 1,
      '类型': '出库',
      '商品名称': r.product_name,
      '数量': r.quantity,
      '供应商/客户': r.customer,
      '操作员': r.operator,
      '备注': r.note,
      '操作时间': new Date(r.created_at).toLocaleString('zh-CN')
    }));

    // 合并并按时间排序
    const allRecords = [...inboundData, ...outboundData].sort((a, b) => {
      return new Date(b.操作时间) - new Date(a.操作时间);
    }).map((r, index) => ({...r, '序号': index + 1}));

    // 创建工作簿
    const wb = XLSX.utils.book_new();

    // 入库记录工作表
    const wsInbound = XLSX.utils.json_to_sheet(inboundData);
    wsInbound['!cols'] = [
      { wch: 6 },  // 序号
      { wch: 8 },  // 类型
      { wch: 20 }, // 商品名称
      { wch: 10 }, // 数量
      { wch: 20 }, // 供应商
      { wch: 12 }, // 操作员
      { wch: 30 }, // 备注
      { wch: 20 }  // 操作时间
    ];
    XLSX.utils.book_append_sheet(wb, wsInbound, '入库记录');

    // 出库记录工作表
    const wsOutbound = XLSX.utils.json_to_sheet(outboundData);
    wsOutbound['!cols'] = [
      { wch: 6 },  // 序号
      { wch: 8 },  // 类型
      { wch: 20 }, // 商品名称
      { wch: 10 }, // 数量
      { wch: 20 }, // 客户
      { wch: 12 }, // 操作员
      { wch: 30 }, // 备注
      { wch: 20 }  // 操作时间
    ];
    XLSX.utils.book_append_sheet(wb, wsOutbound, '出库记录');

    // 全部记录工作表
    const wsAll = XLSX.utils.json_to_sheet(allRecords);
    wsAll['!cols'] = [
      { wch: 6 },  // 序号
      { wch: 8 },  // 类型
      { wch: 20 }, // 商品名称
      { wch: 10 }, // 数量
      { wch: 20 }, // 供应商/客户
      { wch: 12 }, // 操作员
      { wch: 30 }, // 备注
      { wch: 20 }  // 操作时间
    ];
    XLSX.utils.book_append_sheet(wb, wsAll, '全部记录');

    // 生成Excel文件
    const fileName = `出入库记录_${new Date().toISOString().split('T')[0]}.xlsx`;
    const filePath = path.join(__dirname, fileName);
    XLSX.writeFile(wb, filePath);

    // 发送文件
    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('发送文件失败:', err);
      }
      // 删除临时文件
      fs.unlinkSync(filePath);
    });
  } catch (err) {
    console.error('导出Excel失败:', err);
    res.status(500).json({ error: '导出失败' });
  }
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`仓库管理系统运行在 http://localhost:${PORT}`);
});
