'use client';

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <h2 className="text-2xl font-bold text-red-600 mb-2">Terjadi Kesalahan</h2>
        <p className="text-gray-600 mb-6">{error.message || 'Silakan coba lagi'}</p>
        <button
          onClick={reset}
          className="bg-orange-600 hover:bg-orange-700 text-white font-medium px-6 py-2 rounded-lg"
        >
          Coba Lagi
        </button>
      </div>
    </div>
  );
}
