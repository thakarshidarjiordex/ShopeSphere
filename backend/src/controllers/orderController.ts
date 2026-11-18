import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function createOrder(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const body = req.body as CheckoutBody;
  const { customer, shippingAddress, items } = body;

  if (
    !customer ||
    !isNonEmptyString(customer.name) ||
    !isNonEmptyString(customer.email) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)||
    !isNonEmptyString(customer.phone)
  ) {
    return res.status(400).json({
      success: false,
      message: "Valid customer name, email, and phone are required.",
    });
  }

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
      message: "Complete shipping address details are required.",
    });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Your cart is empty.",
    });
  }

  if (items.length > 100) {
    return res.status(400).json({
      success: false,
      message: "Too many different products in one order.",
    });
  }

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
        message: "Each item needs a valid product ID and positive integer quantity.",
      });
    }

    const id = item.productId;
    quantities.set(id, (quantities.get(id) ?? 0) + item.quantity!);
  }

  const session = await mongoose.startSession();

  try {
    let savedOrder: unknown;

    await session.withTransaction(async () => {
      const orderItems = [];
      let totalAmount = 0;

      // Validate every product and calculate the price from the database.
      for (const [productId, quantity] of quantities) {
        const product = await Product.findById(productId).session(session);

        if (!product) {
          throw new Error(`PRODUCT_NOT_FOUND:${productId}`);
        }

        if (product.stock < quantity) {
          throw new Error(`INSUFFICIENT_STOCK:${product.name}`);
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

      // Decrement stock conditionally to guard against concurrent checkouts.
      for (const [productId, quantity] of quantities) {
        const updatedProduct = await Product.findOneAndUpdate(
          {
            _id: productId,
            stock: { $gte: quantity },
          },
          { $inc: { stock: -quantity } },
          { new: true, session }
        );

        if (!updatedProduct) {
          throw new Error(`INSUFFICIENT_STOCK:Product ${productId}`);
        }
      }

      const createdOrders = await Order.create(
        [
          {
            // Associate the order with the authenticated user
            user: req.user!.id,

            customer: {
              name: customer!.name!.trim(),
              email: customer!.email!.trim().toLowerCase(),
              phone: customer!.phone!.trim(),
            },

            shippingAddress: {
              street: shippingAddress!.street!.trim(),
              city: shippingAddress!.city!.trim(),
              state: shippingAddress!.state!.trim(),
              postalCode: shippingAddress!.postalCode!.trim(),
              country: shippingAddress!.country!.trim(),
            },

            items: orderItems,
            totalAmount: Math.round(totalAmount * 100) / 100,

            status: "placed",

            statusHistory: [
              {
                status: "placed",
                changedAt: new Date(),
                note: "Order placed successfully",
              },
            ],
          },
        ],
        { session }
      );


      savedOrder = createdOrders[0].toObject();
    }); 

    return res.status(201).json({
      success: true,
      message: "Order placed successfully.",
      data: savedOrder,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith("PRODUCT_NOT_FOUND:")) {
        return res.status(404).json({
          success: false,
          message: "One or more products no longer exist.",
        });
      }

      if (error.message.startsWith("INSUFFICIENT_STOCK:")) {
        return res.status(409).json({
          success: false,
          message: "Insufficient stock for one or more products.",
        });
      }
    }

    return next(error);
  } finally {
    await session.endSession();
  }
}

export async function getMyOrders(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const orders = await Order.find({
      user: req.user!.id,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getAllOrders(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const orders = await Order.find()
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    return next(error);
  }
}

// Update an order's status (admin only)
export async function updateOrderStatus(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { status } = req.body;
    const { id } = req.params;

    const allowedStatuses = [
      "placed",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status",
      });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const previousStatus = order.status;

    if (previousStatus !== status) {
      order.status = status;

      order.statusHistory.push({
        status,
        changedAt: new Date(),
        note: `Order status changed from ${previousStatus} to ${status}`,
      });

      await order.save();
    }

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: order,
    });
  } catch (error) {
    return next(error);
  }
} 