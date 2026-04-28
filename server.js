require('dotenv').config();

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_me';

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(express.static(__dirname));

function sendRootHtml(req, res, fileName) {
  const filePath = path.join(__dirname, fileName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send(`Không tìm thấy ${fileName}`);
  }
  return res.sendFile(filePath);
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'duonggiaphat',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  namedPlaceholders: true,
});

pool.on('connection', (connection) => {
  connection.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
  connection.query("SET character_set_client = utf8mb4");
  connection.query("SET character_set_connection = utf8mb4");
  connection.query("SET character_set_results = utf8mb4");
});

const memoryUsers = [];
const memoryOrders = [];

function loadLocalProducts() {
  const files = [
    'js/data/products/gaming-laptop.js',
    'js/data/products/office-laptop.js',
    'js/data/products/gaming-pc.js',
    'js/data/products/accessory.js',
  ];

  const products = [];

  files.forEach((file) => {
    const filePath = path.join(__dirname, file);
    const source = fs.readFileSync(filePath, 'utf8');
    const sandbox = { window: { DuongGiaStoreProducts: {} } };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox);
    const store = sandbox.window.DuongGiaStoreProducts || {};
    Object.values(store).forEach((group) => {
      if (Array.isArray(group.products)) {
        products.push(...group.products);
      }
    });
  });

  return products;
}

function normalizeProductForDb(product) {
  return {
    name: product.name,
    slug: slugify(product.slug || product.name),
    category_id: product.category_id || 4,
    brand: product.brand || null,
    sku: product.sku || null,
    short_description: product.short_description || product.description || null,
    description: product.description || null,
    price: Number(product.price) || 0,
    sale_price: product.sale_price || null,
    stock: typeof product.stock === 'number' ? product.stock : 0,
    image: product.image || null,
    is_featured: Number(Boolean(product.is_featured)),
    is_active: 1,
  };
}

const CATEGORY_IMAGE_DIRS = {
  "gaming-laptop": path.join(__dirname, "assets/images/gaming-laptop"),
  "office-laptop": path.join(__dirname, "assets/images/office-laptop"),
  "gaming-pc": path.join(__dirname, "assets/images/gaming-pc"),
  accessory: path.join(__dirname, "assets/images/accessory"),
};

function resolveImageCategory(category, imageCategory) {
  return CATEGORY_IMAGE_DIRS[imageCategory] ? imageCategory : (CATEGORY_IMAGE_DIRS[category] ? category : "accessory");
}

function sanitizeFolderName(folderName) {
  return String(folderName || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ensureDirectoryExists(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function safeImageFileName(originalName = "product-image.png") {
  const parsed = path.parse(originalName);
  const baseName = parsed.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "product-image";
  const ext = (parsed.ext || ".png").toLowerCase();
  const suffix = crypto.randomBytes(4).toString("hex");
  return `${baseName}-${suffix}${ext}`;
}

function decodeDataUrlImage(dataUrl) {
  const match = String(dataUrl || "").match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!match) {
    throw new Error("Dữ liệu ảnh không hợp lệ");
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

function mimeTypeToExtension(mimeType) {
  const map = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
  };

  return map[mimeType.toLowerCase()] || ".png";
}

const CATEGORY_MAP = {
  'gaming-laptop': 'gaming-laptop',
  'office-laptop': 'office-laptop',
  'gaming-pc': 'gaming-pc',
  accessory: 'accessory',
};

function normalizeCategoryKey(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'accessory';
  if (CATEGORY_MAP[raw]) return raw;
  if (raw.includes('gaming') && raw.includes('laptop')) return 'gaming-laptop';
  if (raw.includes('office') || raw.includes('văn phòng') || raw.includes('van phong')) return 'office-laptop';
  if (raw.includes('pc') || raw.includes('desktop') || raw.includes('máy tính')) return 'gaming-pc';
  return 'accessory';
}

async function resolveCategoryId(category) {
  const normalizedCategory = normalizeCategoryKey(category);
  const result = await getDbOrFallbackRows('SELECT id FROM categories WHERE slug = ? LIMIT 1', [normalizedCategory]);

  if (result.ok && result.rows.length > 0) {
    return Number(result.rows[0].id) || 4;
  }

  const categoryIds = {
    'gaming-laptop': 1,
    'office-laptop': 2,
    'gaming-pc': 3,
    accessory: 4,
  };

  return categoryIds[normalizedCategory] || 4;
}

function slugify(input) {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

async function createUniqueProductSlug(name, productId = null) {
  const baseSlug = slugify(name || 'san-pham-moi');
  let nextSlug = baseSlug;
  let suffix = 2;

  while (true) {
    const params = [nextSlug];
    let query = 'SELECT id FROM products WHERE slug = ? LIMIT 1';
    if (productId !== null) {
      query = 'SELECT id FROM products WHERE slug = ? AND id <> ? LIMIT 1';
      params.push(productId);
    }

    const result = await getDbOrFallbackRows(query, params);
    if (!result.ok || result.rows.length === 0) {
      return nextSlug;
    }

    nextSlug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

const seededAdminUser = {
  id: 999,
  email: 'admin@dgstore.local',
  password_hash: bcrypt.hashSync('admin123456', 10),
  name: 'Administrator',
  phone: '0900000000',
  role: 'admin',
  created_at: new Date().toISOString(),
};

function normalizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone || null,
    role: user.role || 'user',
    created_at: user.created_at || new Date().toISOString(),
  };
}

async function getDbOrFallbackRows(query, params = []) {
  try {
    const [rows] = await pool.query(query, params);
    return { ok: true, rows };
  } catch (error) {
    return { ok: false, error };
  }
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Thiếu token xác thực' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
}

app.get('/', (req, res) => sendRootHtml(req, res, 'index.html'));

app.get('/login.html', (req, res) => sendRootHtml(req, res, 'login.html'));

app.get('/register.html', (req, res) => sendRootHtml(req, res, 'register.html'));

app.get('/api/health', async (req, res) => {
  const result = await getDbOrFallbackRows('SELECT 1 AS ok');
  if (result.ok) {
    return res.json({ ok: true, db: result.rows[0].ok === 1, message: 'Server is running' });
  }
  return res.json({ ok: true, db: false, fallback: true, message: 'Server is running without database' });
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, phone } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Thiếu email, mật khẩu hoặc tên' });
    }

    const existingInMemory = memoryUsers.find((user) => user.email.toLowerCase() === email.toLowerCase());
    if (existingInMemory) {
      return res.status(409).json({ message: 'Email đã tồn tại' });
    }

    const dbCheck = await getDbOrFallbackRows('SELECT id FROM users WHERE email = ?', [email]);

    if (dbCheck.ok && dbCheck.rows.length > 0) {
      return res.status(409).json({ message: 'Email đã tồn tại' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    if (dbCheck.ok) {
      const [result] = await pool.query(
        'INSERT INTO users (email, password_hash, name, phone, role) VALUES (?, ?, ?, ?, ?)',
        [email, passwordHash, name, phone || null, 'user']
      );

      return res.status(201).json({
        message: 'Tạo tài khoản thành công',
        user: {
          id: result.insertId,
          email,
          name,
          phone: phone || null,
          role: 'user',
        },
      });
    }

    const newUser = normalizeUser({
      id: memoryUsers.length + 1,
      email,
      name,
      role: 'user',
      created_at: new Date().toISOString(),
    });

    memoryUsers.push({
      ...newUser,
      password_hash: passwordHash,
    });

    return res.status(201).json({
      message: 'Tạo tài khoản thành công',
      user: newUser,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const dbCheck = await getDbOrFallbackRows(
      'SELECT id, email, name, phone, role, created_at FROM users WHERE id = ? LIMIT 1',
      [req.user.id]
    );

    if (dbCheck.ok && dbCheck.rows.length > 0) {
      return res.json({ user: dbCheck.rows[0] });
    }

    if (req.user.email && req.user.email.toLowerCase() === seededAdminUser.email.toLowerCase()) {
      return res.json({
        user: normalizeUser(seededAdminUser),
      });
    }

    const user = memoryUsers.find((item) => item.id === req.user.id || item.email.toLowerCase() === req.user.email?.toLowerCase());
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    return res.json({ user: normalizeUser(user) });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

app.patch('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const { name, phone } = req.body;

    if (name !== undefined && typeof name !== 'string') {
      return res.status(400).json({ message: 'Tên không hợp lệ' });
    }

    if (phone !== undefined && phone !== null && typeof phone !== 'string') {
      return res.status(400).json({ message: 'Số điện thoại không hợp lệ' });
    }

    const nextName = typeof name === 'string' ? name.trim() : undefined;
    const nextPhone = phone === undefined ? undefined : phone === null ? null : phone.trim();

    if (nextName !== undefined && !nextName) {
      return res.status(400).json({ message: 'Tên không được để trống' });
    }

    const currentUserDb = await getDbOrFallbackRows(
      'SELECT id, email, name, phone, role, created_at FROM users WHERE id = ? LIMIT 1',
      [req.user.id]
    );

    if (currentUserDb.ok) {
      if (currentUserDb.rows.length === 0) {
        return res.status(404).json({ message: 'Không tìm thấy người dùng' });
      }

      const currentUser = currentUserDb.rows[0];
      const updatedName = nextName !== undefined ? nextName : currentUser.name;
      const updatedPhone = nextPhone !== undefined ? nextPhone : currentUser.phone || null;

      await pool.query('UPDATE users SET name = ?, phone = ? WHERE id = ?', [
        updatedName,
        updatedPhone,
        req.user.id,
      ]);

      return res.json({
        message: 'Cập nhật hồ sơ thành công',
        user: {
          ...currentUser,
          name: updatedName,
          phone: updatedPhone,
        },
      });
    }

    const memoryUserIndex = memoryUsers.findIndex((item) => item.id === req.user.id);
    if (memoryUserIndex === -1) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    const currentUser = memoryUsers[memoryUserIndex];
    const updatedUser = {
      ...currentUser,
      name: nextName !== undefined ? nextName : currentUser.name,
      phone: nextPhone !== undefined ? nextPhone : currentUser.phone || null,
    };

    memoryUsers[memoryUserIndex] = updatedUser;

    return res.json({
      message: 'Cập nhật hồ sơ thành công',
      user: normalizeUser(updatedUser),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

app.patch('/api/auth/me/password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Thiếu mật khẩu hiện tại hoặc mật khẩu mới' });
    }

    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      return res.status(400).json({ message: 'Mật khẩu không hợp lệ' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
    }

    const currentUserDb = await getDbOrFallbackRows(
      'SELECT id, email, password_hash, name, phone, role, created_at FROM users WHERE id = ? LIMIT 1',
      [req.user.id]
    );

    if (currentUserDb.ok) {
      if (currentUserDb.rows.length === 0) {
        return res.status(404).json({ message: 'Không tìm thấy người dùng' });
      }

      const currentUser = currentUserDb.rows[0];
      const isMatch = await bcrypt.compare(currentPassword, currentUser.password_hash);
      if (!isMatch) {
        return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng' });
      }

      const newPasswordHash = await bcrypt.hash(newPassword, 10);
      await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [newPasswordHash, req.user.id]);

      return res.json({ message: 'Đổi mật khẩu thành công' });
    }

    const memoryUserIndex = memoryUsers.findIndex((item) => item.id === req.user.id);
    if (memoryUserIndex === -1) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    const currentUser = memoryUsers[memoryUserIndex];
    const isMatch = await bcrypt.compare(currentPassword, currentUser.password_hash || currentUser.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng' });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    memoryUsers[memoryUserIndex] = {
      ...currentUser,
      password_hash: newPasswordHash,
      passwordHash: newPasswordHash,
    };

    return res.json({ message: 'Đổi mật khẩu thành công' });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ message: 'Thiếu email hoặc mật khẩu mới' });
    }

    if (typeof email !== 'string' || typeof newPassword !== 'string') {
      return res.status(400).json({ message: 'Dữ liệu không hợp lệ' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    const dbCheck = await getDbOrFallbackRows('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);

    if (dbCheck.ok) {
      if (dbCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Không tìm thấy tài khoản với email này' });
      }

      await pool.query('UPDATE users SET password_hash = ? WHERE email = ?', [passwordHash, email]);

      return res.json({ message: 'Đặt lại mật khẩu thành công' });
    }

    const memoryUserIndex = memoryUsers.findIndex((item) => item.email.toLowerCase() === email.toLowerCase());
    if (memoryUserIndex === -1) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản với email này' });
    }

    memoryUsers[memoryUserIndex] = {
      ...memoryUsers[memoryUserIndex],
      password_hash: passwordHash,
      passwordHash: passwordHash,
    };

    return res.json({ message: 'Đặt lại mật khẩu thành công' });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email và mật khẩu là bắt buộc' });
    }

    const dbCheck = await getDbOrFallbackRows(
      'SELECT id, email, password_hash, name, phone, role FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    let user = null;

    if (dbCheck.ok) {
      user = dbCheck.rows[0] || null;
    } else {
      user = memoryUsers.find((item) => item.email.toLowerCase() === email.toLowerCase()) || null;
    }

    if (!user && email.toLowerCase() === seededAdminUser.email.toLowerCase()) {
      user = seededAdminUser;
    }

    if (!user) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
    }

    let isMatch = false;
    const passwordHash = user.password_hash || user.passwordHash;

    if (user.email && user.email.toLowerCase() === seededAdminUser.email.toLowerCase()) {
      isMatch = password === 'admin123456';
    } else if (passwordHash) {
      isMatch = await bcrypt.compare(password, passwordHash);
    }

    if (!isMatch) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, phone: user.phone || null, role: user.role },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    return res.json({
      message: 'Đăng nhập thành công',
      token,
      user: normalizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});


function requireAdmin(req, res, next) {
  const user = req.user;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ message: 'Không có quyền truy cập admin' });
  }
  return next();
}

async function seedProductsIfNeeded() {
  try {
    const [rows] = await pool.query('SELECT COUNT(*) AS total FROM products');
    if (Number(rows[0]?.total || 0) > 0) {
      return;
    }

    const products = loadLocalProducts().map(normalizeProductForDb);
    if (!products.length) {
      return;
    }

    const categoryIds = await pool.query('SELECT id, slug FROM categories');
    const categoryMap = Object.fromEntries((categoryIds[0] || []).map((row) => [row.slug, row.id]));
    const values = products.map((product) => [
      product.name,
      product.slug,
      categoryMap[normalizeCategoryKey(product.category)] || 4,
      product.brand,
      product.sku,
      product.short_description,
      product.description,
      product.price,
      product.sale_price,
      product.stock,
      product.image,
      product.is_featured,
      product.is_active,
    ]);

    await pool.query(
      'INSERT INTO products (name, slug, category_id, brand, sku, short_description, description, price, sale_price, stock, image, is_featured, is_active) VALUES ?',
      [values]
    );
  } catch (error) {
    console.error('Failed to seed products:', error.message);
  }
}

async function fetchAdminProducts() {
  const result = await getDbOrFallbackRows(
    `SELECT p.id, p.name, p.category_id, c.slug AS category, c.name AS category_name, p.price, p.stock, p.image, p.is_active, p.created_at, p.updated_at
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     ORDER BY p.id DESC`
  );
  if (result.ok) {
    return result.rows;
  }

  return [];
}

async function fetchAdminUsers() {
  const result = await getDbOrFallbackRows(
    'SELECT id, email, name, phone, role, is_active, created_at, updated_at FROM users ORDER BY id DESC'
  );
  if (result.ok) {
    return result.rows;
  }

  return [
    {
      id: 1,
      name: 'Admin',
      email: 'admin@dgstore.local',
      phone: '0900000000',
      role: 'admin',
      is_active: 1,
    },
    {
      id: 2,
      name: 'Khách hàng 1',
      email: 'user1@dgstore.local',
      phone: '0911111111',
      role: 'user',
      is_active: 1,
    },
  ];
}

async function fetchAdminCategories() {
  const result = await getDbOrFallbackRows(
    'SELECT id, name, slug, parent_id, sort_order, is_active, created_at, updated_at FROM categories ORDER BY sort_order ASC, id ASC'
  );
  if (result.ok) return result.rows;
  return [];
}

function normalizeCategoryPayload(body = {}) {
  return {
    name: typeof body.name === 'string' ? body.name.trim() : '',
    slug: typeof body.slug === 'string' ? slugify(body.slug) : '',
    parent_id: body.parent_id === undefined || body.parent_id === null || body.parent_id === '' ? null : Number(body.parent_id),
    sort_order: body.sort_order === undefined || body.sort_order === null || body.sort_order === '' ? 0 : Number(body.sort_order),
    is_active: body.is_active === undefined ? 1 : Number(Boolean(body.is_active)),
  };
}

app.post('/api/admin/categories', authMiddleware, requireAdmin, async (req, res) => {
  const payload = normalizeCategoryPayload(req.body || {});
  const nextId = req.body?.id === undefined || req.body?.id === null || req.body?.id === '' ? null : Number(req.body.id);

  if (!payload.name) {
    return res.status(400).json({ message: 'Tên danh mục không được để trống' });
  }

  if (nextId !== null && !Number.isFinite(nextId)) {
    return res.status(400).json({ message: 'ID danh mục không hợp lệ' });
  }

  const baseSlug = payload.slug || slugify(payload.name);

  if (nextId !== null) {
    const idDuplicate = await getDbOrFallbackRows('SELECT id FROM categories WHERE id = ? LIMIT 1', [nextId]);
    if (idDuplicate.ok && idDuplicate.rows.length > 0) {
      return res.status(409).json({ message: 'ID danh mục đã tồn tại' });
    }
  }

  const dbDuplicate = await getDbOrFallbackRows('SELECT id FROM categories WHERE slug = ? LIMIT 1', [baseSlug]);
  if (dbDuplicate.ok && dbDuplicate.rows.length > 0) {
    return res.status(409).json({ message: 'Slug danh mục đã tồn tại' });
  }

  if (dbDuplicate.ok) {
    const slug = baseSlug;
    const insertColumns = nextId === null
      ? 'name, slug, parent_id, sort_order, is_active'
      : 'id, name, slug, parent_id, sort_order, is_active';
    const insertValues = nextId === null
      ? [payload.name, slug, payload.parent_id, payload.sort_order, payload.is_active]
      : [nextId, payload.name, slug, payload.parent_id, payload.sort_order, payload.is_active];

    const [result] = await pool.query(
      `INSERT INTO categories (${insertColumns}) VALUES (${nextId === null ? '?, ?, ?, ?, ?' : '?, ?, ?, ?, ?, ?'})`,
      insertValues
    );

    const inserted = await pool.query(
      'SELECT id, name, slug, parent_id, sort_order, is_active, created_at, updated_at FROM categories WHERE id = ? LIMIT 1',
      [nextId !== null ? nextId : result.insertId]
    );

    return res.status(201).json({ message: 'Tạo danh mục thành công', category: inserted[0][0] });
  }

  return res.status(501).json({ message: 'Tạo danh mục chưa hỗ trợ ở chế độ fallback' });
});

app.patch('/api/admin/categories/:id', authMiddleware, requireAdmin, async (req, res) => {
  const categoryId = Number(req.params.id);
  if (!Number.isFinite(categoryId)) {
    return res.status(400).json({ message: 'ID danh mục không hợp lệ' });
  }

  const current = await getDbOrFallbackRows('SELECT id, name, slug, parent_id, sort_order, is_active FROM categories WHERE id = ? LIMIT 1', [categoryId]);
  if (!current.ok || current.rows.length === 0) {
    return res.status(404).json({ message: 'Không tìm thấy danh mục' });
  }

  const payload = normalizeCategoryPayload(req.body || {});
  const nextId = req.body?.id === undefined || req.body?.id === null || req.body?.id === '' ? categoryId : Number(req.body.id);

  if (!Number.isFinite(nextId)) {
    return res.status(400).json({ message: 'ID danh mục không hợp lệ' });
  }

  const nextName = payload.name || current.rows[0].name;
  const nextSlug = payload.slug || slugify(nextName);
  const nextParentId = payload.parent_id === null ? null : payload.parent_id;
  const nextSortOrder = payload.sort_order === undefined ? current.rows[0].sort_order : payload.sort_order;
  const nextIsActive = payload.is_active === undefined ? current.rows[0].is_active : payload.is_active;

  const duplicate = await getDbOrFallbackRows('SELECT id FROM categories WHERE slug = ? AND id <> ? LIMIT 1', [nextSlug, categoryId]);
  if (duplicate.ok && duplicate.rows.length > 0) {
    return res.status(409).json({ message: 'Slug danh mục đã tồn tại' });
  }

  if (nextId !== categoryId) {
    const idDuplicate = await getDbOrFallbackRows('SELECT id FROM categories WHERE id = ? LIMIT 1', [nextId]);
    if (idDuplicate.ok && idDuplicate.rows.length > 0) {
      return res.status(409).json({ message: 'ID danh mục đã tồn tại' });
    }
  }

  await pool.query(
    'UPDATE categories SET id = ?, name = ?, slug = ?, parent_id = ?, sort_order = ?, is_active = ? WHERE id = ?',
    [nextId, nextName, nextSlug, nextParentId, nextSortOrder, nextIsActive, categoryId]
  );

  const updated = await pool.query(
    'SELECT id, name, slug, parent_id, sort_order, is_active, created_at, updated_at FROM categories WHERE id = ? LIMIT 1',
    [nextId]
  );

  return res.json({ message: 'Cập nhật danh mục thành công', category: updated[0][0] });
});

app.delete('/api/admin/categories/:id', authMiddleware, requireAdmin, async (req, res) => {
  const categoryId = Number(req.params.id);
  if (!Number.isFinite(categoryId)) {
    return res.status(400).json({ message: 'ID danh mục không hợp lệ' });
  }

  const check = await getDbOrFallbackRows('SELECT id, slug FROM categories WHERE id = ? LIMIT 1', [categoryId]);
  if (!check.ok || check.rows.length === 0) {
    return res.status(404).json({ message: 'Không tìm thấy danh mục' });
  }

  const currentCategorySlug = String(check.rows[0].slug || '').toLowerCase();
  const fallbackCategorySlug = currentCategorySlug === 'accessory' ? 'gaming-pc' : 'accessory';
  const fallbackCategoryId = await resolveCategoryId(fallbackCategorySlug);

  if (fallbackCategoryId !== categoryId) {
    await pool.query('UPDATE products SET category_id = ? WHERE category_id = ?', [fallbackCategoryId, categoryId]);
  }

  await pool.query('DELETE FROM categories WHERE id = ?', [categoryId]);
  return res.json({
    message: 'Xoá danh mục thành công',
    movedProductsToCategoryId: fallbackCategoryId,
  });
});

async function fetchAdminCoupons() {
  const result = await getDbOrFallbackRows(
    'SELECT id, code, name, discount_type, discount_value, min_order_value, max_discount, start_at, end_at, usage_limit, used_count, is_active, created_at, updated_at FROM coupons ORDER BY id DESC'
  );
  if (result.ok) return result.rows;
  return [];
}

async function fetchAdminBanners() {
  const result = await getDbOrFallbackRows(
    'SELECT id, title, image_url, link_url, position, sort_order, is_active, created_at, updated_at FROM banners ORDER BY sort_order ASC, id DESC'
  );
  if (result.ok) return result.rows;
  return [];
}

async function fetchAdminReviews() {
  const result = await getDbOrFallbackRows(
    `SELECT r.id, r.user_id, u.name AS user_name, r.product_id, p.name AS product_name, r.rating, r.comment, r.is_visible, r.created_at, r.updated_at
     FROM reviews r
     LEFT JOIN users u ON u.id = r.user_id
     LEFT JOIN products p ON p.id = r.product_id
     ORDER BY r.id DESC`
  );
  if (result.ok) return result.rows;
  return [];
}

async function fetchAdminWarranties() {
  const result = await getDbOrFallbackRows(
    `SELECT w.id, w.order_item_id, w.warranty_code, w.start_date, w.end_date, w.status, w.note, w.created_at, w.updated_at
     FROM warranties w
     ORDER BY w.id DESC`
  );
  if (result.ok) return result.rows;
  return [];
}

async function fetchAdminOrders() {
  const result = await getDbOrFallbackRows(
    `SELECT o.id, o.code, o.customer_name AS customer_name, o.customer_phone, o.shipping_address, o.shipping_note,
            o.subtotal, o.shipping_fee, o.discount_amount, o.total, o.status, o.payment_status, o.payment_method,
            o.created_at, o.updated_at
     FROM orders o
     ORDER BY o.id DESC`
  );
  if (result.ok) {
    return result.rows;
  }

  return [...memoryOrders].reverse();
}

function normalizeOrderPayload(body = {}) {
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const customer_name = typeof body.customer_name === 'string' ? body.customer_name.trim() : '';
  const customer_phone = typeof body.customer_phone === 'string' ? body.customer_phone.trim() : '';
  const shipping_address = typeof body.shipping_address === 'string' ? body.shipping_address.trim() : '';
  const shipping_note = typeof body.shipping_note === 'string' ? body.shipping_note.trim() : '';
  const status = typeof body.status === 'string' ? body.status.trim() : 'pending';
  const payment_status = typeof body.payment_status === 'string' ? body.payment_status.trim() : 'unpaid';
  const payment_method = typeof body.payment_method === 'string' ? body.payment_method.trim() : 'cod';
  const subtotal = Number(body.subtotal || 0);
  const shipping_fee = Number(body.shipping_fee || 0);
  const discount_amount = Number(body.discount_amount || 0);
  const total = Number(body.total || 0);

  return {
    code,
    customer_name,
    customer_phone,
    shipping_address,
    shipping_note,
    status,
    payment_status,
    payment_method,
    subtotal: Number.isFinite(subtotal) ? subtotal : 0,
    shipping_fee: Number.isFinite(shipping_fee) ? shipping_fee : 0,
    discount_amount: Number.isFinite(discount_amount) ? discount_amount : 0,
    total: Number.isFinite(total) ? total : 0,
  };
}

app.get('/api/admin/dashboard', authMiddleware, requireAdmin, async (req, res) => {
  const [products, users] = await Promise.all([fetchAdminProducts(), fetchAdminUsers()]);
  const topCategory = products.reduce((acc, product) => {
    acc[product.category] = (acc[product.category] || 0) + 1;
    return acc;
  }, {});
  const top = Object.entries(topCategory).sort((a, b) => b[1] - a[1])[0];
  return res.json({
    totalProducts: products.length,
    activeProducts: products.filter((product) => Number(product.is_active) !== 0).length,
    totalUsers: users.length,
    recentProductName: products[0]?.name || null,
    topCategory: top ? top[0] : null,
  });
});

app.get('/api/admin/products', authMiddleware, requireAdmin, async (req, res) => {
  const products = await fetchAdminProducts();
  return res.json({ products });
});

app.get('/api/admin/categories', authMiddleware, requireAdmin, async (req, res) => {
  const categories = await fetchAdminCategories();
  return res.json({ categories });
});


app.get('/api/admin/users', authMiddleware, requireAdmin, async (req, res) => {
  const users = await fetchAdminUsers();
  return res.json({ users });
});

app.get('/api/admin/orders', authMiddleware, requireAdmin, async (req, res) => {
  const orders = await fetchAdminOrders();
  return res.json({ orders });
});

app.get('/api/admin/coupons', authMiddleware, requireAdmin, async (req, res) => {
  const coupons = await fetchAdminCoupons();
  return res.json({ coupons });
});

app.get('/api/admin/banners', authMiddleware, requireAdmin, async (req, res) => {
  const banners = await fetchAdminBanners();
  return res.json({ banners });
});

app.get('/api/admin/reviews', authMiddleware, requireAdmin, async (req, res) => {
  const reviews = await fetchAdminReviews();
  return res.json({ reviews });
});

app.get('/api/admin/warranties', authMiddleware, requireAdmin, async (req, res) => {
  const warranties = await fetchAdminWarranties();
  return res.json({ warranties });
});

app.post('/api/admin/orders', authMiddleware, requireAdmin, async (req, res) => {
  const payload = normalizeOrderPayload(req.body || {});

  if (!payload.code || !payload.customer_name || !payload.customer_phone || !payload.shipping_address) {
    return res.status(400).json({ message: 'Thiếu mã đơn hàng, tên khách hàng, số điện thoại hoặc địa chỉ giao hàng' });
  }

  const dbCheck = await getDbOrFallbackRows('SELECT id FROM orders WHERE code = ? LIMIT 1', [payload.code]);
  if (dbCheck.ok && dbCheck.rows.length > 0) {
    return res.status(409).json({ message: 'Mã đơn hàng đã tồn tại' });
  }

  if (dbCheck.ok) {
    const [result] = await pool.query(
      `INSERT INTO orders (
        code, customer_name, customer_phone, shipping_address, shipping_note,
        subtotal, shipping_fee, discount_amount, total, status, payment_status, payment_method
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.code,
        payload.customer_name,
        payload.customer_phone,
        payload.shipping_address,
        payload.shipping_note || null,
        payload.subtotal,
        payload.shipping_fee,
        payload.discount_amount,
        payload.total,
        payload.status,
        payload.payment_status,
        payload.payment_method,
      ]
    );

    const inserted = await pool.query(
      `SELECT id, code, customer_name, customer_phone, shipping_address, shipping_note, subtotal, shipping_fee,
              discount_amount, total, status, payment_status, payment_method, created_at, updated_at
       FROM orders WHERE id = ? LIMIT 1`,
      [result.insertId]
    );

    return res.status(201).json({
      message: 'Tạo đơn hàng thành công',
      order: inserted[0][0],
    });
  }

  const fallbackOrder = {
    id: memoryOrders.length + 1,
    code: payload.code,
    customer_name: payload.customer_name,
    customer_phone: payload.customer_phone,
    shipping_address: payload.shipping_address,
    shipping_note: payload.shipping_note || null,
    subtotal: payload.subtotal,
    shipping_fee: payload.shipping_fee,
    discount_amount: payload.discount_amount,
    total: payload.total,
    status: payload.status,
    payment_status: payload.payment_status,
    payment_method: payload.payment_method,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  memoryOrders.push(fallbackOrder);

  return res.status(201).json({
    message: 'Tạo đơn hàng thành công',
    order: fallbackOrder,
  });
});

app.patch('/api/admin/orders/:id', authMiddleware, requireAdmin, async (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isFinite(orderId)) {
    return res.status(400).json({ message: 'ID đơn hàng không hợp lệ' });
  }

  const dbCheck = await getDbOrFallbackRows('SELECT id FROM orders WHERE id = ? LIMIT 1', [orderId]);
  if (dbCheck.ok && dbCheck.rows.length === 0) {
    return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
  }

  const payload = normalizeOrderPayload(req.body || {});

  if (dbCheck.ok) {
    const current = await pool.query(
      'SELECT id, code, customer_name, customer_phone, shipping_address, shipping_note, subtotal, shipping_fee, discount_amount, total, status, payment_status, payment_method FROM orders WHERE id = ? LIMIT 1',
      [orderId]
    );
    const currentOrder = current[0][0];

    const nextCode = payload.code || currentOrder.code;
    const nextCustomerName = payload.customer_name || currentOrder.customer_name;
    const nextCustomerPhone = payload.customer_phone || currentOrder.customer_phone;
    const nextShippingAddress = payload.shipping_address || currentOrder.shipping_address;
    const nextShippingNote = payload.shipping_note !== '' ? payload.shipping_note : currentOrder.shipping_note;
    const nextSubtotal = payload.subtotal || currentOrder.subtotal;
    const nextShippingFee = payload.shipping_fee || currentOrder.shipping_fee;
    const nextDiscountAmount = payload.discount_amount || currentOrder.discount_amount;
    const nextTotal = payload.total || currentOrder.total;
    const nextStatus = payload.status || currentOrder.status;
    const nextPaymentStatus = payload.payment_status || currentOrder.payment_status;
    const nextPaymentMethod = payload.payment_method || currentOrder.payment_method;

    if (payload.code && payload.code !== currentOrder.code) {
      const duplicate = await getDbOrFallbackRows('SELECT id FROM orders WHERE code = ? AND id <> ? LIMIT 1', [payload.code, orderId]);
      if (duplicate.ok && duplicate.rows.length > 0) {
        return res.status(409).json({ message: 'Mã đơn hàng đã tồn tại' });
      }
    }

    await pool.query(
      `UPDATE orders
       SET code = ?, customer_name = ?, customer_phone = ?, shipping_address = ?, shipping_note = ?,
           subtotal = ?, shipping_fee = ?, discount_amount = ?, total = ?, status = ?, payment_status = ?, payment_method = ?
       WHERE id = ?`,
      [
        nextCode,
        nextCustomerName,
        nextCustomerPhone,
        nextShippingAddress,
        nextShippingNote || null,
        nextSubtotal,
        nextShippingFee,
        nextDiscountAmount,
        nextTotal,
        nextStatus,
        nextPaymentStatus,
        nextPaymentMethod,
        orderId,
      ]
    );

    const updated = await pool.query(
      `SELECT id, code, customer_name, customer_phone, shipping_address, shipping_note, subtotal, shipping_fee,
              discount_amount, total, status, payment_status, payment_method, created_at, updated_at
       FROM orders WHERE id = ? LIMIT 1`,
      [orderId]
    );

    return res.json({
      message: 'Cập nhật đơn hàng thành công',
      order: updated[0][0],
    });
  }

  const currentOrderIndex = memoryOrders.findIndex((item) => Number(item.id) === orderId);
  if (currentOrderIndex === -1) {
    return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
  }

  const currentOrder = memoryOrders[currentOrderIndex];
  const nextOrder = {
    ...currentOrder,
    code: payload.code || currentOrder.code,
    customer_name: payload.customer_name || currentOrder.customer_name,
    customer_phone: payload.customer_phone || currentOrder.customer_phone,
    shipping_address: payload.shipping_address || currentOrder.shipping_address,
    shipping_note: payload.shipping_note !== '' ? payload.shipping_note : currentOrder.shipping_note,
    subtotal: payload.subtotal || currentOrder.subtotal,
    shipping_fee: payload.shipping_fee || currentOrder.shipping_fee,
    discount_amount: payload.discount_amount || currentOrder.discount_amount,
    total: payload.total || currentOrder.total,
    status: payload.status || currentOrder.status,
    payment_status: payload.payment_status || currentOrder.payment_status,
    payment_method: payload.payment_method || currentOrder.payment_method,
    updated_at: new Date().toISOString(),
  };

  memoryOrders[currentOrderIndex] = nextOrder;

  return res.json({
    message: 'Cập nhật đơn hàng thành công',
    order: nextOrder,
  });
});

app.patch('/api/admin/users/:id', authMiddleware, requireAdmin, async (req, res) => {
  const userId = Number(req.params.id);
  const { name, email, phone, role } = req.body || {};

  if (role && !['user', 'admin'].includes(role)) {
    return res.status(400).json({ message: 'Role không hợp lệ' });
  }

  if (email !== undefined && (typeof email !== 'string' || !email.trim())) {
    return res.status(400).json({ message: 'Email không hợp lệ' });
  }

  const nextEmail = typeof email === 'string' ? email.trim() : undefined;
  const nextName = typeof name === 'string' ? name.trim() : undefined;
  const nextPhone = phone === undefined ? undefined : phone === null ? null : String(phone).trim();

  const dbCheck = await getDbOrFallbackRows('SELECT id, email FROM users WHERE id = ? LIMIT 1', [userId]);
  if (dbCheck.ok) {
    if (dbCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    if (nextEmail && nextEmail.toLowerCase() !== dbCheck.rows[0].email.toLowerCase()) {
      const duplicate = await getDbOrFallbackRows('SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1', [nextEmail, userId]);
      if (duplicate.ok && duplicate.rows.length > 0) {
        return res.status(409).json({ message: 'Email đã tồn tại' });
      }
    }

    await pool.query(
      'UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email), phone = COALESCE(?, phone), role = COALESCE(?, role) WHERE id = ?',
      [nextName || null, nextEmail || null, nextPhone === undefined ? null : nextPhone, role || null, userId]
    );

    const updated = await pool.query(
      'SELECT id, email, name, phone, role, created_at FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    return res.json({ message: 'Cập nhật người dùng thành công', user: updated[0][0] });
  }

  return res.status(501).json({ message: 'Cập nhật người dùng chưa hỗ trợ ở chế độ fallback' });
});

app.delete('/api/admin/users/:id', authMiddleware, requireAdmin, async (req, res) => {
  const userId = Number(req.params.id);
  const dbCheck = await getDbOrFallbackRows('SELECT id FROM users WHERE id = ? LIMIT 1', [userId]);
  if (dbCheck.ok) {
    if (dbCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }
    await pool.query('DELETE FROM users WHERE id = ?', [userId]);
    return res.json({ message: 'Xoá người dùng thành công' });
  }

  return res.status(501).json({ message: 'Xoá người dùng chưa hỗ trợ ở chế độ fallback' });
});

app.post('/api/admin/products', authMiddleware, requireAdmin, async (req, res) => {
  const { name, category, category_id, price, stock, image, imageCategory, imageFolder, imageDataUrl, imageFileName, brand, sku, short_description, description, sale_price, is_featured } = req.body || {};
  const dbCheck = await getDbOrFallbackRows('SELECT id FROM products LIMIT 1');

  let finalImage = typeof image === 'string' ? image.trim() : '';
  if (imageDataUrl) {
    const targetCategory = resolveImageCategory(category, imageCategory);
    const productSlug = sanitizeFolderName(slugify(name || 'san-pham-moi'));
    const folderName = sanitizeFolderName(imageFolder) || productSlug;
    const baseDir = CATEGORY_IMAGE_DIRS[targetCategory] || CATEGORY_IMAGE_DIRS.accessory;
    const targetDir = path.join(baseDir, productSlug, folderName);
    ensureDirectoryExists(targetDir);

    const { mimeType, buffer } = decodeDataUrlImage(imageDataUrl);
    const extension = imageFileName ? path.extname(imageFileName) || mimeTypeToExtension(mimeType) : mimeTypeToExtension(mimeType);
    const fileName = safeImageFileName(imageFileName || `product-image${extension}`);
    const filePath = path.join(targetDir, fileName);
    fs.writeFileSync(filePath, buffer);
    finalImage = path.relative(__dirname, filePath).split(path.sep).join('/');
  }

  if (dbCheck.ok) {
    const categoryId = Number(category_id) || await resolveCategoryId(category);
    const slug = await createUniqueProductSlug(name || 'san-pham-moi');
    const [result] = await pool.query(
      'INSERT INTO products (name, slug, category_id, brand, sku, short_description, description, price, sale_price, stock, image, is_featured, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name || 'Sản phẩm mới', slug, categoryId, brand || null, sku || null, short_description || null, description || null, Number(price || 0), sale_price === undefined ? null : Number(sale_price), Number(stock || 0), finalImage || '', Number(Boolean(is_featured)), 1]
    );
    const inserted = await pool.query(
      `SELECT p.id, p.name, p.category_id, c.slug AS category, c.name AS category_name, p.price, p.stock, p.image, p.is_active, p.created_at, p.updated_at
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.id = ? LIMIT 1`,
      [result.insertId]
    );
    return res.status(201).json({ message: 'Tạo sản phẩm thành công', product: inserted[0][0] });
  }
  return res.status(501).json({ message: 'Tạo sản phẩm chưa hỗ trợ ở chế độ fallback' });
});

app.patch('/api/admin/products/:id', authMiddleware, requireAdmin, async (req, res) => {
  const productId = Number(req.params.id);
  const dbCheck = await getDbOrFallbackRows('SELECT id FROM products WHERE id = ? LIMIT 1', [productId]);
  if (dbCheck.ok) {
    if (dbCheck.rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });

    const { name, category, category_id, price, stock, image, imageCategory, imageFolder, imageDataUrl, imageFileName, is_active, brand, sku, short_description, description, sale_price, is_featured } = req.body || {};
    let finalImage = typeof image === 'string' ? image.trim() : '';

    if (imageDataUrl) {
      const targetCategory = resolveImageCategory(category, imageCategory);
      const productSlug = sanitizeFolderName(slugify(name || 'san-pham-moi'));
      const folderName = sanitizeFolderName(imageFolder) || productSlug;
      const baseDir = CATEGORY_IMAGE_DIRS[targetCategory] || CATEGORY_IMAGE_DIRS.accessory;
      const targetDir = path.join(baseDir, productSlug, folderName);
      ensureDirectoryExists(targetDir);

      const { mimeType, buffer } = decodeDataUrlImage(imageDataUrl);
      const extension = imageFileName ? path.extname(imageFileName) || mimeTypeToExtension(mimeType) : mimeTypeToExtension(mimeType);
      const fileName = safeImageFileName(imageFileName || `product-image${extension}`);
      const filePath = path.join(targetDir, fileName);
      fs.writeFileSync(filePath, buffer);
      finalImage = path.relative(__dirname, filePath).split(path.sep).join('/');
    }

    const categoryId = Number(category_id) || await resolveCategoryId(category);
    await pool.query(
      `UPDATE products
       SET name = COALESCE(?, name),
           category_id = COALESCE(?, category_id),
           brand = COALESCE(?, brand),
           sku = COALESCE(?, sku),
           short_description = COALESCE(?, short_description),
           description = COALESCE(?, description),
           price = COALESCE(?, price),
           sale_price = COALESCE(?, sale_price),
           stock = COALESCE(?, stock),
           image = COALESCE(?, image),
           is_featured = COALESCE(?, is_featured),
           is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [
        name || null,
        categoryId || null,
        brand || null,
        sku || null,
        short_description || null,
        description || null,
        price === undefined ? null : Number(price),
        sale_price === undefined ? null : Number(sale_price),
        stock === undefined ? null : Number(stock),
        finalImage || null,
        is_featured === undefined ? null : Number(Boolean(is_featured)),
        is_active === undefined ? null : Number(Boolean(is_active)),
        productId,
      ]
    );
    const updated = await pool.query(
      `SELECT p.id, p.name, p.category_id, c.slug AS category, c.name AS category_name, p.price, p.stock, p.image, p.is_active, p.created_at, p.updated_at
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.id = ? LIMIT 1`,
      [productId]
    );
    return res.json({ message: 'Cập nhật sản phẩm thành công', product: updated[0][0] });
  }
  return res.status(501).json({ message: 'Cập nhật sản phẩm chưa hỗ trợ ở chế độ fallback' });
});

app.delete('/api/admin/products/:id', authMiddleware, requireAdmin, async (req, res) => {
  const productId = Number(req.params.id);
  const dbCheck = await getDbOrFallbackRows('SELECT id FROM products WHERE id = ? LIMIT 1', [productId]);
  if (dbCheck.ok) {
    if (dbCheck.rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    await pool.query('DELETE FROM products WHERE id = ?', [productId]);
    return res.json({ message: 'Xoá sản phẩm thành công' });
  }
  return res.status(501).json({ message: 'Xoá sản phẩm chưa hỗ trợ ở chế độ fallback' });
});

seedProductsIfNeeded().finally(() => {
  app.listen(PORT, HOST, () => {
    console.log(`Server is running on http://${HOST}:${PORT}`);
  });
});
