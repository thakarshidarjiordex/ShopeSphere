import { useState } from "react";
import {
  useGetProductReviewsQuery,
  useCreateReviewMutation,
  useUpdateReviewMutation,
  useDeleteReviewMutation,
  type Review,
} from "../../services/reviewsApi";
import { useGetCurrentUserQuery } from "../../services/authApi";
import "./ProductReviews.css";

interface ProductReviewsProps {
  productId: string;
}

function ProductReviews({ productId }: ProductReviewsProps) {
  const { data, isLoading, isError } =
    useGetProductReviewsQuery(productId);

  const { data: currentUser } = useGetCurrentUserQuery();

  const [createReview, { isLoading: isCreating }] =
    useCreateReviewMutation();

  const [updateReview, { isLoading: isUpdating }] =
    useUpdateReviewMutation();

  const [deleteReview, { isLoading: isDeleting }] =
    useDeleteReviewMutation();

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const [editingReview, setEditingReview] =
    useState<Review | null>(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const reviews = data?.data ?? [];
  const averageRating = data?.averageRating ?? 0;
  const reviewCount = data?.count ?? 0;

  // Submit a new review
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setMessage("");
    setError("");

    try {
      if (editingReview) {
        await updateReview({
          id: editingReview._id,
          productId,
          rating,
          comment,
        }).unwrap();

        setMessage("Review updated successfully!");
        setEditingReview(null);
      } else {
        await createReview({
          productId,
          rating,
          comment,
        }).unwrap();

        setMessage("Review submitted successfully!");
      }

      setRating(5);
      setComment("");
    } catch (err: any) {
      setError(
        err?.data?.message || "Something went wrong. Please try again."
      );
    }
  };

  // Start editing a review
  const handleEdit = (review: Review) => {
    setEditingReview(review);
    setRating(review.rating);
    setComment(review.comment);
    setMessage("");
    setError("");
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingReview(null);
    setRating(5);
    setComment("");
    setError("");
    setMessage("");
  };

  // Delete a review
  const handleDelete = async (reviewId: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this review?"
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      await deleteReview({
        id: reviewId,
        productId,
      }).unwrap();

      setMessage("Review deleted successfully!");

      if (editingReview?._id === reviewId) {
        handleCancelEdit();
      }
    } catch (err: any) {
      setError(
        err?.data?.message || "Unable to delete review."
      );
    }
  };

  if (isLoading) {
    return <p>Loading reviews...</p>;
  }

  if (isError) {
    return <p>Unable to load product reviews.</p>;
  }

  return (
    <section className="product-reviews">
      <h2>Customer Reviews</h2>

      {/* Rating summary */}
      <div className="rating-summary">
        <h3>{averageRating.toFixed(1)} / 5</h3>

        <div className="stars">
          {"★".repeat(Math.round(averageRating))}
          {"☆".repeat(5 - Math.round(averageRating))}
        </div>

        <p>Based on {reviewCount} reviews</p>
      </div>

      {/* Feedback messages */}
      {message && <p className="review-success">{message}</p>}
      {error && <p className="review-error">{error}</p>}

      {/* Review form */}
      {currentUser && (
        <form className="review-form" onSubmit={handleSubmit}>
          <h3>
            {editingReview ? "Edit Your Review" : "Write a Review"}
          </h3>

          <label>Your Rating</label>

          <div className="rating-input">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                className={value <= rating ? "selected" : ""}
                onClick={() => setRating(value)}
                aria-label={`Rate ${value} out of 5`}
              >
                ★
              </button>
            ))}
          </div>

          <label htmlFor="review-comment">Your Comment</label>

          <textarea
            id="review-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your product experience..."
            minLength={3}
            maxLength={1000}
            required
          />

          <button
            type="submit"
            disabled={isCreating || isUpdating}
          >
            {isCreating || isUpdating
              ? "Saving..."
              : editingReview
                ? "Update Review"
                : "Submit Review"}
          </button>

          {editingReview && (
            <button type="button" onClick={handleCancelEdit}>
              Cancel
            </button>
          )}
        </form>
      )}

      {!currentUser && (
        <p>Please log in to write a review.</p>
      )}

      {/* Review list */}
      <div className="review-list">
        <h3>All Reviews ({reviewCount})</h3>

        {reviews.length === 0 ? (
          <p>No reviews yet. Be the first to review this product!</p>
        ) : (
          reviews.map((review) => {
            const isOwner =
              currentUser?.id === review.user?._id;

            return (
              <article className="review-card" key={review._id}>
                <div className="review-header">
                  <h4>{review.user?.name || "Customer"}</h4>

                  <span className="review-date">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="stars">
                  {"★".repeat(review.rating)}
                  {"☆".repeat(5 - review.rating)}
                </div>

                <p>{review.comment}</p>

                {isOwner && (
                  <div className="review-actions">
                    <button
                      type="button"
                      onClick={() => handleEdit(review)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => handleDelete(review._id)}
                    >
                      {isDeleting ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

export default ProductReviews;
