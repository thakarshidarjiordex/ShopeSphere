import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Product from "../models/Product";

dotenv.config();

// --------------------------------------------------
// CONFIGURATION
// --------------------------------------------------

const CSV_PATH = path.resolve(
  process.cwd(),
  "../product-images-main/product-images-main/product_datasets.csv"
);

const BACKUP_DIR = path.resolve(
  process.cwd(),
  "image-backups"
);

const REPORT_PATH = path.resolve(
  process.cwd(),
  "dataset-catalog-preview.json"
);

const HTML_PATH = path.resolve(
  process.cwd(),
  "../client/public/dataset-catalog-preview.html"
);

// November 16, 2026 reference rate.
// Override it in server/.env with USD_TO_INR_RATE.
const USD_TO_INR_RATE = Number(
  process.env.USD_TO_INR_RATE || 94.03
);

const IMAGES_PER_PRODUCT = 3;
const TARGET_TOTAL = 250;

// Target distribution across the actual dataset groups.
const CATEGORY_QUOTAS: Record<string, number> = {
  WomensClothing: 69,
  UnisexClothing: 65,
  Footwear: 42,
  Jewelry: 15,
  BagsAndWallets: 15,
  HomeAndLiving: 12,
  BeautyAndPersonalCare: 10,
  WatchesAndEyewear: 8,
  MensClothing: 5,
  FashionAccessories: 4,
  Electronics: 4,
  SportsAndFitness: 1,
};

const CATEGORY_LABELS: Record<string, string> = {
  WomensClothing: "Women's Clothing",
  UnisexClothing: "Unisex Clothing",
  Footwear: "Footwear",
  Jewelry: "Jewelry",
  BagsAndWallets: "Bags & Wallets",
  HomeAndLiving: "Home & Living",
  BeautyAndPersonalCare: "Beauty & Personal Care",
  WatchesAndEyewear: "Watches & Eyewear",
  MensClothing: "Men's Clothing",
  FashionAccessories: "Fashion Accessories",
  Electronics: "Electronics",
  SportsAndFitness: "Sports & Fitness",
};

// --------------------------------------------------
// TYPES
// --------------------------------------------------

interface DatasetProduct {
  product_id: string;
  title: string;
  product_description: string;
  rating: string;
  ratings_count: string;
  initial_price: string;
  final_price: string;
  currency: string;
  product_details: string;
  product_specifications: string;
  category_group: string;
  subcategory: string;
  github_images: string;
}

interface SelectedProduct {
  product_id: string;
  title: string;
  product_description: string;
  rating: string;
  ratings_count: string;
  initial_price: string;
  final_price: string;
  currency: string;
  product_details: string;
  product_specifications: string;
  category_group: string;
  subcategory: string;
  github_images: string;
}

interface ImportProduct {
  name: string;
  brand: string;
  category: string;
  subcategory: string;
  datasetProductId: string;
  price: number;
  image: string;
  images: string[];
  description: string;
  specifications: {
    name: string;
    value: string;
  }[];
  rating: number;
  stock: number;
}

// --------------------------------------------------
// CSV PARSER
// Handles quoted fields and commas inside fields.
// --------------------------------------------------

function parseCSV(content: string): string[][] {
  const rows: string[][] = [];

  let row: string[] = [];
  let field = "";
  let insideQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const next = content[i + 1];

    if (char === '"') {
      if (insideQuotes && next === '"') {
        field += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      row.push(field);
      field = "";
    } else if (
      (char === "\n" || char === "\r") &&
      !insideQuotes
    ) {
      if (char === "\r" && next === "\n") {
        i++;
      }

      row.push(field);

      if (row.some((value) => value.trim())) {
        rows.push(row);
      }

      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field);

  if (row.some((value) => value.trim())) {
    rows.push(row);
  }

  return rows;
}

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function parseNumber(value: string): number {
  const cleaned = String(value || "")
    .replace(/,/g, "")
    .replace(/[^0-9.-]/g, "");

  const result = Number.parseFloat(cleaned);

  return Number.isFinite(result) ? result : 0;
}

function parseJson<T>(
  value: string,
  fallback: T
): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function getProductImages(value: string): string[] {
  return String(value || "")
    .split(",")
    .map((url) => url.trim())
    .filter((url) => {
      try {
        const parsed = new URL(url);

        return (
          parsed.protocol === "https:" &&
          parsed.hostname === "pazhanir.github.io" &&
          parsed.pathname.startsWith("/product-images/")
        );
      } catch {
        return false;
      }
    });
}

function getConvertedPrice(product: DatasetProduct): number {
  // Prefer final_price. Fall back to initial_price.
  const usdPrice =
    parseNumber(product.final_price) ||
    parseNumber(product.initial_price);

  if (usdPrice <= 0) {
    throw new Error(
      `Invalid price for dataset product ${product.product_id}`
    );
  }

  return Math.round(usdPrice * USD_TO_INR_RATE);
}

function getRating(value: string): number {
  const rating = parseNumber(value);

  return Math.min(5, Math.max(0, rating));
}

function getStock(productId: string): number {
  // Stable demo stock based on product ID.
  const numericId = Number(productId) || 0;

  return 5 + (numericId % 46);
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// --------------------------------------------------
// READ CSV
// --------------------------------------------------

function readDataset(): DatasetProduct[] {
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV file not found: ${CSV_PATH}`);
  }

  const content = fs.readFileSync(CSV_PATH, "utf8");
  const rows = parseCSV(content);

  if (rows.length < 2) {
    throw new Error("Dataset CSV is empty.");
  }

  const headers = rows[0].map((header) =>
    header.replace(/^\uFEFF/, "").trim()
  );

  const requiredColumns = [
    "product_id",
    "title",
    "product_description",
    "rating",
    "ratings_count",
    "initial_price",
    "final_price",
    "currency",
    "product_details",
    "product_specifications",
    "category_group",
    "subcategory",
    "github_images",
  ];

  for (const column of requiredColumns) {
    if (!headers.includes(column)) {
      throw new Error(`Missing CSV column: ${column}`);
    }
  }

  const columnIndex = (name: string) =>
    headers.indexOf(name);

  const products: DatasetProduct[] = rows
    .slice(1)
    .map((row) => {
      const get = (column: string) =>
        row[columnIndex(column)]?.trim() || "";

      return {
        product_id: get("product_id"),
        title: get("title"),
        product_description: get("product_description"),
        rating: get("rating"),
        ratings_count: get("ratings_count"),
        initial_price: get("initial_price"),
        final_price: get("final_price"),
        currency: get("currency"),
        product_details: get("product_details"),
        product_specifications: get("product_specifications"),
        category_group: get("category_group"),
        subcategory: get("subcategory"),
        github_images: get("github_images"),
      };
    })
    .filter(
      (product) =>
        product.product_id &&
        product.title &&
        product.product_description &&
        product.category_group &&
        product.subcategory
    );

  return products;
}

// --------------------------------------------------
// SELECT PRODUCTS
//
// Products are distributed across subcategories.
// Within each subcategory, higher-rated products
// with more reviews are preferred.
// --------------------------------------------------

function selectProducts(
  dataset: DatasetProduct[]
): SelectedProduct[] {
  const selected: SelectedProduct[] = [];

  for (const [categoryGroup, quota] of Object.entries(
    CATEGORY_QUOTAS
  )) {
    const eligible = dataset.filter((product) => {
      const images = getProductImages(product.github_images);
      const price =
        parseNumber(product.final_price) ||
        parseNumber(product.initial_price);

      return (
        product.category_group === categoryGroup &&
        images.length >= IMAGES_PER_PRODUCT &&
        price > 0 &&
        product.currency.toUpperCase() === "USD"
      );
    });

    // Split products into subcategory buckets.
    const buckets = new Map<string, DatasetProduct[]>();

    for (const product of eligible) {
      const key = product.subcategory;

      if (!buckets.has(key)) {
        buckets.set(key, []);
      }

      buckets.get(key)!.push(product);
    }

    // Sort each subcategory by rating and review count.
    for (const bucket of buckets.values()) {
      bucket.sort((a, b) => {
        const ratingDifference =
          getRating(b.rating) - getRating(a.rating);

        if (ratingDifference !== 0) {
          return ratingDifference;
        }

        const reviewDifference =
          parseNumber(b.ratings_count) -
          parseNumber(a.ratings_count);

        if (reviewDifference !== 0) {
          return reviewDifference;
        }

        return a.product_id.localeCompare(b.product_id);
      });
    }

    const subcategories = Array.from(buckets.keys()).sort();

    if (eligible.length < quota) {
      throw new Error(
        `Not enough eligible products in ${categoryGroup}. ` +
        `Required ${quota}, available ${eligible.length}.`
      );
    }

    // Round-robin selection spreads products across subcategories.
    let selectedForCategory = 0;

    while (selectedForCategory < quota) {
      let addedInRound = false;

      for (const subcategory of subcategories) {
        if (selectedForCategory >= quota) {
          break;
        }

        const bucket = buckets.get(subcategory)!;
        const product = bucket.shift();

        if (!product) {
          continue;
        }

        selected.push(product);
        selectedForCategory++;
        addedInRound = true;
      }

      if (!addedInRound) {
        throw new Error(
          `Could not complete selection for ${categoryGroup}`
        );
      }
    }

    console.log(
      `${categoryGroup}: ${selectedForCategory}/${quota}`
    );
  }

  if (selected.length !== TARGET_TOTAL) {
    throw new Error(
      `Expected ${TARGET_TOTAL} products, selected ${selected.length}.`
    );
  }

  // Protect against duplicate dataset IDs.
  const uniqueIds = new Set(
    selected.map((product) => product.product_id)
  );

  if (uniqueIds.size !== selected.length) {
    throw new Error("Duplicate dataset product IDs found.");
  }

  return selected;
}

// --------------------------------------------------
// MAP DATASET PRODUCT TO MONGOOSE PRODUCT
// --------------------------------------------------

function mapProduct(
  product: SelectedProduct
): ImportProduct {
  const images = getProductImages(product.github_images);

  if (images.length < IMAGES_PER_PRODUCT) {
    throw new Error(
      `Product ${product.product_id} has fewer than 3 images.`
    );
  }

  const details = parseJson<Record<string, string>>(
    product.product_details,
    {}
  );

  const rawSpecifications = parseJson<
    {
      specification_name?: string;
      specification_value?: string;
    }[]
  >(product.product_specifications, []);

  const specifications = rawSpecifications
    .filter(
      (item) =>
        item.specification_name &&
        item.specification_value
    )
    .map((item) => ({
      name: item.specification_name!.trim(),
      value: item.specification_value!.trim(),
    }));

  return {
    // product_description is the actual product name.
    name: product.product_description,

    // title is the brand name in this dataset.
    brand: product.title,

    category:
      CATEGORY_LABELS[product.category_group] ||
      product.category_group,

    subcategory: product.subcategory,

    datasetProductId: product.product_id,

    price: getConvertedPrice(product),

    image: images[0],

    images: images.slice(1, IMAGES_PER_PRODUCT),

    description:
      details.description ||
      product.product_description,

    specifications,

    rating: getRating(product.rating),

    stock: getStock(product.product_id),
  };
}

// --------------------------------------------------
// GENERATE HTML IMAGE PREVIEW
// --------------------------------------------------

function generateHtmlPreview(
  products: ImportProduct[]
): void {
  const cards = products
    .map((product, index) => {
      const allImages = [
        product.image,
        ...product.images,
      ];

      const imageHtml = allImages
        .map(
          (url, imageIndex) => `
            <div class="image-box">
              <img
                src="${escapeHtml(url)}"
                alt="${escapeHtml(product.name)}"
                loading="lazy"
              />
              <span>Image ${imageIndex + 1}</span>
            </div>
          `
        )
        .join("");

      return `
        <article class="product-card">
          <h2>${index + 1}. ${escapeHtml(product.name)}</h2>

          <p><strong>Brand:</strong>
            ${escapeHtml(product.brand)}
          </p>

          <p><strong>Category:</strong>
            ${escapeHtml(product.category)}
          </p>

          <p><strong>Subcategory:</strong>
            ${escapeHtml(product.subcategory)}
          </p>

          <p><strong>Price:</strong>
            ₹${product.price.toLocaleString("en-IN")}
          </p>

          <p><strong>Rating:</strong>
            ${product.rating}/5
          </p>

          <div class="images">
            ${imageHtml}
          </div>
        </article>
      `;
    })
    .join("");

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />

<title>ShopSphere - 250 Product Preview</title>

<style>
  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    padding: 24px;
    background: #f3f4f6;
    color: #222;
    font-family: Arial, sans-serif;
  }

  header {
    max-width: 1400px;
    margin: 0 auto 24px;
  }

  .product-card {
    max-width: 1400px;
    margin: 20px auto;
    padding: 22px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,.08);
  }

  .images {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
    margin-top: 16px;
  }

  .image-box {
    padding: 10px;
    text-align: center;
    border: 1px solid #ddd;
    border-radius: 8px;
  }

  .image-box img {
    width: 100%;
    height: 240px;
    object-fit: contain;
    background: #fff;
  }

  .image-box span {
    display: block;
    margin-top: 8px;
    color: #666;
  }

  @media(max-width: 700px) {
    .images {
      grid-template-columns: 1fr;
    }
  }
</style>
</head>

<body>
  <header>
    <h1>ShopSphere - Dataset Catalog Preview</h1>
    <p>Total products: ${products.length}</p>
    <p>Exchange rate: 1 USD = ₹${USD_TO_INR_RATE}</p>
    <p>Each product displays its own dataset images.</p>
  </header>

  ${cards}
</body>
</html>
  `;

  fs.mkdirSync(path.dirname(HTML_PATH), {
    recursive: true,
  });

  fs.writeFileSync(HTML_PATH, html, "utf8");
}

// --------------------------------------------------
// MAIN
// --------------------------------------------------

async function main(): Promise<void> {
  const applyChanges = process.argv.includes("--apply");
  const visualPreview = process.argv.includes(
    "--visual-preview"
  );
  const confirmReplace = process.argv.includes(
    "--confirm-replace"
  );

  if (applyChanges && visualPreview) {
    throw new Error(
      "Do not combine --apply and --visual-preview."
    );
  }

  if (applyChanges && !confirmReplace) {
    throw new Error(
      "Catalog replacement requires both --apply and --confirm-replace."
    );
  }

  if (
    !Number.isFinite(USD_TO_INR_RATE) ||
    USD_TO_INR_RATE <= 0
  ) {
    throw new Error("Invalid USD_TO_INR_RATE.");
  }

  console.log("\n======================================");
  console.log(" ShopSphere Dataset Catalog Importer");
  console.log("======================================\n");

  console.log("Reading dataset...");

  const dataset = readDataset();

  console.log(`Dataset records: ${dataset.length}`);

  console.log("\nSelecting 250 products...");

  const selected = selectProducts(dataset);

  console.log(`\nSelected: ${selected.length}`);

  const importProducts = selected.map(mapProduct);

  // Report category distribution.
  const categoryCounts: Record<string, number> = {};

  for (const product of importProducts) {
    categoryCounts[product.category] =
      (categoryCounts[product.category] || 0) + 1;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: applyChanges
      ? "apply"
      : visualPreview
        ? "visual-preview"
        : "preview",
    datasetCount: dataset.length,
    selectedCount: importProducts.length,
    imagesPerProduct: IMAGES_PER_PRODUCT,
    totalSelectedImages:
      importProducts.length * IMAGES_PER_PRODUCT,
    currency: "INR",
    originalCurrency: "USD",
    usdToInrRate: USD_TO_INR_RATE,
    categoryCounts,
    products: importProducts,
  };

  fs.writeFileSync(
    REPORT_PATH,
    JSON.stringify(report, null, 2),
    "utf8"
  );

  console.log(`\nJSON report: ${REPORT_PATH}`);

  if (visualPreview) {
    generateHtmlPreview(importProducts);

    console.log(`HTML preview: ${HTML_PATH}`);

    console.log("\nOpen in your browser:");
    console.log(
      "http://localhost:5173/dataset-catalog-preview.html"
    );
  }

  console.log("\n======================================");
  console.log(" SELECTION SUMMARY");
  console.log("======================================");

  console.log(`Selected products: ${importProducts.length}`);
  console.log(
    `Selected images: ${importProducts.length * IMAGES_PER_PRODUCT}`
  );

  for (const [category, count] of Object.entries(categoryCounts)) {
    console.log(`${category}: ${count}`);
  }

  // Preview modes never connect to or modify MongoDB.
  if (!applyChanges) {
    console.log("\nPREVIEW COMPLETED");
    console.log("MongoDB was not modified.");

    return;
  }

  // --------------------------------------------------
  // DATABASE REPLACEMENT
  // --------------------------------------------------

  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is missing from server/.env");
  }

  console.log("\nConnecting to MongoDB...");

  await mongoose.connect(mongoUri);

  console.log("MongoDB connected.");

  const existingProducts = await Product.find().lean();

  console.log(
    `Existing products to back up: ${existingProducts.length}`
  );

  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const backupFile = path.join(
    BACKUP_DIR,
    `products-before-dataset-import-${Date.now()}.json`
  );

  fs.writeFileSync(
    backupFile,
    JSON.stringify(existingProducts, null, 2),
    "utf8"
  );

  console.log(`Backup created: ${backupFile}`);

  try {
    console.log("\nRemoving existing catalog...");

    await Product.deleteMany({});

    console.log("Inserting new catalog...");

    await Product.insertMany(importProducts);

    console.log("\n======================================");
    console.log(" CATALOG IMPORT COMPLETED");
    console.log("======================================");

    console.log(`Imported products: ${importProducts.length}`);
    console.log(`Backup: ${backupFile}`);
  } catch (error) {
    console.error("\nImport failed. Restoring old catalog...");

    await Product.deleteMany({});

    if (existingProducts.length > 0) {
      await Product.insertMany(existingProducts);
    }

    console.log("Previous catalog restored.");

    throw error;
  }
}

// --------------------------------------------------
// EXECUTION
// --------------------------------------------------

main()
  .catch((error: unknown) => {
    console.error("\nCatalog import failed:");

    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }

    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
