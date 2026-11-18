import mongoose, { Schema, type Document } from "mongoose";

export type OrderStatus =
  | "pending_payment"
  | "placed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PaymentMethod = "razorpay" | "cod";

// Add to PaymentStatus
export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded";

// Add to IOrder

export interface OrderItem {
  product: mongoose.Types.ObjectId;
  name: string;
  image: string;
  price: number;
  quantity: number;
}

export interface OrderStatusHistory {
  status: OrderStatus;
  changedAt: Date;
  note: string;
}

export interface IOrder extends Document {
  user?: mongoose.Types.ObjectId;
  paymentExpiresAt?: Date;
  stockReserved: boolean;
  stockRestored: boolean;


  customer: {
    name: string;
    email: string;
    phone: string;
  };

  shippingAddress: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };

  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  statusHistory: OrderStatusHistory[];

  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;

  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
}

const orderItemSchema = new Schema<OrderItem>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    image: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const statusHistorySchema = new Schema<OrderStatusHistory>(
  {
    status: {
      type: String,
      enum: [
        "pending_payment",
        "placed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      required: true,
    },
    changedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    note: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },

    customer: {
      name: { type: String, required: true, trim: true },
      email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
      },
      phone: { type: String, required: true, trim: true },
    },

    shippingAddress: {
      street: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      postalCode: { type: String, required: true, trim: true },
      country: { type: String, required: true, trim: true },
    },

    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items: OrderItem[]) => items.length > 0,
        message: "An order must contain at least one item.",
      },
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    paymentMethod: {
      type: String,
      enum: ["razorpay", "cod"],
      default: "cod",
      required: true,
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
      required: true,
    },

    razorpayOrderId: {
      type: String,
      default: null,
    },

    razorpayPaymentId: {
      type: String,
      default: null,
    },

    razorpaySignature: {
      type: String,
      default: null,
    },

    paymentExpiresAt: {
      type: Date,
      default: null,
    },

    stockReserved: {
      type: Boolean,
      default: false,
    },

    stockRestored: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: [
        "pending_payment",
        "placed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      default: "pending_payment",
    },

    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.model<IOrder>("Order", orderSchema);
