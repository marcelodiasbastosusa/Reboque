import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { useTranslation } from '../hooks/useTranslation';
import { 
  DollarSign, 
  Save, 
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Settings,
  MapPin,
  Clock
} from 'lucide-react';

const DriverPricing = () => {
  const { api, user } = useAuth();
  const { t, formatPrice } = useTranslation();
  const [pricing, setPricing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [formData, setFormData] = useState({
    price_per_mile: 2.50,
    pickup_fee: 25.00,
    is_using_base_pricing: true
  });

  useEffect(() => {
    if (user?.role === 'driver') {
      fetchDriverPricing();
    }
  }, [user]);

  const fetchDriverPricing = async () => {
    try {
      setLoading(true);
      const response = await api.get('/drivers/pricing');
      setPricing(response.data);
      setFormData({
        price_per_mile: response.data.price_per_mile,
        pickup_fee: response.data.pickup_fee,
        is_using_base_pricing: response.data.is_using_base_pricing
      });
    } catch (error) {
      console.error('Error fetching pricing:', error);
      setError(error.response?.data?.detail || t('errorFetchingData'));
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : parseFloat(value) || 0
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.put('/drivers/pricing', formData);
      setPricing(response.data);
      setSuccess(t('pricingUpdatedSuccess'));
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error updating pricing:', error);
      setError(error.response?.data?.detail || t('errorUpdatingPricing'));
    } finally {
      setSaving(false);
    }
  };

  const calculateExamplePrice = (distance) => {
    if (formData.is_using_base_pricing) {
      // Would need to fetch admin pricing, using defaults for now
      return formData.pickup_fee + (distance * 2.50);
    } else {
      return formData.pickup_fee + (distance * formData.price_per_mile);
    }
  };

  if (user?.role !== 'driver') {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            {t('myPricing')}
          </h2>
          <p className="text-sm text-gray-600">
            {t('managePricingDescription')}
          </p>
        </div>
        
        <button
          onClick={fetchDriverPricing}
          disabled={loading}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </button>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-500" />
          <span className="text-green-700">{success}</span>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('loading')}...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Pricing Form */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Settings className="h-5 w-5" />
                {t('pricingConfiguration')}
              </h3>
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Use Base Pricing Toggle */}
                <div className="form-group">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      name="is_using_base_pricing"
                      checked={formData.is_using_base_pricing}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-medium text-gray-700">{t('useBasePricing')}</span>
                      <p className="text-sm text-gray-500">{t('useBasePricingDescription')}</p>
                    </div>
                  </label>
                </div>

                {/* Custom Pricing Fields */}
                {!formData.is_using_base_pricing && (
                  <>
                    <div className="form-group">
                      <label className="form-label flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-500" />
                        {t('pricePerMile')}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          name="price_per_mile"
                          className="form-input pl-8"
                          value={formData.price_per_mile}
                          onChange={handleInputChange}
                          min="0.50"
                          max="10.00"
                          step="0.25"
                          placeholder="2.50"
                          required
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {t('pricePerMileDescription')}
                      </p>
                    </div>

                    <div className="form-group">
                      <label className="form-label flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-500" />
                        {t('pickupFee')}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          name="pickup_fee"
                          className="form-input pl-8"
                          value={formData.pickup_fee}
                          onChange={handleInputChange}
                          min="10.00"
                          max="100.00"
                          step="5.00"
                          placeholder="25.00"
                          required
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {t('pickupFeeDescription')}
                      </p>
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <Save className="h-5 w-5" />
                  )}
                  {t('save')}
                </button>
              </form>
            </div>
          </div>

          {/* Price Examples */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">
                {t('priceExamples')}
              </h3>
            </div>
            <div className="card-body space-y-4">
              {[
                { distance: 5, description: t('shortDistance') },
                { distance: 15, description: t('mediumDistance') },
                { distance: 30, description: t('longDistance') }
              ].map((example) => (
                <div key={example.distance} className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-700">
                        {example.description} ({example.distance} {t('miles')})
                      </p>
                      <p className="text-sm text-gray-500">
                        {t('pickupFee')}: {formatPrice(formData.pickup_fee)} + 
                        {' '}{example.distance} × {formatPrice(formData.price_per_mile)} {t('perMile')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600">
                        {formatPrice(calculateExamplePrice(example.distance))}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Competition Info */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">{t('pricingTips')}</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• {t('competitivePricingTip')}</li>
                  <li>• {t('qualityServiceTip')}</li>
                  <li>• {t('quickResponseTip')}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverPricing;