import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db";
import productRoutes from "./routes/productRoutes";
import orderRoutes from "./routes/orderRoutes";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/authRoutes";
import reviewRoutes from "./routes/reviewRoutes"; 
import paymentRoutes from "./routes/paymentRoutes";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to the ShopSphere API!",
  });
});

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "ShopSphere server is running",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/payments", paymentRoutes);

const startServer = async (): Promise<void> => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`ShopSphere API running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start ShopSphere:", error);
    process.exit(1);
  }
};

void startServer();
