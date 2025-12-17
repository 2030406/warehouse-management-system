const API_BASE = 'http://localhost:3000/api';

// 页面切换
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.page;
        
        // 更新导航状态
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        
        // 更新页面显示
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(page).classList.add('active');
        
        // 加载对应页面数据
        loadPageData(page);
    });
});

// 加载页面数据
function loadPageData(page) {
    switch(page) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'products':
            loadProducts();
            break;
        case 'inbound':
            loadInboundRecords();
            break;
        case 'outbound':
            loadOutboundRecords();
            break;
    }
}

// ==================== 仪表盘 ====================

async function loadDashboard() {
    try {
        const stats = await fetch(`${API_BASE}/statistics`).then(r => r.json());
        
        document.getElementById('totalProducts').textContent = stats.totalProducts;
        document.getElementById('lowStockProducts').textContent = stats.lowStockProducts;
        document.getElementById('totalValue').textContent = `¥${stats.totalValue.toFixed(2)}`;
        document.getElementById('todayInbound').textContent = stats.todayInbound;
        document.getElementById('todayOutbound').textContent = stats.todayOutbound;
        
        // 加载库存不足商品
        const products = await fetch(`${API_BASE}/products`).then(r => r.json());
        const lowStock = products.filter(p => p.stock < p.min_stock);
        
        const lowStockList = document.getElementById('lowStockList');
        if (lowStock.length === 0) {
            lowStockList.innerHTML = '<div class="empty-state">暂无库存预警</div>';
        } else {
            lowStockList.innerHTML = lowStock.map(p => `
                <div class="low-stock-item">
                    <div>
                        <div class="name">${p.name}</div>
                        <div style="font-size: 12px; color: #666;">${p.category}</div>
                    </div>
                    <div class="stock">库存: ${p.stock} / ${p.min_stock}</div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('加载仪表盘数据失败:', error);
        alert('加载数据失败，请确保服务器正在运行');
    }
}

// ==================== 商品管理 ====================

async function loadProducts() {
    try {
        const products = await fetch(`${API_BASE}/products`).then(r => r.json());
        
        const tbody = document.getElementById('productsTable');
        if (products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-state">暂无商品数据</td></tr>';
        } else {
            tbody.innerHTML = products.map(p => {
                const stockStatus = p.stock < p.min_stock ? 
                    '<span class="badge badge-danger">库存不足</span>' : 
                    '<span class="badge badge-success">正常</span>';
                
                return `
                    <tr>
                        <td>${p.name}</td>
                        <td>${p.category}</td>
                        <td>${p.unit}</td>
                        <td>¥${p.price.toFixed(2)}</td>
                        <td>${p.stock}</td>
                        <td>${p.min_stock}</td>
                        <td>${stockStatus}</td>
                        <td>
                            <button class="btn btn-sm btn-warning" onclick="editProduct('${p.id}')">编辑</button>
                            <button class="btn btn-sm btn-danger" onclick="deleteProduct('${p.id}')">删除</button>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    } catch (error) {
        console.error('加载商品数据失败:', error);
    }
}

function showProductModal(id = null) {
    const modal = document.getElementById('productModal');
    modal.classList.add('show');
    
    if (id) {
        document.getElementById('productModalTitle').textContent = '编辑商品';
        loadProductData(id);
    } else {
        document.getElementById('productModalTitle').textContent = '添加商品';
        document.getElementById('productForm').reset();
        document.getElementById('productId').value = '';
    }
}

function closeProductModal() {
    document.getElementById('productModal').classList.remove('show');
}

async function loadProductData(id) {
    try {
        const product = await fetch(`${API_BASE}/products/${id}`).then(r => r.json());
        
        document.getElementById('productId').value = product.id;
        document.getElementById('productName').value = product.name;
        document.getElementById('productCategory').value = product.category;
        document.getElementById('productUnit').value = product.unit;
        document.getElementById('productPrice').value = product.price;
        document.getElementById('productMinStock').value = product.min_stock;
    } catch (error) {
        console.error('加载商品数据失败:', error);
    }
}

async function submitProduct(event) {
    event.preventDefault();
    
    const id = document.getElementById('productId').value;
    const data = {
        name: document.getElementById('productName').value,
        category: document.getElementById('productCategory').value,
        unit: document.getElementById('productUnit').value,
        price: parseFloat(document.getElementById('productPrice').value),
        min_stock: parseInt(document.getElementById('productMinStock').value)
    };
    
    try {
        if (id) {
            await fetch(`${API_BASE}/products/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            await fetch(`${API_BASE}/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
        
        closeProductModal();
        loadProducts();
        alert('保存成功！');
    } catch (error) {
        console.error('保存商品失败:', error);
        alert('保存失败！');
    }
}

function editProduct(id) {
    showProductModal(id);
}

async function deleteProduct(id) {
    if (!confirm('确定要删除这个商品吗？')) return;
    
    try {
        await fetch(`${API_BASE}/products/${id}`, { method: 'DELETE' });
        loadProducts();
        alert('删除成功！');
    } catch (error) {
        console.error('删除商品失败:', error);
        alert('删除失败！');
    }
}

// ==================== 入库管理 ====================

async function loadInboundRecords() {
    try {
        const records = await fetch(`${API_BASE}/inbound`).then(r => r.json());
        
        const tbody = document.getElementById('inboundTable');
        if (records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">暂无入库记录</td></tr>';
        } else {
            tbody.innerHTML = records.map(r => `
                <tr>
                    <td>${r.product_name}</td>
                    <td>${r.quantity}</td>
                    <td>${r.supplier}</td>
                    <td>${r.operator}</td>
                    <td>${r.note || '-'}</td>
                    <td>${new Date(r.created_at).toLocaleString('zh-CN')}</td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('加载入库记录失败:', error);
    }
}

async function showInboundModal() {
    const modal = document.getElementById('inboundModal');
    modal.classList.add('show');
    
    // 加载商品列表
    try {
        const products = await fetch(`${API_BASE}/products`).then(r => r.json());
        const select = document.getElementById('inboundProduct');
        select.innerHTML = '<option value="">请选择商品</option>' + 
            products.map(p => `<option value="${p.id}">${p.name} (库存: ${p.stock})</option>`).join('');
    } catch (error) {
        console.error('加载商品列表失败:', error);
    }
    
    document.getElementById('inboundForm').reset();
}

function closeInboundModal() {
    document.getElementById('inboundModal').classList.remove('show');
}

async function submitInbound(event) {
    event.preventDefault();
    
    const data = {
        product_id: document.getElementById('inboundProduct').value,
        quantity: parseInt(document.getElementById('inboundQuantity').value),
        supplier: document.getElementById('inboundSupplier').value,
        operator: document.getElementById('inboundOperator').value,
        note: document.getElementById('inboundNote').value
    };
    
    try {
        await fetch(`${API_BASE}/inbound`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        closeInboundModal();
        loadInboundRecords();
        alert('入库成功！');
    } catch (error) {
        console.error('入库失败:', error);
        alert('入库失败！');
    }
}

// ==================== 出库管理 ====================

async function loadOutboundRecords() {
    try {
        const records = await fetch(`${API_BASE}/outbound`).then(r => r.json());
        
        const tbody = document.getElementById('outboundTable');
        if (records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">暂无出库记录</td></tr>';
        } else {
            tbody.innerHTML = records.map(r => `
                <tr>
                    <td>${r.product_name}</td>
                    <td>${r.quantity}</td>
                    <td>${r.customer}</td>
                    <td>${r.operator}</td>
                    <td>${r.note || '-'}</td>
                    <td>${new Date(r.created_at).toLocaleString('zh-CN')}</td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('加载出库记录失败:', error);
    }
}

async function showOutboundModal() {
    const modal = document.getElementById('outboundModal');
    modal.classList.add('show');
    
    // 加载商品列表
    try {
        const products = await fetch(`${API_BASE}/products`).then(r => r.json());
        const select = document.getElementById('outboundProduct');
        select.innerHTML = '<option value="">请选择商品</option>' + 
            products.map(p => `<option value="${p.id}">${p.name} (库存: ${p.stock})</option>`).join('');
    } catch (error) {
        console.error('加载商品列表失败:', error);
    }
    
    document.getElementById('outboundForm').reset();
}

function closeOutboundModal() {
    document.getElementById('outboundModal').classList.remove('show');
}

async function submitOutbound(event) {
    event.preventDefault();
    
    const data = {
        product_id: document.getElementById('outboundProduct').value,
        quantity: parseInt(document.getElementById('outboundQuantity').value),
        customer: document.getElementById('outboundCustomer').value,
        operator: document.getElementById('outboundOperator').value,
        note: document.getElementById('outboundNote').value
    };
    
    try {
        const response = await fetch(`${API_BASE}/outbound`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            alert(result.error || '出库失败！');
            return;
        }
        
        closeOutboundModal();
        loadOutboundRecords();
        alert('出库成功！');
    } catch (error) {
        console.error('出库失败:', error);
        alert('出库失败！');
    }
}

// 初始加载
loadDashboard();
