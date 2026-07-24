'use client';

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  quantity: number;
  onQuantityChange?: (id: string, delta: number) => void;
}

export function ProductCard({ id, name, price, imageUrl, quantity, onQuantityChange }: ProductCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      {imageUrl && (
        <img src={imageUrl} alt={name} className="h-16 w-16 rounded-md object-cover" />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">{name}</p>
        <p className="text-sm text-amber-700 font-semibold">
          Rp {price.toLocaleString('id-ID')}
        </p>
      </div>
      {onQuantityChange && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onQuantityChange(id, -1)}
            disabled={quantity <= 1}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
            aria-label="Kurangi jumlah"
          >
            −
          </button>
          <span className="w-6 text-center font-medium">{quantity}</span>
          <button
            onClick={() => onQuantityChange(id, 1)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100"
            aria-label="Tambah jumlah"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
