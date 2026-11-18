export interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  image: string;
  rating: number;
}

export const products: Product[] = [
  {
    id: 1,
    name: "Wireless Headphones",
    category: "Electronics",
    price: 2499,
    image: "https://placehold.co/600x400/e8eef8/243b64?text=Headphones",
    rating: 4.5,
  },
  {
    id: 2,
    name: "Smart Watch",
    category: "Electronics",
    price: 3999,
    image: "https://placehold.co/600x400/e8eef8/243b64?text=Smart+Watch",
    rating: 4.3,
  },
  {
    id: 3,
    name: "Casual Sneakers",
    category: "Fashion",
    price: 1799,
    image: "https://placehold.co/600x400/f6e9dd/70472d?text=Sneakers",
    rating: 4.6,
  },
  {
    id: 4,
    name: "Travel Backpack",
    category: "Accessories",
    price: 1299,
    image: "https://placehold.co/600x400/e3eee5/30563a?text=Backpack",
    rating: 4.2,
  },
  {
    id: 5,
    name: "Mechanical Keyboard",
    category: "Electronics",
    price: 2999,
    image: "https://placehold.co/600x400/eee7f7/503774?text=Keyboard",
    rating: 4.7,
  },
  {
    id: 6,
    name: "Classic T-Shirt",
    category: "Fashion",
    price: 599,
    image: "https://placehold.co/600x400/f7e5e5/873b3b?text=T-Shirt",
    rating: 4.1,
  },
];
