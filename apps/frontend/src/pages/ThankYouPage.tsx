import React from 'react';

import { Icon } from '../components/ui';

export const ThankYouPage: React.FC = () => {
  return (
    <div className="app-auth">
      <div className="app-auth__card app-client-done">
        <span className="app-client-done__icon">
          <Icon name="check" size={24} />
        </span>
        <h1 className="app-auth__title">Dziękujemy!</h1>
        <p className="app-client-done__text">
          Twój wniosek został pomyślnie wysłany. Nasz konsultant skontaktuje się z Tobą wkrótce, aby omówić kolejne kroki.
        </p>
        <a href="https://carsalon.pl" className="iz-btn iz-btn--primary iz-btn--lg">
          Odwiedź carsalon.pl
        </a>
      </div>
    </div>
  );
};
