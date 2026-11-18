import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";

import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../services/productService";

const isValidId = (id: string): boolean =>
  mongoose.isValidObjectId(id);

// Validate product specifications
const isValidSpecifications = (specifications: unknown): boolean => {
  if (!Array.isArray(specifications)) {
    return false;
  }

  return specifications.every(
    (specification) =>
      specification !== null &&
      typeof specification === "object" &&
      typeof specification.name === "string" &&
      specification.name.trim().length > 0 &&
      typeof specification.value === "string" &&
      specification.value.trim().length > 0
  );
};

// Validate description
const isValidDescription = (description: unknown): boolean => {
  return (
    typeof description === "string" &&
    description.length <= 2000
  );
};

// Validate additional product images
const isValidImages = (images: unknown): boolean => {
  if (!Array.isArray(images) || images.length > 8) {
    return false;
  }

  return images.every((image) => {
    if (typeof image !== "string" || !image.trim()) {
      return false;
    }

    try {
      const url = new URL(image.trim());

      return (
        url.protocol === "http:" ||
        url.protocol === "https:"
      );
    } catch {
      return false;
    }
  });
};

export const getProducts = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const products = await getAllProducts();

    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

export const getProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
      return;
    }

    const product = await getProductById(id);

    if (!product) {
      res.status(404).json({
        success: false,
        message: "Product not found",
      });
      return;
    }

    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

export const addProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      name,
      brand,
      category,
      price,
      image,
      images = [],
      rating,
      stock,
      description = "",
      specifications = [],
    } = req.body ?? {};

    // Basic product validation
    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof brand !== "string" ||
      !brand.trim() ||
      typeof category !== "string" ||
      !category.trim() ||
      typeof price !== "number" ||
      !Number.isFinite(price) ||
      price < 0 ||
      typeof image !== "string" ||
      !image.trim()
    ) {
      res.status(400).json({
        success: false,
        message:
          "Name, category, non-negative numeric price, and image are required.",
      });
      return;
    }

    // Rating and stock validation
    if (
      (rating !== undefined &&
        (typeof rating !== "number" ||
          !Number.isFinite(rating) ||
          rating < 0 ||
          rating > 5)) ||
      (stock !== undefined &&
        (typeof stock !== "number" ||
          !Number.isInteger(stock) ||
          stock < 0))
    ) {
      res.status(400).json({
        success: false,
        message:
          "Rating must be 0–5 and stock must be a non-negative integer.",
      });
      return;
    }

    // Description validation
    if (!isValidDescription(description)) {
      res.status(400).json({
        success: false,
        message: "Description must be text and cannot exceed 2000 characters.",
      });
      return;
    }

    // Additional images validation
    if (!isValidImages(images)) {
      res.status(400).json({
        success: false,
        message: "Images must be valid URLs. Maximum 8 additional images allowed.",
      });
      return;
    }

    // Specifications validation
    if (!isValidSpecifications(specifications)) {
      res.status(400).json({
        success: false,
        message:
          "Specifications must contain valid name and value pairs.",
      });
      return;
    }

    const product = await createProduct({
      name: name.trim(),
      brand: brand.trim(),
      category: category.trim(),
      price,
      image: image.trim(),
      images: images.map((url: string) => url.trim()),
      description: description.trim(),
      specifications: specifications.map(
        (specification: { name: string; value: string }) => ({
          name: specification.name.trim(),
          value: specification.value.trim(),
        })
      ),
      ...(rating !== undefined && { rating }),
      ...(stock !== undefined && { stock }),
    });

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

export const editProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
      return;
    }

    const allowedFields = [
      "name",
      "brand",
      "category",
      "price",
      "image",
      "images",
      "rating",
      "stock",
      "description",
      "specifications",
    ];

    const updates = (req.body ?? {}) as Record<string, unknown>;
    const keys = Object.keys(updates);

    console.log("UPDATE PRODUCT BODY:", req.body);
    console.log("UPDATE PRODUCT KEYS:", keys);
    console.log(
      "UNEXPECTED FIELDS:",
      keys.filter((key) => !allowedFields.includes(key))
    );

    if (
      keys.length === 0 ||
      keys.some((key) => !allowedFields.includes(key))
    ) {
      res.status(400).json({
        success: false,
        message: "Provide valid product fields to update.",
      });
      return;
    }

    if ("images" in updates && !isValidImages(updates.images)) {
      res.status(400).json({
        success: false,
        message: "Images must be valid URLs. Maximum 8 additional images allowed.",
      });
      return;
    }

    if (Array.isArray(updates.images)) {
      updates.images = updates.images.map((url: string) => url.trim());
    }

    // Validate individual fields when supplied
    if (
      "name" in updates &&
      (typeof updates.name !== "string" || !updates.name.trim())
    ) {
      res.status(400).json({
        success: false,
        message: "Product name cannot be empty.",
      });
      return;
    }

    if (
      "category" in updates &&
      (typeof updates.category !== "string" || !updates.category.trim())
    ) {
      res.status(400).json({
        success: false,
        message: "Product category cannot be empty.",
      });
      return;
    }

    if (
      "brand" in updates &&
      typeof updates.brand !== "string"
    ) {
      res.status(400).json({
        success: false,
        message: "Brand must be text.",
      });
      return;
    }

    if (typeof updates.brand === "string") {
      updates.brand = updates.brand.trim();
    }

    if (
      "price" in updates &&
      (typeof updates.price !== "number" ||
        !Number.isFinite(updates.price) ||
        updates.price < 0)
    ) {
      res.status(400).json({
        success: false,
        message: "Price must be a non-negative number.",
      });
      return;
    }

    if (
      "image" in updates &&
      (typeof updates.image !== "string" || !updates.image.trim())
    ) {
      res.status(400).json({
        success: false,
        message: "Product image cannot be empty.",
      });
      return;
    }

    if (
      "rating" in updates &&
      (typeof updates.rating !== "number" ||
        !Number.isFinite(updates.rating) ||
        updates.rating < 0 ||
        updates.rating > 5)
    ) {
      res.status(400).json({
        success: false,
        message: "Rating must be between 0 and 5.",
      });
      return;
    }

    if (
      "stock" in updates &&
      (typeof updates.stock !== "number" ||
        !Number.isInteger(updates.stock) ||
        updates.stock < 0)
    ) {
      res.status(400).json({
        success: false,
        message: "Stock must be a non-negative integer.",
      });
      return;
    }

    if (
      "description" in updates &&
      !isValidDescription(updates.description)
    ) {
      res.status(400).json({
        success: false,
        message: "Description must be text and cannot exceed 2000 characters.",
      });
      return;
    }

    if (
      "specifications" in updates &&
      !isValidSpecifications(updates.specifications)
    ) {
      res.status(400).json({
        success: false,
        message: "Specifications must contain valid name and value pairs.",
      });
      return;
    }

    // Clean up text fields
    if (typeof updates.name === "string") {
      updates.name = updates.name.trim();
    }

    if (typeof updates.category === "string") {
      updates.category = updates.category.trim();
    }

    if (typeof updates.image === "string") {
      updates.image = updates.image.trim();
    }

    if (typeof updates.description === "string") {
      updates.description = updates.description.trim();
    }

    if (Array.isArray(updates.specifications)) {
      updates.specifications = updates.specifications.map(
        (specification: { name: string; value: string }) => ({
          name: specification.name.trim(),
          value: specification.value.trim(),
        })
      );
    }

    const product = await updateProduct(id, updates);

    if (!product) {
      res.status(404).json({
        success: false,
        message: "Product not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

export const removeProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
      return;
    }

    const product = await deleteProduct(id);

    if (!product) {
      res.status(404).json({
        success: false,
        message: "Product not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
      data: product,
    });
  } catch (error) {
    next(error);
  }
};
