// Internationalization (i18n) system for TowFleets
// Supports: English (EN), Portuguese (PT), Spanish (ES)

const translations = {
  en: {
    // Authentication
    'login': 'Login',
    'register': 'Register',
    'email': 'Email',
    'password': 'Password',
    'confirmPassword': 'Confirm Password',
    'fullName': 'Full Name',
    'phone': 'Phone',
    'accountType': 'Account Type',
    'createAccount': 'Create Account',
    'alreadyHaveAccount': 'Already have an account?',
    'noAccount': "Don't have an account?",
    'loginHere': 'Login here',
    'registerHere': 'Register here',
    'logout': 'Logout',
    
    // User Roles
    'client': 'Client',
    'dealer': 'Dealership',
    'towCompany': 'Tow Company',
    'driver': 'Driver',
    'admin': 'Administrator',
    
    // Role Descriptions
    'clientDesc': 'Request tow services',
    'dealerDesc': 'Company that requests tows',
    'towCompanyDesc': 'Provide tow services',
    'driverDesc': 'Execute tow services',
    
    // Dashboard
    'welcome': 'Welcome',
    'dashboard': 'Dashboard',
    'towRequestManagement': 'Tow Request Management System',
    'quickActions': 'Quick Actions',
    'newRequest': 'New Request',
    'viewRequests': 'View Requests',
    'driverPanel': 'Driver Panel',
    'adminPanel': 'Administrative Panel',
    'recentRequests': 'Recent Requests',
    'noRequestsFound': 'No requests found',
    'createFirstRequest': 'Create first request',
    
    // Statistics
    'totalRequests': 'Total Requests',
    'pending': 'Pending',
    'inProgress': 'In Progress',
    'completed': 'Completed',
    'cancelled': 'Cancelled',
    
    // Tow Request Form
    'newTowRequest': 'New Tow Request',
    'selectLocations': 'Select Locations',
    'clickMapPickup': 'Click on map to select pickup location',
    'clickMapDropoff': 'Click on map to select delivery location',
    'pickupLocation': 'Pickup Location',
    'deliveryLocation': 'Delivery Location',
    'vehicleInfo': 'Vehicle Information',
    'vehicleInfoPlaceholder': 'Ex: Honda Civic 2020, silver, plate ABC-1234',
    'vehicleInfoDesc': 'Include brand, model, color and vehicle plate',
    'suggestedPrice': 'Suggested Price (Optional)',
    'priceDesc': 'Amount in dollars ($) you are willing to pay',
    'additionalNotes': 'Additional Notes (Optional)',
    'notesPlaceholder': 'Describe important details about the tow, special conditions, etc.',
    'requestDetails': 'Request Details',
    'cancel': 'Cancel',
    'createRequest': 'Create Request',
    'reset': 'Reset',
    'loadingMap': 'Loading map...',
    
    // Status
    'statusPending': 'Pending',
    'statusAccepted': 'Accepted',
    'statusOnMission': 'In Progress',
    'statusCompleted': 'Completed',
    'statusCancelled': 'Cancelled',
    
    // Actions
    'accept': 'Accept',
    'reject': 'Reject',
    'approve': 'Approve',
    'start': 'Start',
    'complete': 'Complete',
    'viewDetails': 'View Details',
    'update': 'Update',
    'save': 'Save',
    'back': 'Back',
    
    // Driver Dashboard
    'driverDashboard': 'Driver Dashboard',
    'availableRequests': 'Available Requests',
    'myJobs': 'My Jobs',
    'totalJobs': 'Total Jobs',
    'rating': 'Rating',
    'activeJobs': 'Active Jobs',
    'offline': 'Offline',
    'available': 'Available',
    'onMission': 'On Mission',
    'nearbyRequests': 'Nearby Requests',
    
    // Messages
    'success': 'Success',
    'error': 'Error',
    'loading': 'Loading',
    'noData': 'No data available',
    'requestCreatedSuccess': 'Request created successfully!',
    'requestAcceptedSuccess': 'Request accepted successfully!',
    'statusUpdatedSuccess': 'Status updated successfully!',
    'loginSuccessful': 'Login successful!',
    'registrationSuccessful': 'Registration successful!',
    
    // Currency
    'currency': '$',
    'priceFormat': '${{amount}}',
    
    // Driver Features
    'nearbyRequests': 'Nearby Requests',
    'yourLocation': 'Your Location',
    'away': 'away',
    'pickup': 'Pickup',
    'delivery': 'Delivery',
    'refresh': 'Refresh',
    'noNearbyRequests': 'No Nearby Requests',
    'noRequestsInArea': 'No tow requests in your area at the moment',
    'justNow': 'just now',
    'notes': 'Notes',
    'autoRefreshEvery30Seconds': 'Auto-refresh every 30 seconds',
    'locationError': 'Could not get your location',
    'geolocationNotSupported': 'Geolocation not supported',
    'errorFetchingRequests': 'Error fetching requests',
    'noAssignedJobs': 'You have no assigned jobs',
    'no': 'No',
    'close': 'Close',
    'confirm': 'Confirm',
    'date': 'Date',
    'time': 'Time',
    'location': 'Location',
    'distance': 'Distance',
    'km': 'km',
    'miles': 'miles'
  },
  
  pt: {
    // Authentication
    'login': 'Entrar',
    'register': 'Registrar',
    'email': 'Email',
    'password': 'Senha',
    'confirmPassword': 'Confirmar Senha',
    'fullName': 'Nome Completo',
    'phone': 'Telefone',
    'accountType': 'Tipo de Conta',
    'createAccount': 'Criar Conta',
    'alreadyHaveAccount': 'Já tem uma conta?',
    'noAccount': 'Não tem uma conta?',
    'loginHere': 'Faça login aqui',
    'registerHere': 'Registre-se aqui',
    'logout': 'Sair',
    
    // User Roles
    'client': 'Cliente',
    'dealer': 'Concessionária',
    'towCompany': 'Empresa de Reboque',
    'driver': 'Motorista',
    'admin': 'Administrador',
    
    // Role Descriptions
    'clientDesc': 'Solicitar serviços de reboque',
    'dealerDesc': 'Empresa que solicita reboques',
    'towCompanyDesc': 'Prestar serviços de reboque',
    'driverDesc': 'Executar serviços de reboque',
    
    // Dashboard
    'welcome': 'Bem-vindo',
    'dashboard': 'Dashboard',
    'towRequestManagement': 'Sistema de Gestão de Reboques',
    'quickActions': 'Ações Rápidas',
    'newRequest': 'Nova Solicitação',
    'viewRequests': 'Ver Solicitações',
    'driverPanel': 'Painel do Motorista',
    'adminPanel': 'Painel Administrativo',
    'recentRequests': 'Solicitações Recentes',
    'noRequestsFound': 'Nenhuma solicitação encontrada',
    'createFirstRequest': 'Criar primeira solicitação',
    
    // Statistics
    'totalRequests': 'Total de Solicitações',
    'pending': 'Pendente',
    'inProgress': 'Em Andamento',
    'completed': 'Concluído',
    'cancelled': 'Cancelado',
    
    // Tow Request Form
    'newTowRequest': 'Nova Solicitação de Reboque',
    'selectLocations': 'Selecionar Locais',
    'clickMapPickup': 'Clique no mapa para selecionar o local de coleta',
    'clickMapDropoff': 'Clique no mapa para selecionar o local de entrega',
    'pickupLocation': 'Local de Coleta',
    'deliveryLocation': 'Local de Entrega',
    'vehicleInfo': 'Informações do Veículo',
    'vehicleInfoPlaceholder': 'Ex: Honda Civic 2020, cor prata, placa ABC-1234',
    'vehicleInfoDesc': 'Inclua marca, modelo, cor e placa do veículo',
    'suggestedPrice': 'Preço Sugerido (Opcional)',
    'priceDesc': 'Valor em dólares ($) que você está disposto a pagar',
    'additionalNotes': 'Observações Adicionais (Opcional)',
    'notesPlaceholder': 'Descreva detalhes importantes sobre o reboque, condições especiais, etc.',
    'requestDetails': 'Detalhes da Solicitação',
    'cancel': 'Cancelar',
    'createRequest': 'Criar Solicitação',
    'reset': 'Redefinir',
    'loadingMap': 'Carregando mapa...',
    
    // Status
    'statusPending': 'Pendente',
    'statusAccepted': 'Aceito',
    'statusOnMission': 'Em Andamento',
    'statusCompleted': 'Concluído',
    'statusCancelled': 'Cancelado',
    
    // Actions
    'accept': 'Aceitar',
    'reject': 'Rejeitar',
    'approve': 'Aprovar',
    'start': 'Iniciar',
    'complete': 'Concluir',
    'viewDetails': 'Ver Detalhes',
    'update': 'Atualizar',
    'save': 'Salvar',
    'back': 'Voltar',
    
    // Driver Dashboard
    'driverDashboard': 'Painel do Motorista',
    'availableRequests': 'Solicitações Disponíveis',
    'myJobs': 'Meus Trabalhos',
    'totalJobs': 'Total de Trabalhos',
    'rating': 'Avaliação',
    'activeJobs': 'Trabalhos Ativos',
    'offline': 'Offline',
    'available': 'Disponível',
    'onMission': 'Em Missão',
    'nearbyRequests': 'Solicitações Próximas',
    
    // Messages
    'success': 'Sucesso',
    'error': 'Erro',
    'loading': 'Carregando',
    'noData': 'Nenhum dado disponível',
    'requestCreatedSuccess': 'Solicitação criada com sucesso!',
    'requestAcceptedSuccess': 'Solicitação aceita com sucesso!',
    'statusUpdatedSuccess': 'Status atualizado com sucesso!',
    'loginSuccessful': 'Login realizado com sucesso!',
    'registrationSuccessful': 'Cadastro realizado com sucesso!',
    
    // Currency
    'currency': '$',
    'priceFormat': '${{amount}}',
    
    // Driver Features
    'nearbyRequests': 'Solicitações Próximas',
    'yourLocation': 'Sua Localização',
    'away': 'de distância',
    'pickup': 'Coleta',
    'delivery': 'Entrega',
    'refresh': 'Atualizar',
    'noNearbyRequests': 'Nenhuma Solicitação Próxima',
    'noRequestsInArea': 'Não há solicitações de reboque na sua área no momento',
    'justNow': 'agora mesmo',
    'notes': 'Observações',
    'autoRefreshEvery30Seconds': 'Atualização automática a cada 30 segundos',
    'locationError': 'Não foi possível obter sua localização',
    'geolocationNotSupported': 'Geolocalização não suportada',
    'errorFetchingRequests': 'Erro ao buscar solicitações',
    'noAssignedJobs': 'Você não tem trabalhos atribuídos',
    'no': 'Não',
    'close': 'Fechar',
    'confirm': 'Confirmar',
    'date': 'Data',
    'time': 'Hora',
    'location': 'Localização',
    'distance': 'Distância',
    'km': 'km',
    'miles': 'milhas'
  },
  
  es: {
    // Authentication
    'login': 'Iniciar Sesión',
    'register': 'Registrarse',
    'email': 'Correo',
    'password': 'Contraseña',
    'confirmPassword': 'Confirmar Contraseña',
    'fullName': 'Nombre Completo',
    'phone': 'Teléfono',
    'accountType': 'Tipo de Cuenta',
    'createAccount': 'Crear Cuenta',
    'alreadyHaveAccount': '¿Ya tienes una cuenta?',
    'noAccount': '¿No tienes una cuenta?',
    'loginHere': 'Inicia sesión aquí',
    'registerHere': 'Regístrate aquí',
    'logout': 'Cerrar Sesión',
    
    // User Roles
    'client': 'Cliente',
    'dealer': 'Concesionario',
    'towCompany': 'Empresa de Grúas',
    'driver': 'Conductor',
    'admin': 'Administrador',
    
    // Role Descriptions
    'clientDesc': 'Solicitar servicios de grúa',
    'dealerDesc': 'Empresa que solicita grúas',
    'towCompanyDesc': 'Proporcionar servicios de grúa',
    'driverDesc': 'Ejecutar servicios de grúa',
    
    // Dashboard
    'welcome': 'Bienvenido',
    'dashboard': 'Panel',
    'towRequestManagement': 'Sistema de Gestión de Grúas',
    'quickActions': 'Acciones Rápidas',
    'newRequest': 'Nueva Solicitud',
    'viewRequests': 'Ver Solicitudes',
    'driverPanel': 'Panel del Conductor',
    'adminPanel': 'Panel Administrativo',
    'recentRequests': 'Solicitudes Recientes',
    'noRequestsFound': 'No se encontraron solicitudes',
    'createFirstRequest': 'Crear primera solicitud',
    
    // Statistics
    'totalRequests': 'Total de Solicitudes',
    'pending': 'Pendiente',
    'inProgress': 'En Progreso',
    'completed': 'Completado',
    'cancelled': 'Cancelado',
    
    // Tow Request Form
    'newTowRequest': 'Nueva Solicitud de Grúa',
    'selectLocations': 'Seleccionar Ubicaciones',
    'clickMapPickup': 'Haz clic en el mapa para seleccionar la ubicación de recogida',
    'clickMapDropoff': 'Haz clic en el mapa para seleccionar la ubicación de entrega',
    'pickupLocation': 'Ubicación de Recogida',
    'deliveryLocation': 'Ubicación de Entrega',
    'vehicleInfo': 'Información del Vehículo',
    'vehicleInfoPlaceholder': 'Ej: Honda Civic 2020, color plata, placa ABC-1234',
    'vehicleInfoDesc': 'Incluye marca, modelo, color y placa del vehículo',
    'suggestedPrice': 'Precio Sugerido (Opcional)',
    'priceDesc': 'Cantidad en dólares ($) que estás dispuesto a pagar',
    'additionalNotes': 'Notas Adicionales (Opcional)',
    'notesPlaceholder': 'Describe detalles importantes sobre la grúa, condiciones especiales, etc.',
    'requestDetails': 'Detalles de la Solicitud',
    'cancel': 'Cancelar',
    'createRequest': 'Crear Solicitud',
    'reset': 'Reiniciar',
    'loadingMap': 'Cargando mapa...',
    
    // Status
    'statusPending': 'Pendiente',
    'statusAccepted': 'Aceptado',
    'statusOnMission': 'En Progreso',
    'statusCompleted': 'Completado',
    'statusCancelled': 'Cancelado',
    
    // Actions
    'accept': 'Aceptar',
    'reject': 'Rechazar',
    'approve': 'Aprobar',
    'start': 'Iniciar',
    'complete': 'Completar',
    'viewDetails': 'Ver Detalles',
    'update': 'Actualizar',
    'save': 'Guardar',
    'back': 'Volver',
    
    // Driver Dashboard
    'driverDashboard': 'Panel del Conductor',
    'availableRequests': 'Solicitudes Disponibles',
    'myJobs': 'Mis Trabajos',
    'totalJobs': 'Total de Trabajos',
    'rating': 'Calificación',
    'activeJobs': 'Trabajos Activos',
    'offline': 'Desconectado',
    'available': 'Disponible',
    'onMission': 'En Misión',
    'nearbyRequests': 'Solicitudes Cercanas',
    
    // Messages
    'success': 'Éxito',
    'error': 'Error',
    'loading': 'Cargando',
    'noData': 'No hay datos disponibles',
    'requestCreatedSuccess': '¡Solicitud creada exitosamente!',
    'requestAcceptedSuccess': '¡Solicitud aceptada exitosamente!',
    'statusUpdatedSuccess': '¡Estado actualizado exitosamente!',
    'loginSuccessful': '¡Inicio de sesión exitoso!',
    'registrationSuccessful': '¡Registro exitoso!',
    
    // Currency
    'currency': '$',
    'priceFormat': '${{amount}}',
    
    // Driver Features
    'nearbyRequests': 'Solicitudes Cercanas',
    'yourLocation': 'Tu Ubicación',
    'away': 'de distancia',
    'pickup': 'Recogida',
    'delivery': 'Entrega',
    'refresh': 'Actualizar',
    'noNearbyRequests': 'No Hay Solicitudes Cercanas',
    'noRequestsInArea': 'No hay solicitudes de grúa en tu área en este momento',
    'justNow': 'ahora mismo',
    'notes': 'Notas',
    'autoRefreshEvery30Seconds': 'Actualización automática cada 30 segundos',
    'locationError': 'No se pudo obtener tu ubicación',
    'geolocationNotSupported': 'Geolocalización no soportada',
    'errorFetchingRequests': 'Error al obtener solicitudes',
    'noAssignedJobs': 'No tienes trabajos asignados',
    'no': 'No',
    'close': 'Cerrar',
    'confirm': 'Confirmar',
    'date': 'Fecha',
    'time': 'Hora',
    'location': 'Ubicación',
    'distance': 'Distancia',
    'km': 'km',
    'miles': 'millas'
  }
};

class I18n {
  constructor() {
    this.currentLanguage = this.detectLanguage();
    this.translations = translations;
  }
  
  detectLanguage() {
    // Try to get language from localStorage first
    const savedLanguage = localStorage.getItem('towfleets_language');
    if (savedLanguage && this.translations[savedLanguage]) {
      return savedLanguage;
    }
    
    // Detect browser language
    const browserLang = navigator.language || navigator.userLanguage;
    
    // Map common language codes
    if (browserLang.startsWith('pt')) return 'pt';
    if (browserLang.startsWith('es')) return 'es';
    if (browserLang.startsWith('en')) return 'en';
    
    // Default to English
    return 'en';
  }
  
  setLanguage(lang) {
    if (this.translations[lang]) {
      this.currentLanguage = lang;
      localStorage.setItem('towfleets_language', lang);
      
      // Trigger a custom event to notify components of language change
      window.dispatchEvent(new CustomEvent('languageChanged', { detail: lang }));
    }
  }
  
  t(key, params = {}) {
    const translation = this.translations[this.currentLanguage]?.[key] || 
                       this.translations['en']?.[key] || 
                       key;
    
    // Replace parameters in translation
    return translation.replace(/\{\{(\w+)\}\}/g, (match, paramKey) => {
      return params[paramKey] || match;
    });
  }
  
  formatPrice(amount) {
    return this.t('priceFormat', { amount: amount.toFixed(2) });
  }
  
  getCurrentLanguage() {
    return this.currentLanguage;
  }
  
  getAvailableLanguages() {
    return [
      { code: 'en', name: 'English', flag: '🇺🇸' },
      { code: 'pt', name: 'Português', flag: '🇧🇷' },
      { code: 'es', name: 'Español', flag: '🇪🇸' }
    ];
  }
}

// Create global instance
const i18n = new I18n();

export default i18n;