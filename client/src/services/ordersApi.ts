import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export interface CheckoutCustomer {
  name: string;
  email: string;
  phone: string;
}

export interface ShippingAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface CheckoutItem {
  productId: string;
  quantity: number;
}

export interface CreateOrderRequest {
  customer: CheckoutCustomer;
  shippingAddress: ShippingAddress;
  items: CheckoutItem[];
}

export interface CreateRazorpayOrderResponse {
  success: boolean;
  message: string;
  data: {
    orderId: string;
    razorpayOrderId: string;
    amount: number;
    currency: string;
    keyId: string;
  };
}

export interface VerifyRazorpayPaymentRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface VerifyRazorpayPaymentResponse {
  success: boolean;
  message: string;
  data: CreatedOrder;
}

export type OrderStatus =
  | "placed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export interface OrderStatusHistory {
  status: OrderStatus;
  changedAt: string;
  note: string;
}

export interface CreatedOrder {
  _id: string;
  customer: CheckoutCustomer;
  shippingAddress: ShippingAddress;
  items: {
    product: string;
    name: string;
    image: string;
    price: number;
    quantity: number;
  }[];
  totalAmount: number;
  status: OrderStatus;
  statusHistory?: OrderStatusHistory[];
  createdAt?: string;
}

export interface MyOrderItem {
  product: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
}

export interface MyOrder {
  _id: string;
  user: string;
  customer: CheckoutCustomer;
  shippingAddress: ShippingAddress;
  items: MyOrderItem[];
  totalAmount: number;
  status: OrderStatus;
  statusHistory?: OrderStatusHistory[];
  createdAt: string;
  updatedAt: string;
}

export interface MyOrdersResponse {
  success: boolean;
  count: number;
  data: MyOrder[];
}

export interface UpdateOrderStatusRequest {
  id: string;
  status: OrderStatus;
}

interface UpdateOrderStatusResponse {
  success: boolean;
  message: string;
  data: MyOrder;
}

export const ordersApi = createApi({
  reducerPath: "ordersApi",

  baseQuery: fetchBaseQuery({
    baseUrl: "http://localhost:5000/api/",
    credentials: "include",
  }),

  tagTypes: ["Order"],

  endpoints: (builder) => ({
    createOrder: builder.mutation<
      { success: boolean; message: string; data: CreatedOrder },
      CreateOrderRequest
    >({
      query: (orderData) => ({
        url: "orders",
        method: "POST",
        body: orderData,
      }),
      invalidatesTags: ["Order"],
    }),

    createRazorpayOrder: builder.mutation<
      CreateRazorpayOrderResponse,
      CreateOrderRequest
    >({
      query: (orderData) => ({
        url: "payments/create-order",
        method: "POST",
        body: orderData,
      }),
      invalidatesTags: ["Order"],
    }),

    verifyRazorpayPayment: builder.mutation<
      VerifyRazorpayPaymentResponse,
      VerifyRazorpayPaymentRequest
    >({
      query: (paymentData) => ({
        url: "payments/verify",
        method: "POST",
        body: paymentData,
      }),
      invalidatesTags: ["Order"],
    }),

    getMyOrders: builder.query<MyOrdersResponse, void>({
      query: () => "orders/my-orders",
      providesTags: ["Order"],
    }),

    getAllOrders: builder.query<MyOrdersResponse, void>({
      query: () => "orders/admin/all",
      providesTags: ["Order"],
    }),

    updateOrderStatus: builder.mutation<
      UpdateOrderStatusResponse,
      UpdateOrderStatusRequest
    >({
      query: ({ id, status }) => ({
        url: `orders/${id}/status`,
        method: "PATCH",
        body: { status },
      }),
      invalidatesTags: ["Order"],
    }),
  }),
});

export const {
  useCreateOrderMutation,
  useGetMyOrdersQuery,
  useGetAllOrdersQuery,
  useUpdateOrderStatusMutation,
  useCreateRazorpayOrderMutation,
  useVerifyRazorpayPaymentMutation,
} = ordersApi;
