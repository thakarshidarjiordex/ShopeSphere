import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export interface ProductSpecification {
  name: string;
  value: string;
}

export interface Product {
  _id: string;
  name: string;
  brand?: string;
  category: string;
  price: number;
  image: string;
  images?: string[];
  description?: string;
  specifications?: ProductSpecification[];
  rating: number;
  stock: number;
}

// Data required when creating a product
export type NewProduct = Omit<Product, "_id">;

interface ProductsResponse {
  success: boolean;
  count: number;
  data: Product[];
}

interface ProductResponse {
  success: boolean;
  data: Product;
}

export const productsApi = createApi({
  reducerPath: "productsApi",

  baseQuery: fetchBaseQuery({
    baseUrl: "http://localhost:5000/api/",
    credentials: "include",
  }),

  tagTypes: ["Product", "Review"],

  endpoints: (builder) => ({
    // GET: Fetch all products
    getProducts: builder.query<Product[], void>({
      query: () => "products",

      transformResponse: (response: ProductsResponse) =>
        response.data,

      providesTags: (result) =>
        result
          ? [
              ...result.map((product) => ({
                type: "Product" as const,
                id: product._id,
              })),
              { type: "Product" as const, id: "LIST" },
            ]
          : [{ type: "Product" as const, id: "LIST" }],
    }),

    // GET: Fetch one product
    getProductById: builder.query<Product, string>({
      query: (id) => `products/${id}`,

      transformResponse: (response: ProductResponse) =>
        response.data,

      providesTags: (_result, _error, id) => [
        { type: "Product", id },
      ],
    }),

    // POST: Create a product
    addProduct: builder.mutation<Product, NewProduct>({
      query: (newProduct) => ({
        url: "products",
        method: "POST",
        body: newProduct,
      }),

      transformResponse: (response: ProductResponse) =>
        response.data,

      invalidatesTags: [{ type: "Product", id: "LIST" }],
    }),

    // PUT: Update a product
    updateProduct: builder.mutation<
      Product,
      { id: string; changes: Partial<NewProduct> }
    >({
      query: ({ id, changes }) => ({
        url: `products/${id}`,
        method: "PUT",
        body: changes,
      }),

      transformResponse: (response: ProductResponse) =>
        response.data,

      invalidatesTags: (_result, _error, { id }) => [
        { type: "Product", id },
        { type: "Product", id: "LIST" },
      ],
    }),

    // DELETE: Remove a product
    deleteProduct: builder.mutation<{ success: boolean }, string>({
      query: (id) => ({
        url: `products/${id}`,
        method: "DELETE",
      }),

      invalidatesTags: (_result, _error, id) => [
        { type: "Product", id },
        { type: "Product", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useGetProductsQuery,
  useGetProductByIdQuery,
  useAddProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
} = productsApi;
