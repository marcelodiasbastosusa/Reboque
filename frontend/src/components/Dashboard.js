import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { 
  Truck, 
  Plus, 
  List, 
  User, 
  LogOut, 
  MapPin, 
  Clock,
  CheckCircle,
  AlertCircle,
  Navigation
} from 'lucide-react';

const Dashboard = () => {
  const { user, logout, api } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalRequests: 0,
    pendingRequests: 0,
    completedRequests: 0,
    onMissionRequests: 0
  });
  const [recentRequests, setRecentRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await api.get('/tow-requests');
      const requests = response.data;
      
      setRecentRequests(requests.slice(0, 5));
      
      // Calculate stats
      const stats = {
        totalRequests: requests.length,
        pendingRequests: requests.filter(r => r.status === 'pending').length,
        completedRequests: requests.filter(r => r.status === 'completed').length,
        onMissionRequests: requests.filter(r => r.status === 'on_mission').length
      };
      setStats(stats);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
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

  const getRoleTitle = (role) => {
    const roleMap = {
      'client': 'Cliente',
      'dealer': 'Concessionária',
      'tow_company': 'Empresa de Reboque',
      'driver': 'Motorista',
      'admin': 'Administrador'
    };
    return roleMap[role] || role;
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
            <Truck className="h-8 w-8 text-blue-600" />
            <h1 className="navbar-brand">TowFleets</h1>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-gray-500" />
              <span className="font-medium text-gray-700">{user.full_name}</span>
              <span className="text-sm text-gray-500">({getRoleTitle(user.role)})</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <LogOut className="h-5 w-5" />
              Sair
            </button>
          </div>
        </div>
      </header>

      <div className="px-6 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Welcome Section */}
          <div className="mb-8 animate-fade-in">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Bem-vindo, {user.full_name}!
            </h2>
            <p className="text-gray-600">
              Gerencie seus serviços de reboque de forma eficiente
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="card animate-slide-in">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total de Solicitações</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.totalRequests}</p>
                  </div>
                  <div className="bg-blue-100 p-3 rounded-full">
                    <List className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </div>
            </div>

            <div className="card animate-slide-in" style={{ animationDelay: '0.1s' }}>
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Pendentes</p>
                    <p className="text-3xl font-bold text-yellow-600">{stats.pendingRequests}</p>
                  </div>
                  <div className="bg-yellow-100 p-3 rounded-full">
                    <Clock className="h-6 w-6 text-yellow-600" />
                  </div>
                </div>
              </div>
            </div>

            <div className="card animate-slide-in" style={{ animationDelay: '0.2s' }}>
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Em Andamento</p>
                    <p className="text-3xl font-bold text-purple-600">{stats.onMissionRequests}</p>
                  </div>
                  <div className="bg-purple-100 p-3 rounded-full">
                    <Navigation className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </div>
            </div>

            <div className="card animate-slide-in" style={{ animationDelay: '0.3s' }}>
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Concluídos</p>
                    <p className="text-3xl font-bold text-green-600">{stats.completedRequests}</p>
                  </div>
                  <div className="bg-green-100 p-3 rounded-full">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Actions Panel */}
            <div className="lg:col-span-1">
              <div className="card animate-slide-in">
                <div className="card-header">
                  <h3 className="text-lg font-semibold text-gray-900">Ações Rápidas</h3>
                </div>
                <div className="card-body space-y-4">
                  {(user.role === 'client' || user.role === 'dealer') && (
                    <Link
                      to="/create-request"
                      className="btn-primary w-full flex items-center justify-center gap-2 text-center no-underline"
                    >
                      <Plus className="h-5 w-5" />
                      Nova Solicitação
                    </Link>
                  )}
                  
                  <Link
                    to="/requests"
                    className="btn-secondary w-full flex items-center justify-center gap-2 text-center no-underline"
                  >
                    <List className="h-5 w-5" />
                    Ver Solicitações
                  </Link>

                  {user.role === 'driver' && (
                    <Link
                      to="/driver-dashboard"
                      className="btn-secondary w-full flex items-center justify-center gap-2 text-center no-underline"
                    >
                      <Navigation className="h-5 w-5" />
                      Painel do Motorista
                    </Link>
                  )}

                  {user.role === 'admin' && (
                    <Link
                      to="/admin"
                      className="btn-secondary w-full flex items-center justify-center gap-2 text-center no-underline"
                    >
                      <User className="h-5 w-5" />
                      Painel Administrativo
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Recent Requests */}
            <div className="lg:col-span-2">
              <div className="card animate-slide-in">
                <div className="card-header">
                  <h3 className="text-lg font-semibold text-gray-900">Solicitações Recentes</h3>
                </div>
                <div className="card-body">
                  {recentRequests.length === 0 ? (
                    <div className="text-center py-8">
                      <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">Nenhuma solicitação encontrada</p>
                      {(user.role === 'client' || user.role === 'dealer') && (
                        <Link
                          to="/create-request"
                          className="text-blue-600 hover:text-blue-700 font-medium mt-2 inline-block"
                        >
                          Criar primeira solicitação
                        </Link>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {recentRequests.map((request) => (
                        <div key={request.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(request.status)}
                              <span className={`status-${request.status}`}>
                                {getStatusText(request.status)}
                              </span>
                            </div>
                            <span className="text-sm text-gray-500">
                              {new Date(request.created_at).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          <div className="space-y-1">
                            <p className="font-medium text-gray-900">
                              {request.pickup_address}
                            </p>
                            <p className="text-sm text-gray-600">
                              → {request.dropoff_address}
                            </p>
                            {request.proposed_price && (
                              <p className="text-sm font-medium text-green-600">
                                Preço sugerido: R$ {request.proposed_price.toFixed(2)}
                              </p>
                            )}
                          </div>
                          <div className="mt-3">
                            <Link
                              to={`/requests/${request.id}`}
                              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                            >
                              Ver detalhes →
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

export default Dashboard;