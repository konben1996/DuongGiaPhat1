require('dotenv').config();

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'duonggiaphat',
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  multipleStatements: true,
};

const pool = mysql.createPool(DB_CONFIG);

const CATEGORY_MAP = {
  'gaming-laptop': { name: 'Laptop Gaming', slug: 'gaming-laptop' },
  'office-laptop': { name: 'Laptop Văn Phòng', slug: 'office-laptop' },
  'gaming-pc': { name: 'Máy Tính Gaming', slug: 'gaming-pc' },
  accessory: { name: 'Phụ Kiện', slug: 'accessory' },
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

function slugify(input) {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

function asInt(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.trunc(num) : fallback;
}

async function tableExists(tableName) {
  const [rows] = await pool.query('SHOW TABLES LIKE ?', [tableName]);
  return rows.length > 0;
}

async function columnExists(tableName, columnName) {
  const [rows] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\` LIKE ?`, [columnName]);
  return rows.length > 0;
}

async function ensureMigrationMarker() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migration_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function hasRun(name) {
  const [rows] = await pool.query('SELECT id FROM migration_log WHERE name = ? LIMIT 1', [name]);
  return rows.length > 0;
}

async function markRun(name) {
  await pool.query('INSERT IGNORE INTO migration_log (name) VALUES (?)', [name]);
}

async function getColumns(tableName) {
  const [rows] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\``);
  return rows.map((row) => row.Field);
}

async function ensureBaseData() {
  await pool.query(
    `INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
     VALUES
       ('Laptop Gaming', 'gaming-laptop', NULL, 1, 1),
       ('Laptop Văn Phòng', 'office-laptop', NULL, 2, 1),
       ('Máy Tính Gaming', 'gaming-pc', NULL, 3, 1),
       ('Phụ Kiện', 'accessory', NULL, 4, 1)
     ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order), is_active = VALUES(is_active)`
  );

  const adminPassword = await bcrypt.hash('admin123456', 10);
  await pool.query(
    `INSERT INTO users (email, password_hash, name, phone, role, is_active)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name), phone = VALUES(phone), role = VALUES(role), is_active = VALUES(is_active)`,
    ['admin@dgstore.local', adminPassword, 'Administrator', '0900000000', 'admin', 1]
  );
}

async function migrateUsers() {
  const exists = await tableExists('users');
  if (!exists) return;

  const columns = await getColumns('users');
  const hasPasswordHash = columns.includes('password_hash');
  const hasPassword = columns.includes('password');
  const hasIsActive = columns.includes('is_active');

  if (!hasPasswordHash && hasPassword) {
    await pool.query('ALTER TABLE users CHANGE COLUMN password password_hash VARCHAR(255) NOT NULL');
  }

  if (!hasIsActive) {
    await pool.query('ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER role');
  }
}

async function migrateCategories() {
  const exists = await tableExists('categories');
  if (!exists) return;
  await ensureBaseData();
}

async function migrateProducts() {
  const exists = await tableExists('products');
  if (!exists) return;

  const [rows] = await pool.query('SELECT * FROM products');
  for (const row of rows) {
    const categoryKey = normalizeCategoryKey(row.category || row.category_slug || row.category_name);
    const categoryId = Object.keys(CATEGORY_MAP).includes(categoryKey)
      ? (await pool.query('SELECT id FROM categories WHERE slug = ? LIMIT 1', [categoryKey]))[0][0]?.id
      : null;

    const [catRows] = await pool.query('SELECT id FROM categories WHERE slug = ? LIMIT 1', [categoryKey]);
    const resolvedCategoryId = catRows[0]?.id || 4;
    const slug = row.slug || slugify(row.name);
    const sku = row.sku || row.code || null;

    await pool.query(
      `INSERT INTO products (
        id, name, slug, category_id, brand, sku, short_description, description,
        price, sale_price, stock, image, is_featured, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        slug = VALUES(slug),
        category_id = VALUES(category_id),
        brand = VALUES(brand),
        sku = VALUES(sku),
        short_description = VALUES(short_description),
        description = VALUES(description),
        price = VALUES(price),
        sale_price = VALUES(sale_price),
        stock = VALUES(stock),
        image = VALUES(image),
        is_featured = VALUES(is_featured),
        is_active = VALUES(is_active),
        updated_at = VALUES(updated_at)`,
      [
        row.id,
        row.name,
        slug,
        resolvedCategoryId,
        row.brand || null,
        sku,
        row.short_description || row.shortDescription || null,
        row.description || null,
        asInt(row.price, 0),
        row.sale_price !== undefined ? asInt(row.sale_price, null) : null,
        asInt(row.stock, 0),
        row.image || null,
        row.is_featured !== undefined ? Number(Boolean(row.is_featured)) : 0,
        row.is_active !== undefined ? Number(Boolean(row.is_active)) : 1,
        row.created_at || new Date(),
        row.updated_at || new Date(),
      ]
    );

    if (await tableExists('product_specs') && row.cpu) {
      await pool.query(
        `INSERT INTO product_specs (
          product_id, cpu, ram, storage, gpu, screen_size, refresh_rate, os, color, weight, battery
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          cpu = VALUES(cpu),
          ram = VALUES(ram),
          storage = VALUES(storage),
          gpu = VALUES(gpu),
          screen_size = VALUES(screen_size),
          refresh_rate = VALUES(refresh_rate),
          os = VALUES(os),
          color = VALUES(color),
          weight = VALUES(weight),
          battery = VALUES(battery)`,
        [
          row.id,
          row.cpu || null,
          row.ram || null,
          row.storage || null,
          row.gpu || null,
          row.screen_size || null,
          row.refresh_rate || null,
          row.os || null,
          row.color || null,
          row.weight || null,
          row.battery || null,
        ]
      );
    }
  }
}

async function migrateOrders() {
  const exists = await tableExists('orders');
  if (!exists) return;

  const [orders] = await pool.query('SELECT * FROM orders');
  for (const order of orders) {
    const code = order.code || `DH-${String(order.id).padStart(4, '0')}`;
    const customerName = order.customer_name || order.customer || 'Khách hàng';
    const customerPhone = order.customer_phone || '0000000000';
    const shippingAddress = order.shipping_address || '';
    const subtotal = asInt(order.subtotal, asInt(order.total, 0));
    const shippingFee = asInt(order.shipping_fee, 0);
    const discountAmount = asInt(order.discount_amount, 0);
    const total = asInt(order.total, subtotal + shippingFee - discountAmount);

    await pool.query(
      `INSERT INTO orders (
        id, code, user_id, customer_name, customer_phone, shipping_address, shipping_note,
        subtotal, shipping_fee, discount_amount, total, status, payment_status, payment_method,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        code = VALUES(code),
        user_id = VALUES(user_id),
        customer_name = VALUES(customer_name),
        customer_phone = VALUES(customer_phone),
        shipping_address = VALUES(shipping_address),
        shipping_note = VALUES(shipping_note),
        subtotal = VALUES(subtotal),
        shipping_fee = VALUES(shipping_fee),
        discount_amount = VALUES(discount_amount),
        total = VALUES(total),
        status = VALUES(status),
        payment_status = VALUES(payment_status),
        payment_method = VALUES(payment_method),
        updated_at = VALUES(updated_at)`,
      [
        order.id,
        code,
        order.user_id || null,
        customerName,
        customerPhone,
        shippingAddress,
        order.shipping_note || null,
        subtotal,
        shippingFee,
        discountAmount,
        total,
        order.status || 'pending',
        order.payment_status || 'unpaid',
        order.payment_method || 'cod',
        order.created_at || new Date(),
        order.updated_at || new Date(),
      ]
    );
  }
}

async function migrateOrderItems() {
  const exists = await tableExists('order_items');
  if (!exists) return;

  const [orders] = await pool.query('SELECT id, products FROM orders');
  for (const order of orders) {
    if (!order.products) continue;

    const parsed = String(order.products).split(',').map((item) => item.trim()).filter(Boolean);
    if (!parsed.length) continue;

    for (const item of parsed) {
      const [productRows] = await pool.query('SELECT id, name, price FROM products WHERE name = ? LIMIT 1', [item]);
      const product = productRows[0] || null;
      if (!product) continue;

      await pool.query(
        `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           product_name = VALUES(product_name),
           unit_price = VALUES(unit_price),
           quantity = VALUES(quantity),
           line_total = VALUES(line_total)`,
        [order.id, product.id, product.name, asInt(product.price, 0), 1, asInt(product.price, 0)]
      );
    }
  }
}

async function migrateInventory() {
  if (!(await tableExists('inventory'))) return;

  const [products] = await pool.query('SELECT id, stock FROM products');
  for (const product of products) {
    await pool.query(
      `INSERT INTO inventory (product_id, quantity, reserved_quantity, warehouse_location)
       VALUES (?, ?, 0, 'Kho chính')
       ON DUPLICATE KEY UPDATE
         quantity = VALUES(quantity),
         warehouse_location = VALUES(warehouse_location)`,
      [product.id, asInt(product.stock, 0)]
    );
  }
}

async function migrateOldData() {
  await migrateUsers();
  await migrateCategories();
  await migrateProducts();
  await migrateOrders();
  await migrateOrderItems();
  await migrateInventory();
  await ensureBaseData();
}

async function main() {
  const migrationName = 'migrate_old_schema_to_new_schema_v1';
  await ensureMigrationMarker();

  if (await hasRun(migrationName)) {
    console.log('Migration already executed.');
    return;
  }

  await migrateOldData();
  await markRun(migrationName);
  console.log('Migration completed successfully.');
}

main()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
