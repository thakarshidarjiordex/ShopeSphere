import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Product from "../models/Product";

dotenv.config();

// --------------------------------------------------
// PATHS
// --------------------------------------------------

const DATASET_ROOT = path.resolve(
  process.cwd(),
  "../product-images-main/product-images-main"
);

const CSV_PATH = path.join(DATASET_ROOT, "product_datasets.csv");

const OUTPUT_DIR = path.resolve(
  process.cwd(),
  "../client/public/products-dataset"
);

const PREVIEW_PATH = path.resolve(
  process.cwd(),
  "dataset-image-preview.json"
);

const BACKUP_DIR = path.resolve(process.cwd(), "image-backups");

// Separate visual-preview folder.
// These files will NOT be used by the live products.

const VISUAL_PREVIEW_DIR = path.resolve(
  process.cwd(),
  "../client/public/dataset-image-preview-assets"
);

const VISUAL_PREVIEW_HTML = path.resolve(
  process.cwd(),
  "../client/public/dataset-image-preview.html"
);

const IMAGE_COUNT = 3;

// --------------------------------------------------
// TYPES
// --------------------------------------------------

interface DatasetProduct {
  product_id: string;
  title: string;
  category_group: string;
  subcategory: string;
}

interface ShopProduct {
  _id: mongoose.Types.ObjectId;
  name: string;
  category: string;
  brand?: string;
}

interface ImageCandidate {
  productId: string;
  title: string;
  categoryGroup: string;
  subcategory: string;
  imagePaths: string[];
}

interface ProductRule {
  categoryGroup: string;
  subcategories: string[];
  reason: string;
}

interface Assignment {
  mongoId: string;
  productName: string;
  category: string;
  datasetTitle: string;
  datasetCategory: string;
  datasetSubcategory: string;
  mainImage: string;
  additionalImages: string[];
  previewImages: string[];
}

interface SkippedProduct {
  mongoId: string;
  productName: string;
  category: string;
  reason: string;
}

// --------------------------------------------------
// CSV PARSER
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
// NORMALIZATION
// --------------------------------------------------

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// --------------------------------------------------
// STRICT PRODUCT-TYPE RULES
//
// Each rule specifies exactly which dataset
// category and subcategory are permitted.
//
// No general category fallback is allowed.
// --------------------------------------------------

function getProductRule(product: ShopProduct): ProductRule | null {
  const name = normalize(product.name);

  // ELECTRONICS

  if (/headphones|earbuds/.test(name)) {
    return {
      categoryGroup: "Electronics",
      subcategories: ["headphones"],
      reason: "Headphones / earbuds match",
    };
  }

  // FOOTWEAR

  if (/running shoes/.test(name)) {
    return {
      categoryGroup: "Footwear",
      subcategories: ["sports-shoes"],
      reason: "Running shoes match",
    };
  }

  if (/sneakers|casual shoes/.test(name)) {
    return {
      categoryGroup: "Footwear",
      subcategories: ["casual-shoes"],
      reason: "Casual footwear match",
    };
  }

  // BAGS

  if (/backpack/.test(name)) {
    return {
      categoryGroup: "BagsAndWallets",
      subcategories: ["backpacks"],
      reason: "Backpack match",
    };
  }

  if (/handbag/.test(name)) {
    return {
      categoryGroup: "BagsAndWallets",
      subcategories: ["handbags"],
      reason: "Handbag match",
    };
  }

  if (/trolley bag/.test(name)) {
    return {
      categoryGroup: "BagsAndWallets",
      subcategories: ["trolley-bag"],
      reason: "Trolley bag match",
    };
  }

  if (/wallet/.test(name)) {
    return {
      categoryGroup: "BagsAndWallets",
      subcategories: ["wallets"],
      reason: "Wallet match",
    };
  }

  if (/leather belt|adjustable leather belt/.test(name)) {
    return {
      categoryGroup: "BagsAndWallets",
      subcategories: ["belts"],
      reason: "Belt match",
    };
  }

  // FASHION

  if (/t shirt|tshirt/.test(name)) {
    return {
      categoryGroup: "UnisexClothing",
      subcategories: ["tshirts"],
      reason: "T-shirt match",
    };
  }

  if (/jeans/.test(name)) {
    return {
      categoryGroup: "UnisexClothing",
      subcategories: ["jeans"],
      reason: "Jeans match",
    };
  }

  if (/casual shirt/.test(name)) {
    return {
      categoryGroup: "UnisexClothing",
      subcategories: ["shirts"],
      reason: "Shirt match",
    };
  }

  if (/hoodie/.test(name)) {
    return {
      categoryGroup: "UnisexClothing",
      subcategories: ["sweatshirts"],
      reason: "Hoodie / sweatshirt match",
    };
  }

  if (/trousers/.test(name)) {
    return {
      categoryGroup: "UnisexClothing",
      subcategories: ["trousers"],
      reason: "Trouser match",
    };
  }

  if (/jacket/.test(name)) {
    return {
      categoryGroup: "UnisexClothing",
      subcategories: ["jackets"],
      reason: "Jacket match",
    };
  }

  if (/kurta/.test(name)) {
    return {
      categoryGroup: "WomensClothing",
      subcategories: ["kurtas"],
      reason: "Kurta match",
    };
  }

  if (/casual dress/.test(name)) {
    return {
      categoryGroup: "WomensClothing",
      subcategories: ["dresses"],
      reason: "Dress match",
    };
  }

  // HOME AND KITCHEN

  if (/bedsheet/.test(name)) {
    return {
      categoryGroup: "HomeAndLiving",
      subcategories: ["bedsheets"],
      reason: "Bedsheet match",
    };
  }

  if (/dinner set|dinnerware/.test(name)) {
    return {
      categoryGroup: "HomeAndLiving",
      subcategories: ["dinnerware"],
      reason: "Dinnerware match",
    };
  }

  // SPORTS

  if (/yoga mat/.test(name)) {
    return {
      categoryGroup: "SportsAndFitness",
      subcategories: ["yoga-mats"],
      reason: "Yoga mat match",
    };
  }

  // BEAUTY

  if (/shampoo/.test(name)) {
    return {
      categoryGroup: "BeautyAndPersonalCare",
      subcategories: ["shampoo-and-conditioner"],
      reason: "Shampoo match",
    };
  }

  if (/face cleanser|face wash|cleanser/.test(name)) {
    return {
      categoryGroup: "BeautyAndPersonalCare",
      subcategories: ["face-wash-and-cleanser"],
      reason: "Face cleanser match",
    };
  }

  if (/lipstick/.test(name)) {
    return {
      categoryGroup: "BeautyAndPersonalCare",
      subcategories: ["lipstick"],
      reason: "Lipstick match",
    };
  }

  if (/face moisturizer|face moisturiser/.test(name)) {
    return {
      categoryGroup: "BeautyAndPersonalCare",
      subcategories: ["face-moisturisers"],
      reason: "Face moisturizer match",
    };
  }

  if (/perfume/.test(name)) {
    return {
      categoryGroup: "BeautyAndPersonalCare",
      subcategories: ["perfume-and-body-mist"],
      reason: "Perfume match",
    };
  }

  if (/cap|baseball cap/.test(name)) {
    return {
      categoryGroup: "FashionAccessories",
      subcategories: ["caps"],
      reason: "Cap match",
    };
  }

  // No safe matching rule.
  // Existing database images will remain unchanged.

  return null;
}

// --------------------------------------------------
// CREATE SLUG
// --------------------------------------------------

function createSlug(name: string, id: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${slug}-${id.slice(-6)}`;
}


// --------------------------------------------------
// HTML PREVIEW GALLERY
// --------------------------------------------------

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function generateVisualPreview(
  assignments: Assignment[]
): void {
  const cards = assignments
    .map((item, index) => {
      const images = item.previewImages
        .map(
          (image, imageIndex) => `
            <div class="image-container">
              <img
                src="${escapeHtml(image)}"
                alt="${escapeHtml(item.productName)} image ${imageIndex + 1}"
                loading="lazy"
              />
              <p>Image ${imageIndex + 1}</p>
            </div>
          `
        )
        .join("");

      return `
        <article class="product-card">
          <h2>${index + 1}. ${escapeHtml(item.productName)}</h2>

          <div class="details">
            <p><strong>ShopSphere category:</strong>
              ${escapeHtml(item.category)}
            </p>

            <p><strong>Dataset title:</strong>
              ${escapeHtml(item.datasetTitle)}
            </p>

            <p><strong>Dataset category:</strong>
              ${escapeHtml(item.datasetCategory)}
            </p>

            <p><strong>Dataset subcategory:</strong>
              ${escapeHtml(item.datasetSubcategory)}
            </p>
          </div>

          <div class="images">
            ${images}
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

  <title>ShopSphere - Dataset Image Preview</title>

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 25px;
      background: #f3f4f6;
      font-family: Arial, sans-serif;
      color: #222;
    }

    header {
      max-width: 1400px;
      margin: 0 auto 25px;
    }

    h1 {
      margin-bottom: 8px;
    }

    .summary {
      color: #555;
    }

    .product-card {
      max-width: 1400px;
      margin: 20px auto;
      padding: 22px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }

    .product-card h2 {
      margin-top: 0;
    }

    .details {
      margin-bottom: 18px;
      color: #444;
      line-height: 1.5;
    }

    .details p {
      margin: 5px 0;
    }

    .images {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 18px;
    }

    .image-container {
      text-align: center;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
    }

    .image-container img {
      width: 100%;
      height: 260px;
      object-fit: contain;
      background: white;
    }

    .image-container p {
      margin-bottom: 0;
      color: #555;
    }

    @media (max-width: 750px) {
      .images {
        grid-template-columns: 1fr;
      }

      .image-container img {
        height: 220px;
      }
    }
  </style>
</head>

<body>
  <header>
    <h1>ShopSphere Dataset Image Preview</h1>

    <p class="summary">
      Total matched products: ${assignments.length}
    </p>

    <p class="summary">
      Review all images carefully before applying them to MongoDB.
    </p>
  </header>

  ${cards}
</body>
</html>
  `;

  fs.writeFileSync(
    VISUAL_PREVIEW_HTML,
    html,
    "utf8"
  );
}


// --------------------------------------------------
// MAIN
// --------------------------------------------------

async function main(): Promise<void> {
  const applyChanges = process.argv.includes("--apply");

  const visualPreview = process.argv.includes(
    "--visual-preview"
  );

  if (applyChanges && visualPreview) {
    throw new Error(
      "Use either --apply or --visual-preview, not both."
    );
  }

  console.log("\n======================================");
  console.log(" ShopSphere Strict Dataset Image Importer");
  console.log("======================================\n");

  // CHECK DATASET

  if (!fs.existsSync(DATASET_ROOT)) {
    throw new Error(`Dataset folder not found: ${DATASET_ROOT}`);
  }

  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV file not found: ${CSV_PATH}`);
  }

  // READ CSV

  console.log("Reading dataset CSV...");

  const csvContent = fs.readFileSync(CSV_PATH, "utf8");
  const rows = parseCSV(csvContent);

  if (rows.length < 2) {
    throw new Error("Dataset CSV is empty.");
  }

  const headers = rows[0].map((header) =>
    header.replace(/^\uFEFF/, "").trim()
  );

  const requiredColumns = [
    "product_id",
    "title",
    "category_group",
    "subcategory",
  ];

  for (const column of requiredColumns) {
    if (!headers.includes(column)) {
      throw new Error(`Missing CSV column: ${column}`);
    }
  }

  const index = (column: string) => headers.indexOf(column);

  const datasetProducts: DatasetProduct[] = rows
    .slice(1)
    .map((row) => ({
      product_id: row[index("product_id")]?.trim(),
      title: row[index("title")]?.trim(),
      category_group: row[index("category_group")]?.trim(),
      subcategory: row[index("subcategory")]?.trim(),
    }))
    .filter(
      (item) =>
        item.product_id &&
        item.title &&
        item.category_group &&
        item.subcategory
    );

  console.log(`Dataset products: ${datasetProducts.length}`);

  // SCAN LOCAL IMAGES

  console.log("Scanning dataset images...");

  const candidates: ImageCandidate[] = [];

  for (const item of datasetProducts) {
    const folder = path.join(
      DATASET_ROOT,
      item.category_group,
      item.subcategory
    );

    if (!fs.existsSync(folder)) {
      continue;
    }

    const imageFiles = fs
      .readdirSync(folder)
      .filter(
        (file) =>
          file.startsWith(`${item.product_id}_`) &&
          /\.(jpg|jpeg)$/i.test(file)
      )
      .sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      );

    const imagePaths = imageFiles.map((file) =>
      path.join(folder, file)
    );

    if (imagePaths.length >= IMAGE_COUNT) {
      candidates.push({
        productId: item.product_id,
        title: item.title,
        categoryGroup: item.category_group,
        subcategory: item.subcategory,
        imagePaths,
      });
    }
  }

  console.log(
    `Dataset products with ${IMAGE_COUNT}+ images: ${candidates.length}`
  );

  // CONNECT DATABASE

  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is missing from server/.env");
  }

  console.log("\nConnecting to MongoDB...");

  await mongoose.connect(mongoUri);

  console.log("MongoDB connected.");

  const products = (await Product.find()
    .select("_id name category brand")
    .lean()) as unknown as ShopProduct[];

  console.log(`ShopSphere products: ${products.length}`);

  // --------------------------------------------------
  // MATCH PRODUCTS
  // --------------------------------------------------

  const usedDatasetIds = new Set<string>();

  const assignments: Assignment[] = [];
  const skipped: SkippedProduct[] = [];

  for (const product of products) {
    const rule = getProductRule(product);

    if (!rule) {
      skipped.push({
        mongoId: product._id.toString(),
        productName: product.name,
        category: product.category,
        reason: "No strict product-type rule exists for this product.",
      });

      continue;
    }

    const matchingCandidates = candidates.filter(
      (candidate) =>
        candidate.categoryGroup === rule.categoryGroup &&
        rule.subcategories.includes(candidate.subcategory) &&
        !usedDatasetIds.has(candidate.productId)
    );

    if (matchingCandidates.length === 0) {
      skipped.push({
        mongoId: product._id.toString(),
        productName: product.name,
        category: product.category,
        reason:
          `No unused dataset product found. Required: ` +
          `${rule.categoryGroup} / ${rule.subcategories.join(", ")}`,
      });

      continue;
    }

    // Use one dataset product per ShopSphere product.
    const selected = matchingCandidates[0];

    const selectedImages = selected.imagePaths.slice(0, IMAGE_COUNT);

    if (
      selectedImages.length !== IMAGE_COUNT ||
      selectedImages.some((image) => !fs.existsSync(image))
    ) {
      skipped.push({
        mongoId: product._id.toString(),
        productName: product.name,
        category: product.category,
        reason: "Selected dataset images are missing.",
      });

      continue;
    }

    usedDatasetIds.add(selected.productId);

    const slug = createSlug(
      product.name,
      product._id.toString()
    );

    const publicFolder = path.join(OUTPUT_DIR, slug);

    const publicPaths = [
      `/products-dataset/${slug}/image-1.jpg`,
      `/products-dataset/${slug}/image-2.jpg`,
      `/products-dataset/${slug}/image-3.jpg`,
        ];
    const previewFolder = path.join(
      VISUAL_PREVIEW_DIR,
      slug
    );

    const previewPaths = [
      `/dataset-image-preview-assets/${slug}/image-1.jpg`,
      `/dataset-image-preview-assets/${slug}/image-2.jpg`,
      `/dataset-image-preview-assets/${slug}/image-3.jpg`,
    ];

    assignments.push({
      mongoId: product._id.toString(),
      productName: product.name,
      category: product.category,
      datasetTitle: selected.title,
      datasetCategory: selected.categoryGroup,
      datasetSubcategory: selected.subcategory,
      mainImage: publicPaths[0],
      additionalImages: publicPaths.slice(1),
      previewImages: previewPaths,
    });

    // Copy files only in apply mode.

    // Copy production images only in apply mode.

if (applyChanges) {
  fs.mkdirSync(publicFolder, { recursive: true });

  selectedImages.forEach((source, imageIndex) => {
    const destination = path.join(
      publicFolder,
      `image-${imageIndex + 1}.jpg`
    );

    fs.copyFileSync(source, destination);
  });
}

// Copy separate preview images only in visual-preview mode.

    if (visualPreview) {
      fs.mkdirSync(previewFolder, { recursive: true });

      selectedImages.forEach((source, imageIndex) => {
        const destination = path.join(
          previewFolder,
          `image-${imageIndex + 1}.jpg`
        );

        fs.copyFileSync(source, destination);
      });
    }
  }

  // --------------------------------------------------
  // SAVE PREVIEW
  // --------------------------------------------------

  const report = {
    generatedAt: new Date().toISOString(),
    mode: applyChanges
    ? "apply"
    : visualPreview
      ? "visual-preview"
      : "preview",
    totalProducts: products.length,
    matchedCount: assignments.length,
    skippedCount: skipped.length,
    assignments,
    skipped,
  };

  fs.writeFileSync(
    PREVIEW_PATH,
    JSON.stringify(report, null, 2),
    "utf8"
  );

  // DISPLAY MATCHES

  console.log("\n======================================");
  console.log(" MATCHED PRODUCTS");
  console.log("======================================\n");

  assignments.forEach((item, index) => {
    console.log(`${index + 1}. ${item.productName}`);
    console.log(`   Dataset title: ${item.datasetTitle}`);
    console.log(`   Dataset group: ${item.datasetCategory}`);
    console.log(`   Dataset type: ${item.datasetSubcategory}`);
    console.log(`   Main image: ${item.mainImage}`);
    console.log("");
  });

  // DISPLAY SKIPPED PRODUCTS

  console.log("\n======================================");
  console.log(" SKIPPED PRODUCTS");
  console.log("======================================\n");

  skipped.forEach((item, index) => {
    console.log(`${index + 1}. ${item.productName}`);
    console.log(`   Reason: ${item.reason}`);
    console.log("   Existing images will remain unchanged.");
    console.log("");
  });

  console.log(`Preview saved: ${PREVIEW_PATH}`);
  
  // --------------------------------------------------
  // DRY RUN / VISUAL PREVIEW
  // --------------------------------------------------

  if (!applyChanges) {
    console.log("\n======================================");
    console.log(" PREVIEW COMPLETED");
    console.log("======================================");

    console.log(`Matched: ${assignments.length}`);
    console.log(`Skipped: ${skipped.length}`);

    console.log("No database fields changed.");
    console.log("Production image files were not copied.");

    if (visualPreview) {
      console.log("\nOpen this URL in your browser:");
      console.log(
        "http://localhost:5173/dataset-image-preview.html"
      );
    }

    return;
  }

  // --------------------------------------------------
  // BACKUP ORIGINAL IMAGE FIELDS
  // --------------------------------------------------

  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const backupFile = path.join(
    BACKUP_DIR,
    `product-images-${Date.now()}.json`
  );

  // GENERATE VISUAL PREVIEW

  if (visualPreview) {
    generateVisualPreview(assignments);

    console.log("\n======================================");
    console.log(" VISUAL PREVIEW GENERATED");
    console.log("======================================");

    console.log(`Matched products: ${assignments.length}`);
    console.log(`HTML gallery: ${VISUAL_PREVIEW_HTML}`);
    console.log(`Preview images: ${VISUAL_PREVIEW_DIR}`);
  }

  const matchedIds = assignments.map((item) => item.mongoId);

  const originalProducts = await Product.find({
    _id: { $in: matchedIds },
  })
    .select("_id name image images")
    .lean();

  fs.writeFileSync(
    backupFile,
    JSON.stringify(originalProducts, null, 2),
    "utf8"
  );

  console.log(`\nBackup created: ${backupFile}`);

  // --------------------------------------------------
  // UPDATE ONLY image AND images
  // --------------------------------------------------

  console.log("\nUpdating matched MongoDB products...");

  for (const assignment of assignments) {
    await Product.updateOne(
      { _id: assignment.mongoId },
      {
        $set: {
          image: assignment.mainImage,
          images: assignment.additionalImages,
        },
      }
    );

    console.log(`Updated: ${assignment.productName}`);
  }

  console.log("\n======================================");
  console.log(" IMPORT COMPLETED");
  console.log("======================================");

  console.log(`Updated: ${assignments.length}`);
  console.log(`Skipped: ${skipped.length}`);
  console.log(`Backup: ${backupFile}`);
  console.log(`Image directory: ${OUTPUT_DIR}`);
}

// --------------------------------------------------
// EXECUTION
// --------------------------------------------------

main()
  .catch((error: unknown) => {
    console.error("\nImage import failed:");

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
