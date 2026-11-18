import { useEffect, useState } from "react";

import { useGetProductByIdQuery } from "../services/productsApi";
import { useCartStore } from "../stores/cartStore";
import ProductReviews from "./reviews/ProductReviews";
import { useGetProductReviewsQuery } from "../services/reviewsApi";

import "./ProductDetails.css";

interface ProductDetailsProps {
  productId: string;
  onBack: () => void;
}

function ProductDetails({
  productId,
  onBack,
}: ProductDetailsProps) {
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Reset component state when another product is opened.
  useEffect(() => {
    setSelectedImageIndex(0);
    setQuantity(1);
    setMessage("");
  }, [productId]);

  // RTK Query: Fetch product details.
  const {
    data: product,
    isLoading,
    isError,
    refetch,
  } = useGetProductByIdQuery(productId);

  // RTK Query: Fetch product reviews.
  const {
    data: reviewData,
    isLoading: reviewsLoading,
  } = useGetProductReviewsQuery(productId);

  // Zustand: Add products to cart.
  const addToCart = useCartStore((state) => state.addToCart);

  if (isLoading) {
    return (
      <section className="product-details-state">
        <h2>Loading product...</h2>
        <p>Fetching product details from the server.</p>
      </section>
    );
  }

  if (isError || !product) {
    return (
      <section className="product-details-state">
        <h2>Unable to load product</h2>
        <p>Please check your connection and try again.</p>

        <button type="button" onClick={() => refetch()}>
          Try Again
        </button>

        <button type="button" onClick={onBack}>
          Back to Products
        </button>
      </section>
    );
  }

  // Combine main image and additional images.
  const productImages = [
    product.image,
    ...(product.images ?? []).filter(
      (image) =>
        typeof image === "string" && image.trim() !== ""
    ),
  ];

  const selectedImage =
    productImages[selectedImageIndex] ?? product.image;

  // Add selected quantity to Zustand cart.
  function handleAddToCart() {
    if (product.stock <= 0) {
      setMessage("This product is out of stock.");
      return;
    }

    if (quantity > product.stock) {
      setMessage(`Only ${product.stock} item(s) are available.`);
      return;
    }

    for (let i = 0; i < quantity; i++) {
      addToCart(product);
    }

    setMessage(`${quantity} item(s) added to your cart.`);
  }

  return (
    <section className="product-details-page">
      <button
        type="button"
        className="details-back-button"
        onClick={onBack}
      >
        ← Back to Products
      </button>

      <div className="product-details-card">
        {/* PRODUCT IMAGE GALLERY */}
        <div className="product-details-gallery">
          <div className="product-details-image">
            <img
              src={selectedImage}
              alt={product.name}
              onError={(event) => {
                event.currentTarget.src = product.image;
              }}
            />
          </div>

          {productImages.length > 1 && (
            <div className="product-image-thumbnails">
              {productImages.map((image, index) => (
                <button
                  type="button"
                  key={`${image}-${index}`}
                  className={`product-thumbnail ${
                    selectedImageIndex === index ? "active" : ""
                  }`}
                  onClick={() => setSelectedImageIndex(index)}
                  aria-label={`View product image ${index + 1}`}
                  aria-pressed={selectedImageIndex === index}
                >
                  <img
                    src={image}
                    alt={`${product.name} view ${index + 1}`}
                    onError={(event) => {
                      event.currentTarget.src = product.image;
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* PRODUCT INFORMATION */}
        <div className="product-details-info">
          <span className="details-category">
            {product.category}
          </span>

          {product.brand && (
            <p className="details-brand">
              Brand: <strong>{product.brand}</strong>
            </p>
          )}

          <h1>{product.name}</h1>

          {/* RATINGS */}
          <div className="details-rating">
            {reviewsLoading ? (
              <span>Loading ratings...</span>
            ) : reviewData && reviewData.count > 0 ? (
              <>
                <span>★</span>
                {reviewData.averageRating.toFixed(1)} / 5
                <span>({reviewData.count} reviews)</span>
              </>
            ) : (
              <span>No ratings yet</span>
            )}
          </div>

          {/* DESCRIPTION */}
          <div className="details-description">
            <h3>About this product</h3>

            <p>
              {product.description?.trim()
                ? product.description
                : "No product description available."}
            </p>
          </div>

          {/* SPECIFICATIONS */}
          <div className="details-specifications">
            <h3>Product Specifications</h3>

            {product.specifications &&
            product.specifications.length > 0 ? (
              <div className="specifications-table">
                {product.specifications.map(
                  (specification, index) => (
                    <div
                      className="specification-item"
                      key={`${specification.name}-${index}`}
                    >
                      <span className="specification-name">
                        {specification.name}
                      </span>

                      <span className="specification-value">
                        {specification.value}
                      </span>
                    </div>
                  )
                )}
              </div>
            ) : (
              <p className="no-specifications">
                No specifications available.
              </p>
            )}
          </div>

          {/* PRICE AND STOCK */}
          <p className="details-price">
            ₹{product.price.toLocaleString("en-IN")}
          </p>

          <p className="details-stock">
            {product.stock > 0
              ? `${product.stock} item(s) available`
              : "Out of stock"}
          </p>

          {/* QUANTITY */}
          <div className="details-quantity">
            <label>Quantity</label>

            <div className="quantity-controls">
              <button
                type="button"
                onClick={() => {
                  setQuantity((current) =>
                    Math.max(1, current - 1)
                  );
                  setMessage("");
                }}
                disabled={quantity <= 1}
                aria-label="Decrease quantity"
              >
                −
              </button>

              <span>{quantity}</span>

              <button
                type="button"
                onClick={() => {
                  setQuantity((current) =>
                    Math.min(product.stock, current + 1)
                  );
                  setMessage("");
                }}
                disabled={quantity >= product.stock}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          </div>

          <p className="details-total">
            Total: ₹
            {(product.price * quantity).toLocaleString("en-IN")}
          </p>

          {/* ADD TO CART */}
          <button
            type="button"
            className="details-add-button"
            onClick={handleAddToCart}
            disabled={product.stock <= 0}
          >
            {product.stock <= 0 ? "Out of Stock" : "Add to Cart"}
          </button>

          {message && (
            <p className="details-message" role="status">
              {message}
            </p>
          )}
        </div>
      </div>

      {/* PRODUCT REVIEWS */}
      <ProductReviews productId={product._id} />
    </section>
  );
}

export default ProductDetails;
