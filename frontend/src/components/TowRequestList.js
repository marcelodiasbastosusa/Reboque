import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App';
import { 
  ArrowLeft, 
  MapPin, 
  Clock, 
  DollarSign,
  Navigation,
  CheckCircle,
  AlertCircle,
  Filter,
  Search
} from 'lucide-react';

const TowRequestList = () => {
  const { api, user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchRequests();
  }, []);

  useEffect(() => {
    filterRequests();
  }, [requests, filter, searchTerm]);

  const fetchRequests = async () => {
    try {
      const response = await api.get('/tow-requests');
      setRequests(response.data);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterRequests = () => {
    let filtered = requests;

    // Filter by status
    if (filter !== 'all') {
      filtered = filtered.filter(request => request.status === filter);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(request =>
        request.pickup_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.dropoff_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (request.vehicle_info && request.vehicle_info.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    setFilteredRequests(filtered);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'accepted': return <CheckCircle className="h-4 w-4" />;
      case 'on_mission': return <Navigation className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'cancelled': return <AlertCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
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

  const handleAcceptRequest = async (requestId) => {
    try {
      await api.post(`/tow-requests/${requestId}/accept`);
      // Refresh the list
      fetchRequests();
    } catch (error) {
      console.error('Error accepting request:', error);
      alert('Erro ao aceitar solicitação: ' + (error.response?.data?.detail || 'Erro desconhecido'));
    }
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
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="text-gray-600 hover:text-gray-800">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">Solicitações de Reboque</h1>
        </div>
      </header>

      <div className="px-6 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Filters */}
          <div className="card mb-8">
            <div className="card-body">
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Search */}
                <div className="flex-1">
                  <div className="relative">
                    <Search className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar por endereço ou veículo..."
                      className="form-input pl-10"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                {/* Status Filter */}
                <div className="sm:w-48">
                  <div className="relative">
                    <Filter className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                    <select
                      className="form-select pl-10"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option value="all">Todos os Status</option>
                      <option value="pending">Pendente</option>
                      <option value="accepted">Aceito</option>
                      <option value="on_mission">Em Andamento</option>
                      <option value="completed">Concluído</option>
                      <option value="cancelled">Cancelado</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Results Summary */}
          <div className="mb-6">
            <p className="text-gray-600">
              {filteredRequests.length} {filteredRequests.length === 1 ? 'solicitação encontrada' : 'solicitações encontradas'}
            </p>
          </div>

          {/* Requests List */}
          {filteredRequests.length === 0 ? (
            <div className="card">
              <div className="card-body text-center py-12">
                <MapPin className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Nenhuma solicitação encontrada
                </h3>
                <p className="text-gray-600 mb-6">
                  {searchTerm || filter !== 'all' 
                    ? 'Tente ajustar os filtros de busca'
                    : 'Não há solicitações de reboque no momento'
                  }
                </p>
                {(user.role === 'client' || user.role === 'dealer') && !searchTerm && filter === 'all' && (
                  <Link to="/create-request" className="btn-primary">
                    Criar Nova Solicitação
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredRequests.map((request) => (
                <div key={request.id} className="card hover:shadow-lg transition-shadow animate-fade-in">
                  <div className="card-body">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(request.status)}
                        <span className={`status-${request.status}`}>
                          {getStatusText(request.status)}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">
                          {new Date(request.created_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
                      {/* Locations */}
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="w-4 h-4 bg-green-500 rounded-full mt-1 flex-shrink-0"></div>
                          <div>
                            <p className="text-sm font-medium text-gray-700">Local de Coleta</p>
                            <p className="text-sm text-gray-600">{request.pickup_address}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-4 h-4 bg-red-500 rounded-full mt-1 flex-shrink-0"></div>
                          <div>
                            <p className="text-sm font-medium text-gray-700">Local de Entrega</p>
                            <p className="text-sm text-gray-600">{request.dropoff_address}</p>
                          </div>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="space-y-3">
                        {request.vehicle_info && (
                          <div>
                            <p className="text-sm font-medium text-gray-700">Veículo</p>
                            <p className="text-sm text-gray-600">{request.vehicle_info}</p>
                          </div>
                        )}
                        {request.proposed_price && (
                          <div>
                            <p className="text-sm font-medium text-gray-700">Preço Sugerido</p>
                            <p className="text-sm font-semibold text-green-600 flex items-center gap-1">
                              <DollarSign className="h-4 w-4" />
                              R$ {request.proposed_price.toFixed(2)}
                            </p>
                          </div>
                        )}
                        {request.notes && (
                          <div>
                            <p className="text-sm font-medium text-gray-700">Observações</p>
                            <p className="text-sm text-gray-600">{request.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                      <Link
                        to={`/requests/${request.id}`}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Ver detalhes →
                      </Link>

                      {/* Action Buttons based on user role */}
                      <div className="flex gap-2">
                        {(user.role === 'driver' || user.role === 'tow_company') && 
                         request.status === 'pending' && (
                          <button
                            onClick={() => handleAcceptRequest(request.id)}
                            className="btn-primary btn-sm"
                          >
                            Aceitar
                          </button>
                        )}
                        
                        {user.role === 'admin' && (
                          <span className="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded">
                            Admin View
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TowRequestList;