import { productsApi } from "./productsApi";

// Review author information
export interface ReviewUser {
  _id: string;
  name: string;
}

// Review information
export interface Review {
  _id: string;
  user: ReviewUser;
  product: string;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
}

// GET response
interface ReviewsResponse {
  success: boolean;
  count: number;
  averageRating: number;
  data: Review[];
}

// Single review response
interface ReviewResponse {
  success: boolean;
  message: string;
  data: Review;
}

// Create review request
export interface CreateReviewRequest {
  productId: string;
  rating: number;
  comment: string;
}

// Update review request
export interface UpdateReviewRequest {
  id: string;
  productId: string;
  rating: number;
  comment: string;
}

// GET reviews and rating summary
export const reviewsApi = productsApi.injectEndpoints({
  endpoints: (builder) => ({
    // GET: Fetch reviews for a product
    getProductReviews: builder.query<
      ReviewsResponse,
      string
    >({
      query: (productId) => `reviews/product/${productId}`,

      providesTags: (_result, _error, productId) => [
        { type: "Review", id: productId },
      ],
    }),

    // POST: Create a review
    createReview: builder.mutation<
      ReviewResponse,
      CreateReviewRequest
    >({
      query: ({ productId, rating, comment }) => ({
        url: `reviews/product/${productId}`,
        method: "POST",
        body: { rating, comment },
      }),

      invalidatesTags: (_result, _error, { productId }) => [
        { type: "Review", id: productId },
      ],
    }),

    // PUT: Update a review
    updateReview: builder.mutation<
      ReviewResponse,
      UpdateReviewRequest
    >({
      query: ({ id, rating, comment }) => ({
        url: `reviews/${id}`,
        method: "PUT",
        body: { rating, comment },
      }),

      invalidatesTags: (_result, _error, { productId }) => [
        { type: "Review", id: productId },
      ],
    }),

    // DELETE: Delete a review
    deleteReview: builder.mutation<
      { success: boolean; message: string },
      { id: string; productId: string }
    >({
      query: ({ id }) => ({
        url: `reviews/${id}`,
        method: "DELETE",
      }),

      invalidatesTags: (_result, _error, { productId }) => [
        { type: "Review", id: productId },
      ],
    }),
  }),
});

export const {
  useGetProductReviewsQuery,
  useCreateReviewMutation,
  useUpdateReviewMutation,
  useDeleteReviewMutation,
} = reviewsApi;
