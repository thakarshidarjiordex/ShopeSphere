import { useCartStore } from "../stores/cartStore";

interface CartProps {
  onContinueShopping: () => void;
  onCheckout: () => void;
}

export default function Cart({
  onContinueShopping,
  onCheckout,
}: CartProps) {
  const items = useCartStore((state) => state.items);
  const increaseQuantity = useCartStore((state) => state.increaseQuantity);
  const decreaseQuantity = useCartStore((state) => state.decreaseQuantity);
  const removeFromCart = useCartStore((state) => state.removeFromCart);

  const totalItems = items.reduce(
    (total, item) => total + item.quantity,
    0
  );

  const subtotal = items.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0
  );

  const formatPrice = (price: number) =>
    `₹${price.toLocaleString("en-IN")}`;

  if (items.length === 0) {
    return (
      <section className="cart-page">
        <div className="empty-cart-card">
          <div className="empty-cart-icon">🛍️</div>
          <span className="empty-cart-label">YOUR CART</span>
          <h2>Your cart is feeling lonely!</h2>
          <p>
            Looks like you haven't added anything to your cart yet.
            Explore our collection and find something you'll love.
          </p>
          <button
            className="empty-cart-button"
            onClick={onContinueShopping}
          >
            Explore Products →
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="cart-page">
      {/* Cart Header */}
      <div className="cart-header">
        <div>
          <span className="cart-eyebrow">SHOPPING BAG</span>
          <h1>Your Shopping Cart</h1>
          <p>
            Review your items and proceed when you're ready.
          </p>
        </div>

        <div className="cart-item-count">
          <span>{totalItems}</span>
          {totalItems === 1 ? " Item" : " Items"}
        </div>
      </div>

      <div className="cart-layout">
        {/* Cart Products */}
        <div className="cart-products">
          <div className="cart-products-heading">
            <h2>Cart Items</h2>
            <span>{items.length} products</span>
          </div>

          {items.map(({ product, quantity }) => (
            <article className="cart-product-card" key={product._id}>
              <div className="cart-product-image">
                <img src={product.image} alt={product.name} />
              </div>

              <div className="cart-product-info">
                <div className="cart-product-top">
                  <div>
                    <span className="cart-product-category">
                      {product.category}
                    </span>
                    <h3>{product.name}</h3>
                  </div>

                  <button
                    type="button"
                    className="cart-remove-button"
                    onClick={() => removeFromCart(product._id)}
                    aria-label={`Remove ${product.name} from cart`}
                    title="Remove item"
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </div>

                <p className="cart-product-price">
                  {formatPrice(product.price)}{" "}
                  <span> / item</span>
                </p>

                <div className="cart-product-bottom">
                  <div className="cart-quantity-control">
                    <button
                      type="button"
                      onClick={() => decreaseQuantity(product._id)}
                      disabled={quantity <= 1}
                      aria-label={`Decrease ${product.name} quantity`}
                    >
                      −
                    </button>

                    <span>{quantity}</span>

                    <button
                      type="button"
                      onClick={() => increaseQuantity(product._id)}
                      disabled={quantity >= product.stock}
                      aria-label={`Increase ${product.name} quantity`}
                    >
                      +
                    </button>
                  </div>

                  <div className="cart-line-total">
                    <span>Item Total</span>
                    <strong>
                      {formatPrice(product.price * quantity)}
                    </strong>
                  </div>
                </div>
              </div>
            </article>
          ))}

          <button
            type="button"
            className="cart-continue-button"
            onClick={onContinueShopping}
          >
            <span>←</span> Continue Shopping
          </button>
        </div>

        {/* Order Summary */}
        <aside className="cart-summary-card">
          <div className="cart-summary-heading">
            <h2>Order Summary</h2>
            <span>🛒</span>
          </div>

          <div className="cart-summary-items">
            <div>
              <span>Items ({totalItems})</span>
              <strong>{formatPrice(subtotal)}</strong>
            </div>

            <div>
              <span>Shipping</span>
              <strong className="free-shipping">FREE</strong>
            </div>
          </div>

          <div className="cart-summary-total">
            <span>Subtotal</span>
            <strong>{formatPrice(subtotal)}</strong>
          </div>

          <p className="cart-summary-note">
            Shipping and any applicable charges will be confirmed
            during checkout.
          </p>

          <button
            type="button"
            className="cart-checkout-button"
            onClick={onCheckout}
          >
            Proceed to Checkout <span>→</span>
          </button>

          <div className="cart-secure-note">
            <span>🔒</span>
            Secure checkout
          </div>

          <div className="cart-benefit">
            <span>✓</span>
            Your items are ready for checkout
          </div>
        </aside>
      </div>
    </section>
  );
}
