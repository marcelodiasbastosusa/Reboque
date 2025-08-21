import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { Loader } from '@googlemaps/js-api-loader';
import { 
  ArrowLeft, 
  MapPin, 
  Clock, 
  DollarSign,
  Navigation,
  CheckCircle,
  AlertCircle,
  Car,
  FileText,
  User,
  Phone
} from 'lucide-react';

const TowRequestDetail = () => {
  const { id } = useParams();
  const { api, user } = useAuth();
  const navigate = useNavigate();
  const mapRef = useRef(null);
  
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [map, setMap] = useState(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchRequest();
  }, [id]);

  useEffect(() => {
    if (request) {
      initializeMap();
    }
  }, [request]);

  const fetchRequest = async () => {
    try {
      const response = await api.get(`/tow-requests/${id}`);
      setRequest(response.data);
    } catch (error) {
      console.error('Error fetching request:', error);
      setError('Solicitação não encontrada');
    } finally {
      setLoading(false);
    }
  };

  const initializeMap = async () => {
    if (!request || !mapRef.current) return;

    try {
      const loader = new Loader({
        apiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
        version: 'weekly',
        libraries: ['places', 'geometry']
      });

      const google = await loader.load();
      
      const mapInstance = new google.maps.Map(mapRef.current, {
        center: { lat: request.pickup_lat, lng: request.pickup_lng },
        zoom: 13,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      });

      // Add pickup marker
      new google.maps.Marker({
        position: { lat: request.pickup_lat, lng: request.pickup_lng },
        map: mapInstance,
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

      // Add dropoff marker
      new google.maps.Marker({
        position: { lat: request.dropoff_lat, lng: request.dropoff_lng },
        map: mapInstance,
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

      // Add route
      const directionsService = new google.maps.DirectionsService();
      const directionsRenderer = new google.maps.DirectionsRenderer({
        draggable: false,
        markerOptions: { visible: false }
      });
      
      directionsRenderer.setMap(mapInstance);

      directionsService.route(
        {
          origin: { lat: request.pickup_lat, lng: request.pickup_lng },
          destination: { lat: request.dropoff_lat, lng: request.dropoff_lng },
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === 'OK') {
            directionsRenderer.setDirections(result);
          }
        }
      );

      setMap(mapInstance);
    } catch (error) {
      console.error('Error loading Google Maps:', error);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <Clock className="h-5 w-5" />;
      case 'accepted': return <CheckCircle className="h-5 w-5" />;
      case 'on_mission': return <Navigation className="h-5 w-5" />;
      case 'completed': return <CheckCircle className="h-5 w-5" />;
      case 'cancelled': return <AlertCircle className="h-5 w-5" />;
      default: return <Clock className="h-5 w-5" />;
    }
  };

  const getStatusText = (status) => {
    const statusMap = {
      'pending': 'Pendente',
      'accepted': 'Aceito',
      'on_mission': 'Em Andamento',
      'completed': 'Concluído',
      'cancelled': 'Cancelado'
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status) => {
    const colorMap = {
      'pending': 'text-yellow-600 bg-yellow-100',
      'accepted': 'text-blue-600 bg-blue-100',
      'on_mission': 'text-purple-600 bg-purple-100',
      'completed': 'text-green-600 bg-green-100',
      'cancelled': 'text-red-600 bg-red-100'
    };
    return colorMap[status] || 'text-gray-600 bg-gray-100';
  };

  const handleAcceptRequest = async () => {
    setUpdating(true);
    try {
      await api.post(`/tow-requests/${id}/accept`);
      await fetchRequest(); // Refresh the request data
    } catch (error) {
      console.error('Error accepting request:', error);
      alert('Erro ao aceitar solicitação: ' + (error.response?.data?.detail || 'Erro desconhecido'));
    } finally {
      setUpdating(false);
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    setUpdating(true);
    try {
      await api.put(`/tow-requests/${id}`, { status: newStatus });
      await fetchRequest(); // Refresh the request data
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Erro ao atualizar status: ' + (error.response?.data?.detail || 'Erro desconhecido'));
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Solicitação não encontrada</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Link to="/requests" className="btn-primary">
            Voltar às solicitações
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="navbar px-6 py-4">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <Link to="/requests" className="text-gray-600 hover:text-gray-800">
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <h1 className="text-xl font-semibold text-gray-900">Detalhes da Solicitação</h1>
          </div>
          
          {/* Status Badge */}
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${getStatusColor(request.status)}`}>
            {getStatusIcon(request.status)}
            <span className="font-medium">{getStatusText(request.status)}</span>
          </div>
        </div>
      </header>

      <div className="px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Map Section */}
            <div className="space-y-6">
              <div className="card">
                <div className="card-header">
                  <h3 className="text-lg font-semibold text-gray-900">Rota do Reboque</h3>
                </div>
                <div className="card-body">
                  <div 
                    ref={mapRef} 
                    className="map-container-full"
                    style={{ minHeight: '400px' }}
                  />
                </div>
              </div>

              {/* Location Details */}
              <div className="card">
                <div className="card-header">
                  <h3 className="text-lg font-semibold text-gray-900">Locais</h3>
                </div>
                <div className="card-body space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-bold mt-1">
                      A
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Local de Coleta</p>
                      <p className="text-gray-600">{request.pickup_address}</p>
                      <p className="text-sm text-gray-500">
                        {request.pickup_lat.toFixed(6)}, {request.pickup_lng.toFixed(6)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-sm font-bold mt-1">
                      B
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Local de Entrega</p>
                      <p className="text-gray-600">{request.dropoff_address}</p>
                      <p className="text-sm text-gray-500">
                        {request.dropoff_lat.toFixed(6)}, {request.dropoff_lng.toFixed(6)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Details Section */}
            <div className="space-y-6">
              {/* Request Info */}
              <div className="card">
                <div className="card-header">
                  <h3 className="text-lg font-semibold text-gray-900">Informações da Solicitação</h3>
                </div>
                <div className="card-body space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Data de Criação</p>
                      <p className="text-gray-900">
                        {new Date(request.created_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium text-gray-700">Última Atualização</p>
                      <p className="text-gray-900">
                        {new Date(request.updated_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>

                  {request.vehicle_info && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <Car className="h-4 w-4" />
                        Informações do Veículo
                      </p>
                      <p className="text-gray-900">{request.vehicle_info}</p>
                    </div>
                  )}

                  {request.proposed_price && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Preço Sugerido
                      </p>
                      <p className="text-lg font-semibold text-green-600">
                        R$ {request.proposed_price.toFixed(2)}
                      </p>
                    </div>
                  )}

                  {request.notes && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Observações
                      </p>
                      <p className="text-gray-900">{request.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="card">
                <div className="card-header">
                  <h3 className="text-lg font-semibold text-gray-900">Ações</h3>
                </div>
                <div className="card-body space-y-4">
                  {/* Driver/Company Actions */}
                  {(user.role === 'driver' || user.role === 'tow_company') && (
                    <div className="space-y-2">
                      {request.status === 'pending' && (
                        <button
                          onClick={handleAcceptRequest}
                          disabled={updating}
                          className="btn-primary w-full flex items-center justify-center gap-2"
                        >
                          {updating ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          ) : (
                            <>
                              <CheckCircle className="h-5 w-5" />
                              Aceitar Solicitação
                            </>
                          )}
                        </button>
                      )}
                      
                      {request.status === 'accepted' && user.role === 'driver' && (
                        <button
                          onClick={() => handleStatusUpdate('on_mission')}
                          disabled={updating}
                          className="btn-primary w-full flex items-center justify-center gap-2"
                        >
                          {updating ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          ) : (
                            <>
                              <Navigation className="h-5 w-5" />
                              Iniciar Missão
                            </>
                          )}
                        </button>
                      )}
                      
                      {request.status === 'on_mission' && user.role === 'driver' && (
                        <button
                          onClick={() => handleStatusUpdate('completed')}
                          disabled={updating}
                          className="btn-primary w-full flex items-center justify-center gap-2"
                        >
                          {updating ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          ) : (
                            <>
                              <CheckCircle className="h-5 w-5" />
                              Concluir Reboque
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Contact Actions */}
                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-sm font-medium text-gray-700 mb-2">Precisa de ajuda?</p>
                    <div className="flex gap-2">
                      <button className="btn-secondary flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Contato
                      </button>
                      <button className="btn-secondary flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        Reportar Problema
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TowRequestDetail;