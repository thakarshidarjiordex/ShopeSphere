import { Router } from "express";

import {
  createRazorpayOrder,
  verifyRazorpayPayment,
} from "../controllers/paymentController";

import { protect } from "../middleware/authMiddleware";

const router = Router();

// Create Razorpay order
router.post(
  "/create-order",
  protect,
  createRazorpayOrder
);

// Verify Razorpay payment
router.post(
  "/verify",
  protect,
  verifyRazorpayPayment
);

export default router;
