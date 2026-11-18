
import Product from "../models/Product";

// Get all products
export const getAllProducts = () => {
  return Product.find().sort({ createdAt: -1 });
};

// Get a single product by ID
export const getProductById = (id: string) => {
  return Product.findById(id);
};

// Create a new product
export const createProduct = (productData: {
  name: string;
  brand?: string;
  category: string;
  price: number;
  image: string;
  images?: string[];
  description?: string;
  specifications?: {
    name: string;
    value: string;
  }[];
  rating?: number;
  stock?: number;
}) => {
  return Product.create(productData);
};

// Update an existing product
export const updateProduct = (
  id: string,
  productData: Record<string, unknown>
) => {
  return Product.findByIdAndUpdate(
    id,
    { $set: productData },
    {
      new: true,
      runValidators: true,
    }
  );
};

// Delete a product
export const deleteProduct = (id: string) => {
  return Product.findByIdAndDelete(id);
};
