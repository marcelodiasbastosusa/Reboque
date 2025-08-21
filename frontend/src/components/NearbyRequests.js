import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { useTranslation } from '../hooks/useTranslation';
import { 
  Navigation, 
  MapPin, 
  Clock, 
  DollarSign,
  RefreshCw,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

const NearbyRequests = () => {
  const { api, user } = useAuth();
  const { t, formatPrice } = useTranslation();
  const [nearbyRequests, setNearbyRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [driverLocation, setDriverLocation] = useState(null);
  const [locationError, setLocationError] = useState('');

  useEffect(() => {
    if (user?.role === 'driver') {
      getCurrentLocation();
      // Auto-refresh every 30 seconds
      const interval = setInterval(fetchNearbyRequests, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setDriverLocation(location);
          updateDriverLocation(location);
          fetchNearbyRequests();
        },
        (error) => {
          console.error('Geolocation error:', error);
          setLocationError(t('locationError'));
          // Still fetch requests even without precise location
          fetchNearbyRequests();
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000 // Cache for 1 minute
        }
      );
    } else {
      setLocationError(t('geolocationNotSupported'));
      fetchNearbyRequests();
    }
  };

  const updateDriverLocation = async (location) => {
    try {
      await api.put('/drivers/location', null, {
        params: { lat: location.lat, lng: location.lng }
      });
    } catch (error) {
      console.error('Error updating driver location:', error);
    }
  };

  const fetchNearbyRequests = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await api.get('/tow-requests/nearby', {
        params: { max_distance: 50 } // 50km radius
      });
      setNearbyRequests(response.data);
    } catch (error) {
      console.error('Error fetching nearby requests:', error);
      setError(error.response?.data?.detail || t('errorFetchingRequests'));
    } finally {
      setLoading(false);
    }
  };

  const acceptRequest = async (requestId) => {
    try {
      await api.post(`/tow-requests/${requestId}/accept`);
      
      // Remove accepted request from list and refresh
      setNearbyRequests(prev => prev.filter(req => req.id !== requestId));
      
      // Show success message
      alert(t('requestAcceptedSuccess'));
      
    } catch (error) {
      console.error('Error accepting request:', error);
      alert(t('error') + ': ' + (error.response?.data?.detail || t('unknownError')));
    }
  };

  const formatDistance = (distanceKm) => {
    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)}m`;
    }
    return `${distanceKm} ${t('km')}`;
  };

  const getTimeAgo = (dateString) => {
    const now = new Date();
    const requestDate = new Date(dateString);
    const diffMs = now - requestDate;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return t('justNow');
    if (diffMins < 60) return `${diffMins} min`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d`;
  };

  if (user?.role !== 'driver') {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{t('nearbyRequests')}</h2>
          {driverLocation && (
            <p className="text-sm text-gray-600">
              📍 {t('yourLocation')}: {driverLocation.lat.toFixed(4)}, {driverLocation.lng.toFixed(4)}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {locationError && (
            <span className="text-xs text-yellow-600 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {locationError}
            </span>
          )}
          <button
            onClick={() => {
              getCurrentLocation();
              fetchNearbyRequests();
            }}
            disabled={loading}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('loading')}...</p>
        </div>
      )}

      {/* Nearby Requests List */}
      {!loading && (
        <div className="space-y-4">
          {nearbyRequests.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {t('noNearbyRequests')}
              </h3>
              <p className="text-gray-600">
                {t('noRequestsInArea')}
              </p>
            </div>
          ) : (
            nearbyRequests.map((request) => (
              <div 
                key={request.id} 
                className="card hover:shadow-lg transition-shadow animate-fade-in border-l-4 border-l-blue-500"
              >
                <div className="card-body">
                  {/* Header with distance and time */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-100 p-2 rounded-full">
                        <Navigation className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                          📍 {formatDistance(request.distance_km)} {t('away')}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {getTimeAgo(request.created_at)}
                        </p>
                      </div>
                    </div>
                    
                    {request.proposed_price && (
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-600">
                          {formatPrice(request.proposed_price)}
                        </p>
                        <p className="text-xs text-gray-500">{t('suggestedPrice')}</p>
                      </div>
                    )}
                  </div>

                  {/* Locations */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-start gap-3">
                      <div className="w-3 h-3 bg-green-500 rounded-full mt-1 flex-shrink-0"></div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-700">{t('pickup')}</p>
                        <p className="text-sm text-gray-600 truncate">{request.pickup_address}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className="w-3 h-3 bg-red-500 rounded-full mt-1 flex-shrink-0"></div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-700">{t('delivery')}</p>
                        <p className="text-sm text-gray-600 truncate">{request.dropoff_address}</p>
                      </div>
                    </div>
                  </div>

                  {/* Vehicle Info */}
                  {request.vehicle_info && (
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium text-gray-700 mb-1">{t('vehicleInfo')}</p>
                      <p className="text-sm text-gray-600">{request.vehicle_info}</p>
                    </div>
                  )}

                  {/* Notes */}
                  {request.notes && (
                    <div className="mb-4 p-3 bg-yellow-50 rounded-lg">
                      <p className="text-sm font-medium text-gray-700 mb-1">{t('notes')}</p>
                      <p className="text-sm text-gray-600">{request.notes}</p>
                    </div>
                  )}

                  {/* Action Button */}
                  <div className="flex gap-3 pt-3 border-t border-gray-200">
                    <button
                      onClick={() => acceptRequest(request.id)}
                      className="btn-primary flex-1 flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="h-4 w-4" />
                      {t('accept')} • {formatDistance(request.distance_km)}
                    </button>
                    
                    <button className="btn-secondary px-4">
                      {t('viewDetails')}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Auto-refresh indicator */}
      <div className="text-center text-xs text-gray-500">
        <RefreshCw className="h-3 w-3 inline mr-1" />
        {t('autoRefreshEvery30Seconds')}
      </div>
    </div>
  );
};

export default NearbyRequests;