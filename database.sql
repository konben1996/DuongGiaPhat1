CREATE DATABASE IF NOT EXISTS duonggiaphat CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE duonggiaphat;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(30) DEFAULT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(180) NOT NULL UNIQUE,
  parent_id INT DEFAULT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  category_id INT NOT NULL,
  brand VARCHAR(150) DEFAULT NULL,
  sku VARCHAR(100) DEFAULT NULL UNIQUE,
  short_description VARCHAR(500) DEFAULT NULL,
  description TEXT DEFAULT NULL,
  price BIGINT NOT NULL DEFAULT 0,
  sale_price BIGINT DEFAULT NULL,
  stock INT NOT NULL DEFAULT 0,
  image VARCHAR(500) DEFAULT NULL,
  is_featured TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  INDEX idx_products_category (category_id),
  INDEX idx_products_price (price),
  INDEX idx_products_active (is_active)
);

CREATE TABLE IF NOT EXISTS product_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  alt_text VARCHAR(255) DEFAULT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_images_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product_images_product (product_id)
);

CREATE TABLE IF NOT EXISTS product_specs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  cpu VARCHAR(255) DEFAULT NULL,
  ram VARCHAR(100) DEFAULT NULL,
  storage VARCHAR(255) DEFAULT NULL,
  gpu VARCHAR(255) DEFAULT NULL,
  screen_size VARCHAR(50) DEFAULT NULL,
  refresh_rate VARCHAR(50) DEFAULT NULL,
  os VARCHAR(100) DEFAULT NULL,
  color VARCHAR(100) DEFAULT NULL,
  weight VARCHAR(100) DEFAULT NULL,
  battery VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_specs_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE KEY uq_product_specs_product (product_id)
);

CREATE TABLE IF NOT EXISTS inventory (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  reserved_quantity INT NOT NULL DEFAULT 0,
  warehouse_location VARCHAR(255) DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_inventory_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE KEY uq_inventory_product (product_id)
);

CREATE TABLE IF NOT EXISTS carts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_carts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_carts_user (user_id)
);

CREATE TABLE IF NOT EXISTS cart_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cart_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cart_items_cart FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE KEY uq_cart_items_cart_product (cart_id, product_id)
);

CREATE TABLE IF NOT EXISTS addresses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  recipient_name VARCHAR(255) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  address_line VARCHAR(255) NOT NULL,
  ward VARCHAR(100) DEFAULT NULL,
  district VARCHAR(100) DEFAULT NULL,
  province VARCHAR(100) DEFAULT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_addresses_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_addresses_user (user_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  user_id INT DEFAULT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(30) NOT NULL,
  shipping_address VARCHAR(500) NOT NULL,
  shipping_note VARCHAR(500) DEFAULT NULL,
  subtotal BIGINT NOT NULL DEFAULT 0,
  shipping_fee BIGINT NOT NULL DEFAULT 0,
  discount_amount BIGINT NOT NULL DEFAULT 0,
  total BIGINT NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  payment_status VARCHAR(50) NOT NULL DEFAULT 'unpaid',
  payment_method VARCHAR(50) NOT NULL DEFAULT 'cod',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_orders_user (user_id),
  INDEX idx_orders_status (status),
  INDEX idx_orders_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  unit_price BIGINT NOT NULL DEFAULT 0,
  quantity INT NOT NULL DEFAULT 1,
  line_total BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  INDEX idx_order_items_order (order_id)
);

CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  transaction_code VARCHAR(100) DEFAULT NULL,
  amount BIGINT NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  INDEX idx_payments_order (order_id),
  INDEX idx_payments_status (status)
);

CREATE TABLE IF NOT EXISTS order_status_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  old_status VARCHAR(50) DEFAULT NULL,
  new_status VARCHAR(50) NOT NULL,
  note VARCHAR(500) DEFAULT NULL,
  changed_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_status_history_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_status_history_user FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_order_status_history_order (order_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  product_id INT NOT NULL,
  rating TINYINT NOT NULL,
  comment TEXT DEFAULT NULL,
  is_visible TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE KEY uq_reviews_user_product (user_id, product_id),
  INDEX idx_reviews_product (product_id)
);

CREATE TABLE IF NOT EXISTS wishlists (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  product_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_wishlists_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_wishlists_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE KEY uq_wishlists_user_product (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS coupons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  discount_type VARCHAR(20) NOT NULL DEFAULT 'percent',
  discount_value BIGINT NOT NULL DEFAULT 0,
  min_order_value BIGINT NOT NULL DEFAULT 0,
  max_discount BIGINT DEFAULT NULL,
  start_at DATETIME DEFAULT NULL,
  end_at DATETIME DEFAULT NULL,
  usage_limit INT DEFAULT NULL,
  used_count INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS warranties (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_item_id INT NOT NULL,
  warranty_code VARCHAR(100) NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  note VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_warranties_order_item FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS banners (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  link_url VARCHAR(500) DEFAULT NULL,
  position VARCHAR(100) NOT NULL DEFAULT 'homepage',
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_banners_position (position)
);

INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
VALUES
  ('Laptop Gaming', 'gaming-laptop', NULL, 1, 1),
  ('Laptop Văn Phòng', 'office-laptop', NULL, 2, 1),
  ('Máy Tính Gaming', 'gaming-pc', NULL, 3, 1),
  ('Phụ Kiện', 'accessory', NULL, 4, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  parent_id = VALUES(parent_id),
  sort_order = VALUES(sort_order),
  is_active = VALUES(is_active);

INSERT INTO users (email, password_hash, name, phone, role)
VALUES (
  'admin@dgstore.local',
  '$2a$10$QX7Qx3GfG2D4u6L4JQ8h0eO7xw5B9C6uL0Jx1kXgPq0q0q0q0q0qO',
  'Administrator',
  '0900000000',
  'admin'
)
ON DUPLICATE KEY UPDATE email = email;

INSERT INTO products (name, slug, category_id, brand, sku, short_description, description, price, stock, image, is_featured, is_active)
VALUES
  ('HP Omen 15-dh0172TX Gaming Laptop','hp-omen-15-dh0172tx-gaming-laptop',1,'HP','HP-OMEN-15-DH0172TX','Laptop gaming hiệu năng cao','Laptop gaming HP Omen 15 cấu hình mạnh cho chơi game và đồ họa',42800000,0,'assets/images/gaming-laptop/hp-omen-15/hp-omen-15.jpg',1,1),
  ('Acer Predator Helios 300 PH315-52-78HH','acer-predator-helios-300-ph315-52-78hh',1,'Acer','ACER-PREDATOR-HELIOS-300-PH315-52-78HH','Laptop gaming cao cấp','Laptop gaming Acer Predator Helios 300 mạnh mẽ, tản nhiệt tốt',34500000,0,'assets/images/gaming-laptop/acer-predator-helios/acer-predator-helios.jpg',1,1),
  ('ASUS ROG Zephyrus M GU502GU-AZ090T','asus-rog-zephyrus-m-gu502gu-az090t',1,'ASUS','ASUS-ROG-ZEPHYRUS-M-GU502GU-AZ090T','Laptop gaming mỏng nhẹ','ASUS ROG Zephyrus M phù hợp game thủ cần hiệu năng và tính di động',31600000,0,'assets/images/gaming-laptop/rog-zephyrus-m/rog-zephyrus-m.jpg',1,1),
  ('ASUS TUF Gaming FX705DT-H7138T','asus-tuf-gaming-fx705dt-h7138t',1,'ASUS','ASUS-TUF-GAMING-FX705DT-H7138T','Laptop gaming bền bỉ','ASUS TUF Gaming FX705DT có độ bền cao và cấu hình ổn định',42000000,0,'assets/images/gaming-laptop/asus-tuf-fx705/asus-tuf-fx705.jpg',1,1),
  ('Acer Swift 7 SF714-52T-7134 Laptop Black','acer-swift-7-sf714-52t-7134-laptop-black',2,'Acer','ACER-SWIFT-7-SF714-52T-7134','Laptop văn phòng siêu mỏng nhẹ','Acer Swift 7 thiết kế sang trọng, phù hợp di chuyển',48000000,0,'assets/images/office-laptop/acer-swift-7/acer-swift-7.jpg',1,1),
  ('LG Gram 17Z90N-V.AH75A5 Laptop Silver','lg-gram-17z90n-v-ah75a5-laptop-silver',2,'LG','LG-GRAM-17Z90N-V-AH75A5','Laptop màn hình lớn','LG Gram 17 có màn hình lớn và trọng lượng nhẹ',38000000,0,'assets/images/office-laptop/lg-gram-17/lg-gram-17.jpg',1,1),
  ('ASUS VivoBook 15 A512FA-EJ1281T Laptop','asus-vivobook-15-a512fa-ej1281t-laptop',2,'ASUS','ASUS-VIVOBOOK-15-A512FA-EJ1281T','Laptop phổ thông','ASUS VivoBook 15 phù hợp học tập và làm việc văn phòng',13600000,0,'assets/images/office-laptop/asus-vivobook-15/asus-vivobook-15.jpg',1,1),
  ('MSI Modern 15 A10M-068VN Laptop','msi-modern-15-a10m-068vn-laptop',2,'MSI','MSI-MODERN-15-A10M-068VN','Laptop làm việc hiện đại','MSI Modern 15 cân bằng giữa hiệu năng và giá thành',16800000,0,'assets/images/office-laptop/msi-modern-15/msi-modern-15.jpg',1,1),
  ('LG Gram 14ZD90N-V.AX55A5 Laptop','lg-gram-14zd90n-v-ax55a5-laptop',2,'LG','LG-GRAM-14ZD90N-V-AX55A5','Laptop di động','LG Gram 14 nhỏ gọn, pin tốt, phù hợp di chuyển',28000000,0,'assets/images/office-laptop/lg-gram-14/lg-gram-14.jpg',1,1),
  ('Máy tính chơi game PCAP Apollo','may-tinh-choi-game-pcap-apollo',3,'PCAP','PCAP-APOLLO','PC gaming mạnh mẽ','Máy tính chơi game PCAP Apollo tối ưu cho game thủ',13500000,0,'assets/images/gaming-pc/pcap-apollo/pcap-apollo.jpg',1,1),
  ('Máy tính đa tác vụ PCAP Styx','may-tinh-da-tac-vu-pcap-styx',3,'PCAP','PCAP-STYX','PC đa nhiệm','Máy tính đa tác vụ PCAP Styx dành cho làm việc và giải trí',13500000,0,'assets/images/gaming-pc/pcap-styx/pcap-styx.jpg',1,1),
  ('Máy tính đa tác vụ PCAP Iris','may-tinh-da-tac-vu-pcap-iris',3,'PCAP','PCAP-IRIS','PC đa nhiệm hiệu năng cao','PCAP Iris phù hợp cho làm việc nặng và đồ họa',23500000,0,'assets/images/gaming-pc/pcap-iris/pcap-iris.jpg',1,1),
  ('Máy tính chơi game PCAP Poseidon','may-tinh-choi-game-pcap-poseidon',3,'PCAP','PCAP-POSEIDON','PC gaming cấu hình mạnh','PCAP Poseidon tối ưu cho gaming FPS cao',23500000,0,'assets/images/gaming-pc/pcap-poseidon/pcap-poseidon.jpg',1,1),
  ('Máy tính chơi game PCAP Jupiter','may-tinh-choi-game-pcap-jupiter',3,'PCAP','PCAP-JUPITER','PC gaming tầm trung','PCAP Jupiter cân bằng hiệu năng và giá trị',20500000,0,'assets/images/gaming-pc/pcap-jupiter/pcap-jupiter.jpg',1,1),
  ('Máy tính chơi game PCAP ASUS STRIX ULTRA 1','may-tinh-choi-game-pcap-asus-strix-ultra-1',3,'ASUS','ASUS-STRIX-ULTRA-1','PC gaming cao cấp','PCAP ASUS STRIX ULTRA 1 dành cho cấu hình khủng',33500000,0,'assets/images/gaming-pc/asus-strix-ultra/asus-strix-ultra.jpg',1,1),
  ('Tai nghe Asus ROG Cetra Core','tai-nghe-asus-rog-cetra-core',4,'ASUS','ASUS-ROG-CETRA-CORE','Tai nghe gaming','Tai nghe gaming ASUS ROG Cetra Core âm thanh tốt',990000,0,'assets/images/accessory/asus-rog-cetra-core/asus-rog-cetra-core.jpg',0,1),
  ('Tai nghe Asus TUF H3 Red','tai-nghe-asus-tuf-h3-red',4,'ASUS','ASUS-TUF-H3-RED','Tai nghe gaming','Tai nghe ASUS TUF H3 Red thiết kế nhẹ, âm thanh rõ',990000,0,'assets/images/accessory/asus-tuf-h3/asus-tuf-h3.jpg',0,1),
  ('Bàn phím cơ IKBC CD108 PD Blue Switch','ban-phim-co-ikbc-cd108-pd-blue-switch',4,'IKBC','IKBC-CD108-PD-BLUE-SWITCH','Bàn phím cơ','Bàn phím cơ IKBC CD108 PD Blue Switch bền và nhạy',990000,0,'assets/images/accessory/ikbc-cd108/ikbc-cd108.jpg',0,1),
  ('Ghế game DXRacer Valkyrie Series GC','ghe-game-dxracer-valkyrie-series-gc',4,'DXRacer','DXRACER-VALKYRIE-GC','Ghế gaming','Ghế game DXRacer Valkyrie Series GC hỗ trợ ngồi lâu',990000,0,'assets/images/accessory/dxracer-valkyrie/dxracer-valkyrie.jpg',0,1)
ON DUPLICATE KEY UPDATE
  category_id = VALUES(category_id),
  brand = VALUES(brand),
  sku = VALUES(sku),
  short_description = VALUES(short_description),
  description = VALUES(description),
  price = VALUES(price),
  stock = VALUES(stock),
  image = VALUES(image),
  is_featured = VALUES(is_featured),
  is_active = VALUES(is_active);

INSERT INTO product_specs (product_id, cpu, ram, storage, gpu, screen_size, refresh_rate, os, color, weight, battery)
VALUES
  (1, 'Intel Core i7', '16GB', '512GB SSD', 'NVIDIA GTX 1650', '15.6"', '144Hz', 'Windows 10', 'Black', '2.3kg', '4-cell'),
  (2, 'Intel Core i7', '16GB', '512GB SSD', 'NVIDIA RTX 2060', '15.6"', '144Hz', 'Windows 10', 'Black', '2.5kg', '4-cell'),
  (3, 'Intel Core i7', '16GB', '512GB SSD', 'NVIDIA GTX 1660 Ti', '15.6"', '144Hz', 'Windows 10', 'Blue', '1.9kg', '4-cell'),
  (4, 'Intel Core i7', '16GB', '512GB SSD', 'NVIDIA GTX 1660 Ti', '17.3"', '144Hz', 'Windows 10', 'Black', '2.6kg', '4-cell'),
  (5, 'Intel Core i7', '16GB', '512GB SSD', 'Intel Iris Plus', '14"', '60Hz', 'Windows 10', 'Silver', '0.9kg', '2-cell'),
  (6, 'Intel Core i7', '16GB', '1TB SSD', 'Intel Iris Plus', '17"', '60Hz', 'Windows 10', 'Silver', '1.3kg', '2-cell')
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
  battery = VALUES(battery);

INSERT INTO orders (code, customer_name, customer_phone, shipping_address, shipping_note, subtotal, shipping_fee, discount_amount, total, status, payment_status, payment_method, created_at)
VALUES (
  'DH-0001',
  'Nguyễn Văn A',
  '0900000000',
  '123 Lê Lợi, Quận 1, TP.HCM',
  'Giao giờ hành chính',
  45990000,
  0,
  0,
  45990000,
  'pending',
  'unpaid',
  'cod',
  '2026-04-24 08:30:00'
)
ON DUPLICATE KEY UPDATE
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
  created_at = VALUES(created_at);

INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
VALUES (
  1,
  1,
  'HP Omen 15-dh0172TX Gaming Laptop',
  45990000,
  1,
  45990000
)
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name),
  unit_price = VALUES(unit_price),
  quantity = VALUES(quantity),
  line_total = VALUES(line_total);

INSERT INTO inventory (product_id, quantity, reserved_quantity, warehouse_location)
VALUES
  (1, 10, 0, 'Kho chính'),
  (2, 8, 0, 'Kho chính'),
  (3, 6, 0, 'Kho chính'),
  (4, 5, 0, 'Kho chính'),
  (5, 12, 0, 'Kho chính'),
  (6, 10, 0, 'Kho chính')
ON DUPLICATE KEY UPDATE
  quantity = VALUES(quantity),
  reserved_quantity = VALUES(reserved_quantity),
  warehouse_location = VALUES(warehouse_location);

INSERT INTO coupons (code, name, discount_type, discount_value, min_order_value, max_discount, start_at, end_at, usage_limit, used_count, is_active)
VALUES
  ('NEW100', 'Giảm giá khách hàng mới', 'fixed', 100000, 1000000, 100000, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 1000, 0, 1),
  ('SALE10', 'Giảm 10% đơn hàng', 'percent', 10, 5000000, 500000, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 500, 0, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  discount_type = VALUES(discount_type),
  discount_value = VALUES(discount_value),
  min_order_value = VALUES(min_order_value),
  max_discount = VALUES(max_discount),
  start_at = VALUES(start_at),
  end_at = VALUES(end_at),
  usage_limit = VALUES(usage_limit),
  used_count = VALUES(used_count),
  is_active = VALUES(is_active);

INSERT INTO banners (title, image_url, link_url, position, sort_order, is_active)
VALUES
  ('Sale Laptop Gaming', 'assets/images/banners/banner-gaming.jpg', '/products/gaming-laptop', 'homepage', 1, 1),
  ('Ưu đãi PC Gaming', 'assets/images/banners/banner-pc.jpg', '/products/gaming-pc', 'homepage', 2, 1)
ON DUPLICATE KEY UPDATE
  image_url = VALUES(image_url),
  link_url = VALUES(link_url),
  position = VALUES(position),
  sort_order = VALUES(sort_order),
  is_active = VALUES(is_active);
