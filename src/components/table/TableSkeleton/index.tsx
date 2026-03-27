const SKELETON_ROWS = 5;
const SKELETON_COLS = 5;

export default function SkeletonTable() {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
      <table className="min-w-full text-sm text-left">
        <thead className="bg-gray-50 uppercase border-b border-gray-200">
          <tr>
            {Array.from({ length: SKELETON_COLS }, (_, idx) => (
              <th key={idx} className="py-3 px-4 font-medium text-[14px] whitespace-nowrap">
                <div className={`flex items-center gap-2 ${idx === 0 ? 'justify-start' : 'justify-center'}`}>
                  {idx === 0 && <div className="w-4 h-4 bg-gray-300 rounded animate-pulse" />}
                  <div className="h-4 bg-gray-300 rounded animate-pulse w-20" />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: SKELETON_ROWS }, (_, rowIdx) => (
            <tr key={rowIdx} className="border-b border-gray-100 animate-pulse">
              {Array.from({ length: SKELETON_COLS }, (_, colIdx) => (
                <td key={colIdx} className="py-3 px-4">
                  <div className="flex items-center justify-center">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
