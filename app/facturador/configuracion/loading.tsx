export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-8 bg-gray-200 rounded animate-pulse" />
            <div>
              <div className="w-48 h-6 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="w-64 h-4 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="w-full h-32 bg-gray-200 rounded-lg animate-pulse mb-8" />
        <div className="grid lg:grid-cols-2 gap-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="w-full h-64 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
