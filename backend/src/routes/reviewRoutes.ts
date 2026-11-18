import { Router } from "express";
import {
  getProductReviews,
  createProductReview,
  updateProductReview,
  deleteProductReview,
} from "../controllers/reviewController";
import { protect } from "../middleware/authMiddleware";

const router = Router();

// Public route
router.get("/product/:productId", getProductReviews);

// Login required
router.post("/product/:productId", protect, createProductReview);
router.put("/:id", protect, updateProductReview);
router.delete("/:id", protect, deleteProductReview);

export default router;
