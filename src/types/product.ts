export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  unit_type: string;
  image_url: string | null;
  category_id: string | null;
}

export interface Category {
  id: string;
  name: string;
  emoji: string | null;
}
