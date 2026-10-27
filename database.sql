CREATE DATABASE IF NOT EXISTS stockwise_inventory
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE stockwise_inventory;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  sku VARCHAR(40) NOT NULL UNIQUE,
  category VARCHAR(80) NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  reorder_level INT NOT NULL DEFAULT 10,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_user FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT chk_product_price CHECK (price > 0),
  CONSTRAINT chk_product_quantity CHECK (quantity >= 0),
  CONSTRAINT chk_product_reorder CHECK (reorder_level >= 0)
);

-- Optional sample products. Run after creating the tables.
INSERT IGNORE INTO products (name, sku, category, price, quantity, reorder_level)
VALUES
('Wireless Mouse', 'ACC-104', 'Accessories', 799.00, 34, 10),
('Mechanical Keyboard', 'ACC-108', 'Accessories', 2499.00, 8, 10),
('USB-C Hub', 'ELE-205', 'Electronics', 1899.00, 21, 8),
('Notebook Set', 'OFF-301', 'Office Supplies', 249.00, 4, 12),
('Desk Lamp', 'FUR-112', 'Furniture', 1299.00, 0, 5),
('Bluetooth Speaker', 'ELE-211', 'Electronics', 1599.00, 17, 6);
