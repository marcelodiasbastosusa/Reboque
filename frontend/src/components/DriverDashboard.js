import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App';
import { useTranslation } from '../hooks/useTranslation';
import LanguageSelector from './LanguageSelector';
import NearbyRequests from './NearbyRequests';
import { 
  ArrowLeft,
  Navigation,
  MapPin,
  Clock,
  CheckCircle,
  AlertCircle,
  Power,
  User,
  Truck
} from 'lucide-react';

const DriverDashboard = () => {
  const { api, user } = useAuth();
  const { t, formatPrice } = useTranslation();
  const [driverProfile, setDriverProfile] = useState(null);
  const [availableRequests, setAvailableRequests] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    fetchDriverData();
  }, []);

  const fetchDriverData = async () => {
    try {
      // Fetch driver profile
      const profileResponse = await api.get('/drivers/profile');
      setDriverProfile(profileResponse.data);

      // Fetch all requests (API filters for driver role)
      const requestsResponse = await api.get('/tow-requests');
      const requests = requestsResponse.data;
      
      // Separate available requests from assigned requests
      const available = requests.filter(r => r.status === 'pending' && !r.assigned_driver_id);
      const assigned = requests.filter(r => r.assigned_driver_id === user.id);
      
      setAvailableRequests(available);
      setMyRequests(assigned);
    } catch (error) {
      console.error('Error fetching driver data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateDriverStatus = async (newStatus) => {
    setUpdatingStatus(true);
    try {
      await api.put('/drivers/status', null, {
        params: { status: newStatus }
      });
      setDriverProfile(prev => ({ ...prev, status: newStatus }));
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Erro ao atualizar status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const acceptRequest = async (requestId) => {
    try {
      await api.post(`/tow-requests/${requestId}/accept`);
      await fetchDriverData(); // Refresh data
    } catch (error) {
      console.error('Error accepting request:', error);
      alert('Erro ao aceitar solicitação: ' + (error.response?.data?.detail || 'Erro desconhecido'));
    }
  };

  const updateRequestStatus = async (requestId, status) => {
    try {
      await api.put(`/tow-requests/${requestId}`, { status });
      await fetchDriverData(); // Refresh data
    } catch (error) {
      console.error('Error updating request status:', error);
      alert('Erro ao atualizar status da solicitação');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'offline': return <Power className="h-4 w-4" />;
      case 'available': return <CheckCircle className="h-4 w-4" />;
      case 'on_mission': return <Navigation className="h-4 w-4" />;
      default: return <Power className="h-4 w-4" />;
    }
  };

  const getStatusText = (status) => {
    const statusMap = {
      'offline': 'Offline',
      'available': 'Disponível',
      'on_mission': 'Em Missão'
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status) => {
    const colorMap = {
      'offline': 'text-gray-600 bg-gray-100',
      'available': 'text-green-600 bg-green-100',
      'on_mission': 'text-purple-600 bg-purple-100'
    };
    return colorMap[status] || 'text-gray-600 bg-gray-100';
  };

  const getRequestStatusText = (status) => {
    const statusMap = {
      'pending': 'Pendente',
      'accepted': 'Aceito',
      'on_mission': 'Em Andamento',
      'completed': 'Concluído',
      'cancelled': 'Cancelado'
    };
    return statusMap[status] || status;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="navbar px-6 py-4">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="text-gray-600 hover:text-gray-800">
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <h1 className="text-xl font-semibold text-gray-900">{t('driverDashboard')}</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <LanguageSelector />
            
            {/* Status Control */}
            {driverProfile && (
              <>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${getStatusColor(driverProfile.status)}`}>
                  {getStatusIcon(driverProfile.status)}
                  <span className="font-medium">{getStatusText(driverProfile.status)}</span>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => updateDriverStatus('offline')}
                    disabled={updatingStatus}
                    className={`btn-sm ${driverProfile.status === 'offline' ? 'bg-gray-500 text-white cursor-not-allowed' : 'btn-secondary'}`}
                  >
                    {t('offline')}
                  </button>
                  <button
                    onClick={() => updateDriverStatus('available')}
                    disabled={updatingStatus || driverProfile.status === 'on_mission'}
                    className={`btn-sm ${driverProfile.status === 'available' ? 'bg-green-500 text-white cursor-not-allowed' : 'btn-secondary'} ${driverProfile.status === 'on_mission' ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    {t('available')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="px-6 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Driver Stats */}
          {driverProfile && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="card">
                <div className="card-body">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Total de Trabalhos</p>
                      <p className="text-3xl font-bold text-gray-900">{driverProfile.total_jobs}</p>
                    </div>
                    <div className="bg-blue-100 p-3 rounded-full">
                      <Truck className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-body">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Avaliação</p>
                      <p className="text-3xl font-bold text-yellow-600">{driverProfile.rating.toFixed(1)}</p>
                    </div>
                    <div className="bg-yellow-100 p-3 rounded-full">
                      <User className="h-6 w-6 text-yellow-600" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-body">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Trabalhos Ativos</p>
                      <p className="text-3xl font-bold text-purple-600">
                        {myRequests.filter(r => r.status === 'accepted' || r.status === 'on_mission').length}
                      </p>
                    </div>
                    <div className="bg-purple-100 p-3 rounded-full">
                      <Navigation className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Nearby Requests - New Uber-like System */}
            <div className="space-y-6">
              <NearbyRequests />
            </div>

            {/* My Requests */}
            <div className="space-y-6">
              <div className="card">
                <div className="card-header">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {t('myJobs')} ({myRequests.length})
                  </h3>
                </div>
                <div className="card-body">
                  {myRequests.length === 0 ? (
                    <div className="text-center py-8">
                      <Navigation className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">{t('noAssignedJobs')}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {myRequests.map((request) => (
                        <div key={request.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className={`status-${request.status}`}>
                                {getRequestStatusText(request.status)}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500">
                              {new Date(request.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          
                          <div className="space-y-2 mb-3">
                            <p className="text-sm">
                              <span className="font-medium">{t('pickup')}:</span> {request.pickup_address}
                            </p>
                            <p className="text-sm">
                              <span className="font-medium">{t('delivery')}:</span> {request.dropoff_address}
                            </p>
                            {request.proposed_price && (
                              <p className="text-sm font-semibold text-green-600">
                                {formatPrice(request.proposed_price)}
                              </p>
                            )}
                          </div>
                          
                          <div className="flex gap-2">
                            {request.status === 'accepted' && (
                              <button
                                onClick={() => updateRequestStatus(request.id, 'on_mission')}
                                className="btn-primary btn-sm"
                              >
                                {t('start')}
                              </button>
                            )}
                            {request.status === 'on_mission' && (
                              <button
                                onClick={() => updateRequestStatus(request.id, 'completed')}
                                className="btn-primary btn-sm"
                              >
                                {t('complete')}
                              </button>
                            )}
                            <Link 
                              to={`/requests/${request.id}`}
                              className="btn-secondary btn-sm flex-1"
                            >
                              {t('viewDetails')}
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverDashboard;