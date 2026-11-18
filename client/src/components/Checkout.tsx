import {
  useState,
  useEffect,
  type ChangeEvent,
  type FormEvent,
} from "react";

import {
  useCreateOrderMutation,
  useCreateRazorpayOrderMutation,
  useVerifyRazorpayPaymentMutation,
} from "../services/ordersApi";

import { useGetCurrentUserQuery } from "../services/authApi";
import { useCartStore } from "../stores/cartStore";


type PaymentMethod = "cod" | "razorpay";

interface RazorpaySuccessResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: {
    name: string;
    email: string;
    contact: string;
  };
  theme: {
    color: string;
  };
  handler: (
    response: RazorpaySuccessResponse
  ) => void | Promise<void>;
  modal?: {
    ondismiss?: () => void;
  };
}

interface RazorpayInstance {
  open: () => void;
  on: (
    event: string,
    callback: (response: {
      error?: {
        description?: string;
      };
    }) => void
  ) => void;
}

declare global {
  interface Window {
    Razorpay?: new (
      options: RazorpayOptions
    ) => RazorpayInstance;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");

    script.src =
      "https://checkout.razorpay.com/v1/checkout.js";

    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);

    document.body.appendChild(script);
  });
}

interface CheckoutProps {
  onBackToCart: () => void;
  onContinueShopping: () => void;
  onLogin: () => void;
}

interface CheckoutForm {
  name: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface CompletedOrder {
  id: string;
  total: number;
  status: string;
}

const initialForm: CheckoutForm = {
  name: "",
  email: "",
  phone: "",
  street: "",
  city: "",
  state: "",
  postalCode: "",
  country: "India",
};

function formatPrice(price: number) {
  return `₹${price.toLocaleString("en-IN")}`;
}

function getErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "status" in error) {
    const apiError = error as {
      status?: number | string;
      data?: { message?: string };
    };

    if (apiError.status === 401) {
      return "Your session has expired. Please log in again.";
    }

    if (apiError.status === 403) {
      return "You are not authorized to place this order.";
    }

    if (apiError.data?.message) {
      return apiError.data.message;
    }
  }

  return "Unable to place your order. Please try again.";
}

export default function Checkout({
  onBackToCart,
  onContinueShopping,
  onLogin,
}: CheckoutProps) {
  // Zustand: cart state
  const items = useCartStore((store) => store.items);
  const clearCart = useCartStore((store) => store.clearCart);

  // RTK Query: authentication
  const {
    data: currentUser,
    isLoading: isCheckingSession,
    isFetching: isRefreshingSession,
  } = useGetCurrentUserQuery();

  // RTK Query: create order
  const [createOrder, { isLoading }] = useCreateOrderMutation();
  const [
    createRazorpayOrder,
    { isLoading: isCreatingRazorpayOrder },
  ] = useCreateRazorpayOrderMutation();

  const [
    verifyRazorpayPayment,
    { isLoading: isVerifyingPayment },
  ] = useVerifyRazorpayPaymentMutation();

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("cod");

  const [isProcessingPayment, setIsProcessingPayment] =
    useState(false);

  const isSubmitting =
  isLoading ||
  isCreatingRazorpayOrder ||
  isVerifyingPayment ||
  isProcessingPayment;

  // React state
  const [form, setForm] = useState<CheckoutForm>(initialForm);
  const [errorMessage, setErrorMessage] = useState("");
  const [completedOrder, setCompletedOrder] =
    useState<CompletedOrder | null>(null);

  // Fill customer information from logged-in user
  useEffect(() => {
    if (!currentUser) return;

    setForm((previous) => ({
      ...previous,
      name: previous.name || currentUser.name,
      email: previous.email || currentUser.email,
    }));
  }, [currentUser]);

  // Calculate cart totals
  const totalItems = items.reduce(
    (total, item) => total + item.quantity,
    0
  );

  const subtotal = items.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0
  );

  // Handle form changes
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  // Submit order
 
  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (isSubmitting) return;

    setErrorMessage("");

    if (!currentUser) {
      setErrorMessage(
        "Please log in before placing your order."
      );
      return;
    }

    if (items.length === 0) {
      setErrorMessage("Your cart is empty.");
      return;
    }

    const orderData = {
      customer: {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
      },
      shippingAddress: {
        street: form.street.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        postalCode: form.postalCode.trim(),
        country: form.country.trim(),
      },
      items: items.map((item) => ({
        productId: item.product._id,
        quantity: item.quantity,
      })),
    };

    try {
      // ==================================
      // CASH ON DELIVERY
      // ==================================

      if (paymentMethod === "cod") {
        const response = await createOrder(
          orderData
        ).unwrap();

        completeOrder(response.data);

        return;
      }

      // ==================================
      // RAZORPAY PAYMENT
      // ==================================

      setIsProcessingPayment(true);

      // Step 1: Load Razorpay Checkout
      const scriptLoaded = await loadRazorpayScript();

      if (!scriptLoaded) {
        throw new Error(
          "Unable to load Razorpay. Please check your internet connection."
        );
      }

      // Step 2: Create Razorpay order on backend
      const razorpayResponse =
        await createRazorpayOrder(orderData).unwrap();

      const {
        razorpayOrderId,
        amount,
        currency,
        keyId,
      } = razorpayResponse.data;

      // Step 3: Open Razorpay Checkout
      if (!window.Razorpay) {
        throw new Error(
          "Razorpay Checkout is unavailable."
        );
      }

      const razorpay = new window.Razorpay({
        key: keyId,
        amount,
        currency,
        name: "ShopSphere",
        description: "ShopSphere Order Payment",
        order_id: razorpayOrderId,

        prefill: {
          name: form.name,
          email: form.email,
          contact: form.phone,
        },

        theme: {
          color: "#2563eb",
        },

        // Step 4: Payment successful callback
        handler: async (paymentResponse) => {
          try {
            // Step 5: Verify payment on backend
            const verificationResponse =
              await verifyRazorpayPayment({
                razorpay_order_id:
                  paymentResponse.razorpay_order_id,

                razorpay_payment_id:
                  paymentResponse.razorpay_payment_id,

                razorpay_signature:
                  paymentResponse.razorpay_signature,
              }).unwrap();

            // Step 6: Clear cart only after
            // successful backend verification
            completeOrder(
              verificationResponse.data
            );

          } catch (error) {
            setErrorMessage(
              getErrorMessage(error)
            );

            setIsProcessingPayment(false);
          }
        },

        modal: {
          ondismiss: () => {
            setIsProcessingPayment(false);

            setErrorMessage(
              "Payment was cancelled. Your cart is still saved. You can try again."
            );
          },
        },
      });

      razorpay.on("payment.failed", (response) => {
        setIsProcessingPayment(false);

        setErrorMessage(
          response.error?.description ||
            "Payment failed. Please try again."
        );
      });

      razorpay.open();

    } catch (error) {
      setIsProcessingPayment(false);

      if (error instanceof Error && !("status" in error)) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(getErrorMessage(error));
      }
    }
  }


  function completeOrder(order: {
    _id: string;
    totalAmount: number;
    status: string;
  }) {
    // Clear Zustand cart only after confirmed order
    clearCart();

    // Display successful order
    setCompletedOrder({
      id: order._id,
      total: order.totalAmount,
      status: order.status,
    });

    setErrorMessage("");
    setIsProcessingPayment(false);
  }

  // ==========================================
  // ORDER SUCCESS SCREEN
  // ==========================================

  if (completedOrder) {
    return (
      <section className="checkout-page order-success-page">
        <div className="order-success-card">
          <div className="success-checkmark">
            <span>✓</span>
          </div>

          <span className="success-label">ORDER CONFIRMED</span>

          <h1>Order placed successfully!</h1>

          <p className="success-message">
            Thank you for shopping with ShopSphere.
            Your order has been received and is being processed.
          </p>

          <div className="success-order-details">
            <div className="success-detail-row">
              <span>Order ID</span>
              <strong>{completedOrder.id}</strong>
            </div>

            <div className="success-detail-row">
              <span>Order Total</span>
              <strong>{formatPrice(completedOrder.total)}</strong>
            </div>

            <div className="success-detail-row">
              <span>Order Status</span>
              <strong className="success-status">
                {completedOrder.status}
              </strong>
            </div>
          </div>

          <div className="success-cart-message">
            ✓ Your cart has been cleared successfully.
          </div>

          <button
            type="button"
            className="success-primary-button"
            onClick={onContinueShopping}
          >
            Continue Shopping →
          </button>

          <p className="success-footer">
            Thank you for choosing ShopSphere!
          </p>
        </div>
      </section>
    );
  }

  // ==========================================
  // EMPTY CART SCREEN
  // ==========================================

  if (items.length === 0) {
    return (
      <section className="checkout-page checkout-empty">
        <div className="checkout-empty-card">
          <div className="checkout-empty-icon">🛍️</div>

          <h2>Your cart is empty</h2>

          <p>
            Add some products before proceeding to checkout.
          </p>

          <button type="button" onClick={onContinueShopping}>
            Explore Products →
          </button>
        </div>
      </section>
    );
  }

  // ==========================================
  // AUTHENTICATION LOADING
  // ==========================================

  if (isCheckingSession || (isRefreshingSession && !currentUser)) {
    return (
      <section className="checkout-page">
        <div className="checkout-loading">
          <div className="checkout-spinner" />
          <p>Checking your login status...</p>
        </div>
      </section>
    );
  }

  // ==========================================
  // LOGIN REQUIRED SCREEN
  // ==========================================

  if (!currentUser) {
    return (
      <section className="checkout-page checkout-login-page">
        <div className="checkout-login-warning">
          <div className="checkout-warning-icon">🔐</div>

          <span className="checkout-eyebrow">
            ACCOUNT REQUIRED
          </span>

          <h2>Login Required</h2>

          <p>
            Please log in to your ShopSphere account before placing
            an order. Your cart items will remain saved.
          </p>

          <div className="checkout-buttons">
            <button type="button" onClick={onBackToCart}>
              Back to Cart
            </button>

            <button type="button" onClick={onLogin}>
              Log In to Continue
            </button>
          </div>
        </div>
      </section>
    );
  }

  // ==========================================
  // MAIN CHECKOUT PAGE
  // ==========================================

  return (
    <section className="checkout-page">
      {/* Page Header */}
      <div className="checkout-header">
        <div>
          <span className="checkout-eyebrow">
            SHOPSPHERE CHECKOUT
          </span>

          <h1>Complete Your Order</h1>

          <p>
            Enter your delivery information to place your order.
          </p>
        </div>

        <div className="checkout-step">
          <span>01</span>

          <div>
            <strong>Checkout</strong>
            <small>Secure order placement</small>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="checkout-error" role="alert">
          <span>!</span>

          <p>{errorMessage}</p>

          {errorMessage.toLowerCase().includes("log in") ||
          errorMessage.toLowerCase().includes("session has expired") ? (
            <button type="button" onClick={onLogin}>
              Log In
            </button>
          ) : null}
        </div>
      )}

      <div className="checkout-layout">
        {/* ================================== */}
        {/* CHECKOUT FORM */}
        {/* ================================== */}

        <form className="checkout-form" onSubmit={handleSubmit}>
          {/* Customer Information */}
          <div className="checkout-section-heading">
            <span className="checkout-section-icon">👤</span>

            <div>
              <h2>Customer Information</h2>
              <p>Your contact details</p>
            </div>
          </div>

          <fieldset
            disabled={isSubmitting}
            className="checkout-fieldset"
          >
            <div className="checkout-form-grid">
              <label className="checkout-field full-width">
                Full Name

                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Enter your full name"
                  autoComplete="name"
                  required
                />
              </label>

              <label className="checkout-field">
                Email Address

                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="example@email.com"
                  autoComplete="email"
                  required
                />
              </label>

              <label className="checkout-field">
                Phone Number

                <input
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="Enter phone number"
                  autoComplete="tel"
                  pattern="[0-9+() -]{7,20}"
                  title="Enter a valid phone number"
                  required
                />
              </label>
            </div>

            <div className="checkout-form-divider" />

            {/* Shipping Address */}
            <div className="checkout-section-heading">
              <span className="checkout-section-icon">📍</span>

              <div>
                <h2>Shipping Address</h2>
                <p>Where should we deliver your order?</p>
              </div>
            </div>

            <div className="checkout-form-grid">
              <label className="checkout-field full-width">
                Street Address

                <input
                  name="street"
                  value={form.street}
                  onChange={handleChange}
                  placeholder="House number, street name"
                  autoComplete="street-address"
                  required
                />
              </label>

              <label className="checkout-field">
                City

                <input
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  placeholder="Enter city"
                  autoComplete="address-level2"
                  required
                />
              </label>

              <label className="checkout-field">
                State

                <input
                  name="state"
                  value={form.state}
                  onChange={handleChange}
                  placeholder="Enter state"
                  autoComplete="address-level1"
                  required
                />
              </label>

              <label className="checkout-field">
                Postal Code

                <input
                  name="postalCode"
                  value={form.postalCode}
                  onChange={handleChange}
                  placeholder="Enter postal code"
                  autoComplete="postal-code"
                  required
                />
              </label>

              <label className="checkout-field">
                Country

                <input
                  name="country"
                  value={form.country}
                  onChange={handleChange}
                  placeholder="Enter country"
                  autoComplete="country-name"
                  required
                />
              </label>
            </div>
          </fieldset>


          {/* Payment Method */}

          <div className="checkout-form-divider" />

          <div className="checkout-section-heading">
            <span className="checkout-section-icon">💳</span>

            <div>
              <h2>Payment Method</h2>
              <p>Choose how you want to pay</p>
            </div>
          </div>

          <div className="checkout-payment-options">

            {/* Cash on Delivery */}

            <label
              className={`checkout-payment-option ${
                paymentMethod === "cod" ? "selected" : ""
              }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                value="cod"
                checked={paymentMethod === "cod"}
                onChange={() => setPaymentMethod("cod")}
                disabled={isSubmitting}
              />

              <div className="checkout-payment-icon">
                💵
              </div>

              <div className="checkout-payment-info">
                <strong>Cash on Delivery</strong>
                <span>Pay when your order arrives</span>
              </div>

              {paymentMethod === "cod" && (
                <span className="checkout-payment-check">
                  ✓
                </span>
              )}
            </label>

            {/* Razorpay */}

            <label
              className={`checkout-payment-option ${
                paymentMethod === "razorpay" ? "selected" : ""
              }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                value="razorpay"
                checked={paymentMethod === "razorpay"}
                onChange={() => setPaymentMethod("razorpay")}
                disabled={isSubmitting}
              />

              <div className="checkout-payment-icon">
                💳
              </div>

              <div className="checkout-payment-info">
                <strong>Pay Online with Razorpay</strong>
                <span>
                  UPI, Cards, Net Banking and more
                </span>
              </div>

              {paymentMethod === "razorpay" && (
                <span className="checkout-payment-check">
                  ✓
                </span>
              )}
            </label>

          </div>


          {/* Form Actions */}
          
          <div className="checkout-form-actions">
            <button
              type="button"
              className="checkout-back-button"
              onClick={onBackToCart}
              disabled={isSubmitting}
            >
              ← Back to Cart
            </button>

            <button
              type="submit"
              className="checkout-place-button"
              disabled={isSubmitting}
            >
              {isCreatingRazorpayOrder
                ? "Creating Payment..."
                : isVerifyingPayment
                ? "Verifying Payment..."
                : isProcessingPayment
                ? "Processing Payment..."
                : isLoading
                ? "Placing Order..."
                : paymentMethod === "cod"
                ? "Place COD Order →"
                : "Pay Now →"}
            </button>
          </div>

          <p className="checkout-form-note">
            🔒 Your order information is submitted securely.
          </p>
        </form>

        {/* ================================== */}
        {/* ORDER SUMMARY */}
        {/* ================================== */}

        <aside className="checkout-summary">
          <div className="checkout-summary-heading">
            <h2>Order Summary</h2>
            <span>{totalItems} items</span>
          </div>

          {/* Products */}
          <div className="checkout-review-items">
            {items.map(({ product, quantity }) => (
              <div
                className="checkout-review-item"
                key={product._id}
              >
                <div className="checkout-review-image">
                  <img
                    src={product.image}
                    alt={product.name}
                  />

                  <span>{quantity}</span>
                </div>

                <div className="checkout-review-info">
                  <h3>{product.name}</h3>
                  <p>{formatPrice(product.price)} each</p>
                </div>

                <strong>
                  {formatPrice(product.price * quantity)}
                </strong>
              </div>
            ))}
          </div>

          {/* Price Calculation */}
          <div className="checkout-summary-calculation">
            <div>
              <span>Items ({totalItems})</span>
              <strong>{formatPrice(subtotal)}</strong>
            </div>

            <div>
              <span>Shipping</span>

              <strong className="checkout-free">
                Calculated if applicable
              </strong>
            </div>
          </div>

          <div className="checkout-summary-total">
            <span>Subtotal</span>
            <strong>{formatPrice(subtotal)}</strong>
          </div>

          <p className="checkout-summary-note">
            Final charges, including any applicable shipping or taxes,
            are subject to your order's backend calculation.
          </p>

          <div className="checkout-summary-secure">
            🔒 Secure checkout with ShopSphere
          </div>
        </aside>
      </div>
    </section>
  );
}
