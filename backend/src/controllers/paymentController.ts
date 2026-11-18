import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import crypto from "crypto";

import Razorpay from "../config/razorpay";
import Product from "../models/Product";
import Order from "../models/Order";

interface CheckoutBody {
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  shippingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  items?: {
    productId?: string;
    quantity?: number;
  }[];
}

interface VerifyPaymentBody {
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// STEP 1: Create Razorpay order
export async function createRazorpayOrder(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { customer, shippingAddress, items } =
      req.body as CheckoutBody;

    // Validate customer
    if (
      !customer ||
      !isNonEmptyString(customer.name) ||
      !isNonEmptyString(customer.email) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email) ||
      !isNonEmptyString(customer.phone)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid customer details are required.",
      });
    }

    // Validate shipping address
    if (
      !shippingAddress ||
      !isNonEmptyString(shippingAddress.street) ||
      !isNonEmptyString(shippingAddress.city) ||
      !isNonEmptyString(shippingAddress.state) ||
      !isNonEmptyString(shippingAddress.postalCode) ||
      !isNonEmptyString(shippingAddress.country)
    ) {
      return res.status(400).json({
        success: false,
        message: "Complete shipping address is required.",
      });
    }

    if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid cart items.",
      });
    }

    // Combine duplicate product IDs
    const quantities = new Map<string, number>();

    for (const item of items) {
      if (
        !item ||
        typeof item.productId !== "string" ||
        !mongoose.isValidObjectId(item.productId) ||
        !Number.isSafeInteger(item.quantity) ||
        (item.quantity ?? 0) < 1
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid product ID or quantity.",
        });
      }

      const id = item.productId;
      const newQuantity =
        (quantities.get(id) ?? 0) + item.quantity!;

      if (!Number.isSafeInteger(newQuantity)) {
        return res.status(400).json({
          success: false,
          message: "Invalid product quantity.",
        });
      }

      quantities.set(id, newQuantity);
    }

    // Calculate total using database prices
    const orderItems = [];
    let totalAmount = 0;

    for (const [productId, quantity] of quantities) {
      const product = await Product.findById(productId);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "One or more products no longer exist.",
        });
      }

      if (product.stock < quantity) {
        return res.status(409).json({
          success: false,
          message: `Insufficient stock for ${product.name}.`,
        });
      }

      orderItems.push({
        product: product._id,
        name: product.name,
        image: product.image,
        price: product.price,
        quantity,
      });

      totalAmount += product.price * quantity;
    }

    // Convert rupees into paise
    const amountInPaise = Math.round(totalAmount * 100);

    if (!Number.isSafeInteger(amountInPaise) || amountInPaise < 100) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment amount.",
      });
    }

    totalAmount = amountInPaise / 100;

    // Create Razorpay order
    const razorpayOrder = await Razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
    });

    // Save pending order in MongoDB
    const order = await Order.create({
      user: req.user!.id,

      customer: {
        name: customer.name.trim(),
        email: customer.email.trim().toLowerCase(),
        phone: customer.phone.trim(),
      },

      shippingAddress: {
        street: shippingAddress.street.trim(),
        city: shippingAddress.city.trim(),
        state: shippingAddress.state.trim(),
        postalCode: shippingAddress.postalCode.trim(),
        country: shippingAddress.country.trim(),
      },

      items: orderItems,
      totalAmount,

      paymentMethod: "razorpay",
      paymentStatus: "pending",

      razorpayOrderId: razorpayOrder.id,

      status: "pending_payment",

      statusHistory: [
        {
          status: "pending_payment",
          changedAt: new Date(),
          note: "Awaiting Razorpay payment.",
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Razorpay order created successfully.",

      data: {
        orderId: order._id,
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error) {
    return next(error);
  }
}

// STEP 2: Verify Razorpay payment
export async function verifyRazorpayPayment(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = req.body as VerifyPaymentBody;

  try {
    if (
      !isNonEmptyString(razorpay_order_id) ||
      !isNonEmptyString(razorpay_payment_id) ||
      !isNonEmptyString(razorpay_signature) ||
      !/^[a-fA-F0-9]{64}$/.test(razorpay_signature)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment verification details.",
      });
    }

    // Find order belonging to authenticated user
    const order = await Order.findOne({
      razorpayOrderId: razorpay_order_id,
      user: req.user!.id,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    // Make verification idempotent
    if (order.paymentStatus === "paid") {
      if (order.razorpayPaymentId !== razorpay_payment_id) {
        return res.status(409).json({
          success: false,
          message: "Order has already been paid with another payment.",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Payment already verified.",
        data: order,
      });
    }

    if (order.paymentStatus !== "pending") {
      return res.status(409).json({
        success: false,
        message: "This order is not awaiting payment.",
      });
    }

    // Generate signature using the order ID stored in MongoDB
    const secret = process.env.RAZORPAY_KEY_SECRET;

    if (!secret) {
      throw new Error("Razorpay secret is missing.");
    }

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${order.razorpayOrderId}|${razorpay_payment_id}`)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    const receivedBuffer = Buffer.from(razorpay_signature, "hex");

    if (!crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
      return res.status(400).json({
        success: false,
        message: "Payment signature verification failed.",
      });
    }

    // Verify actual payment status with Razorpay
    const payment = await Razorpay.payments.fetch(
      razorpay_payment_id
    );

    if (
      payment.order_id !== order.razorpayOrderId ||
      payment.amount !== Math.round(order.totalAmount * 100) ||
      payment.currency !== "INR" ||
      payment.status !== "captured"
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment is not captured or payment details do not match.",
      });
    }

    // Deduct stock only after verified and captured payment
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const currentOrder = await Order.findById(order._id).session(session);

        if (!currentOrder) {
          throw new Error("ORDER_NOT_FOUND");
        }

        if (currentOrder.paymentStatus === "paid") {
          if (currentOrder.razorpayPaymentId !== razorpay_payment_id) {
            throw new Error("ORDER_ALREADY_PAID");
          }
          return;
        }

        if (currentOrder.paymentStatus !== "pending") {
          throw new Error("ORDER_NOT_PENDING");
        }

        for (const item of currentOrder.items) {
          const updatedProduct = await Product.findOneAndUpdate(
            {
              _id: item.product,
              stock: { $gte: item.quantity },
            },
            {
              $inc: { stock: -item.quantity },
            },
            {
              new: true,
              session,
            }
          );

          if (!updatedProduct) {
            throw new Error("INSUFFICIENT_STOCK");
          }
        }

        currentOrder.paymentStatus = "paid";
        currentOrder.razorpayPaymentId = razorpay_payment_id;
        currentOrder.razorpaySignature = razorpay_signature;
        currentOrder.status = "placed";

        currentOrder.statusHistory.push({
          status: "placed",
          changedAt: new Date(),
          note: "Payment verified and order confirmed.",
        });

        await currentOrder.save({ session });
      });
    } finally {
      await session.endSession();
    }

    const confirmedOrder = await Order.findById(order._id);

    return res.status(200).json({
      success: true,
      message: "Payment verified and order confirmed successfully.",
      data: confirmedOrder,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "INSUFFICIENT_STOCK") {
        return res.status(409).json({
          success: false,
          message:
            "Payment was captured, but stock is no longer available. The payment requires a refund.",
        });
      }

      if (error.message === "ORDER_NOT_FOUND") {
        return res.status(404).json({
          success: false,
          message: "Order not found.",
        });
      }

      if (error.message === "ORDER_ALREADY_PAID") {
        return res.status(409).json({
          success: false,
          message: "Order has already been paid.",
        });
      }

      if (error.message === "ORDER_NOT_PENDING") {
        return res.status(409).json({
          success: false,
          message: "Order is no longer awaiting payment.",
        });
      }
    }

    return next(error);
  }
}
