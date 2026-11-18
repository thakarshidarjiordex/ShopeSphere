import dotenv from "dotenv";
import connectDB from "./config/db";
import Product from "./models/Product";

dotenv.config();

const seedProducts = async (): Promise<void> => {
  try {
    await connectDB();

    const existingCount = await Product.countDocuments();

    if (existingCount > 0) {
      console.log(
        `Seed skipped: ${existingCount} products already exist.`
      );
      return;
    }

    const products = [
      {
        name: "Wireless Headphones",
        category: "Electronics",
        price: 2499,
        image: "https://placehold.co/600x400?text=Headphones",
        rating: 4.5,
        stock: 20,
      },
      {
        name: "Smart Watch",
        category: "Electronics",
        price: 3999,
        image: "https://placehold.co/600x400?text=Smart+Watch",
        rating: 4.3,
        stock: 15,
      },
      {
        name: "Casual Sneakers",
        category: "Fashion",
        price: 1799,
        image: "https://placehold.co/600x400?text=Sneakers",
        rating: 4.6,
        stock: 30,
      },
      {
        name: "Travel Backpack",
        category: "Accessories",
        price: 1299,
        image: "https://placehold.co/600x400?text=Backpack",
        rating: 4.2,
        stock: 12,
      },
      {
        name: "Mechanical Keyboard",
        category: "Electronics",
        price: 2999,
        image: "https://placehold.co/600x400?text=Keyboard",
        rating: 4.7,
        stock: 18,
      },
      {
        name: "Classic T-Shirt",
        category: "Fashion",
        price: 599,
        image: "https://placehold.co/600x400?text=T-Shirt",
        rating: 4.1,
        stock: 50,
      },
    ];

    await Product.insertMany(products);

    console.log("Six sample products inserted successfully.");
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  } finally {
    await import("mongoose").then(({ default: mongoose }) =>
      mongoose.disconnect()
    );
  }
};

void seedProducts();
