import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App';
import { 
  ArrowLeft,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Truck,
  Shield,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

const AdminPanel = () => {
  const { api, user } = useAuth();
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchPendingApprovals();
    }
  }, [user]);

  const fetchPendingApprovals = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/pending-approvals');
      setPendingUsers(response.data);
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
    } finally {
      setLoading(false);
    }
  };

  const approveUser = async (userId, userName) => {
    setApproving(true);
    try {
      await api.post(`/admin/approve-user/${userId}`);
      
      // Remove user from pending list
      setPendingUsers(prev => prev.filter(u => u.id !== userId));
      
      alert(`✅ Usuário ${userName} aprovado com sucesso!`);
    } catch (error) {
      console.error('Error approving user:', error);
      alert('❌ Erro ao aprovar usuário: ' + (error.response?.data?.detail || 'Erro desconhecido'));
    } finally {
      setApproving(false);
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'driver': return <User className="h-5 w-5 text-blue-600" />;
      case 'tow_company': return <Truck className="h-5 w-5 text-purple-600" />;
      case 'admin': return <Shield className="h-5 w-5 text-red-600" />;
      default: return <Users className="h-5 w-5 text-gray-600" />;
    }
  };

  const getRoleText = (role) => {
    const roleMap = {
      'client': 'Cliente',
      'dealer': 'Concessionária',
      'tow_company': 'Empresa de Reboque',
      'driver': 'Motorista',
      'admin': 'Administrador'
    };
    return roleMap[role] || role;
  };

  const getRoleBadgeColor = (role) => {
    const colorMap = {
      'driver': 'bg-blue-100 text-blue-800',
      'tow_company': 'bg-purple-100 text-purple-800',
      'admin': 'bg-red-100 text-red-800',
      'client': 'bg-green-100 text-green-800',
      'dealer': 'bg-yellow-100 text-yellow-800'
    };
    return colorMap[role] || 'bg-gray-100 text-gray-800';
  };

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Acesso Negado</h2>
          <p className="text-gray-600 mb-4">Apenas administradores podem acessar esta página.</p>
          <Link to="/dashboard" className="btn-primary">
            Voltar ao Dashboard
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
            <Link to="/dashboard" className="text-gray-600 hover:text-gray-800">
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <h1 className="text-xl font-semibold text-gray-900">Painel Administrativo</h1>
          </div>
          
          <button
            onClick={fetchPendingApprovals}
            disabled={loading}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </header>

      <div className="px-6 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="card">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Aprovações Pendentes</p>
                    <p className="text-3xl font-bold text-yellow-600">{pendingUsers.length}</p>
                  </div>
                  <div className="bg-yellow-100 p-3 rounded-full">
                    <Clock className="h-6 w-6 text-yellow-600" />
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Motoristas Pendentes</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {pendingUsers.filter(u => u.role === 'driver').length}
                    </p>
                  </div>
                  <div className="bg-blue-100 p-3 rounded-full">
                    <User className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Empresas Pendentes</p>
                    <p className="text-3xl font-bold text-purple-600">
                      {pendingUsers.filter(u => u.role === 'tow_company').length}
                    </p>
                  </div>
                  <div className="bg-purple-100 p-3 rounded-full">
                    <Truck className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pending Approvals */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">
                Usuários Pendentes de Aprovação
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Motoristas e empresas de reboque precisam de aprovação administrativa antes de poderem fazer login
              </p>
            </div>
            <div className="card-body">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-gray-600">Carregando...</span>
                </div>
              ) : pendingUsers.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Nenhuma aprovação pendente
                  </h3>
                  <p className="text-gray-600">
                    Todos os usuários que precisam de aprovação já foram processados.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingUsers.map((pendingUser) => (
                    <div key={pendingUser.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="bg-gray-100 p-3 rounded-full">
                            {getRoleIcon(pendingUser.role)}
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="text-lg font-semibold text-gray-900">
                                {pendingUser.full_name}
                              </h4>
                              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRoleBadgeColor(pendingUser.role)}`}>
                                {getRoleText(pendingUser.role)}
                              </span>
                            </div>
                            
                            <div className="space-y-2">
                              <p className="text-gray-600">
                                <span className="font-medium">Email:</span> {pendingUser.email}
                              </p>
                              {pendingUser.phone && (
                                <p className="text-gray-600">
                                  <span className="font-medium">Telefone:</span> {pendingUser.phone}
                                </p>
                              )}
                              <p className="text-sm text-gray-500">
                                <span className="font-medium">Cadastrado em:</span>{' '}
                                {new Date(pendingUser.created_at).toLocaleDateString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex gap-3">
                          <button
                            onClick={() => approveUser(pendingUser.id, pendingUser.full_name)}
                            disabled={approving}
                            className="btn-primary flex items-center gap-2"
                          >
                            {approving ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            ) : (
                              <CheckCircle className="h-4 w-4" />
                            )}
                            Aprovar
                          </button>
                          
                          <button
                            disabled={approving}
                            className="btn-secondary flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50"
                          >
                            <XCircle className="h-4 w-4" />
                            Rejeitar
                          </button>
                        </div>
                      </div>
                      
                      {pendingUser.role === 'driver' && (
                        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                          <p className="text-sm text-blue-800">
                            <strong>Lembrete:</strong> Após a aprovação, este motorista poderá fazer login e 
                            aceitar solicitações de reboque. Certifique-se de que possui documentação válida.
                          </p>
                        </div>
                      )}
                      
                      {pendingUser.role === 'tow_company' && (
                        <div className="mt-4 p-4 bg-purple-50 rounded-lg">
                          <p className="text-sm text-purple-800">
                            <strong>Lembrete:</strong> Após a aprovação, esta empresa poderá gerenciar motoristas 
                            e aceitar solicitações de reboque. Verifique a documentação da empresa.
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;