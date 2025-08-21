import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../App';
import { useTranslation } from '../hooks/useTranslation';
import LanguageSelector from './LanguageSelector';
import { Loader } from '@googlemaps/js-api-loader';
import { 
  ArrowLeft, 
  MapPin, 
  DollarSign, 
  Car, 
  FileText, 
  Navigation,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

const CreateTowRequest = () => {
  const { api } = useAuth();
  const { t, formatPrice } = useTranslation();
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [pickupMarker, setPickupMarker] = useState(null);
  const [dropoffMarker, setDropoffMarker] = useState(null);
  const [directionsService, setDirectionsService] = useState(null);
  const [directionsRenderer, setDirectionsRenderer] = useState(null);
  
  const [formData, setFormData] = useState({
    pickup_address: '',
    pickup_lat: null,
    pickup_lng: null,
    dropoff_address: '',
    dropoff_lat: null,
    dropoff_lng: null,
    vehicle_info: '',
    proposed_price: '',
    notes: ''
  });
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectingPickup, setSelectingPickup] = useState(true);

  useEffect(() => {
    const initMap = async () => {
      try {
        await initializeMap();
      } catch (err) {
        console.error('Map initialization error:', err);
        setError(t('errorLoadingMap'));
      }
    };
    
    initMap();
  }, []);

  const initializeMap = async () => {
    if (!process.env.REACT_APP_GOOGLE_MAPS_API_KEY) {
      setError('Google Maps API key not configured');
      return;
    }

    try {
      const loader = new Loader({
        apiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
        version: 'weekly',
        libraries: ['places', 'geometry']
      });

      const google = await loader.load();
      
      // Default to a major city
      const defaultCenter = { lat: 40.7580, lng: -73.9855 }; // NYC Times Square
      
      const mapInstance = new google.maps.Map(mapRef.current, {
        center: defaultCenter,
        zoom: 12,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      });

      const directionsServiceInstance = new google.maps.DirectionsService();
      const directionsRendererInstance = new google.maps.DirectionsRenderer({
        draggable: false,
        markerOptions: { visible: false }
      });
      
      directionsRendererInstance.setMap(mapInstance);

      setMap(mapInstance);
      setDirectionsService(directionsServiceInstance);
      setDirectionsRenderer(directionsRendererInstance);
      setMapLoaded(true);

      // Add click listener to map
      mapInstance.addListener('click', (event) => {
        handleMapClick(event.latLng, google);
      });

      // Try to get user's location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const userLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            mapInstance.setCenter(userLocation);
            mapInstance.setZoom(15);
          },
          (error) => {
            console.log('Geolocation error:', error);
            // Keep default location
          },
          { timeout: 5000 }
        );
      }
    } catch (error) {
      console.error('Error loading Google Maps:', error);
      setError(t('errorLoadingMap'));
    }
  };

  const handleMapClick = async (latLng, google) => {
    const lat = latLng.lat();
    const lng = latLng.lng();

    try {
      const geocoder = new google.maps.Geocoder();
      const response = await geocoder.geocode({ location: { lat, lng } });
      
      if (response.results[0]) {
        const address = response.results[0].formatted_address;
        
        if (selectingPickup) {
          // Set pickup location
          if (pickupMarker) {
            pickupMarker.setMap(null);
          }
          
          const marker = new google.maps.Marker({
            position: { lat, lng },
            map: map,
            title: 'Local de Coleta',
            icon: {
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="16" cy="16" r="12" fill="#22c55e" stroke="white" stroke-width="3"/>
                  <text x="16" y="21" text-anchor="middle" fill="white" font-size="14" font-weight="bold">A</text>
                </svg>
              `),
              scaledSize: new google.maps.Size(32, 32)
            }
          });
          
          setPickupMarker(marker);
          setFormData(prev => ({
            ...prev,
            pickup_address: address,
            pickup_lat: lat,
            pickup_lng: lng
          }));
          
          setSelectingPickup(false);
        } else {
          // Set dropoff location
          if (dropoffMarker) {
            dropoffMarker.setMap(null);
          }
          
          const marker = new google.maps.Marker({
            position: { lat, lng },
            map: map,
            title: 'Local de Entrega',
            icon: {
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="16" cy="16" r="12" fill="#ef4444" stroke="white" stroke-width="3"/>
                  <text x="16" y="21" text-anchor="middle" fill="white" font-size="14" font-weight="bold">B</text>
                </svg>
              `),
              scaledSize: new google.maps.Size(32, 32)
            }
          });
          
          setDropoffMarker(marker);
          setFormData(prev => ({
            ...prev,
            dropoff_address: address,
            dropoff_lat: lat,
            dropoff_lng: lng
          }));
          
          // Calculate and display route
          if (formData.pickup_lat && formData.pickup_lng) {
            calculateRoute(
              { lat: formData.pickup_lat, lng: formData.pickup_lng },
              { lat, lng }
            );
          }
        }
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    }
  };

  const calculateRoute = (pickup, dropoff) => {
    if (directionsService && directionsRenderer && window.google) {
      directionsService.route(
        {
          origin: pickup,
          destination: dropoff,
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === 'OK') {
            directionsRenderer.setDirections(result);
          }
        }
      );
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const resetPickupLocation = () => {
    if (pickupMarker) {
      pickupMarker.setMap(null);
      setPickupMarker(null);
    }
    if (directionsRenderer) {
      directionsRenderer.setDirections({ routes: [] });
    }
    setFormData(prev => ({
      ...prev,
      pickup_address: '',
      pickup_lat: null,
      pickup_lng: null
    }));
    setSelectingPickup(true);
  };

  const resetDropoffLocation = () => {
    if (dropoffMarker) {
      dropoffMarker.setMap(null);
      setDropoffMarker(null);
    }
    if (directionsRenderer) {
      directionsRenderer.setDirections({ routes: [] });
    }
    setFormData(prev => ({
      ...prev,
      dropoff_address: '',
      dropoff_lat: null,
      dropoff_lng: null
    }));
    setSelectingPickup(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!formData.pickup_lat || !formData.pickup_lng || !formData.dropoff_lat || !formData.dropoff_lng) {
      setError('Por favor, selecione os locais de coleta e entrega no mapa.');
      setLoading(false);
      return;
    }

    try {
      const submitData = {
        ...formData,
        proposed_price: formData.proposed_price ? parseFloat(formData.proposed_price) : null
      };

      await api.post('/tow-requests', submitData);
      setSuccess('Solicitação criada com sucesso!');
      
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (error) {
      setError(error.response?.data?.detail || 'Erro ao criar solicitação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="navbar px-6 py-4">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="text-gray-600 hover:text-gray-800">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">Nova Solicitação de Reboque</h1>
        </div>
      </header>

      <div className="px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Map Section */}
            <div className="space-y-4">
              <div className="card">
                <div className="card-header">
                  <h3 className="text-lg font-semibold text-gray-900">Selecionar Locais</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectingPickup 
                      ? "Clique no mapa para selecionar o local de coleta" 
                      : "Clique no mapa para selecionar o local de entrega"
                    }
                  </p>
                </div>
                <div className="card-body">
                  <div 
                    ref={mapRef} 
                    className="map-container-full"
                    style={{ minHeight: '400px' }}
                  >
                    {!mapLoaded && (
                      <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="ml-2 text-gray-600">Carregando mapa...</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Location Summary */}
              <div className="card">
                <div className="card-body space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="flex items-center gap-2 font-medium text-gray-700">
                        <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                        Local de Coleta
                      </label>
                      {formData.pickup_address && (
                        <button
                          type="button"
                          onClick={resetPickupLocation}
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          Redefinir
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      {formData.pickup_address || 'Clique no mapa para selecionar'}
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="flex items-center gap-2 font-medium text-gray-700">
                        <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                        Local de Entrega
                      </label>
                      {formData.dropoff_address && (
                        <button
                          type="button"
                          onClick={resetDropoffLocation}
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          Redefinir
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      {formData.dropoff_address || 'Clique no mapa para selecionar'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Form Section */}
            <div className="space-y-6">
              <form onSubmit={handleSubmit} className="space-y-6">
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

                <div className="card">
                  <div className="card-header">
                    <h3 className="text-lg font-semibold text-gray-900">Detalhes da Solicitação</h3>
                  </div>
                  <div className="card-body space-y-6">
                    <div className="form-group">
                      <label className="form-label flex items-center gap-2">
                        <Car className="h-4 w-4 text-gray-500" />
                        Informações do Veículo
                      </label>
                      <input
                        type="text"
                        name="vehicle_info"
                        className="form-input"
                        value={formData.vehicle_info}
                        onChange={handleInputChange}
                        placeholder="Ex: Honda Civic 2020, cor prata, placa ABC-1234"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Inclua marca, modelo, cor e placa do veículo
                      </p>
                    </div>

                    <div className="form-group">
                      <label className="form-label flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-gray-500" />
                        Preço Sugerido (Opcional)
                      </label>
                      <input
                        type="number"
                        name="proposed_price"
                        className="form-input"
                        value={formData.proposed_price}
                        onChange={handleInputChange}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Valor em reais (R$) que você está disposto a pagar
                      </p>
                    </div>

                    <div className="form-group">
                      <label className="form-label flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-500" />
                        Observações Adicionais (Opcional)
                      </label>
                      <textarea
                        name="notes"
                        className="form-textarea"
                        value={formData.notes}
                        onChange={handleInputChange}
                        placeholder="Descreva detalhes importantes sobre o reboque, condições especiais, etc."
                        rows="4"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Link
                    to="/dashboard"
                    className="btn-secondary flex-1 text-center"
                  >
                    Cancelar
                  </Link>
                  <button
                    type="submit"
                    disabled={loading || !formData.pickup_lat || !formData.dropoff_lat}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <Navigation className="h-5 w-5" />
                        Criar Solicitação
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateTowRequest;