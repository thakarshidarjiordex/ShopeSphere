import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import Product from "../models/Product";

dotenv.config();

const PROJECT_ROOT = path.resolve(process.cwd(), "..");
const OUTPUT_DIR = path.join(
  PROJECT_ROOT,
  "client",
  "public",
  "products"
);

const ATTRIBUTION_FILE = path.join(
  OUTPUT_DIR,
  "attributions.json"
);

const API_URL = "https://commons.wikimedia.org/w/api.php";

type CommonsImage = {
  pageid: number;
  title: string;
  imageinfo?: Array<{
    thumburl?: string;
    mime?: string;
    descriptionurl?: string;
    extmetadata?: Record<
      string,
      { value?: string }
    >;
  }>;
};

type Attribution = {
  product: string;
  filename: string;
  creator: string;
  license: string;
  source: string;
};

const usedImages = new Set<number>();
const attributions: Attribution[] = [];

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function cleanHtml(value = ""): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}


async function searchCommons(
  searchTerm: string,
  attempt = 1
): Promise<CommonsImage[]> {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: `filetype:bitmap ${searchTerm}`,
    gsrnamespace: "6",
    gsrlimit: "50",
    prop: "imageinfo",
    iiprop: "url|mime|extmetadata",
    iiurlwidth: "1000",
    iiextmetadatafilter:
      "LicenseShortName|Artist|ImageDescription",
    format: "json",
    origin: "*",
  });

  const response = await fetch(
    `${API_URL}?${params}`,
    {
      headers: {
        "User-Agent":
          "ShopSphereProductImageDownloader/1.0 (educational project)",
      },
    }
  );

  if (response.status === 429) {
    if (attempt >= 5) {
      throw new Error(
        "Wikimedia rate limit reached after 5 attempts."
      );
    }

    const retryAfter = Number(
      response.headers.get("Retry-After")
    );

    const delay = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : 15000 * attempt;

    console.log(
      `Rate limited. Retrying in ${delay / 1000} seconds...`
    );

    await sleep(delay);

    return searchCommons(searchTerm, attempt + 1);
  }

  if (!response.ok) {
    throw new Error(
      `Commons API error: ${response.status}`
    );
  }

  const data = await response.json();

  return Object.values(
    data.query?.pages ?? {}
  ) as CommonsImage[];
}



async function downloadImage(
  url: string,
  destination: string
): Promise<boolean> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "ShopSphereProductImageDownloader/1.0",
        },
      });

      if (!response.ok) {
        console.log(
          `Image request failed: ${response.status}, attempt ${attempt}`
        );

        await sleep(3000 * attempt);
        continue;
      }

      const contentType =
        response.headers.get("content-type") ?? "";

      if (!contentType.startsWith("image/")) {
        await sleep(2000);
        continue;
      }

      const buffer = Buffer.from(
        await response.arrayBuffer()
      );

      if (buffer.length < 1000) {
        await sleep(2000);
        continue;
      }

      await fs.writeFile(destination, buffer);
      return true;
    } catch (error) {
      console.log(`Download attempt ${attempt} failed.`);
      await sleep(3000 * attempt);
    }
  }

  return false;
}


async function getProductImages(
  product: {
    name: string;
    brand?: string;
    category: string;
  }
): Promise<string[]> {
  const brand = product.brand?.trim() ?? "";

  const searchTerms = [
    `${brand} ${product.name} product`,
    `${product.name} ${product.category}`,
    `${product.category} product photography`,
  ].filter(Boolean);

  const selected: CommonsImage[] = [];

  for (const term of searchTerms) {
    console.log(`Searching: ${term}`);

    const results = await searchCommons(term);

    for (const item of results) {
      const info = item.imageinfo?.[0];

      if (
        !info?.thumburl ||
        !info.mime?.startsWith("image/") ||
        usedImages.has(item.pageid)
      ) {
        continue;
      }

      const license = cleanHtml(
        info.extmetadata?.LicenseShortName?.value
      );

      // Skip files without a clear licence.
      if (!license) continue;

      selected.push(item);
      usedImages.add(item.pageid);

      if (selected.length === 4) break;
    }

    if (selected.length === 4) break;

    await sleep(1200);
  }

  if (selected.length !== 4) {
    // Release temporary reservations if this product
    // did not receive its complete image gallery.
    selected.forEach((item) =>
      usedImages.delete(item.pageid)
    );

    throw new Error(
      `Only ${selected.length} suitable images found for ${product.name}. Skipping product.`
    );
  }

  return selected.map((item) => item.title);
}

async function processProduct(product: any) {
  const folderName = slugify(product.name);

  const productFolder = path.join(
    OUTPUT_DIR,
    folderName
  );

  await fs.mkdir(productFolder, {
    recursive: true,
  });

  const brand = product.brand?.trim() ?? "";

  const searchTerms = [
    `${brand} ${product.name} product`,
    `${product.name} ${product.category}`,
    `${product.category} product photography`,
  ].filter(Boolean);

  const selected: CommonsImage[] = [];

  for (const term of searchTerms) {
    const results = await searchCommons(term);
    await sleep(5000);

    for (const item of results) {
      const info = item.imageinfo?.[0];

      if (
        !info?.thumburl ||
        !info.mime?.startsWith("image/") ||
        usedImages.has(item.pageid)
      ) {
        continue;
      }

      const license = cleanHtml(
        info.extmetadata?.LicenseShortName?.value
      );

      if (!license) continue;

      selected.push(item);
      usedImages.add(item.pageid);

      if (selected.length === 4) break;
    }

    if (selected.length === 4) break;

    await sleep(1200);
  }

  if (selected.length !== 4) {
    selected.forEach((item) =>
      usedImages.delete(item.pageid)
    );

    console.log(
      `SKIPPED: ${product.name} — found ${selected.length}/4 images`
    );

    return false;
  }

  const localPaths: string[] = [];

  for (let i = 0; i < selected.length; i++) {
    const item = selected[i];
    const info = item.imageinfo![0];

    const filename =
      `image-${i + 1}.jpg`;

    const destination = path.join(
      productFolder,
      filename
    );

    const downloaded = await downloadImage(
      info.thumburl!,
      destination
    );

    if (!downloaded) {
      console.log(
        `Download failed: ${product.name} ${filename}`
      );

      return false;
    }

    localPaths.push(
      `/products/${folderName}/${filename}`
    );

    attributions.push({
      product: product.name,
      filename,
      creator: cleanHtml(
        info.extmetadata?.Artist?.value
      ) || "Creator not listed",
      license: cleanHtml(
        info.extmetadata?.LicenseShortName?.value
      ) || "Licence not listed",
      source: info.descriptionurl ?? item.title,
    });
  }

  // Main image is image-1.
  // The remaining three are gallery images.
  await Product.updateOne(
    { _id: product._id },
    {
      $set: {
        image: localPaths[0],
        images: localPaths.slice(1),
      },
    }
  );

  console.log(
    `SUCCESS: ${product.name} — 4 images saved`
  );

  return true;
}

async function main() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing from server/.env");
    }

    await mongoose.connect(process.env.MONGO_URI);

    await fs.mkdir(OUTPUT_DIR, {
      recursive: true,
    });

    const products = await Product.find();

    console.log(
      `Found ${products.length} products in MongoDB`
    );

    let successful = 0;
    let skipped = 0;

    for (const product of products) {
      console.log(`\nProcessing: ${product.name}`);

      try {
        const result = await processProduct(product);

        if (result) successful++;
        else skipped++;
      } catch (error) {
        skipped++;

        console.error(
          `Failed: ${product.name}`,
          error
        );
      }

      // Be considerate to Wikimedia's API.
      await sleep(1500);
    }

    await fs.writeFile(
      ATTRIBUTION_FILE,
      JSON.stringify(attributions, null, 2),
      "utf8"
    );

    console.log("\n========== COMPLETE ==========");
    console.log(`Products found: ${products.length}`);
    console.log(`Successful: ${successful}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Downloaded images: ${successful * 4}`);
    console.log(`Attribution: ${ATTRIBUTION_FILE}`);
  } catch (error) {
    console.error("Image download failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main();
