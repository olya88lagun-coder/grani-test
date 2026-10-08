// Знак бренда рядом со словом «грани»: изумрудный шестиугольник в золотой рамке.
// Тот же камень, что в значке вкладки (src/app/icon.svg), но без буквы «Г»: слово рядом уже есть
export function BrandMark({ height = 30 }: { height?: number }) {
  const width = Math.round(height * 0.877);
  return (
    <svg width={width} height={height} viewBox="0 0 100 114" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="brand-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F8DE7E" />
          <stop offset="1" stopColor="#D8A52A" />
        </linearGradient>
        <linearGradient id="brand-table" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0E5B39" />
          <stop offset="1" stopColor="#073B25" />
        </linearGradient>
      </defs>
      <polygon points="50,2 98,30 98,84 50,112 2,84 2,30" fill="url(#brand-gold)" />
      <polygon points="50,6 94.5,32 94.5,82 50,108 5.5,82 5.5,32" fill="#0A7A48" />
      <polygon points="50,6 94.5,32 50,38 5.5,32" fill="#2EDC92" />
      <polygon points="94.5,32 94.5,82 76,70 76,44" fill="#12A566" />
      <polygon points="94.5,82 50,108 50,86 76,70" fill="#0B7C49" />
      <polygon points="50,108 5.5,82 24,70 50,86" fill="#1CC27B" />
      <polygon points="5.5,82 5.5,32 24,44 24,70" fill="#0A6A3F" />
      <polygon points="50,38 76,44 76,70 50,86 24,70 24,44" fill="url(#brand-table)" />
    </svg>
  );
}
