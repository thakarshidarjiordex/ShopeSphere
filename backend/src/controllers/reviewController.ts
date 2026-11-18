import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Review from "../models/Review";
import Order from "../models/Order";

// GET /api/reviews/product/:productId
// Public: Get reviews and rating summary for a product
export async function getProductReviews(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { productId } = req.params;

    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
    }

    const reviews = await Review.find({ product: productId })
      .populate("user", "name")
      .sort({ createdAt: -1 });

    const count = reviews.length;
    const averageRating =
      count > 0
        ? Math.round(
            (reviews.reduce((sum, review) => sum + review.rating, 0) /
              count) *
              10
          ) / 10
        : 0;

    return res.status(200).json({
      success: true,
      count,
      averageRating,
      data: reviews,
    });
  } catch (error) {
    return next(error);
  }
}

// POST /api/reviews/product/:productId
// Protected: Only customers with a delivered order can review
export async function createProductReview(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { productId } = req.params;
    const { rating, comment } = req.body ?? {};

    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
    }

    if (
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5
    ) {
      return res.status(400).json({
        success: false,
        message: "Rating must be a whole number between 1 and 5.",
      });
    }

    if (
      typeof comment !== "string" ||
      comment.trim().length < 3 ||
      comment.trim().length > 1000
    ) {
      return res.status(400).json({
        success: false,
        message: "Comment must contain 3 to 1000 characters.",
      });
    }

    // The user must have purchased this product in a delivered order.
    const deliveredOrder = await Order.findOne({
      user: req.user!.id,
      status: "delivered",
      "items.product": new mongoose.Types.ObjectId(productId),
    });

    if (!deliveredOrder) {
      return res.status(403).json({
        success: false,
        message: "You can review this product after your order is delivered.",
      });
    }

    // The unique user + product index prevents duplicate reviews.
    const review = await Review.create({
      user: req.user!.id,
      product: productId,
      rating,
      comment: comment.trim(),
    });

    const populatedReview = await Review.findById(review._id)
      .populate("user", "name");

    return res.status(201).json({
      success: true,
      message: "Review submitted successfully.",
      data: populatedReview,
    });
  } catch (error) {
    if (
      error instanceof mongoose.Error &&
      error.name === "ValidationError"
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (
      error instanceof mongoose.mongo.MongoServerError &&
      error.code === 11000
    ) {
      return res.status(409).json({
        success: false,
        message: "You have already reviewed this product. Edit your existing review instead.",
      });
    }

    return next(error);
  }
}

// PUT /api/reviews/:id
// Protected: Only the review's author can edit it
export async function updateProductReview(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body ?? {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid review ID.",
      });
    }

    if (
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5
    ) {
      return res.status(400).json({
        success: false,
        message: "Rating must be a whole number between 1 and 5.",
      });
    }

    if (
      typeof comment !== "string" ||
      comment.trim().length < 3 ||
      comment.trim().length > 1000
    ) {
      return res.status(400).json({
        success: false,
        message: "Comment must contain 3 to 1000 characters.",
      });
    }

    const review = await Review.findOne({
      _id: id,
      user: req.user!.id,
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found or you are not allowed to edit it.",
      });
    }

    review.rating = rating;
    review.comment = comment.trim();
    await review.save();

    const populatedReview = await Review.findById(review._id)
      .populate("user", "name");

    return res.status(200).json({
      success: true,
      message: "Review updated successfully.",
      data: populatedReview,
    });
  } catch (error) {
    return next(error);
  }
}

// DELETE /api/reviews/:id
// Protected: Only the review's author can delete it
export async function deleteProductReview(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid review ID.",
      });
    }

    const review = await Review.findOneAndDelete({
      _id: id,
      user: req.user!.id,
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found or you are not allowed to delete it.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Review deleted successfully.",
    });
  } catch (error) {
    return next(error);
  }
}
