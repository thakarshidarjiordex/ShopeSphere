import { Router } from "express";
import {
  register,
  login,
  logout,
} from "../controllers/authController";
import { protect } from "../middleware/authMiddleware";

const router = Router();

router.post("/register", register);
router.post("/login", login);

// Logout should be accessible even if the token is expired.
router.post("/logout", logout);

// Keep authentication required for this route.
router.get("/me", protect, (req, res) => {
  res.json({
    success: true,
    data: req.user,
  });
});

export default router;