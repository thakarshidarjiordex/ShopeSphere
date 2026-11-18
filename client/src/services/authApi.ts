import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "customer" | "admin";
}

interface AuthResponse {
  success: boolean;
  message: string;
  data?: AuthUser;
}

interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

export const authApi = createApi({
  reducerPath: "authApi",

  baseQuery: fetchBaseQuery({
    baseUrl: "http://localhost:5000/api/",
    credentials: "include",
  }),

  tagTypes: ["Auth"],

  endpoints: (builder) => ({
    register: builder.mutation<AuthResponse, RegisterRequest>({
      query: (body) => ({
        url: "auth/register",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Auth"],
    }),

    login: builder.mutation<AuthResponse, LoginRequest>({
      query: (body) => ({
        url: "auth/login",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Auth"],
    }),

    getCurrentUser: builder.query<AuthUser, void>({
      query: () => "auth/me",
      transformResponse: (response: AuthResponse) => {
        if (!response.data) {
          throw new Error("User information is missing.");
        }
        return response.data;
      },
      providesTags: ["Auth"],
    }),

    logout: builder.mutation<AuthResponse, void>({
      query: () => ({
        url: "auth/logout",
        method: "POST",
      }),
      invalidatesTags: ["Auth"],
    }),
  }),
});

export const {
  useRegisterMutation,
  useLoginMutation,
  useGetCurrentUserQuery,
  useLogoutMutation,
} = authApi;
