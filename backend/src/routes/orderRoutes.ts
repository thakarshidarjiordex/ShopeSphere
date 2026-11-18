import { Router } from "express";
import {
  createOrder,
  getMyOrders,
  getAllOrders,
  updateOrderStatus,
} from "../controllers/orderController";
import { protect , authorizeRoles} from "../middleware/authMiddleware";

const router = Router();

router.post("/", protect, createOrder);

router.get("/my-orders", protect, getMyOrders);

router.get(
  "/admin/all",
  protect,
  authorizeRoles("admin"),
  getAllOrders
);

router.patch(
  "/:id/status",
  protect,
  authorizeRoles("admin"),
  updateOrderStatus
);

export default router;