import { useState, useEffect } from 'react';
import i18n from '../utils/i18n';

export const useTranslation = () => {
  const [, setLanguage] = useState(i18n.getCurrentLanguage());
  
  useEffect(() => {
    const handleLanguageChange = (event) => {
      setLanguage(event.detail);
    };
    
    window.addEventListener('languageChanged', handleLanguageChange);
    return () => window.removeEventListener('languageChanged', handleLanguageChange);
  }, []);
  
  const t = (key, params = {}) => i18n.t(key, params);
  
  const formatPrice = (amount) => i18n.formatPrice(amount);
  
  return {
    t,
    formatPrice,
    currentLanguage: i18n.getCurrentLanguage(),
    setLanguage: i18n.setLanguage.bind(i18n)
  };
};