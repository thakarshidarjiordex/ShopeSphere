import { useState } from "react";

import {
  useGetProductsQuery,
  useAddProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
  type NewProduct,
  type Product,
  type ProductSpecification,
} from "../services/productsApi";

import "./ProductAdmin.css";

const emptyProduct: NewProduct = {
  name: "",
  brand: "",
  category: "",
  price: 0,
  image: "",
  images: [],
  description: "",
  specifications: [],
  rating: 0,
  stock: 1,
};

function getErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "data" in error) {
    const data = (error as { data?: { message?: string } }).data;

    if (data?.message) return data.message;
  }

  return "Something went wrong. Please try again.";
}

function isValidImageUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export default function ProductAdmin() {
  const {
    data: products = [],
    isLoading,
    isError,
    error,
  } = useGetProductsQuery();

  const [addProduct, addStatus] = useAddProductMutation();
  const [updateProduct, updateStatus] = useUpdateProductMutation();
  const [deleteProduct, deleteStatus] = useDeleteProductMutation();

  const [form, setForm] = useState<NewProduct>(emptyProduct);

  const [editingProductId, setEditingProductId] =
    useState<string | null>(null);

  const [message, setMessage] = useState("");

  const [messageType, setMessageType] = useState<
    "success" | "error"
  >("success");

  const isSaving = addStatus.isLoading || updateStatus.isLoading;

  function showMessage(
    text: string,
    type: "success" | "error"
  ) {
    setMessage(text);
    setMessageType(type);
  }

  // ==========================================
  // NORMAL FORM INPUTS
  // ==========================================

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]:
        name === "price" ||
        name === "rating" ||
        name === "stock"
          ? value === ""
            ? 0
            : Number(value)
          : value,
    }));
  }

  // ==========================================
  // ADDITIONAL PRODUCT IMAGES
  // ==========================================

  function handleAddImage() {
    setForm((previous) => ({
      ...previous,
      images: [...(previous.images ?? []), ""],
    }));
  }

  function handleImageChange(index: number, value: string) {
    setForm((previous) => ({
      ...previous,
      images: (previous.images ?? []).map((image, i) =>
        i === index ? value : image
      ),
    }));
  }

  function handleRemoveImage(index: number) {
    setForm((previous) => ({
      ...previous,
      images: (previous.images ?? []).filter(
        (_, i) => i !== index
      ),
    }));
  }

  // ==========================================
  // PRODUCT SPECIFICATIONS
  // ==========================================

  function handleAddSpecification() {
    setForm((previous) => ({
      ...previous,
      specifications: [
        ...(previous.specifications ?? []),
        { name: "", value: "" },
      ],
    }));
  }

  function handleSpecificationChange(
    index: number,
    field: keyof ProductSpecification,
    value: string
  ) {
    setForm((previous) => ({
      ...previous,
      specifications: (previous.specifications ?? []).map(
        (specification, i) =>
          i === index
            ? { ...specification, [field]: value }
            : specification
      ),
    }));
  }

  function handleRemoveSpecification(index: number) {
    setForm((previous) => ({
      ...previous,
      specifications: (previous.specifications ?? []).filter(
        (_, i) => i !== index
      ),
    }));
  }

  // ==========================================
  // RESET FORM
  // ==========================================

  function resetForm() {
    setForm({ ...emptyProduct, images: [], specifications: [] });
    setEditingProductId(null);
  }

  // ==========================================
  // VALIDATE PRODUCT
  // ==========================================

  function validateProduct(): boolean {
    const additionalImages = form.images ?? [];
    const specifications = form.specifications ?? [];

    if (
      !form.name.trim() ||
      !form.category.trim() ||
      !form.image.trim()
    ) {
      showMessage(
        "Product name, category, and main image are required.",
        "error"
      );
      return false;
    }

    if (!isValidImageUrl(form.image)) {
      showMessage("Please enter a valid main image URL.", "error");
      return false;
    }

    if (
      !Number.isFinite(form.price) ||
      form.price <= 0
    ) {
      showMessage("Please enter a valid product price.", "error");
      return false;
    }

    if (
      !Number.isInteger(form.stock) ||
      form.stock < 0
    ) {
      showMessage("Stock must be a non-negative whole number.", "error");
      return false;
    }

    if (
      !Number.isFinite(form.rating) ||
      form.rating < 0 ||
      form.rating > 5
    ) {
      showMessage("Rating must be between 0 and 5.", "error");
      return false;
    }

    if (form.description.length > 2000) {
      showMessage(
        "Description cannot exceed 2000 characters.",
        "error"
      );
      return false;
    }

    if (additionalImages.length > 8) {
      showMessage(
        "You can add a maximum of 8 additional images.",
        "error"
      );
      return false;
    }

    const invalidImage = additionalImages.some(
      (image) => !isValidImageUrl(image)
    );

    if (invalidImage) {
      showMessage(
        "Please enter valid URLs for all additional images.",
        "error"
      );
      return false;
    }

    const invalidSpecification = specifications.some(
      (specification) =>
        !specification.name.trim() ||
        !specification.value.trim()
    );

    if (invalidSpecification) {
      showMessage(
        "Please complete or remove every specification row.",
        "error"
      );
      return false;
    }

    return true;
  }

  // ==========================================
  // ADD OR UPDATE PRODUCT
  // ==========================================

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (isSaving) return;

    setMessage("");

    if (!validateProduct()) return;

    const productData: NewProduct = {
      ...form,

      name: form.name.trim(),
      brand: form.brand?.trim() ?? "",
      category: form.category.trim(),

      price: Number(form.price),
      rating: Number(form.rating),
      stock: Number(form.stock),

      image: form.image.trim(),

      images: (form.images ?? []).map((image) =>
        image.trim()
      ),

      description: form.description.trim(),

      specifications: (form.specifications ?? []).map(
        (specification) => ({
          name: specification.name.trim(),
          value: specification.value.trim(),
        })
      ),
    };

    try {
      if (editingProductId) {
        await updateProduct({
          id: editingProductId,
          changes: productData,
        }).unwrap();

        showMessage(
          "Product updated successfully!",
          "success"
        );
      } else {
        await addProduct(productData).unwrap();

        showMessage(
          "Product added successfully!",
          "success"
        );
      }

      resetForm();
    } catch (err) {
      showMessage(getErrorMessage(err), "error");
    }
  }

  // ==========================================
  // EDIT PRODUCT
  // ==========================================

  function handleEdit(product: Product) {
    setForm({
      name: product.name,
      brand: product.brand ?? "",
      category: product.category,
      price: product.price,
      image: product.image,

      images: product.images ?? [],

      description: product.description ?? "",

      specifications: (product.specifications ?? []).map(
        (specification) => ({
          name: specification.name,
          value: specification.value,
        })
      ),

      rating: product.rating ?? 0,
      stock: product.stock,
    });

    setEditingProductId(product._id);
    setMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // ==========================================
  // DELETE PRODUCT
  // ==========================================

  async function handleDelete(product: Product) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${product.name}"?`
    );

    if (!confirmed) return;

    setMessage("");

    try {
      await deleteProduct(product._id).unwrap();

      if (editingProductId === product._id) {
        resetForm();
      }

      showMessage(
        "Product deleted successfully!",
        "success"
      );
    } catch (err) {
      showMessage(getErrorMessage(err), "error");
    }
  }

  // ==========================================
  // LOADING AND ERROR STATES
  // ==========================================

  if (isLoading) {
    return (
      <section className="product-admin">
        <p className="admin-loading">
          Loading product management...
        </p>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="product-admin">
        <p
          className="admin-message admin-message-error"
          role="alert"
        >
          {getErrorMessage(error)}
        </p>
      </section>
    );
  }

  // ==========================================
  // ADMIN DASHBOARD
  // ==========================================

  return (
    <section className="product-admin">

      {/* Dashboard Header */}
      <div className="admin-header">
        <div>
          <p className="admin-eyebrow">
            SHOPSPHERE ADMIN
          </p>

          <h2>Product Management</h2>

          <p className="admin-subtitle">
            Manage your catalog, images, descriptions,
            specifications, and inventory.
          </p>
        </div>

        <div className="admin-count">
          <span>Total products</span>
          <strong>{products.length}</strong>
        </div>
      </div>

      {/* Status Message */}
      {message && (
        <p
          className={`admin-message ${
            messageType === "success"
              ? "admin-message-success"
              : "admin-message-error"
          }`}
          role="status"
        >
          {message}
        </p>
      )}

      {/* ====================================== */}
      {/* ADD / EDIT PRODUCT FORM */}
      {/* ====================================== */}

      <div className="admin-panel">
        <div className="admin-panel-heading">
          <div className="admin-heading-icon">
            {editingProductId ? "✎" : "＋"}
          </div>

          <div>
            <h3>
              {editingProductId
                ? "Edit Product"
                : "Add a New Product"}
            </h3>

            <p>
              {editingProductId
                ? "Update the product information below."
                : "Enter all the information to add a product."}
            </p>
          </div>
        </div>

        <form className="admin-form" onSubmit={handleSubmit}>

          {/* BASIC INFORMATION */}

          <div className="admin-form-section admin-field-full">
            <h4>Basic Information</h4>
            <p>Enter the product name, brand, and category.</p>
          </div>

          <label>
            Product Name

            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Samsung Galaxy S25"
              required
            />
          </label>

          <label>
            Brand

            <input
              name="brand"
              value={form.brand ?? ""}
              onChange={handleChange}
              placeholder="Samsung"
            />
          </label>

          <label>
            Category

            <input
              name="category"
              value={form.category}
              onChange={handleChange}
              placeholder="Smartphones"
              required
            />
          </label>

          <label>
            Price (₹)

            <input
              name="price"
              type="number"
              min="0.01"
              step="0.01"
              value={form.price}
              onChange={handleChange}
              required
            />
          </label>

          {/* PRODUCT IMAGES */}

          <div className="admin-form-section admin-field-full">
            <h4>Product Images</h4>
            <p>Add the main product image and additional gallery images.</p>
          </div>

          <label className="admin-field-full">
            Main Image URL

            <input
              name="image"
              type="url"
              value={form.image}
              onChange={handleChange}
              placeholder="https://example.com/product.jpg"
              required
            />
          </label>

          {form.image && (
            <div className="admin-image-preview admin-field-full">
              <img src={form.image} alt="Main product preview" />
              <span>Main product image preview</span>
            </div>
          )}

          <div className="admin-images-section admin-field-full">
            <div className="admin-images-heading">
              <div>
                <h4>Additional Product Images</h4>
                <p>
                  Add up to 8 additional images.
                </p>
              </div>

              <button
                type="button"
                className="admin-add-image-button"
                onClick={handleAddImage}
                disabled={(form.images ?? []).length >= 8}
              >
                + Add Image
              </button>
            </div>

            {(form.images ?? []).length === 0 && (
              <p className="admin-no-images">
                No additional images added yet.
              </p>
            )}

            {(form.images ?? []).map((image, index) => (
              <div className="admin-image-row" key={index}>
                <label>
                  Additional Image {index + 1}

                  <input
                    type="url"
                    value={image}
                    onChange={(event) =>
                      handleImageChange(index, event.target.value)
                    }
                    placeholder="https://example.com/product-image.jpg"
                    required
                  />
                </label>

                <button
                  type="button"
                  className="admin-remove-image-button"
                  onClick={() => handleRemoveImage(index)}
                >
                  Remove
                </button>

                {image && (
                  <img
                    className="admin-extra-image-preview"
                    src={image}
                    alt={`Additional image ${index + 1}`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* DESCRIPTION */}

          <div className="admin-form-section admin-field-full">
            <h4>Product Description</h4>
            <p>Explain the product and its main benefits.</p>
          </div>

          <label className="admin-field-full">
            Description

            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Describe the product, its features, benefits, and uses..."
              maxLength={2000}
              rows={6}
            />

            <span className="admin-character-count">
              {form.description.length}/2000 characters
            </span>
          </label>

          {/* SPECIFICATIONS */}

          <div className="admin-specifications admin-field-full">
            <div className="admin-specifications-heading">
              <div>
                <h4>Product Specifications</h4>
                <p>
                  Add technical or product-specific details.
                </p>
              </div>

              <button
                type="button"
                className="admin-add-spec-button"
                onClick={handleAddSpecification}
              >
                + Add Specification
              </button>
            </div>

            {form.specifications.length === 0 && (
              <p className="admin-no-specifications">
                No specifications added yet.
              </p>
            )}

            {form.specifications.map((specification, index) => (
              <div
                className="admin-specification-row"
                key={index}
              >
                <label>
                  Specification Name

                  <input
                    value={specification.name}
                    onChange={(event) =>
                      handleSpecificationChange(
                        index,
                        "name",
                        event.target.value
                      )
                    }
                    placeholder="RAM"
                    required
                  />
                </label>

                <label>
                  Specification Value

                  <input
                    value={specification.value}
                    onChange={(event) =>
                      handleSpecificationChange(
                        index,
                        "value",
                        event.target.value
                      )
                    }
                    placeholder="12GB"
                    required
                  />
                </label>

                <button
                  type="button"
                  className="admin-remove-spec-button"
                  onClick={() =>
                    handleRemoveSpecification(index)
                  }
                  aria-label={`Remove specification ${index + 1}`}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          {/* INVENTORY */}

          <div className="admin-form-section admin-field-full">
            <h4>Inventory and Rating</h4>
            <p>Set the product stock and rating.</p>
          </div>

          <label>
            Rating (0–5)

            <input
              name="rating"
              type="number"
              min="0"
              max="5"
              step="0.1"
              value={form.rating}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Stock Quantity

            <input
              name="stock"
              type="number"
              min="0"
              step="1"
              value={form.stock}
              onChange={handleChange}
              required
            />
          </label>

          {/* FORM BUTTONS */}

          <div className="admin-form-actions admin-field-full">
            <button
              type="submit"
              className="admin-primary-button"
              disabled={isSaving}
            >
              {isSaving
                ? "Saving Product..."
                : editingProductId
                  ? "Save Changes"
                  : "+ Add Product"}
            </button>

            {editingProductId && (
              <button
                type="button"
                className="admin-cancel-button"
                onClick={resetForm}
              >
                Cancel Editing
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ====================================== */}
      {/* EXISTING PRODUCTS */}
      {/* ====================================== */}

      <div className="admin-inventory">
        <div className="admin-inventory-heading">
          <div>
            <h3>Existing Products</h3>
            <p>
              View and manage products in your catalog.
            </p>
          </div>

          <span className="admin-inventory-count">
            {products.length}{" "}
            {products.length === 1 ? "item" : "items"}
          </span>
        </div>

        {products.length === 0 ? (
          <div className="admin-empty">
            <span className="admin-empty-icon">📦</span>
            <h4>No products yet</h4>
            <p>Add your first product using the form above.</p>
          </div>
        ) : (
          <div className="admin-product-grid">
            {products.map((product) => (
              <article
                key={product._id}
                className="admin-product-card"
              >
                <div className="admin-product-image">
                  <img
                    src={product.image}
                    alt={product.name}
                    loading="lazy"
                  />

                  <span className="admin-category-badge">
                    {product.category}
                  </span>
                </div>

                <div className="admin-product-info">
                  <div className="admin-product-title-row">
                    <h4>{product.name}</h4>

                    <span className="admin-product-rating">
                      ★ {(product.rating ?? 0).toFixed(1)}
                    </span>
                  </div>

                  {product.brand && (
                    <p className="admin-product-brand">
                      Brand: {product.brand}
                    </p>
                  )}

                  <p className="admin-product-price">
                    ₹{product.price.toLocaleString("en-IN")}
                  </p>

                  {product.description && (
                    <p className="admin-product-description">
                      {product.description}
                    </p>
                  )}

                  <div className="admin-product-stock-row">
                    <span>Inventory</span>

                    <span
                      className={`admin-stock-badge ${
                        product.stock === 0
                          ? "admin-stock-out"
                          : product.stock <= 5
                            ? "admin-stock-low"
                            : "admin-stock-available"
                      }`}
                    >
                      {product.stock === 0
                        ? "Out of stock"
                        : product.stock <= 5
                          ? `Low stock · ${product.stock}`
                          : `${product.stock} in stock`}
                    </span>
                  </div>

                  <div className="admin-product-actions">
                    <button
                      type="button"
                      className="admin-edit-button"
                      onClick={() => handleEdit(product)}
                      disabled={deleteStatus.isLoading}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="admin-delete-button"
                      onClick={() => handleDelete(product)}
                      disabled={deleteStatus.isLoading}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
