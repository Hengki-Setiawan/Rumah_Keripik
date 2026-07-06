export type ProductPlaceholder = {
  id: string;
  match: string[];
  url: string;
  alt: string;
  sourceName: 'Pexels' | 'Pixabay';
  sourceUrl: string;
  temporary: true;
};

export type PlaceholderProductInput = {
  nama_produk: string;
  deskripsi?: string | null;
  kategori_nama?: string | null;
};

const placeholders: ProductPlaceholder[] = [
  {
    id: 'spicy-chips',
    match: ['pedas', 'balado', 'cabai', 'sambal', 'chili', 'hot'],
    url: 'https://images.pexels.com/photos/1893556/pexels-photo-1893556.jpeg?auto=compress&cs=tinysrgb&w=900',
    alt: 'Ilustrasi keripik pedas renyah untuk produk Rumah Keripik',
    sourceName: 'Pexels',
    sourceUrl: 'https://www.pexels.com/photo/photo-of-potato-chips-1893556/',
    temporary: true,
  },
  {
    id: 'banana-chips',
    match: ['pisang', 'banana'],
    url: 'https://images.pexels.com/photos/5945755/pexels-photo-5945755.jpeg?auto=compress&cs=tinysrgb&w=900',
    alt: 'Ilustrasi camilan pisang renyah untuk produk Rumah Keripik',
    sourceName: 'Pexels',
    sourceUrl: 'https://www.pexels.com/search/banana%20chips/',
    temporary: true,
  },
  {
    id: 'cassava-chips',
    match: ['singkong', 'cassava', 'ubi'],
    url: 'https://images.pexels.com/photos/4110251/pexels-photo-4110251.jpeg?auto=compress&cs=tinysrgb&w=900',
    alt: 'Ilustrasi keripik singkong renyah untuk produk Rumah Keripik',
    sourceName: 'Pexels',
    sourceUrl: 'https://www.pexels.com/search/chips/',
    temporary: true,
  },
  {
    id: 'bundle-snacks',
    match: ['paket', 'bundle', 'hemat', 'oleh-oleh', 'hampers'],
    url: 'https://images.pexels.com/photos/1028599/pexels-photo-1028599.jpeg?auto=compress&cs=tinysrgb&w=900',
    alt: 'Ilustrasi paket camilan untuk produk Rumah Keripik',
    sourceName: 'Pexels',
    sourceUrl: 'https://www.pexels.com/search/snacks/',
    temporary: true,
  },
];

export const defaultProductPlaceholder: ProductPlaceholder = {
  id: 'default-snack-bowl',
  match: [],
  url: 'https://images.pexels.com/photos/1583884/pexels-photo-1583884.jpeg?auto=compress&cs=tinysrgb&w=900',
  alt: 'Ilustrasi camilan renyah untuk produk Rumah Keripik',
  sourceName: 'Pexels',
  sourceUrl: 'https://www.pexels.com/photo/close-up-photo-of-potato-chips-1583884/',
  temporary: true,
};

export function getProductPlaceholder(product: PlaceholderProductInput): ProductPlaceholder {
  const haystack = `${product.nama_produk} ${product.deskripsi || ''} ${product.kategori_nama || ''}`.toLowerCase();
  return placeholders.find((placeholder) => placeholder.match.some((keyword) => haystack.includes(keyword))) || defaultProductPlaceholder;
}
