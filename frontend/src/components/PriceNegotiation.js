import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { useTranslation } from '../hooks/useTranslation';
import { 
  DollarSign, 
  MessageSquare, 
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  Send
} from 'lucide-react';

const PriceNegotiation = ({ requestId, onStatusChange }) => {
  const { api, user } = useAuth();
  const { t, formatPrice } = useTranslation();
  const [offers, setOffers] = useState([]);
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (requestId) {
      fetchRequestAndOffers();
      // Auto-refresh every 10 seconds
      const interval = setInterval(fetchRequestAndOffers, 10000);
      return () => clearInterval(interval);
    }
  }, [requestId]);

  const fetchRequestAndOffers = async () => {
    try {
      const [requestResponse, offersResponse] = await Promise.all([
        api.get(`/tow-requests/${requestId}`),
        api.get(`/tow-requests/${requestId}/offers`)
      ]);
      
      setRequest(requestResponse.data);
      setOffers(offersResponse.data);
    } catch (error) {
      console.error('Error fetching negotiation data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMakeOffer = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await api.post(`/tow-requests/${requestId}/offer`, {
        amount: parseFloat(offerAmount),
        message: offerMessage
      });

      setOfferAmount('');
      setOfferMessage('');
      setShowOfferForm(false);
      
      // Refresh offers
      await fetchRequestAndOffers();
      
      if (onStatusChange) onStatusChange();
    } catch (error) {
      console.error('Error making offer:', error);
      alert(t('error') + ': ' + (error.response?.data?.detail || t('unknownError')));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptOffer = async () => {
    try {
      await api.post(`/tow-requests/${requestId}/accept-offer`);
      await fetchRequestAndOffers();
      if (onStatusChange) onStatusChange();
      alert(t('offerAccepted'));
    } catch (error) {
      console.error('Error accepting offer:', error);
      alert(t('error') + ': ' + (error.response?.data?.detail || t('unknownError')));
    }
  };

  const handleRejectOffer = async () => {
    try {
      await api.post(`/tow-requests/${requestId}/reject-offer`);
      await fetchRequestAndOffers();
      if (onStatusChange) onStatusChange();
    } catch (error) {
      console.error('Error rejecting offer:', error);
      alert(t('error') + ': ' + (error.response?.data?.detail || t('unknownError')));
    }
  };

  const getOfferTypeText = (offerType) => {
    const typeMap = {
      'client_offer': t('clientOffer'),
      'driver_counter': t('driverOffer'),
      'system_calculated': t('calculatedPrice')
    };
    return typeMap[offerType] || offerType;
  };

  const getOfferStatusColor = (status) => {
    const colorMap = {
      'pending': 'text-yellow-600 bg-yellow-100',
      'accepted': 'text-green-600 bg-green-100',
      'rejected': 'text-red-600 bg-red-100',
      'expired': 'text-gray-600 bg-gray-100'
    };
    return colorMap[status] || 'text-gray-600 bg-gray-100';
  };

  const canMakeOffer = () => {
    if (!request) return false;
    
    // Client can make initial offer or respond to driver counter
    if (user.role === 'client' && request.client_id === user.id) {
      const latestOffer = offers[0];
      return !latestOffer || latestOffer.offer_type === 'driver_counter';
    }
    
    // Driver can make counter offer if they are assigned
    if (user.role === 'driver' && request.current_driver_id === user.id) {
      const latestOffer = offers[0];
      return latestOffer && latestOffer.offer_type === 'client_offer';
    }
    
    return false;
  };

  const canAcceptOffer = () => {
    if (!offers.length) return false;
    
    const latestOffer = offers[0];
    if (latestOffer.status !== 'pending') return false;
    
    // Driver can accept client offers
    if (user.role === 'driver' && request?.current_driver_id === user.id) {
      return latestOffer.offer_type === 'client_offer';
    }
    
    // Client can accept driver counter offers
    if (user.role === 'client' && request?.client_id === user.id) {
      return latestOffer.offer_type === 'driver_counter';
    }
    
    return false;
  };

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    );
  }

  if (!request) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Current Status */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-blue-900">{t('negotiationStatus')}</h3>
          {request.calculated_price && (
            <span className="text-sm text-blue-700">
              {t('calculatedPrice')}: {formatPrice(request.calculated_price)}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-600" />
          <span className="text-blue-800">
            {request.negotiation_status === 'awaiting_driver' && t('waitingForDriver')}
            {request.negotiation_status === 'negotiating' && t('negotiating')}
            {request.negotiation_status === 'price_agreed' && t('priceAgreed')}
          </span>
        </div>
        
        {request.final_agreed_price && (
          <div className="mt-2">
            <span className="font-semibold text-green-700">
              {t('finalPrice')}: {formatPrice(request.final_agreed_price)}
            </span>
          </div>
        )}
      </div>

      {/* Offer History */}
      {offers.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold">{t('negotiationHistory')}</h3>
          </div>
          <div className="card-body">
            <div className="space-y-4">
              {offers.map((offer, index) => (
                <div key={offer.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0">
                    <DollarSign className="h-6 w-6 text-green-600" />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{getOfferTypeText(offer.offer_type)}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getOfferStatusColor(offer.status)}`}>
                          {offer.status}
                        </span>
                      </div>
                      <span className="text-lg font-bold text-green-600">
                        {formatPrice(offer.amount)}
                      </span>
                    </div>
                    
                    {offer.message && (
                      <p className="text-sm text-gray-600 mb-2">{offer.message}</p>
                    )}
                    
                    <p className="text-xs text-gray-500">
                      {new Date(offer.created_at).toLocaleString()}
                    </p>
                  </div>

                  {/* Actions for latest pending offer */}
                  {index === 0 && offer.status === 'pending' && canAcceptOffer() && (
                    <div className="flex gap-2">
                      <button
                        onClick={handleAcceptOffer}
                        className="btn-primary btn-sm flex items-center gap-1"
                      >
                        <CheckCircle className="h-4 w-4" />
                        {t('accept')}
                      </button>
                      <button
                        onClick={handleRejectOffer}
                        className="btn-secondary btn-sm flex items-center gap-1 text-red-600"
                      >
                        <XCircle className="h-4 w-4" />
                        {t('reject')}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Make Offer Form */}
      {canMakeOffer() && (
        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {user.role === 'client' ? t('makeOffer') : t('counterOffer')}
              </h3>
              {!showOfferForm && (
                <button
                  onClick={() => setShowOfferForm(true)}
                  className="btn-primary btn-sm"
                >
                  {user.role === 'client' ? t('makeOffer') : t('counterOffer')}
                </button>
              )}
            </div>
          </div>
          
          {showOfferForm && (
            <div className="card-body">
              <form onSubmit={handleMakeOffer} className="space-y-4">
                <div className="form-group">
                  <label className="form-label">{t('offerAmount')}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      className="form-input pl-8"
                      value={offerAmount}
                      onChange={(e) => setOfferAmount(e.target.value)}
                      placeholder="0.00"
                      min="10"
                      max="1000"
                      step="5"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">{t('offerMessage')}</label>
                  <textarea
                    className="form-textarea"
                    value={offerMessage}
                    onChange={(e) => setOfferMessage(e.target.value)}
                    placeholder={t('explainYourOffer')}
                    rows="3"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={submitting || !offerAmount}
                    className="btn-primary flex items-center gap-2"
                  >
                    {submitting ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {t('sendOffer')}
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setShowOfferForm(false)}
                    className="btn-secondary"
                  >
                    {t('cancel')}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PriceNegotiation;