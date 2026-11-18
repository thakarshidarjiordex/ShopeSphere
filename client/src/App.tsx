import { useState, useEffect } from "react";
import { useDispatch } from "react-redux";

import Login from "./components/Login";
import Register from "./components/Register";
import MyOrders from "./components/MyOrders";
import AdminOrders from "./components/AdminOrders";
import Cart from "./components/Cart";
import Checkout from "./components/Checkout";
import ProductAdmin from "./components/ProductAdmin";
import ProductDetails from "./components/ProductDetails";

import { authApi } from "./services/authApi";
import {
  useGetCurrentUserQuery,
  useLogoutMutation,
} from "./services/authApi";

import { useGetProductsQuery } from "./services/productsApi";
import type { Product } from "./services/productsApi";

import type { AppDispatch } from "./app/store";
import { useCartStore } from "./stores/cartStore";

import "./App.css";
import "./index.css";

type Page =
  | "products"
  | "product-details"
  | "cart"
  | "checkout"
  | "admin"
  | "admin-products"
  | "login"
  | "register"
  | "orders";

type SortOption =
  | "default"
  | "price-low"
  | "price-high"
  | "rating";

function App() {
  const dispatch = useDispatch<AppDispatch>();

  // Search, category, and filter states
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [sortBy, setSortBy] = useState<SortOption>("default");
  const [inStockOnly, setInStockOnly] = useState(false);

  // Scroll to Top button visibility
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };

    window.addEventListener("scroll", handleScroll);

    // Check initial scroll position
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Scroll smoothly to the top
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // Current page
  const [currentPage, setCurrentPage] = useState<Page>("products");

  // Restore the current user from the HTTP-only cookie
  const { data: currentUser } = useGetCurrentUserQuery();

  // Logout API
  const [logout, { isLoading: isLoggingOut }] =
    useLogoutMutation();

  const [selectedProductId, setSelectedProductId] =
    useState<string | null>(null);

  // Zustand: get the cart item count
  const cartItemCount = useCartStore((state) =>
    state.items.reduce((total, item) => total + item.quantity, 0)
  );

  // Zustand: add products to the cart
  const addToCart = useCartStore((state) => state.addToCart);

  // RTK Query: fetch products from the backend
  const {
    data: products = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useGetProductsQuery();

  // Get available categories
  const categories = [
    "All",
    ...new Set(products.map((product) => product.category)),
  ];

  // Search suggestions
  const searchSuggestions = products
    .filter((product) =>
      product.name.toLowerCase().includes(search.trim().toLowerCase())
    )
    .slice(0, 5);

  // Filter and sort products
  const filteredProducts = products
    .filter((product: Product) => {
      const matchesSearch = product.name
        .toLowerCase()
        .includes(search.trim().toLowerCase());

      const matchesCategory =
        category === "All" || product.category === category;

      const matchesStock =
        !inStockOnly || product.stock > 0;

      return matchesSearch && matchesCategory && matchesStock;
    })
    .sort((a: Product, b: Product) => {
      switch (sortBy) {
        case "price-low":
          return a.price - b.price;

        case "price-high":
          return b.price - a.price;

        case "rating":
          return b.rating - a.rating;

        default:
          return 0;
      }
    });

  // Reset all filters
  const resetFilters = () => {
    setSearch("");
    setCategory("All");
    setSortBy("default");
    setInStockOnly(false);
    setShowSuggestions(false);
  };

  const openProductDetails = (productId: string) => {
    setSelectedProductId(productId);
    setCurrentPage("product-details");
    setShowSuggestions(false);
  };

  // Navigate to a product from search suggestions
  const goToProduct = (productId: string) => {
    setCurrentPage("products");
    setCategory("All");
    setSearch("");
    setSortBy("default");
    setInStockOnly(false);
    setShowSuggestions(false);

    requestAnimationFrame(() => {
      document
        .getElementById(`product-${productId}`)
        ?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
    });
  };

  // Navigate to the storefront
  const goToProducts = () => {
    setCurrentPage("products");
    setShowSuggestions(false);
  };

  // Navigate to admin order management
  const goToAdminOrders = () => {
    if (currentUser?.role !== "admin") {
      setCurrentPage("products");
      return;
    }

    setCurrentPage("admin");
    setShowSuggestions(false);
  };

  const goToProductAdmin = () => {
    if (currentUser?.role !== "admin") {
      setCurrentPage("products");
      return;
    }

    setCurrentPage("admin-products");
    setShowSuggestions(false);
  };

  // Logout
  const handleLogout = async () => {
    try {
      await logout().unwrap();

      // Clear cached authentication and API data
      dispatch(authApi.util.resetApiState());

      // Return to the Products page
      setCurrentPage("products");
      setShowSuggestions(false);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="app">
      {/* Navbar */}
      <header className="navbar">
        <a
          className="logo"
          href="#products"
          onClick={(event) => {
            event.preventDefault();
            goToProducts();
          }}
        >
          <img
            src="/favicon.png"
            alt="ShopSphere Logo"
            className="logo-icon"
          />

          <span>
            Shop<span className="logo-highlight">Sphere</span>
          </span>
        </a>

        {/* Search box: visible on the storefront */}
        {currentPage === "products" && (
          <div className="search-box">
            <input
              type="search"
              placeholder="Search products..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setShowSuggestions(true);
                setCurrentPage("products");
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setShowSuggestions(false);
                }

                if (
                  event.key === "Enter" &&
                  searchSuggestions.length > 0
                ) {
                  event.preventDefault();
                  goToProduct(searchSuggestions[0]._id);
                }
              }}
              aria-label="Search products"
            />

            {showSuggestions && search.trim() !== "" && (
              <div className="search-suggestions">
                {searchSuggestions.length > 0 ? (
                  searchSuggestions.map((product) => (
                    <button
                      type="button"
                      className="suggestion-item"
                      key={product._id}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => goToProduct(product._id)}
                    >
                      <img src={product.image} alt="" />

                      <span className="suggestion-details">
                        <strong>{product.name}</strong>
                        <small>{product.category}</small>

                        <span className="suggestion-price">
                          ₹{product.price.toLocaleString("en-IN")}
                        </span>
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="no-suggestions">
                    No matching products found.
                  </p>
                )}

                <button
                  type="button"
                  className="close-suggestions"
                  onClick={() => setShowSuggestions(false)}
                >
                  Close suggestions
                </button>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <nav className="nav-links">
          <button
            type="button"
            className={currentPage === "products" ? "active" : ""}
            onClick={goToProducts}
          >
            Products
          </button>

          <button
            type="button"
            className={currentPage === "cart" ? "active" : ""}
            onClick={() => {
              setCurrentPage("cart");
              setShowSuggestions(false);
            }}
          >
            Cart ({cartItemCount})
          </button>

          {/* Admin Orders: visible only to admins */}
          {/* Admin navigation: visible only to admins */}
          {currentUser?.role === "admin" && (
            <>
              <button
                type="button"
                className={currentPage === "admin" ? "active" : ""}
                onClick={goToAdminOrders}
              >
                Admin Orders
              </button>

              <button
                type="button"
                className={currentPage === "admin-products" ? "active" : ""}
                onClick={goToProductAdmin}
              >
                Product Admin
              </button>
            </>
          )}

          {currentUser ? (
            <>
              <span className="user-greeting">
                Hi, {currentUser.name}
              </span>

              <button
                type="button"
                className={currentPage === "orders" ? "active" : ""}
                onClick={() => {
                  setCurrentPage("orders");
                  setShowSuggestions(false);
                }}
              >
                My Orders
              </button>

              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? "Logging out..." : "Logout"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={currentPage === "login" ? "active" : ""}
                onClick={() => {
                  setCurrentPage("login");
                  setShowSuggestions(false);
                }}
              >
                Login
              </button>

              <button
                type="button"
                className={currentPage === "register" ? "active" : ""}
                onClick={() => {
                  setCurrentPage("register");
                  setShowSuggestions(false);
                }}
              >
                Register
              </button>
            </>
          )}
        </nav>
      </header>

      {/* Main content */}
      <main>
        {currentPage === "login" ? (
          <Login
            onLoginSuccess={() => setCurrentPage("products")}
            onShowRegister={() => setCurrentPage("register")}
          />
        ) : currentPage === "register" ? (
          <Register
            onRegisterSuccess={() => setCurrentPage("products")}
            onShowLogin={() => setCurrentPage("login")}
          />
        ) : currentPage === "admin" ? (
          currentUser?.role === "admin" ? (
            <AdminOrders />
          ) : (
            <section className="empty-state">
              <h3>Access denied</h3>
              <p>You must be logged in as an admin to manage orders.</p>
              <button
                type="button"
                onClick={() => setCurrentPage("products")}
              >
                Back to Products
              </button>
            </section>
          )

        ) : currentPage === "admin-products" ? (
          currentUser?.role === "admin" ? (
            <ProductAdmin />
          ) : (
            <section className="empty-state">
              <h3>Access denied</h3>
              <p>You must be logged in as an admin to manage products.</p>
              <button
                type="button"
                onClick={() => setCurrentPage("products")}
              >
                Back to Products
              </button>
            </section>
          )
        ) : currentPage === "product-details" ? (
          selectedProductId ? (
            <ProductDetails
              productId={selectedProductId}
              onBack={goToProducts}
            />
          ) : (
            <section className="empty-state">
              <h3>No product selected</h3>
              <button
                type="button"
                onClick={goToProducts}
              >
                Back to Products
              </button>
            </section>
          )
        ) : currentPage === "cart" ? (
          <Cart
            onContinueShopping={goToProducts}
            onCheckout={() => setCurrentPage("checkout")}
          />

        ) : currentPage === "orders" ? (
          currentUser ? (
            <MyOrders />
          ) : (
            <section className="empty-state">
              <h3>Please log in</h3>
              <p>You need to log in to view your orders.</p>
              <button
                type="button"
                onClick={() => setCurrentPage("login")}
              >
                Login
              </button>
            </section>
          )
        ) : currentPage === "checkout" ? (
          <Checkout
            onBackToCart={() => setCurrentPage("cart")}
            onContinueShopping={goToProducts}
            onLogin={() => setCurrentPage("login")}
          />
        ) : (
          <>
            {/* Hero section */}
            <section className="hero">
              <div className="hero-content">
                <p className="eyebrow">WELCOME TO SHOPSPHERE</p>

                <h1>
                  Find your next
                  <br />
                  <span>favorite thing.</span>
                </h1>

                <p className="hero-description">
                  Discover electronics, fashion, and everyday essentials
                  at prices you'll love.
                </p>

                <button
                  type="button"
                  className="shop-button"
                  onClick={() =>
                    document
                      .getElementById("products")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  Explore products →
                </button>
              </div>

              <div className="hero-decoration">
                <div className="hero-circle">
                  <span><img src="/favicon.png" alt="ShopSphere Logo" /></span>
                </div>

                <div className="floating-tag">
                  Your next find awaits!
                </div>
              </div>
            </section>

            {/* Products section */}
            <section className="products-section" id="products">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">OUR COLLECTION</p>
                  <h2>Popular Products</h2>

                  <p className="section-description">
                    Find something you'll love.
                  </p>
                </div>

                {/* Category filter */}
                <label className="category-filter">
                  <span>Category</span>

                  <select
                    value={category}
                    onChange={(event) =>
                      setCategory(event.target.value)
                    }
                  >
                    {categories.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Sorting and stock filters */}
              <div className="product-controls">
                <label className="sort-filter">
                  <span>Sort by</span>

                  <select
                    value={sortBy}
                    onChange={(event) =>
                      setSortBy(event.target.value as SortOption)
                    }
                  >
                    <option value="default">Default</option>
                    <option value="price-low">
                      Price: Low to High
                    </option>
                    <option value="price-high">
                      Price: High to Low
                    </option>
                    <option value="rating">
                      Highest Rated
                    </option>
                  </select>
                </label>

                <label className="stock-filter">
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={(event) =>
                      setInStockOnly(event.target.checked)
                    }
                  />

                  <span>In-stock products only</span>
                </label>

                <button
                  type="button"
                  className="reset-button"
                  onClick={resetFilters}
                >
                  Reset Filters
                </button>
              </div>

              {/* Loading and error states */}
              {isLoading ? (
                <div className="empty-state">
                  <h3>Loading products...</h3>
                  <p>Fetching products from MongoDB.</p>
                </div>
              ) : isError ? (
                <div className="empty-state">
                  <h3>Unable to load products</h3>

                  <p>
                    Check that the backend is running on port 5000.
                  </p>

                  <p>{JSON.stringify(error)}</p>

                  <button
                    type="button"
                    className="reset-button"
                    onClick={() => refetch()}
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <>
                  {/* Results count */}
                  <div className="results-info" aria-live="polite">
                    Showing {filteredProducts.length}{" "}
                    {filteredProducts.length === 1
                      ? "product"
                      : "products"}

                    {search.trim() && (
                      <span>
                        {" "}for "<strong>{search}</strong>"
                      </span>
                    )}
                  </div>

                  {/* Product grid */}
                  {filteredProducts.length > 0 ? (
                    <div className="product-grid">
                      {filteredProducts.map((product: Product) => (
                        <article
                          className="product-card"
                          id={`product-${product._id}`}
                          key={product._id}
                        >
                          <div className="product-image-wrapper">
                            <img
                              className="product-image"
                              src={product.image}
                              alt={product.name}
                              loading="lazy"
                              onClick={() => openProductDetails(product._id)}
                            />

                            <span className="category-badge">
                              {product.category}
                            </span>

                            {product.stock <= 0 && (
                              <span className="out-of-stock-badge">
                                Out of stock
                              </span>
                            )}
                          </div>

                          <div className="product-info">
                            <div className="product-rating">
                              <span>★</span>{" "}
                              {product.rating.toFixed(1)}
                            </div>

                            <h3
                              className="clickable-product-name"
                              onClick={() => openProductDetails(product._id)}
                            >
                              {product.name}
                            </h3>

                            <div className="product-bottom">
                              <strong className="product-price">
                                ₹{product.price.toLocaleString("en-IN")}
                              </strong>

                              <button
                                type="button"
                                className="add-button"
                                disabled={product.stock <= 0}
                                onClick={() => addToCart(product)}
                              >
                                {product.stock <= 0
                                  ? "Out of stock"
                                  : "+ Add"}
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <div className="empty-icon">🔎</div>
                      <h3>No products found</h3>
                      <p>Try changing your search or filters.</p>

                      <button
                        type="button"
                        className="reset-button"
                        onClick={resetFilters}
                      >
                        Clear search and filters
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          </>
        )}
      </main>

      {/* Footer remains visible on all pages */}
      <footer className="footer" id="footer">
        <a
          className="logo footer-logo"
          href="#products"
          onClick={(event) => {
            event.preventDefault();
            goToProducts();
          }}
        >
          Shop<span>Sphere</span>
        </a>

        <p>Your everyday shopping, made simpler.</p>
        <small>© 2026 ShopSphere. Learning project.</small>
      </footer>

      {/* Scroll to Top Button: Products and Product Admin only */}
      {showScrollTop &&
        (currentPage === "products" ||
          currentPage === "admin-products") && (
          <button
            type="button"
            className="scroll-to-top"
            onClick={scrollToTop}
            aria-label="Scroll to top"
            title="Scroll to top"
          >
            ↑
          </button>
        )}

    </div>
  );
}

export default App;
