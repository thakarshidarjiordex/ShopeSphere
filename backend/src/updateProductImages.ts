
import dotenv from "dotenv";
import mongoose from "mongoose";

import connectDB from "./config/db";
import Product from "./models/Product";

dotenv.config();

// Generate product-specific image URLs
const getImageUrl = (
  productName: string,
  lock: number
): string => {
  const tags = productName
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .trim()
    .split(/\s+/)
    .join(",");

  return `https://loremflickr.com/800/800/${tags}?lock=${lock}`;
};

const updateProductImages = async (): Promise<void> => {
  try {
    await connectDB();

    const products = await Product.find()
      .select("_id name")
      .sort({ _id: 1 })
      .lean();

    if (products.length === 0) {
      console.log("No products found.");
      return;
    }

    const operations = products.map((product, index) => {
      const baseLock = 10000 + index * 3;

      const mainImage = getImageUrl(
        product.name,
        baseLock
      );

      const additionalImages = [
        getImageUrl(product.name, baseLock + 1),
        getImageUrl(product.name, baseLock + 2),
      ];

      return {
        updateOne: {
          filter: { _id: product._id },
          update: {
            $set: {
              image: mainImage,
              images: additionalImages,
            },
          },
        },
      };
    });

    // Check that all main image URLs are unique
    const mainUrls = operations.map(
      (operation) => operation.updateOne.update.$set.image
    );

    if (new Set(mainUrls).size !== products.length) {
      throw new Error("Duplicate main image URLs detected.");
    }

    const result = await Product.bulkWrite(operations);

    console.log("--------------------------------");
    console.log("PRODUCT IMAGE UPDATE COMPLETED");
    console.log("--------------------------------");

    console.log(`Total products: ${products.length}`);
    console.log(`Updated products: ${result.modifiedCount}`);
    console.log("Main images: Unique URLs generated");
    console.log("Additional images: 2 per product");

    console.log("--------------------------------");

  } catch (error) {
    console.error("Image update failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

void updateProductImages();
