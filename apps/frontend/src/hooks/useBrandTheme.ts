import { useEffect } from 'react';

export function useBrandTheme(brand: 'carsalon') {
  useEffect(() => {
    const className = `theme-${brand}`;
    document.body.classList.add(className);

    return () => {
      document.body.classList.remove(className);
    };
  }, [brand]);
}
