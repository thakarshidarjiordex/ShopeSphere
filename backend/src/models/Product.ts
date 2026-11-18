import { Schema, model } from "mongoose";

const productSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
    },

    brand: {
      type: String,
      trim: true,
      default: "",
    },

    category: {
      type: String,
      required: [true, "Product category is required"],
      trim: true,
    },

    subcategory: {
      type: String,
      trim: true,
      default: "",
    },

    // Original dataset product ID
    datasetProductId: {
      type: String,
      default: undefined,
      trim: true,
    },

    price: {
      type: Number,
      required: [true, "Product price is required"],
      min: [0, "Price cannot be negative"],
    },

    image: {
      type: String,
      required: [true, "Product image is required"],
      trim: true,
    },

    images: {
      type: [String],
      default: [],
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },

    specifications: {
      type: [
        {
          _id: false,
          name: {
            type: String,
            required: true,
            trim: true,
          },
          value: {
            type: String,
            required: true,
            trim: true,
          },
        },
      ],
      default: [],
    },

    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    stock: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Stock must be a whole number",
      },
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate dataset products.
productSchema.index(
  { datasetProductId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      datasetProductId: { $type: "string" },
    },
  }
);

const Product = model("Product", productSchema);

export default Product;
