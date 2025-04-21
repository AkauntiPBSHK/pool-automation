/**
 * Pool Automation Dashboard JavaScript
 */

// Mock data for simulation mode
const mockData = {
    ph: 7.4,
    orp: 720,
    freeChlorine: 1.2,
    combinedChlorine: 0.2,
    turbidity: 0.14,
    temperature: 28.2,
    uvIntensity: 94,
    phPumpRunning: false,
    clPumpRunning: false,
    pacPumpRunning: false,
    pacDosingRate: 75 // Default value in ml/h
};

// Connect to Socket.IO
const socket = io();

// Global variables for charts
let chemistryChart = null;

// Language translations
const translations = {
    en: {
        // Overview Tab
        "systemOverview": "System Overview",
        "currentAlerts": "Current Alerts",
        "allSystemsNormal": "All Systems Normal",
        "noAlerts": "No alerts at this time",
        
        // Parameters
        "pHTitle": "pH",
        "ORPTitle": "ORP",
        "chlorineTitle": "Chlorine",
        "turbidityTitle": "Turbidity",
        "temperatureTitle": "Temperature",
        "uvSystemTitle": "UV System",
        
        // Status
        "good": "Good",
        "fair": "Fair",
        "poor": "Poor",
        "pumpActive": "Pump active",
        "pumpInactive": "Pump inactive",
        "pacPumpActive": "PAC pump active",
        "pacPumpInactive": "PAC pump inactive",
        
        // Settings
        "accountSettings": "Account Settings",
        "notificationSettings": "Notification Settings",
        "systemConfiguration": "System Configuration",
        "waterChemistryTargets": "Water Chemistry Targets",
        "dosingPumpConfiguration": "Dosing Pump Configuration",
        "turbidityControlSettings": "Turbidity Control Settings",
        "dataManagement": "Data Management",
        "saveSettings": "Save Settings",
        "changePassword": "Change Password",
        
        // Navigation
        "overview": "Overview",
        "waterChemistry": "Water Chemistry",
        "turbidityPac": "Turbidity & PAC",
        "history": "History",
        "settings": "Settings",

        // Units and common terms
        "seconds": "seconds",
        "minutes": "minutes",
        "hours": "hours",
        "days": "days",
        "target": "Target",
        "minimum": "Min",
        "maximum": "Max",
        "ml/h": "ml/h",
        "NTU": "NTU",
        "mV": "mV",

        "started": "started",
        "for": "for",
        "phDosingStop": "pH dosing stopped",
        "clDosingStop": "Chlorine dosing stopped",
        "pacDosingStop": "PAC dosing stopped",
        "at": "at",
        "justNow": "Just now",
        "systemTitle": "Pool Automation",
        "systemStarted": "System started in automatic mode",
        "automaticChlorineDosing": "Automatic chlorine dosing",
        "lowChlorineAlert": "Low chlorine level detected",
        "automaticPACDosing": "Automatic PAC dosing",
        "userChangedPH": "User changed target pH range",
        "freeCl": "Free Cl",
        "noDataAvailable": "No data available",
        "noEventsAvailable": "No events available",
        "clearing": "Clearing",
        "resetComplete": "Settings reset to defaults completed",
        "clearDataComplete": "Historical data cleared successfully",
        
        // Button actions
        "refresh": "Refresh",
        "automatic": "Automatic",
        "manual": "Manual",
        "export": "Export",
        "import": "Import",
        "apply": "Apply",
        "start": "Start",
        "stop": "Stop",
        
        // Form fields
        "username": "Username",
        "password": "Password",
        "email": "Email",
        
        // Toast messages
        "settingsSaved": "Settings saved successfully",
        "dataRefreshed": "Data refreshed",
        "passwordChanged": "Password changed successfully",
        "languageChanged": "Language changed to English",
        
        // Water Chemistry
        "phControl": "pH Control",
        "chlorineControl": "Chlorine Control",
        "phTarget": "pH Target Range",
        "clTarget": "Chlorine Target Range",
        "currentValue": "Current Value",
        "pumpStatus": "Pump Status",
        "manualControl": "Manual Control",
        "doseAcid": "Dose Acid",
        "doseChlorine": "Dose Chlorine",
        "stopPump": "Stop Pump",
        "recentDosing": "Recent Dosing",
        
        // Turbidity & PAC
        "turbidityMonitoring": "Turbidity Monitoring",
        "pacDosingControl": "PAC Dosing Control",
        "dosingRate": "Dosing Rate",
        "filterEfficiency": "Filter Efficiency",
        "filterStatus": "Filter Status",
        "filterLoad": "Filter Load",
        "pacLevel": "PAC Level",
        "controlThresholds": "Control Thresholds",
        "highThreshold": "High Threshold",
        "lowThreshold": "Low Threshold",
        "targetValue": "Target Value",
        "startDosing": "Start Dosing",
        "optimized": "Optimized",
        
        // History
        "historicalData": "Historical Data & Logs",
        "timeRange": "Time Range",
        "customRange": "Custom Range",
        "parameters": "Parameters",
        "exportData": "Export Data",
        "dataTable": "Data Table",
        "systemEvents": "System Events",
        "showing": "Showing",
        "of": "of",
        "records": "records",
        "events": "events",
        "timestamp": "Timestamp",
        "description": "Description",
        "parameter": "Parameter",
        "value": "Value",
        
        // Time ranges
        "last24Hours": "Last 24 Hours",
        "last48Hours": "Last 48 Hours",
        "last7Days": "Last 7 Days",
        "last30Days": "Last 30 Days",
        "customRange": "Custom Range",

        "time": "Time",
        "duration": "Duration",
        "type": "Type",
        "before": "Before",
        "auto": "Auto",
        "idle": "Idle",
        "running": "Running",
        "manualDosing": "Manual Dosing",
        "flowRateMin": "Minimum Flow Rate",
        "flowRateMax": "Maximum Flow Rate",
        "phPump": "pH Pump",
        "chlorinePump": "Chlorine Pump",
        "pacPump": "PAC Pump",
        "selectDuration": "Select Duration",
        "visualizationType": "Visualization Type",
        "dataResolution": "Data Resolution",
        "rawData": "Raw Data",
        "minuteAvg": "1 Minute Avg",
        "hourAvg": "1 Hour Avg",
        "dayAvg": "1 Day Avg",
        "lineChart": "Line Chart",
        "scatterPlot": "Scatter Plot",
        "barChart": "Bar Chart",
        "activeFilters": "Active Filters",
        "allEvents": "All Events",
        "dosingEvents": "Dosing Events",
        "alertEvents": "Alerts",
        "systemEvents": "System Events",
        "userActions": "User Actions",
        "enterEmail": "Enter email for alerts",
        "criticalAlerts": "Critical Alerts",
        "warningNotifications": "Warning Notifications",
        "maintenanceReminders": "Maintenance Reminders",
        "dailyReports": "Daily Status Reports",
        "since": "since",
        "maintenance": "maintenance",
        "hoursSince": "hours since last maintenance",
        "phRange": "pH Range",
        "orpRange": "ORP Range (mV)",
        "freeChlorineRange": "Free Chlorine Range (mg/L)",
        "combinedChlorineMax": "Combined Chlorine Maximum (mg/L)",
        "min": "Min",
        "max": "Max",
        "backupRestore": "Backup & Restore",
        "dataRetention": "Data Retention",
        "resetMaintenance": "Reset & Maintenance",
        "saveRetentionSettings": "Save Retention Settings",
        "maxDoseDuration": "Maximum Dose Duration",

        "poolAutomationTitle": "Pool Automation",
        "dashboard": "Dashboard",
        "active": "Active", 
        "historicalData": "Historical Data",
        "turbidityHistory": "Turbidity History",
        "freeChlorine": "Free Chlorine",
        "combinedCl": "Combined Cl",
        "additionalOptions": "Additional Options",
        "sensorData": "Sensor Data",
        "csv": "CSV",
        "json": "JSON",
        "systemEvent": "System",
        "dosingEvent": "Dosing",
        "alertEvent": "Alert",
        "userEvent": "User",
        "notificationPreferences": "Notification Preferences",
        "saveSystemSettings": "Save System Settings",
        "phPumpFlowRate": "pH Pump Flow Rate (ml/h)",
        "chlorinePumpFlowRate": "Chlorine Pump Flow Rate (ml/h)",
        "pacPumpFlowConfig": "PAC Pump Flow Rate Configuration",
        "minimumMlh": "Minimum (ml/h)",
        "maximumMlh": "Maximum (ml/h)",
        "maxDoseDurations": "Maximum Dose Durations",
        "phPumpSeconds": "pH Pump (seconds)",
        "chlorinePumpSeconds": "Chlorine Pump (seconds)",
        "turbidityTargetNTU": "Turbidity Target (NTU)",
        "pacDosingThresholds": "PAC Dosing Thresholds",
        "lowNTU": "Low (NTU)",
        "highNTU": "High (NTU)",
        "filterBackwashLevel": "Filter Backwash Alert Level (%)",
        "enableAutoBackwash": "Enable Automatic Backwash Alerts",
        "exportSettings": "Export Settings",
        "sensorReadingsRetention": "Sensor Readings Retention",
        "systemEventsRetention": "System Events Retention",
        
        // System Configuration
        "systemName": "System Name",
        "poolSize": "Pool Size (m³)",
        "refreshInterval": "Data Refresh Interval",
        "defaultMode": "Default Operation Mode",
        "language": "Language / Gjuha",
        "english": "English",
        "albanian": "Shqip (Albanian)"
    },
    sq: {
        // Overview Tab
        "systemOverview": "Përmbledhja e Sistemit",
        "currentAlerts": "Njoftimet Aktuale",
        "allSystemsNormal": "Të Gjitha Sistemet Normale",
        "noAlerts": "Nuk ka njoftime për momentin",
        
        // Parameters
        "pHTitle": "pH",
        "ORPTitle": "ORP",
        "chlorineTitle": "Klori",
        "turbidityTitle": "Turbullira",
        "temperatureTitle": "Temperatura",
        "uvSystemTitle": "Sistemi UV",
        
        // Status
        "good": "Mirë",
        "fair": "Mesatar",
        "poor": "Dobët",
        "pumpActive": "Pompa aktive",
        "pumpInactive": "Pompa joaktive",
        "pacPumpActive": "Pompa PAC aktive",
        "pacPumpInactive": "Pompa PAC joaktive",
        
        // Settings
        "accountSettings": "Cilësimet e Llogarisë",
        "notificationSettings": "Cilësimet e Njoftimeve",
        "systemConfiguration": "Konfigurimi i Sistemit",
        "waterChemistryTargets": "Objektivat e Kimisë së Ujit",
        "dosingPumpConfiguration": "Konfigurimi i Pompës së Dozimit",
        "turbidityControlSettings": "Cilësimet e Kontrollit të Turbullirës",
        "dataManagement": "Menaxhimi i të Dhënave",
        "saveSettings": "Ruaj Cilësimet",
        "changePassword": "Ndrysho Fjalëkalimin",
        
        // Navigation
        "overview": "Përmbledhje",
        "waterChemistry": "Kimia e Ujit",
        "turbidityPac": "Turbullira & PAC",
        "history": "Historia",
        "settings": "Cilësimet",

        // Units and common terms
        "seconds": "sekonda",
        "minutes": "minuta",
        "hours": "orë",
        "days": "ditë",
        "target": "Objektivi",
        "minimum": "Min",
        "maximum": "Max",
        "ml/h": "ml/h",
        "NTU": "NTU",
        "mV": "mV",
        
        // Button actions
        "refresh": "Rifresko",
        "automatic": "Automatike",
        "manual": "Manuale",
        "export": "Eksporto",
        "import": "Importo",
        "apply": "Apliko",
        "start": "Fillo",
        "stop": "Ndalo",

        "started": "filluar",
        "for": "për",
        "phDosingStop": "Dozimi i pH u ndërpre",
        "clDosingStop": "Dozimi i klorit u ndërpre",
        "pacDosingStop": "Dozimi i PAC u ndërpre",
        "at": "me",
        "justNow": "Tani",
        "systemTitle": "Automatizimi i Pishinës",
        "systemStarted": "Sistemi u nis në mënyrë automatike",
        "automaticChlorineDosing": "Dozimi automatik i klorit",
        "lowChlorineAlert": "U zbulua nivel i ulët i klorit",
        "automaticPACDosing": "Dozimi automatik i PAC",
        "userChangedPH": "Përdoruesi ndryshoi gamën e synuar të pH",
        "freeCl": "Klori i Lirë",
        "noDataAvailable": "Nuk ka të dhëna",
        "noEventsAvailable": "Nuk ka ngjarje",
        "clearing": "Duke pastruar",
        "resetComplete": "Rivendosja e cilësimeve u krye",
        "clearDataComplete": "Pastrimi i të dhënave historike u krye me sukses",

        "poolAutomationTitle": "Automatizimi i Pishinës",
        "dashboard": "Paneli",
        "active": "Aktive",
        "historicalData": "Të Dhënat Historike",
        "turbidityHistory": "Historia e Turbullirës",
        "freeChlorine": "Klori i Lirë",
        "combinedCl": "Klori i Kombinuar",
        "additionalOptions": "Opsione Shtesë",
        "sensorData": "Të Dhënat e Sensorëve",
        "csv": "CSV",
        "json": "JSON",
        "systemEvent": "Sistemi",
        "dosingEvent": "Dozimi",
        "alertEvent": "Alarm",
        "userEvent": "Përdoruesi",
        "notificationPreferences": "Preferencat e Njoftimeve",
        "saveSystemSettings": "Ruaj Cilësimet e Sistemit",
        "phPumpFlowRate": "Rrjedhja e Pompës së pH (ml/h)",
        "chlorinePumpFlowRate": "Rrjedhja e Pompës së Klorit (ml/h)",
        "pacPumpFlowConfig": "Konfigurimi i Rrjedhjes së Pompës PAC",
        "minimumMlh": "Minimumi (ml/h)",
        "maximumMlh": "Maksimumi (ml/h)",
        "maxDoseDurations": "Kohëzgjatja Maksimale e Dozimit",
        "phPumpSeconds": "Pompa e pH (sekonda)",
        "chlorinePumpSeconds": "Pompa e Klorit (sekonda)",
        "turbidityTargetNTU": "Vlera e Synuar e Turbullirës (NTU)",
        "pacDosingThresholds": "Pragjet e Dozimit PAC",
        "lowNTU": "I Ulët (NTU)",
        "highNTU": "I Lartë (NTU)",
        "filterBackwashLevel": "Niveli i Alarmit për Shplarjen e Filtrit (%)",
        "enableAutoBackwash": "Aktivizo Alarmet Automatike të Shplarjes",
        "exportSettings": "Eksporto Cilësimet",
        "sensorReadingsRetention": "Ruajtja e Leximeve të Sensorëve",
        "systemEventsRetention": "Ruajtja e Ngjarjeve të Sistemit",
        
        // Form fields
        "username": "Emri i përdoruesit",
        "password": "Fjalëkalimi",
        "email": "Email",
        
        // Toast messages
        "settingsSaved": "Cilësimet u ruajtën me sukses",
        "dataRefreshed": "Të dhënat u rifreskuan",
        "passwordChanged": "Fjalëkalimi u ndryshua me sukses",
        "languageChanged": "Gjuha u ndryshua në Shqip",
        
        // Water Chemistry
        "phControl": "Kontrolli i pH",
        "chlorineControl": "Kontrolli i Klorit",
        "phTarget": "Diapazoni i Synuar i pH",
        "clTarget": "Diapazoni i Synuar i Klorit",
        "currentValue": "Vlera Aktuale",
        "pumpStatus": "Statusi i Pompës",
        "manualControl": "Kontrolli Manual",
        "doseAcid": "Dozo Acid",
        "doseChlorine": "Dozo Klor",
        "stopPump": "Ndalo Pompën",
        "recentDosing": "Dozimi i Fundit",
        
        // Turbidity & PAC
        "turbidityMonitoring": "Monitorimi i Turbullirës",
        "pacDosingControl": "Kontrolli i Dozimit PAC",
        "dosingRate": "Shkalla e Dozimit",
        "filterEfficiency": "Efikasiteti i Filtrit",
        "filterStatus": "Statusi i Filtrit",
        "filterLoad": "Ngarkesa e Filtrit",
        "pacLevel": "Niveli i PAC",
        "controlThresholds": "Pragjet e Kontrollit",
        "highThreshold": "Pragu i Lartë",
        "lowThreshold": "Pragu i Ulët",
        "targetValue": "Vlera e Synuar",
        "startDosing": "Fillo Dozimin",
        "optimized": "Optimizuar",
        
        // History
        "historicalData": "Të Dhënat Historike & Regjistrat",
        "timeRange": "Intervali Kohor",
        "customRange": "Interval i Personalizuar",
        "parameters": "Parametrat",
        "exportData": "Eksporto të Dhënat",
        "dataTable": "Tabela e të Dhënave",
        "systemEvents": "Ngjarjet e Sistemit",
        "showing": "Duke shfaqur",
        "of": "nga",
        "records": "regjistrime",
        "events": "ngjarje",
        "timestamp": "Koha",
        "description": "Përshkrimi",
        "parameter": "Parametri",
        "value": "Vlera",
        
        // Time ranges
        "last24Hours": "24 Orët e Fundit",
        "last48Hours": "48 Orët e Fundit",
        "last7Days": "7 Ditët e Fundit",
        "last30Days": "30 Ditët e Fundit",
        "customRange": "Interval i Personalizuar",

        "time": "Koha",
        "duration": "Kohëzgjatja",
        "type": "Lloji",
        "before": "Para",
        "auto": "Auto",
        "idle": "Pasive",
        "running": "Aktive",
        "manualDosing": "Dozimi Manual",
        "flowRateMin": "Shkalla Minimale e Rrjedhjes",
        "flowRateMax": "Shkalla Maksimale e Rrjedhjes",
        "phPump": "Pompa e pH",
        "chlorinePump": "Pompa e Klorit",
        "pacPump": "Pompa PAC",
        "selectDuration": "Zgjidh Kohëzgjatjen",
        "visualizationType": "Lloji i Vizualizimit",
        "dataResolution": "Rezolucioni i të Dhënave",
        "rawData": "Të Dhëna të Papërpunuara",
        "minuteAvg": "Mesatare 1 Minutëshe",
        "hourAvg": "Mesatare 1 Orëshe",
        "dayAvg": "Mesatare 1 Ditore",
        "lineChart": "Grafik Linear",
        "scatterPlot": "Grafik me Pika",
        "barChart": "Grafik me Shtylla",
        "activeFilters": "Filtrat Aktivë",
        "allEvents": "Të Gjitha Ngjarjet",
        "dosingEvents": "Ngjarjet e Dozimit",
        "alertEvents": "Alarmet",
        "systemEvents": "Ngjarjet e Sistemit",
        "userActions": "Veprimet e Përdoruesit",
        "enterEmail": "Vendosni email për njoftimet",
        "criticalAlerts": "Alarmet Kritike",
        "warningNotifications": "Njoftimet Paralajmëruese",
        "maintenanceReminders": "Kujtuesit e Mirëmbajtjes",
        "dailyReports": "Raportet Ditore",
        "since": "që nga",
        "maintenance": "mirëmbajtja",
        "hoursSince": "orë që nga mirëmbajtja e fundit",
        "phRange": "Diapazoni i pH",
        "orpRange": "Diapazoni i ORP (mV)",
        "freeChlorineRange": "Diapazoni i Klorit të Lirë (mg/L)",
        "combinedChlorineMax": "Maksimumi i Klorit të Kombinuar (mg/L)",
        "min": "Min",
        "max": "Max",
        "backupRestore": "Rezervo & Rikthe",
        "dataRetention": "Ruajtja e të Dhënave",
        "resetMaintenance": "Rivendosje & Mirëmbajtje",
        "saveRetentionSettings": "Ruaj Cilësimet e Ruajtjes",
        "maxDoseDuration": "Kohëzgjatja Maksimale e Dozës",
        
        // System Configuration
        "systemName": "Emri i Sistemit",
        "poolSize": "Madhësia e Pishinës (m³)",
        "refreshInterval": "Intervali i Rifreskimit",
        "defaultMode": "Mënyra e Parazgjedhur e Operimit",
        "language": "Gjuha / Language",
        "english": "English (Anglisht)",
        "albanian": "Shqip"
    }
};

// Current language (initialized during page load)
let currentLanguage = 'en';

// DOM Ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard initialized');
    
    // Initialize navigation
    initializeNavigation();
    
    // Setup mode toggle event listeners
    document.getElementById('autoMode').addEventListener('click', function() {
        console.log('Switching to automatic mode');
        setMode('automatic');
    });
    
    document.getElementById('manualMode').addEventListener('click', function() {
        console.log('Switching to manual mode');
        setMode('manual');
    });
    
    document.getElementById('refreshBtn').addEventListener('click', function() {
        console.log('Refreshing data');
        fetchStatus();
        updateParameterDisplays(mockData);
    });
    
    // Initialize water chemistry section
    initializeWaterChemistryControls();

    // Initialize turbidity & PAC section
    initializeTurbidityPACControls();
    
    // Initialize history tab
    initializeHistoryTab();

    // Initial data fetch
    fetchStatus();
    
    // Load initial data
    updateParameterDisplays(mockData);

    // Initialize settings tab
    initializeSettingsTab();

    // Apply any saved settings to the UI
    updateUIFromSettings();
    
    // Setup socket events
    socket.on('connect', function() {
        console.log('Connected to server');
        updateStatusBar('Connected to server', 'success');
    });
    
    socket.on('disconnect', function() {
        console.log('Disconnected from server');
        updateStatusBar('Disconnected from server', 'danger');
    });
    
    // Set up simulation data updates
    if (getParameterByName('simulate') !== 'false') {
        setInterval(simulateDataChanges, 5000);
    }

    // Add event listeners for language switching
        document.getElementById('langEnglish').addEventListener('change', function() {
            if (this.checked) {
                applyLanguage('en');
            }
        });

        document.getElementById('langAlbanian').addEventListener('change', function() {
            if (this.checked) {
                applyLanguage('sq');
            }
        });

        // At the end of your DOMContentLoaded function, add:
        // Initialize language
        const systemConfig = JSON.parse(localStorage.getItem('systemConfig') || '{}');
        const language = systemConfig.language || 'en';
        if (language === 'sq') {
            document.getElementById('langAlbanian').checked = true;
        } else {
            document.getElementById('langEnglish').checked = true;
        }
        applyLanguage(language);

        // Call testTranslationCompleteness in development mode
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log("Running in development mode - testing translations");
            setTimeout(testTranslationCompleteness, 2000); // Wait for page to fully load
        }
});

/**
 * Initialize navigation between tabs
 */
function initializeNavigation() {
    // Add event listeners to nav links
    document.querySelectorAll('#sidebar .nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Get the target tab ID
            const targetId = this.getAttribute('href');
            console.log('Navigating to:', targetId);
            
            // Hide all tabs
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.style.display = 'none';
            });
            
            // Show the target tab
            if (targetId && document.querySelector(targetId)) {
                document.querySelector(targetId).style.display = 'block';
            }
            
            // Update active state in navigation
            document.querySelectorAll('#sidebar .nav-link').forEach(navLink => {
                navLink.classList.remove('active');
            });
            this.classList.add('active');
        });
    });
}

/**
 * Initialize water chemistry controls
 */
function initializeWaterChemistryControls() {
    // Initialize mode-dependent controls
    updateControlsBasedOnMode();
    
    // Add event listeners to dose buttons
    document.getElementById('phDoseBtn').addEventListener('click', function() {
        const duration = document.getElementById('phDoseDuration').value;
        startPHDosing(duration);
    });
    
    document.getElementById('phStopBtn').addEventListener('click', function() {
        stopPHDosing();
    });
    
    document.getElementById('clDoseBtn').addEventListener('click', function() {
        const duration = document.getElementById('clDoseDuration').value;
        startCLDosing(duration);
    });
    
    document.getElementById('clStopBtn').addEventListener('click', function() {
        stopCLDosing();
    });
    
    // Initialize chart
    initializeChemistryChart();
    
    // Add event listener for time range change
    document.getElementById('chemistryTimeRange').addEventListener('change', function() {
        updateChemistryChart(this.value);
    });
}

/**
 * Update manual controls based on operation mode
 */
function updateControlsBasedOnMode() {
    const isManualMode = document.getElementById('manualMode').classList.contains('active');
    
    // Enable or disable control buttons based on mode
    document.getElementById('phDoseBtn').disabled = !isManualMode;
    document.getElementById('phStopBtn').disabled = !isManualMode;
    document.getElementById('clDoseBtn').disabled = !isManualMode;
    document.getElementById('clStopBtn').disabled = !isManualMode;
    
    // Update help text if needed
    if (isManualMode) {
        // Any manual mode specific UI updates
    } else {
        // Any automatic mode specific UI updates
    }

    // Update Turbidity & PAC controls
    updateTurbidityPACControlsBasedOnMode();
}

/**
 * Simulate starting pH dosing
 */
function startPHDosing(duration) {
    mockData.phPumpRunning = true;
    updatePumpStatus('phPump', true);
    updatePumpStatus('phPumpDetail', true);
    
    // Show toast notification with translated message
    const message = `${t('doseAcid')} ${t('started')} ${t('for')} ${duration} ${t('seconds')}`;
    showToast(message);
    
    // Auto-stop after duration
    setTimeout(() => {
        stopPHDosing();
    }, duration * 1000);
}

/**
 * Simulate stopping pH dosing
 */
function stopPHDosing() {
    mockData.phPumpRunning = false;
    updatePumpStatus('phPump', false);
    updatePumpStatus('phPumpDetail', false);
    
    // Show toast notification with translated message
    showToast(t('phDosingStop'));
}

/**
 * Simulate starting chlorine dosing
 */
function startCLDosing(duration) {
    mockData.clPumpRunning = true;
    updatePumpStatus('clPump', true);
    updatePumpStatus('clPumpDetail', true);
    
    // Show toast notification with translated message
    const message = `${t('doseChlorine')} ${t('started')} ${t('for')} ${duration} ${t('seconds')}`;
    showToast(message);
    
    // Auto-stop after duration
    setTimeout(() => {
        stopCLDosing();
    }, duration * 1000);
}

/**
 * Simulate stopping chlorine dosing
 */
function stopCLDosing() {
    mockData.clPumpRunning = false;
    updatePumpStatus('clPump', false);
    updatePumpStatus('clPumpDetail', false);
    
    // Show toast notification with translated message
    showToast(t('clDosingStop'));
}

/**
 * Show a toast notification
 */
function showToast(message, type = 'info') {
    // Try to find message in translations if it's a direct key
    if (typeof message === 'string' && translations[currentLanguage] && translations[currentLanguage][message]) {
        message = translations[currentLanguage][message];
    } else if (typeof message === 'string' && translations[currentLanguage]) {
        // Check if message matches any English translation
        for (const key in translations[currentLanguage]) {
            if (message === translations['en'][key]) {
                message = translations[currentLanguage][key];
                break;
            }
        }
    }
    
    // Check if toast container exists, create if not
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toastId = 'toast-' + Date.now();
    const toastHtml = `
    <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="toast-header">
            <strong class="me-auto">${t('systemTitle')}</strong>
            <small>${t('justNow')}</small>
            <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">
            ${message}
        </div>
    </div>
    `;
    
    // Add toast to container
    toastContainer.insertAdjacentHTML('beforeend', toastHtml);
    
    // Initialize and show toast
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, { autohide: true, delay: 3000 });
    toast.show();
    
    // Remove toast after it's hidden
    toastElement.addEventListener('hidden.bs.toast', function() {
        toastElement.remove();
    });
}

/**
 * Initialize chemistry chart
 */
function initializeChemistryChart() {
    const ctx = document.getElementById('chemistryChart');
    
    if (!ctx) return;
    
    // Generate sample data
    const hours = 24;
    const labels = Array.from({length: hours}, (_, i) => `${23 - i}h ago`);
    
    // Sample pH data
    const phData = [];
    for (let i = 0; i < hours; i++) {
        phData.push(7.4 + (Math.random() - 0.5) * 0.3);
    }
    
    // Sample chlorine data
    const clData = [];
    for (let i = 0; i < hours; i++) {
        clData.push(1.2 + (Math.random() - 0.5) * 0.4);
    }
    
    // Create chart
    chemistryChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.reverse(),
            datasets: [
                {
                    label: 'pH',
                    data: phData.reverse(),
                    borderColor: 'rgba(13, 110, 253, 1)',
                    backgroundColor: 'rgba(13, 110, 253, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: false,
                    yAxisID: 'y-ph'
                },
                {
                    label: 'Free Chlorine',
                    data: clData.reverse(),
                    borderColor: 'rgba(25, 135, 84, 1)',
                    backgroundColor: 'rgba(25, 135, 84, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: false,
                    yAxisID: 'y-cl'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            scales: {
                x: {
                    ticks: {
                        maxRotation: 0
                    }
                },
                'y-ph': {
                    type: 'linear',
                    position: 'left',
                    title: {
                        display: true,
                        text: 'pH'
                    },
                    min: 6.8,
                    max: 8.0,
                    grid: {
                        drawOnChartArea: true
                    }
                },
                'y-cl': {
                    type: 'linear',
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Chlorine (mg/L)'
                    },
                    min: 0,
                    max: 3,
                    grid: {
                        drawOnChartArea: false
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(2);
                                if (context.dataset.label === 'pH') {
                                    label += ' pH';
                                } else if (context.dataset.label === 'Free Chlorine') {
                                    label += ' mg/L';
                                }
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Update chemistry chart with new data
 */
function updateChemistryChart(hours) {
    if (!chemistryChart) return;
    
    hours = parseInt(hours);
    
    // Generate new labels
    const labels = Array.from({length: hours}, (_, i) => `${hours - 1 - i}h ago`);
    
    // Generate new data
    const phData = [];
    const clData = [];
    
    for (let i = 0; i < hours; i++) {
        phData.push(7.4 + (Math.random() - 0.5) * 0.3);
        clData.push(1.2 + (Math.random() - 0.5) * 0.4);
    }
    
    // Update chart data
    chemistryChart.data.labels = labels;
    chemistryChart.data.datasets[0].data = phData;
    chemistryChart.data.datasets[1].data = clData;
    
    // Update chart
    chemistryChart.update();
}

/**
 * Update detailed water chemistry displays
 */
function updateWaterChemistryDisplays() {
    // Update pH detail panel
    document.getElementById('phDetailValue').textContent = mockData.ph.toFixed(2);
    document.getElementById('phPumpDetailStatus').innerHTML = mockData.phPumpRunning ? 
        '<i class="bi bi-droplet-fill me-1 text-primary"></i> ' + t('pumpActive') : 
        '<i class="bi bi-droplet me-1"></i> ' + t('pumpInactive');
    
    if (mockData.phPumpRunning) {
        document.getElementById('phPumpDetailStatus').className = 'text-primary pump-active';
    } else {
        document.getElementById('phPumpDetailStatus').className = 'text-secondary';
    }
    
    // Update pH marker position
    const phPercentage = ((mockData.ph - 6.8) / (8.0 - 6.8)) * 100;
    document.querySelector('.ph-marker').style.left = `${phPercentage}%`;
    
    // Update chlorine detail panel
    document.getElementById('freeChlorineDetailValue').textContent = mockData.freeChlorine.toFixed(2);
    document.getElementById('combinedChlorineDetailValue').textContent = mockData.combinedChlorine.toFixed(2);
    document.getElementById('clPumpDetailStatus').innerHTML = mockData.clPumpRunning ? 
        '<i class="bi bi-droplet-fill me-1 text-primary"></i> ' + t('pumpActive') : 
        '<i class="bi bi-droplet me-1"></i> ' + t('pumpInactive');
    
    if (mockData.clPumpRunning) {
        document.getElementById('clPumpDetailStatus').className = 'text-primary pump-active';
    } else {
        document.getElementById('clPumpDetailStatus').className = 'text-secondary';
    }
    
    // Update chlorine marker position
    const clPercentage = ((mockData.freeChlorine - 0.5) / (5.0 - 0.5)) * 100;
    document.querySelector('.chlorine-marker').style.left = `${clPercentage}%`;
    
    // Update trends randomly for simulation
    if (Math.random() > 0.7) {
        const phTrend = Math.random() > 0.5 ? 
            '<i class="bi bi-arrow-up-short trend-up"></i> +0.1 in 1h' : 
            '<i class="bi bi-arrow-down-short trend-down"></i> -0.1 in 1h';
        document.getElementById('phTrend').innerHTML = phTrend;
        
        const clTrend = Math.random() > 0.5 ? 
            '<i class="bi bi-arrow-up-short trend-up"></i> +0.1 in 1h' : 
            '<i class="bi bi-arrow-down-short trend-down"></i> -0.1 in 1h';
        document.getElementById('chlorineTrend').innerHTML = clTrend;
    }
}

/**
 * Update all parameter displays with current values
 */
function updateParameterDisplays(data) {
    // Update pH
    updateParameter('ph', data.ph, 7.2, 7.6, 6.8, 8.0);
    updatePumpStatus('phPump', data.phPumpRunning);
    
    // Update ORP
    updateParameter('orp', data.orp, 650, 750, 600, 800);
    
    // Update Chlorine
    updateParameter('freeChlorine', data.freeChlorine, 1.0, 2.0, 0.5, 3.0);
    document.getElementById('combinedChlorineValue').textContent = data.combinedChlorine.toFixed(1);
    updateChlorineStatus(data.freeChlorine, data.combinedChlorine);
    updatePumpStatus('clPump', data.clPumpRunning);
    
    // Update Turbidity
    updateParameter('turbidity', data.turbidity, 0.12, 0.25, 0.0, 0.5);
    updatePumpStatus('pacPump', data.pacPumpRunning);
    
    // Update Temperature
    updateParameter('temp', data.temperature, 26, 30, 20, 32);
    
    // Update UV System
    document.getElementById('uvIntensity').textContent = data.uvIntensity;
    const uvMarker = document.querySelector('#uvStatus + div .parameter-marker');
    if (uvMarker) {
        uvMarker.style.left = data.uvIntensity + '%';
    }
}

/**
 * Update a single parameter display
 */
function updateParameter(id, value, lowThreshold, highThreshold, minValue, maxValue) {
    // Update value
    const valueEl = document.getElementById(id + 'Value');
    if (valueEl) {
        if (typeof value === 'number') {
            if (id === 'orp' || id === 'uvIntensity') {
                valueEl.textContent = Math.round(value);
            } else if (value < 10) {
                valueEl.textContent = value.toFixed(2);
            } else {
                valueEl.textContent = value.toFixed(1);
            }
        } else {
            valueEl.textContent = value;
        }
    }
    
    // Update status
    const statusEl = document.getElementById(id + 'Status');
    if (statusEl) {
        if (value >= lowThreshold && value <= highThreshold) {
            statusEl.textContent = t('good');
            statusEl.className = 'badge bg-success';
        } else if (value >= minValue && value <= maxValue) {
            statusEl.textContent = t('fair');
            statusEl.className = 'badge bg-warning';
        } else {
            statusEl.textContent = t('poor');
            statusEl.className = 'badge bg-danger';
        }
    }
    
    // Update marker position
    const markerEl = document.querySelector(`#${id}Value`).closest('.d-flex').querySelector('.parameter-marker');
    if (markerEl) {
        const percentage = ((value - minValue) / (maxValue - minValue)) * 100;
        markerEl.style.left = `${Math.min(100, Math.max(0, percentage))}%`;
    }
}

/**
 * Update chlorine status based on both free and combined values
 */
function updateChlorineStatus(freeChlorine, combinedChlorine) {
    const statusEl = document.getElementById('chlorineStatus');
    if (!statusEl) return;
    
    if (freeChlorine >= 1.0 && freeChlorine <= 2.0 && combinedChlorine <= 0.3) {
        statusEl.textContent = t('good');
        statusEl.className = 'badge bg-success';
    } else if (freeChlorine >= 0.5 && freeChlorine <= 3.0 && combinedChlorine <= 0.5) {
        statusEl.textContent = t('fair');
        statusEl.className = 'badge bg-warning';
    } else {
        statusEl.textContent = t('poor');
        statusEl.className = 'badge bg-danger';
    }
}

/**
 * Update pump status display
 */
function updatePumpStatus(id, running) {
    const statusEl = document.getElementById(id + 'Status');
    if (!statusEl) return;
    
    if (running) {
        statusEl.textContent = id === 'pacPump' ? t('pacPumpActive') : t('pumpActive');
        statusEl.className = 'text-primary pump-active';
        statusEl.previousElementSibling.className = 'bi bi-droplet-fill me-2 text-primary';
    } else {
        statusEl.textContent = id === 'pacPump' ? t('pacPumpInactive') : t('pumpInactive');
        statusEl.className = 'text-secondary';
        statusEl.previousElementSibling.className = 'bi bi-droplet me-2';
    }
}

/**
 * Fetch current system status
 */
function fetchStatus() {
    fetch('/api/status')
        .then(response => response.json())
        .then(data => {
            console.log('Status:', data);
            const mode = data.simulation_mode ? 'simulation' : 'production';
            updateStatusBar(`System running in ${mode} mode (v${data.version})`, 'info');
        })
        .catch(error => {
            console.error('Error fetching status:', error);
            updateStatusBar('Error connecting to server', 'danger');
        });
}

/**
 * Update status bar
 */
function updateStatusBar(message, type) {
    const statusBar = document.getElementById('statusBar');
    statusBar.className = `alert alert-${type}`;
    statusBar.textContent = message;
}

/**
 * Set operation mode
 */
function setMode(mode) {
    const autoBtn = document.getElementById('autoMode');
    const manualBtn = document.getElementById('manualMode');
    
    if (mode === 'automatic') {
        autoBtn.classList.add('btn-success', 'active');
        autoBtn.classList.remove('btn-outline-secondary');
        
        manualBtn.classList.add('btn-outline-secondary');
        manualBtn.classList.remove('btn-warning', 'active');
        
        updateStatusBar('Automatic mode activated', 'success');
    } else {
        manualBtn.classList.add('btn-warning', 'active');
        manualBtn.classList.remove('btn-outline-secondary');
        
        autoBtn.classList.add('btn-outline-secondary');
        autoBtn.classList.remove('btn-success', 'active');
        
        updateStatusBar('Manual mode activated', 'warning');
    }

    // Update control availability based on mode
    updateControlsBasedOnMode();
}

/**
 * Simulate data changes for demonstration
 */
function simulateDataChanges() {
    // Add small random variations to mock data
    mockData.ph = clamp(mockData.ph + (Math.random() - 0.5) * 0.1, 6.8, 8.0);
    mockData.orp = clamp(mockData.orp + (Math.random() - 0.5) * 20, 600, 800);
    mockData.freeChlorine = clamp(mockData.freeChlorine + (Math.random() - 0.5) * 0.1, 0.5, 3.0);
    mockData.combinedChlorine = clamp(mockData.combinedChlorine + (Math.random() - 0.5) * 0.05, 0, 0.5);
    mockData.turbidity = clamp(mockData.turbidity + (Math.random() - 0.5) * 0.02, 0.05, 0.5);
    mockData.temperature = clamp(mockData.temperature + (Math.random() - 0.5) * 0.2, 20, 32);
    
    // Occasionally toggle pump states
    if (Math.random() < 0.1) {
        mockData.phPumpRunning = !mockData.phPumpRunning;
    }
    if (Math.random() < 0.1) {
        mockData.clPumpRunning = !mockData.clPumpRunning;
    }
    if (Math.random() < 0.1) {
        mockData.pacPumpRunning = !mockData.pacPumpRunning;
    }
    
    // Update displays
    updateParameterDisplays(mockData);

    // Update Water Chemistry displays
    updateWaterChemistryDisplays();

    // Update Turbidity & PAC displays
    updateTurbidityPACDisplays();
}

/**
 * Helper function to clamp values between min and max
 */
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

/**
 * Helper function to get URL parameters
 */
function getParameterByName(name, url = window.location.href) {
    name = name.replace(/[\[\]]/g, '\\$&');
    const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

// Global variables for charts
let turbidityChart = null;

/**
 * Initialize turbidity and PAC controls
 */
function initializeTurbidityPACControls() {
    // Initialize auto switch
    document.getElementById('pacAutoSwitch').addEventListener('change', function() {
        togglePACAutoMode(this.checked);
    });
    
    // Initialize threshold input fields
    document.getElementById('pacHighThreshold').addEventListener('change', function() {
        updatePACThresholds();
    });
    
    document.getElementById('pacLowThreshold').addEventListener('change', function() {
        updatePACThresholds();
    });
    
    document.getElementById('pacTargetValue').addEventListener('change', function() {
        updatePACThresholds();
    });
    
    // Initialize manual control buttons
    document.getElementById('pacDoseBtn').addEventListener('click', function() {
        const flowRate = document.getElementById('pacFlowRate').value;
        startPACDosing(flowRate);
    });
    
    document.getElementById('pacStopBtn').addEventListener('click', function() {
        stopPACDosing();
    });
    
    // Initialize chart
    initializeTurbidityChart();
    
    // Add event listener for time range change
    document.getElementById('turbidityTimeRange').addEventListener('change', function() {
        updateTurbidityChart(this.value);
    });
    
    // Initial update of controls based on mode
    updateTurbidityPACControlsBasedOnMode();
}

/**
 * Toggle PAC auto/manual mode
 */
function togglePACAutoMode(isAuto) {
    // Update UI based on mode
    if (isAuto) {
        document.getElementById('pacDosingStatus').textContent = 'Optimized';
        document.getElementById('pacDosingStatus').className = 'badge bg-success';
        
        // Disable manual controls
        document.getElementById('pacDoseBtn').disabled = true;
        document.getElementById('pacStopBtn').disabled = true;
        document.getElementById('pacFlowRate').disabled = true;
        
        // Disable threshold inputs
        document.getElementById('pacHighThreshold').disabled = false;
        document.getElementById('pacLowThreshold').disabled = false;
        document.getElementById('pacTargetValue').disabled = false;
        
        showToast('PAC dosing switched to automatic mode');
    } else {
        document.getElementById('pacDosingStatus').textContent = 'Manual';
        document.getElementById('pacDosingStatus').className = 'badge bg-warning';
        
        // Enable manual controls if in manual mode
        const isManualMode = document.getElementById('manualMode').classList.contains('active');
        document.getElementById('pacDoseBtn').disabled = !isManualMode;
        document.getElementById('pacStopBtn').disabled = !isManualMode;
        document.getElementById('pacFlowRate').disabled = !isManualMode;
        
        // Disable threshold inputs in manual mode
        document.getElementById('pacHighThreshold').disabled = true;
        document.getElementById('pacLowThreshold').disabled = true;
        document.getElementById('pacTargetValue').disabled = true;
        
        showToast('PAC dosing switched to manual mode');
    }
}

/**
 * Update PAC control thresholds
 */
function updatePACThresholds() {
    const highThreshold = parseFloat(document.getElementById('pacHighThreshold').value);
    const lowThreshold = parseFloat(document.getElementById('pacLowThreshold').value);
    const targetValue = parseFloat(document.getElementById('pacTargetValue').value);
    
    // Validate thresholds
    if (lowThreshold >= highThreshold) {
        document.getElementById('pacLowThreshold').value = (highThreshold - 0.05).toFixed(2);
        showToast('Low threshold must be less than high threshold', 'warning');
    }
    
    if (targetValue >= highThreshold) {
        document.getElementById('pacTargetValue').value = (highThreshold - 0.03).toFixed(2);
        showToast('Target value must be less than high threshold', 'warning');
    }
    
    if (targetValue <= lowThreshold) {
        document.getElementById('pacTargetValue').value = (lowThreshold + 0.03).toFixed(2);
        showToast('Target value must be greater than low threshold', 'warning');
    }
    
    showToast('PAC dosing thresholds updated');
}

/**
 * Update controls based on operation mode
 */
function updateTurbidityPACControlsBasedOnMode() {
    const isManualMode = document.getElementById('manualMode').classList.contains('active');
    const isAutoMode = document.getElementById('pacAutoSwitch').checked;
    
    // Enable or disable control buttons based on mode
    if (!isAutoMode) {
        document.getElementById('pacDoseBtn').disabled = !isManualMode;
        document.getElementById('pacStopBtn').disabled = !isManualMode;
        document.getElementById('pacFlowRate').disabled = !isManualMode;
    } else {
        document.getElementById('pacDoseBtn').disabled = true;
        document.getElementById('pacStopBtn').disabled = true;
        document.getElementById('pacFlowRate').disabled = true;
    }
}

/**
 * Simulate starting PAC dosing
 */
function startPACDosing(flowRate) {
    mockData.pacPumpRunning = true;
    mockData.pacDosingRate = parseInt(flowRate);
    updatePumpStatus('pacPump', true);
    updatePumpStatus('pacPumpDetail', true);
    
    // Show toast notification with translated message
    const message = `${t('startDosing')} ${t('at')} ${flowRate} ml/h`;
    showToast(message);
}

/**
 * Simulate stopping PAC dosing
 */
function stopPACDosing() {
    mockData.pacPumpRunning = false;
    updatePumpStatus('pacPump', false);
    updatePumpStatus('pacPumpDetail', false);
    
    // Show toast notification with translated message
    showToast(t('pacDosingStop'));
}

/**
 * Update detailed turbidity and PAC displays
 */
function updateTurbidityPACDisplays() {
    // Null checks for all DOM operations
    const turbidityDetailValue = document.getElementById('turbidityDetailValue');
    if (turbidityDetailValue) {
        turbidityDetailValue.textContent = mockData.turbidity.toFixed(2);
    }
    
    // Update turbidity marker position
    const turbidityMarker = document.querySelector('.turbidity-marker');
    if (turbidityMarker) {
        const turbidityPercentage = ((mockData.turbidity - 0.05) / (0.5 - 0.05)) * 100;
        turbidityMarker.style.left = `${turbidityPercentage}%`;
    }
    
    // Update PAC panel
    const pacDosingRate = document.getElementById('pacDosingRate');
    if (pacDosingRate) {
        pacDosingRate.textContent = mockData.pacDosingRate;
    }
    
    const pacPumpDetailStatus = document.getElementById('pacPumpDetailStatus');
    if (pacPumpDetailStatus) {
        pacPumpDetailStatus.innerHTML = mockData.pacPumpRunning ? 
            '<i class="bi bi-droplet-fill me-1 text-primary"></i> ' + t('running') : 
            '<i class="bi bi-droplet me-1"></i> ' + t('idle');
        
        pacPumpDetailStatus.className = mockData.pacPumpRunning ? 
            'text-primary pump-active' : 'text-secondary';
    }
    
    // Update filter efficiency calculation (simplified simulation)
    const filterEfficiency = document.getElementById('filterEfficiency');
    if (filterEfficiency) {
        const efficiency = Math.round(85 - mockData.turbidity * 100);
        filterEfficiency.textContent = `${efficiency}%`;
    }
    
    // Update filter load progress
    const filterLoadProgress = document.getElementById('filterLoadProgress');
    if (filterLoadProgress) {
        const filterLoad = Math.round(mockData.turbidity * 100) + 10;
        filterLoadProgress.style.width = `${filterLoad}%`;
        filterLoadProgress.textContent = `${filterLoad}%`;
        filterLoadProgress.setAttribute('aria-valuenow', filterLoad);
        
        // Update filter load color based on value
        if (filterLoad < 40) {
            filterLoadProgress.className = 'progress-bar bg-success';
        } else if (filterLoad < 70) {
            filterLoadProgress.className = 'progress-bar bg-warning';
        } else {
            filterLoadProgress.className = 'progress-bar bg-danger';
        }
    }
    
    // Update PAC level indicator randomly for simulation
    const pacLevelIndicator = document.getElementById('pacLevelIndicator');
    if (pacLevelIndicator && Math.random() > 0.95) {
        const pacLevel = Math.round(Math.random() * 30) + 40; // 40-70%
        pacLevelIndicator.style.height = `${pacLevel}%`;
        pacLevelIndicator.setAttribute('aria-valuenow', pacLevel);
        
        const pacLevelText = pacLevelIndicator.nextElementSibling;
        if (pacLevelText) {
            pacLevelText.textContent = `${pacLevel}%`;
        }
    }
    
    // Update trends randomly for simulation
    const turbidityTrend = document.getElementById('turbidityTrend');
    if (turbidityTrend && Math.random() > 0.7) {
        const trendHtml = Math.random() > 0.5 ? 
            '<i class="bi bi-arrow-up-short trend-up"></i> +0.02 in 1h' : 
            '<i class="bi bi-arrow-down-short trend-down"></i> -0.02 in 1h';
        turbidityTrend.innerHTML = trendHtml;
    }
}

/**
 * Initialize turbidity chart
 */
function initializeTurbidityChart() {
    const ctx = document.getElementById('turbidityChart');
    
    if (!ctx) return;
    
    // Generate sample data
    const hours = 24;
    const labels = Array.from({length: hours}, (_, i) => `${23 - i}h ago`);
    
    // Sample turbidity data
    const turbidityData = [];
    for (let i = 0; i < hours; i++) {
        turbidityData.push(0.15 + (Math.random() - 0.5) * 0.1);
    }
    
    // Sample dosing events data
    const dosingEvents = [];
    for (let i = 0; i < hours; i++) {
        if (Math.random() > 0.7) {
            dosingEvents.push({
                x: `${23 - i}h ago`,
                y: 0.4 // Top of the chart
            });
        } else {
            dosingEvents.push(null);
        }
    }
    
    // Create chart
    turbidityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Turbidity (NTU)',
                    data: turbidityData,
                    borderColor: 'rgba(13, 110, 253, 1)',
                    backgroundColor: 'rgba(13, 110, 253, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true
                },
                {
                    label: 'PAC Dosing',
                    data: dosingEvents,
                    borderColor: 'rgba(220, 53, 69, 0.8)',
                    backgroundColor: 'rgba(220, 53, 69, 0.8)',
                    borderWidth: 1,
                    pointRadius: 6,
                    pointStyle: 'triangle',
                    pointRotation: 180,
                    showLine: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'nearest',
                intersect: false
            },
            scales: {
                x: {
                    ticks: {
                        maxRotation: 0
                    }
                },
                y: {
                    type: 'linear',
                    min: 0,
                    max: 0.5,
                    title: {
                        display: true,
                        text: 'Turbidity (NTU)'
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (context.dataset.label === 'PAC Dosing' && context.raw !== null) {
                                return 'PAC Dosing Event';
                            }
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(2) + ' NTU';
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Update turbidity chart with new data
 */
function updateTurbidityChart(hours) {
    if (!turbidityChart) return;
    
    hours = parseInt(hours);
    
    // Generate new labels
    const labels = Array.from({length: hours}, (_, i) => `${hours - 1 - i}h ago`);
    
    // Generate new data
    const turbidityData = [];
    const dosingEvents = [];
    
    for (let i = 0; i < hours; i++) {
        turbidityData.push(0.15 + (Math.random() - 0.5) * 0.1);
        
        if (Math.random() > 0.7) {
            dosingEvents.push({
                x: `${hours - 1 - i}h ago`,
                y: 0.4 // Top of the chart
            });
        } else {
            dosingEvents.push(null);
        }
    }
    
    // Update chart data
    turbidityChart.data.labels = labels;
    turbidityChart.data.datasets[0].data = turbidityData;
    turbidityChart.data.datasets[1].data = dosingEvents;
    
    // Update chart
    turbidityChart.update();
}

// Global variables for history charts
let historyChart = null;

/**
 * Initialize history tab functionality
 */
function initializeHistoryTab() {
    console.log('Initializing History Tab');
    
    // Initialize time range controls
    document.getElementById('historyPresetRange').addEventListener('change', function() {
        const value = this.value;
        if (value === 'custom') {
            document.getElementById('customDateRange').style.display = 'block';
            // Set default date range (last 7 days)
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 7);
            
            document.getElementById('historyStartDate').value = formatDateTimeForInput(startDate);
            document.getElementById('historyEndDate').value = formatDateTimeForInput(endDate);
        } else {
            document.getElementById('customDateRange').style.display = 'none';
            // Update chart with selected preset
            updateHistoryChart(parseInt(value));
        }
    });
    
    // Initialize apply custom range button
    document.getElementById('applyCustomRange').addEventListener('click', function() {
        const startDate = new Date(document.getElementById('historyStartDate').value);
        const endDate = new Date(document.getElementById('historyEndDate').value);
        
        if (startDate && endDate) {
            if (startDate > endDate) {
                showToast('Start date must be before end date', 'warning');
                return;
            }
            updateHistoryChartCustomRange(startDate, endDate);
        } else {
            showToast('Please select valid date range', 'warning');
        }
    });
    
    // Initialize refresh button
    document.getElementById('refreshHistoryBtn').addEventListener('click', function() {
        const rangeSelect = document.getElementById('historyPresetRange');
        const value = rangeSelect.value;
        
        if (value === 'custom') {
            document.getElementById('applyCustomRange').click();
        } else {
            updateHistoryChart(parseInt(value));
        }
        
        showToast('Historical data refreshed');
    });
    
    // Initialize parameter checkboxes
    document.querySelectorAll('#history-tab input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            updateHistoryChartVisibility();
        });
    });
    
    // Initialize visualization type
    document.getElementById('visualizationType').addEventListener('change', function() {
        updateHistoryChartType(this.value);
    });
    
    // Initialize resolution selection
    document.getElementById('dataResolution').addEventListener('change', function() {
        // This would typically re-fetch data with different resolution
        // For demo, we'll just show a toast
        showToast(`Data resolution changed to ${this.options[this.selectedIndex].text}`);
        // Simulate chart update
        updateHistoryChart(parseInt(document.getElementById('historyPresetRange').value));
    });
    
    // Initialize export buttons
    document.getElementById('downloadChartBtn').addEventListener('click', function() {
        // This would typically generate a download
        // For demo, we'll just show a toast
        showToast('Chart data export started');
    });
    
    document.getElementById('exportCsvBtn').addEventListener('click', function() {
        // This would typically generate a CSV download
        // For demo, we'll just show a toast
        showToast('CSV export started');
    });
    
    document.getElementById('exportJsonBtn').addEventListener('click', function() {
        // This would typically generate a JSON download
        // For demo, we'll just show a toast
        showToast('JSON export started');
    });
    
    // Initialize event type filter
    document.getElementById('eventTypeFilter').addEventListener('change', function() {
        filterEventsByType(this.value);
    });
    
    // Initialize tables with consistent data
    initializeTableData();
    
    // Create initial history chart
    initializeHistoryChart();
    
    // Initialize pagination controls
    initializePagination();

    // Load initial data based on default selections
    updateHistoryChart(168); // Default: 7 days
}

/**
 * Initialize history chart with better defaults
 */
function initializeHistoryChart() {
    const ctx = document.getElementById('historyChart');
    
    if (!ctx) {
        console.error('Chart canvas element not found!');
        return;
    }
    
    console.log('Initializing history chart...');
    
    // Generate sample data
    const hours = 168; // 7 days
    const labels = [];
    const now = new Date();
    
    // Generate labels with less density (every 6 hours instead of hourly)
    for (let i = hours - 1; i >= 0; i -= 6) {
        const date = new Date(now);
        date.setHours(date.getHours() - i);
        labels.push(formatDateTime(date));
    }
    
    // Sample data sets with smoothing
    const phData = smoothData(generateSampleData(7.4, 0.2, Math.ceil(hours/6)));
    const orpData = smoothData(generateSampleData(720, 30, Math.ceil(hours/6)));
    const freeChlorineData = smoothData(generateSampleData(1.2, 0.3, Math.ceil(hours/6)));
    const combinedChlorineData = smoothData(generateSampleData(0.2, 0.1, Math.ceil(hours/6)));
    const turbidityData = smoothData(generateSampleData(0.15, 0.05, Math.ceil(hours/6)));
    const temperatureData = smoothData(generateSampleData(28, 1, Math.ceil(hours/6)));
    
    // Create a cleaner chart
    try {
        historyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'pH',
                        data: phData,
                        borderColor: 'rgba(13, 110, 253, 1)',
                        backgroundColor: 'rgba(13, 110, 253, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: false,
                        yAxisID: 'y-ph'
                    },
                    {
                        label: 'ORP',
                        data: orpData,
                        borderColor: 'rgba(108, 117, 125, 1)',
                        backgroundColor: 'rgba(108, 117, 125, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: false,
                        hidden: true, // Initially hidden
                        yAxisID: 'y-orp'
                    },
                    {
                        label: 'Free Chlorine',
                        data: freeChlorineData,
                        borderColor: 'rgba(25, 135, 84, 1)',
                        backgroundColor: 'rgba(25, 135, 84, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: false,
                        yAxisID: 'y-chlorine'
                    },
                    {
                        label: 'Combined Chlorine',
                        data: combinedChlorineData,
                        borderColor: 'rgba(25, 135, 84, 0.6)',
                        backgroundColor: 'rgba(25, 135, 84, 0.05)',
                        borderWidth: 1.5,
                        borderDash: [5, 5],
                        tension: 0.4,
                        fill: false,
                        hidden: true, // Initially hidden
                        yAxisID: 'y-chlorine'
                    },
                    {
                        label: 'Turbidity',
                        data: turbidityData,
                        borderColor: 'rgba(220, 53, 69, 1)',
                        backgroundColor: 'rgba(220, 53, 69, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: false,
                        hidden: true, // Initially hidden
                        yAxisID: 'y-turbidity'
                    },
                    {
                        label: 'Temperature',
                        data: temperatureData,
                        borderColor: 'rgba(255, 193, 7, 1)',
                        backgroundColor: 'rgba(255, 193, 7, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: false,
                        hidden: true, // Initially hidden
                        yAxisID: 'y-temp'
                    },
                    {
                        label: 'Dosing Events',
                        data: generateSimplifiedDosingEvents(Math.ceil(hours/6)),
                        borderColor: 'rgba(13, 202, 240, 1)',
                        backgroundColor: 'rgba(13, 202, 240, 1)',
                        borderWidth: 2,
                        pointRadius: 12,
                        pointStyle: 'triangle',
                        pointRotation: 0,
                        showLine: false,
                        yAxisID: 'y-ph' // Positioned on pH axis for visibility
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    x: {
                        ticks: {
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 10
                        }
                    },
                    'y-ph': {
                        type: 'linear',
                        position: 'left',
                        title: {
                            display: true,
                            text: 'pH'
                        },
                        min: 6.8,
                        max: 8.0,
                        grid: {
                            drawOnChartArea: true
                        }
                    },
                    'y-chlorine': {
                        type: 'linear',
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Chlorine (mg/L)'
                        },
                        min: 0,
                        max: 3,
                        grid: {
                            drawOnChartArea: false
                        }
                    },
                    'y-orp': {
                        type: 'linear',
                        position: 'right',
                        title: {
                            display: false, // Hide by default
                            text: 'ORP (mV)'
                        },
                        min: 600,
                        max: 800,
                        display: false // Initially hidden
                    },
                    'y-turbidity': {
                        type: 'linear',
                        position: 'right',
                        title: {
                            display: false, // Hide by default
                            text: 'Turbidity (NTU)'
                        },
                        min: 0,
                        max: 0.5,
                        display: false // Initially hidden
                    },
                    'y-temp': {
                        type: 'linear',
                        position: 'right',
                        title: {
                            display: false, // Hide by default
                            text: 'Temperature (°C)'
                        },
                        min: 22,
                        max: 32,
                        display: false // Initially hidden
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true
                        },
                        // Make legend display-only by providing an empty click handler
                        onClick: function(e, legendItem, legend) {
                            // Do nothing - legend is display only
                            return;
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.dataset.label === 'Dosing Events' && context.raw !== null) {
                                    return 'Dosing Event';
                                }
                                if (context.parsed.y !== null) {
                                    label += context.parsed.y.toFixed(2);
                                    if (context.dataset.label === 'pH') {
                                        label += ' pH';
                                    } else if (context.dataset.label.includes('Chlorine')) {
                                        label += ' mg/L';
                                    } else if (context.dataset.label === 'ORP') {
                                        label += ' mV';
                                    } else if (context.dataset.label === 'Turbidity') {
                                        label += ' NTU';
                                    } else if (context.dataset.label === 'Temperature') {
                                        label += ' °C';
                                    }
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
        
        console.log('Chart initialized successfully');
        
        // Link parameter checkboxes to chart visibility
        linkCheckboxesToChart();
        syncCheckboxesWithChart();
        
        // Initialize parameter buttons
        initializeParameterButtons();
        
    } catch (error) {
        console.error('Error initializing chart:', error);
    }
}

/**
 * Initialize parameter button states based on chart visibility
 */
function initializeParameterButtons() {
    if (!historyChart) return;
    
    // Map parameters to their dataset indices
    const paramMap = {
        'pH': 0,
        'ORP': 1,
        'Free Chlorine': 2,
        'Combined Cl': 3,
        'Turbidity': 4,
        'Temperature': 5
    };
    
    // Set up click handlers for all parameter buttons
    document.querySelectorAll('.parameters button').forEach(button => {
        // Remove existing click handlers by cloning the button
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        // Add our new handler
        newButton.addEventListener('click', function() {
            // Get parameter name and dataset index
            const paramName = this.textContent.trim();
            const datasetIndex = paramMap[paramName];
            
            if (datasetIndex !== undefined) {
                // Toggle visibility in the chart
                const currentVisibility = historyChart.isDatasetVisible(datasetIndex);
                const newVisibility = !currentVisibility;
                
                // Update chart visibility
                historyChart.setDatasetVisibility(datasetIndex, newVisibility);
                
                // Update button appearance
                this.classList.toggle('active', newVisibility);
                this.classList.toggle('btn-primary', newVisibility);
                this.classList.toggle('btn-outline-secondary', !newVisibility);
                
                // Update corresponding checkbox
                const checkboxMap = {
                    'pH': 'showPh',
                    'ORP': 'showOrp',
                    'Free Chlorine': 'showFreeChlorine',
                    'Combined Cl': 'showCombinedChlorine', 
                    'Turbidity': 'showTurbidity',
                    'Temperature': 'showTemp'
                };
                
                const checkbox = document.getElementById(checkboxMap[paramName]);
                if (checkbox) {
                    checkbox.checked = newVisibility;
                }
                
                // Update axis visibility
                updateAllAxisVisibility();
                
                // Update chart
                historyChart.update();
            }
        });
        
        // Set initial state
        const paramName = newButton.textContent.trim();
        const datasetIndex = paramMap[paramName];
        if (datasetIndex !== undefined) {
            const isVisible = historyChart.isDatasetVisible(datasetIndex);
            newButton.classList.toggle('active', isVisible);
            newButton.classList.toggle('btn-primary', isVisible);
            newButton.classList.toggle('btn-outline-secondary', !isVisible);
        }
    });
    
    // Set up dosing events checkbox
    const dosingEventsCheckbox = document.getElementById('showDosingEvents');
    if (dosingEventsCheckbox) {
        dosingEventsCheckbox.addEventListener('change', function() {
            historyChart.setDatasetVisibility(6, this.checked);
            updateAllAxisVisibility();
            historyChart.update();
        });
    }
}

/**
 * Simplified dosing events generator
 */
function generateSimplifiedDosingEvents(count) {
    const events = Array(count).fill(null);
    
    // Add 5-8 random dosing events
    const numEvents = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < numEvents; i++) {
        const position = Math.floor(Math.random() * count);
        events[position] = 7.8; // Position near the top of pH scale
    }
    
    return events;
}

/**
 * Apply smoothing to data
 */
function smoothData(data) {
    // Simple moving average smoothing
    const smoothed = [];
    const windowSize = 3;
    
    for (let i = 0; i < data.length; i++) {
        let sum = 0;
        let count = 0;
        
        for (let j = Math.max(0, i - windowSize + 1); j <= i; j++) {
            sum += data[j];
            count++;
        }
        
        smoothed.push(sum / count);
    }
    
    return smoothed;
}

/**
 * Link parameter checkboxes to chart visibility
 */
function linkCheckboxesToChart() {
    if (!historyChart) return;
    
    // Map checkboxes to dataset indices
    const checkboxMap = {
        'showPh': 0,
        'showOrp': 1,
        'showFreeChlorine': 2,
        'showCombinedChlorine': 3,
        'showTurbidity': 4,
        'showTemp': 5
    };
    
    // Link checkbox change events
    Object.keys(checkboxMap).forEach(checkboxId => {
        const checkbox = document.getElementById(checkboxId);
        if (checkbox) {
            checkbox.addEventListener('change', function() {
                const datasetIndex = checkboxMap[this.id];
                
                // Update dataset visibility
                historyChart.setDatasetVisibility(datasetIndex, this.checked);
                
                // Update parameter button state
                const buttonMap = {
                    'showPh': 'pH',
                    'showOrp': 'ORP',
                    'showFreeChlorine': 'Free Chlorine',
                    'showCombinedChlorine': 'Combined Cl',
                    'showTurbidity': 'Turbidity',
                    'showTemp': 'Temperature'
                };
                
                const paramName = buttonMap[this.id];
                document.querySelectorAll('.parameters button').forEach(button => {
                    if (button.textContent.trim() === paramName) {
                        button.classList.toggle('active', this.checked);
                        button.classList.toggle('btn-primary', this.checked);
                        button.classList.toggle('btn-outline-secondary', !this.checked);
                    }
                });
                
                // Update all axes visibility
                updateAllAxisVisibility();
                
                // Update chart
                historyChart.update();
            });
        }
    });
    
    // Link dosing events checkbox
    const dosingEventsCheckbox = document.getElementById('showDosingEvents');
    if (dosingEventsCheckbox) {
        dosingEventsCheckbox.addEventListener('change', function() {
            historyChart.setDatasetVisibility(6, this.checked);
            updateAllAxisVisibility();
            historyChart.update();
        });
    }
}

/**
 * Update history chart with new data for a time period
 */
function updateHistoryChart(hours) {
    if (!historyChart) return;
    
    // Generate sample data
    const labels = [];
    const now = new Date();
    
    for (let i = hours - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setHours(date.getHours() - i);
        labels.push(formatDateTime(date));
    }
    
    // Sample data sets
    const phData = generateSampleData(7.4, 0.2, hours);
    const orpData = generateSampleData(720, 30, hours);
    const freeChlorineData = generateSampleData(1.2, 0.3, hours);
    const combinedChlorineData = generateSampleData(0.2, 0.1, hours);
    const turbidityData = generateSampleData(0.15, 0.05, hours);
    const temperatureData = generateSampleData(28, 1, hours);
    
    // Generate dosing events
    const dosingEvents = generateSampleEvents(hours, Math.max(5, Math.floor(hours / 12)));
    
    // Update chart data
    historyChart.data.labels = labels;
    historyChart.data.datasets[0].data = phData;
    historyChart.data.datasets[1].data = orpData;
    historyChart.data.datasets[2].data = freeChlorineData;
    historyChart.data.datasets[3].data = combinedChlorineData;
    historyChart.data.datasets[4].data = turbidityData;
    historyChart.data.datasets[5].data = temperatureData;
    historyChart.data.datasets[6].data = dosingEvents;
    
    // Update axis options for better display with different time ranges
    if (hours <= 48) {
        historyChart.options.scales.x.ticks.maxTicksLimit = 24;
    } else if (hours <= 168) {
        historyChart.options.scales.x.ticks.maxTicksLimit = 14;
    } else {
        historyChart.options.scales.x.ticks.maxTicksLimit = 10;
    }
    
    // Update chart
    historyChart.update();
    
    updateTableDataForPage('historyDataTable', 1);
}

/**
 * Update history chart with custom date range
 */
function updateHistoryChartCustomRange(startDate, endDate) {
    if (!historyChart) return;
    
    // Calculate hours between dates
    const diffMs = endDate - startDate;
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
    
    // Generate new labels for custom range
    const labels = [];
    const currentDate = new Date(startDate);
    
    // Generate labels based on range duration
    let interval = 1; // hours
    if (diffHours > 168) interval = 6;
    if (diffHours > 720) interval = 24;
    
    const steps = Math.ceil(diffHours / interval);
    
    for (let i = 0; i < steps; i++) {
        labels.push(formatDateTime(currentDate));
        currentDate.setHours(currentDate.getHours() + interval);
    }
    
    // Sample data sets
    const phData = generateSampleData(7.4, 0.2, steps);
    const orpData = generateSampleData(720, 30, steps);
    const freeChlorineData = generateSampleData(1.2, 0.3, steps);
    const combinedChlorineData = generateSampleData(0.2, 0.1, steps);
    const turbidityData = generateSampleData(0.15, 0.05, steps);
    const temperatureData = generateSampleData(28, 1, steps);
    
    // Generate dosing events
    const dosingEvents = generateSampleEvents(steps, Math.max(5, Math.floor(steps / 12)));
    
    // Update chart data
    historyChart.data.labels = labels;
    historyChart.data.datasets[0].data = phData;
    historyChart.data.datasets[1].data = orpData;
    historyChart.data.datasets[2].data = freeChlorineData;
    historyChart.data.datasets[3].data = combinedChlorineData;
    historyChart.data.datasets[4].data = turbidityData;
    historyChart.data.datasets[5].data = temperatureData;
    historyChart.data.datasets[6].data = dosingEvents;
    
    // Update axis options for better display with different time ranges
    if (steps <= 48) {
        historyChart.options.scales.x.ticks.maxTicksLimit = 24;
    } else if (steps <= 168) {
        historyChart.options.scales.x.ticks.maxTicksLimit = 14;
    } else {
        historyChart.options.scales.x.ticks.maxTicksLimit = 10;
    }
    
    // Update chart
    historyChart.update();
    
    updateTableDataForPage('historyDataTable', 1);
}

/**
 * Update chart visibility based on parameter checkboxes
 */
function updateHistoryChartVisibility() {
    if (!historyChart) return;
    
    // pH
    historyChart.data.datasets[0].hidden = !document.getElementById('showPh').checked;
    
    // ORP
    historyChart.data.datasets[1].hidden = !document.getElementById('showOrp').checked;
    
    // Free Chlorine
    historyChart.data.datasets[2].hidden = !document.getElementById('showFreeChlorine').checked;
    
    // Combined Chlorine
    historyChart.data.datasets[3].hidden = !document.getElementById('showCombinedChlorine').checked;
    
    // Turbidity
    historyChart.data.datasets[4].hidden = !document.getElementById('showTurbidity').checked;
    
    // Temperature
    historyChart.data.datasets[5].hidden = !document.getElementById('showTemp').checked;
    
    // Dosing Events
    historyChart.data.datasets[6].hidden = !document.getElementById('showDosingEvents').checked;
    
    // Update axis visibility
    updateAxisVisibility();

    // Update chart
    historyChart.update();
}

/**
 * Update axis visibility based on dataset visibility
 */
function updateAxisVisibility() {
    if (!historyChart) return;
    
    // pH axis
    historyChart.options.scales['y-ph'].display = document.getElementById('showPh').checked;
    
    // Chlorine axis - show if either chlorine dataset is visible
    const freeChlorineVisible = document.getElementById('showFreeChlorine').checked;
    const combinedChlorineVisible = document.getElementById('showCombinedChlorine').checked;
    historyChart.options.scales['y-chlorine'].display = freeChlorineVisible || combinedChlorineVisible;
    
    // ORP axis
    historyChart.options.scales['y-orp'].display = document.getElementById('showOrp').checked;
    
    // Turbidity axis
    historyChart.options.scales['y-turbidity'].display = document.getElementById('showTurbidity').checked;
    
    // Temperature axis
    historyChart.options.scales['y-temp'].display = document.getElementById('showTemp').checked;
}

/**
 * Update chart type
 */
function updateHistoryChartType(type) {
    if (!historyChart) return;
    
    // Change chart type
    historyChart.config.type = type;
    
    // Adjust point sizes for different chart types
    if (type === 'scatter') {
        historyChart.data.datasets.forEach(dataset => {
            if (dataset.label !== 'Dosing Events') {
                dataset.pointRadius = 3;
            }
        });
    } else {
        historyChart.data.datasets.forEach(dataset => {
            if (dataset.label !== 'Dosing Events') {
                dataset.pointRadius = type === 'line' ? undefined : 0;
            }
        });
    }
    
    // Update chart
    historyChart.update();
}

/**
 * Update history data table
 */
function updateHistoryTable(hours) {
    const tbody = document.getElementById('historyDataTable').querySelector('tbody');
    tbody.innerHTML = '';
    
    // Generate sample data for table (most recent first)
    const now = new Date();
    let rows = Math.min(hours, 25); // Limit to 25 rows for demo
    
    for (let i = 0; i < rows; i++) {
        const date = new Date(now);
        date.setHours(date.getHours() - i);
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDateTime(date)}</td>
            <td>${(7.4 + (Math.random() - 0.5) * 0.2).toFixed(2)}</td>
            <td>${Math.round(720 + (Math.random() - 0.5) * 30)}</td>
            <td>${(1.2 + (Math.random() - 0.5) * 0.3).toFixed(2)}</td>
            <td>${(0.2 + (Math.random() - 0.5) * 0.1).toFixed(2)}</td>
            <td>${(0.15 + (Math.random() - 0.5) * 0.05).toFixed(3)}</td>
            <td>${(28 + (Math.random() - 0.5) * 1).toFixed(1)}</td>
        `;
        
        tbody.appendChild(tr);
    }
    
    // Update row count
    const rowCountElem = document.getElementById('historyDataTable').parentNode.nextElementSibling.firstElementChild;
    if (rowCountElem) {
        rowCountElem.textContent = `${t('showing')} ${rows} ${t('of')} ${hours} ${t('records')}`;
    }
}

/**
 * Filter events by type
 */
function filterEventsByType(type) {
    const rows = document.getElementById('eventsTable').querySelectorAll('tbody tr');
    
    rows.forEach(row => {
        const eventType = row.querySelector('td:nth-child(2) .badge').textContent.toLowerCase();
        
        if (type === 'all' || eventType.includes(type.toLowerCase())) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

/**
 * Generate sample data with variation around a base value
 */
function generateSampleData(baseValue, variation, count) {
    const data = [];
    let currentValue = baseValue;
    
    for (let i = 0; i < count; i++) {
        // Add some randomness and trend
        const trend = Math.sin(i / 20) * variation * 0.5;
        const random = (Math.random() - 0.5) * variation;
        
        currentValue = baseValue + trend + random;
        data.push(currentValue);
    }
    
    return data;
}

/**
 * Generate sample dosing events
 */
function generateSampleEvents(hours, count) {
    const events = [];
    
    // Initialize with null values for all hours
    for (let i = 0; i < hours; i++) {
        events.push(null);
    }
    
    // Add random events
    for (let i = 0; i < count; i++) {
        const position = Math.floor(Math.random() * hours);
        events[position] = 7.8; // Position dosing events at the top of the chart
    }
    
    return events;
}

/**
 * Format date for display
 */
function formatDateTime(date) {
    return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

/**
 * Format date for datetime-local input
 */
function formatDateTimeForInput(date) {
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}T${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

/**
 * Initialize pagination for both tables
 */
function initializePagination() {
    // Initialize data table pagination
    initializeTablePagination('historyDataTable', 'historyDataPagination');
    
    // Initialize events table pagination
    initializeTablePagination('eventsTable', 'eventsPagination');
}

/**
 * Initialize pagination for a specific table
 */
function initializeTablePagination(tableId, paginationId) {
    const table = document.getElementById(tableId);
    if (!table) return;
    
    // Find pagination container - select the closest pagination element to the table
    const paginationContainer = table.closest('.card').querySelector('.pagination');
    if (!paginationContainer) return;
    
    // Add active class to first page
    const firstPageItem = paginationContainer.querySelector('.page-item:nth-child(2)');
    if (firstPageItem) {
        firstPageItem.classList.add('active');
        updateActivePageNumberStyle(paginationContainer);
    }

    // Update the disabled state of prev/next buttons
    updatePaginationArrows(paginationContainer, 1);
    
    // Add click handlers to pagination links
    paginationContainer.querySelectorAll('.page-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const pageText = this.textContent;
            let currentPage = 1;

            if (pageText === '«') {
                // Previous page
                const activePage = paginationContainer.querySelector('.page-item.active');
                if (!activePage) return;
                
                // Find the page number of the active page
                const activePageNum = activePage.querySelector('.page-link').textContent;
                currentPage = parseInt(activePageNum) - 1;
                
                if (currentPage < 1) return; // Don't go below page 1
                
                // Update page data and UI
                updatePaginationPage(paginationContainer, currentPage, tableId);
            } 
            else if (pageText === '»') {
                // Next page
                const activePage = paginationContainer.querySelector('.page-item.active');
                if (!activePage) return;
                
                // Find the page number of the active page
                const activePageNum = activePage.querySelector('.page-link').textContent;
                currentPage = parseInt(activePageNum) + 1;
                
                // Determine max pages (we have 3 page links in our pagination)
                const maxPage = 3; // Assuming 3 pages in the pagination
                if (currentPage > maxPage) return; // Don't go beyond available pages
                
                // Update page data and UI
                updatePaginationPage(paginationContainer, currentPage, tableId);
            }
            else {
                // Direct page click
                currentPage = parseInt(pageText);
                updatePaginationPage(paginationContainer, currentPage, tableId);
            }
        });
    });
}

/**
 * Update pagination page - handles both UI updates and data updates
 */
function updatePaginationPage(paginationContainer, pageNumber, tableId) {
    // Update active page
    paginationContainer.querySelectorAll('.page-item').forEach(item => {
        if (item.classList.contains('active')) {
            item.classList.remove('active');
        }
    });
    
    // Find the page item with the target page number and make it active
    paginationContainer.querySelectorAll('.page-item').forEach(item => {
        const link = item.querySelector('.page-link');
        if (link && link.textContent === pageNumber.toString()) {
            item.classList.add('active');
        }
    });
    
    // Update previous/next button states
    updatePaginationArrows(paginationContainer, pageNumber);

    // Ensure page numbers are visible
    updateActivePageNumberStyle(paginationContainer);
    
    // Update table data based on the page number
    if (tableId === 'historyDataTable') {
        updateTableDataForPage(tableId, pageNumber);
    } else if (tableId === 'eventsTable') {
        updateEventsDataForPage(tableId, pageNumber);
    }
}

/**
 * Update the disabled state of pagination arrows based on current page
 */
function updatePaginationArrows(paginationContainer, currentPage) {
    // Get previous and next buttons
    const prevButton = paginationContainer.querySelector('.page-item:first-child');
    const nextButton = paginationContainer.querySelector('.page-item:last-child');
    
    if (prevButton) {
        if (currentPage <= 1) {
            prevButton.classList.add('disabled');
        } else {
            prevButton.classList.remove('disabled');
        }
    }
    
    if (nextButton) {
        // Assuming we have 3 page links
        if (currentPage >= 3) {
            nextButton.classList.add('disabled');
        } else {
            nextButton.classList.remove('disabled');
        }
    }
}

/**
 * Sync checkbox states with initial chart visibility
 */
function syncCheckboxesWithChart() {
    if (!historyChart) return;
    
    // Match checkbox states to chart visibility
    document.getElementById('showPh').checked = !historyChart.data.datasets[0].hidden;
    document.getElementById('showOrp').checked = !historyChart.data.datasets[1].hidden;
    document.getElementById('showFreeChlorine').checked = !historyChart.data.datasets[2].hidden;
    document.getElementById('showCombinedChlorine').checked = !historyChart.data.datasets[3].hidden;
    document.getElementById('showTurbidity').checked = !historyChart.data.datasets[4].hidden;
    document.getElementById('showTemp').checked = !historyChart.data.datasets[5].hidden;

    // Update all axes visibility
    updateAllAxisVisibility();
}

/**
 * Update table data for a specific page
 */
function updateTableDataForPage(tableId, pageNumber) {
    const tbody = document.getElementById(tableId).querySelector('tbody');
    if (!tbody) return;
    
    const recordsPerPage = 5; // 5 records per page
    const offset = (pageNumber - 1) * recordsPerPage;
    const now = new Date();
    
    // Clear existing rows
    tbody.innerHTML = '';
    
    // Generate new rows for this page
    for (let i = 0; i < recordsPerPage; i++) {
        const date = new Date(now);
        date.setHours(date.getHours() - (offset + i));
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDateTime(date)}</td>
            <td>${(7.4 + (Math.random() - 0.5) * 0.2).toFixed(2)}</td>
            <td>${Math.round(720 + (Math.random() - 0.5) * 30)}</td>
            <td>${(1.2 + (Math.random() - 0.5) * 0.3).toFixed(2)}</td>
            <td>${(0.2 + (Math.random() - 0.5) * 0.1).toFixed(2)}</td>
            <td>${(0.15 + (Math.random() - 0.5) * 0.05).toFixed(3)}</td>
            <td>${(28 + (Math.random() - 0.5) * 1).toFixed(1)}</td>
        `;
        
        tbody.appendChild(tr);
    }
    
    // Update the count display
    const countDisplay = document.querySelector(`#${tableId}`).closest('.card-body').querySelector('.d-flex div');
    if (countDisplay) {
        countDisplay.textContent = `${t('showing')} ${recordsPerPage} ${t('of')} 15 ${t('records')}`;
    }
}

/**
 * Update events data for a specific page
 */
function updateEventsDataForPage(tableId, pageNumber) {
    const tbody = document.getElementById(tableId).querySelector('tbody');
    if (!tbody) return;
    
    const recordsPerPage = 5; // 5 records per page
    const offset = (pageNumber - 1) * recordsPerPage;
    const now = new Date();
    
    // Event types
    const eventTypes = [
        { type: t('systemEvents'), class: 'bg-info' },
        { type: t('dosingEvents'), class: 'bg-success' },
        { type: t('alertEvents'), class: 'bg-warning' },
        { type: t('userActions'), class: 'bg-primary' }
    ];
    
    // Event descriptions (these should also be translated in a real app)
    const descriptions = [
        { text: t('systemStarted'), param: '-', value: '-' },
        { text: t('automaticChlorineDosing'), param: t('freeCl'), value: '0.9 mg/L' },
        { text: t('lowChlorineAlert'), param: t('freeCl'), value: '0.7 mg/L' },
        { text: t('automaticPACDosing'), param: t('turbidity'), value: '0.22 NTU' },
        { text: t('userChangedPH'), param: 'pH', value: '7.2-7.6' }
    ];
    
    // Clear existing rows
    tbody.innerHTML = '';
    
    // Generate new rows for this page
    for (let i = 0; i < recordsPerPage; i++) {
        const date = new Date(now);
        date.setHours(date.getHours() - (offset + i));
        
        // Pick random event type and description
        const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        const description = descriptions[Math.floor(Math.random() * descriptions.length)];
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDateTime(date)}</td>
            <td><span class="badge ${eventType.class}">${eventType.type}</span></td>
            <td>${description.text}</td>
            <td>${description.param}</td>
            <td>${description.value}</td>
        `;
        
        tbody.appendChild(tr);
    }
    
    // Update the count display
    const countDisplay = document.querySelector(`#${tableId}`).closest('.card-body').querySelector('.d-flex div');
    if (countDisplay) {
        countDisplay.textContent = `${t('showing')} ${recordsPerPage} ${t('of')} 15 ${t('events')}`;
    }
}

/**
 * Initialize table data with 5 records per page
 */
function initializeTableData() {
    // Get both tables
    const historyTable = document.getElementById('historyDataTable');
    const eventsTable = document.getElementById('eventsTable');
    
    if (historyTable) {
        const tbody = historyTable.querySelector('tbody');
        if (tbody) {
            // Clear any existing data first
            tbody.innerHTML = '';
            
            // Add exactly 5 rows
            const now = new Date();
            for (let i = 0; i < 5; i++) {
                const date = new Date(now);
                date.setHours(date.getHours() - i);
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${formatDateTime(date)}</td>
                    <td>${(7.4 + (Math.random() - 0.5) * 0.2).toFixed(2)}</td>
                    <td>${Math.round(720 + (Math.random() - 0.5) * 30)}</td>
                    <td>${(1.2 + (Math.random() - 0.5) * 0.3).toFixed(2)}</td>
                    <td>${(0.2 + (Math.random() - 0.5) * 0.1).toFixed(2)}</td>
                    <td>${(0.15 + (Math.random() - 0.5) * 0.05).toFixed(3)}</td>
                    <td>${(28 + (Math.random() - 0.5) * 1).toFixed(1)}</td>
                `;
                tbody.appendChild(tr);
            }
            
            // Update the count display
            const countDisplay = historyTable.closest('.card-body').querySelector('.d-flex div');
            if (countDisplay) {
                countDisplay.textContent = 'Showing 5 of 15 records';
            }
        }
    }
    
    if (eventsTable) {
        const tbody = eventsTable.querySelector('tbody');
        if (tbody) {
            // Clear any existing data
            tbody.innerHTML = '';
            
            // Event types and descriptions are the same as in updateEventsDataForPage
            const eventTypes = [
                { type: 'System', class: 'bg-info' },
                { type: 'Dosing', class: 'bg-success' },
                { type: 'Alert', class: 'bg-warning' },
                { type: 'User', class: 'bg-primary' }
            ];
            
            const descriptions = [
                { text: 'System started in automatic mode', param: '-', value: '-' },
                { text: 'Automatic chlorine dosing', param: 'Free Cl', value: '0.9 mg/L' },
                { text: 'Low chlorine level detected', param: 'Free Cl', value: '0.7 mg/L' },
                { text: 'Automatic PAC dosing', param: 'Turbidity', value: '0.22 NTU' },
                { text: 'User changed target pH range', param: 'pH', value: '7.2-7.6' }
            ];
            
            // Add exactly 5 rows
            const now = new Date();
            for (let i = 0; i < 5; i++) {
                const date = new Date(now);
                date.setHours(date.getHours() - i);
                
                // Pick specific event for consistency
                const eventType = eventTypes[i % eventTypes.length];
                const description = descriptions[i % descriptions.length];
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${formatDateTime(date)}</td>
                    <td><span class="badge ${eventType.class}">${eventType.type}</span></td>
                    <td>${description.text}</td>
                    <td>${description.param}</td>
                    <td>${description.value}</td>
                `;
                tbody.appendChild(tr);
            }
            
            // Update the count display
            const countDisplay = eventsTable.closest('.card-body').querySelector('.d-flex div');
            if (countDisplay) {
                countDisplay.textContent = 'Showing 5 of 15 events';
            }
        }
    }
}

/**
 * Ensure page numbers are visible when active
 */
function updateActivePageNumberStyle(paginationContainer) {
    paginationContainer.querySelectorAll('.page-item').forEach(item => {
        const link = item.querySelector('.page-link');
        if (link) {
            if (item.classList.contains('active')) {
                // Add white text color for active page
                link.style.color = 'white';
                // Add the page number to make it more visible
                if (!isNaN(parseInt(link.textContent))) {
                    link.setAttribute('data-page', link.textContent);
                }
            } else {
                link.style.color = '';
            }
        }
    });
}

/**
 * Update all axis visibility based on dataset visibility
 */
function updateAllAxisVisibility() {
    if (!historyChart) return;
    
    // First, set all axes to hidden
    historyChart.options.scales['y-ph'].display = false;
    historyChart.options.scales['y-orp'].display = false;
    historyChart.options.scales['y-chlorine'].display = false; 
    historyChart.options.scales['y-turbidity'].display = false;
    historyChart.options.scales['y-temp'].display = false;
    
    // Now check each dataset and show the axis if the dataset is visible
    const datasetToAxisMap = {
        0: 'y-ph',          // pH
        1: 'y-orp',         // ORP
        2: 'y-chlorine',    // Free Chlorine
        3: 'y-chlorine',    // Combined Chlorine (shares axis with Free Chlorine)
        4: 'y-turbidity',   // Turbidity
        5: 'y-temp',        // Temperature
        6: 'y-ph'           // Dosing Events (shown on pH axis)
    };
    
    // For each dataset, check if it's visible and update its axis
    for (let i = 0; i < historyChart.data.datasets.length; i++) {
        if (historyChart.isDatasetVisible(i)) {
            const axisId = datasetToAxisMap[i];
            if (axisId) {
                historyChart.options.scales[axisId].display = true;
                
                // Also ensure axis title is visible
                historyChart.options.scales[axisId].title.display = true;
            }
        }
    }
    
    // Special case: If dosing events is the only visible dataset on y-ph axis
    const phDatasetVisible = historyChart.isDatasetVisible(0); // pH
    const dosingEventsVisible = historyChart.isDatasetVisible(6); // Dosing Events
    
    if (!phDatasetVisible && dosingEventsVisible) {
        // If only dosing events are visible, show pH axis for reference but with muted styling
        historyChart.options.scales['y-ph'].display = true;
        historyChart.options.scales['y-ph'].grid.color = 'rgba(0, 0, 0, 0.1)'; // Muted grid
    } else if (phDatasetVisible) {
        // Reset grid color when pH dataset is visible
        historyChart.options.scales['y-ph'].grid.color = undefined; // Use default
    }
}

/**
 * Initialize settings tab functionality
 */
function initializeSettingsTab() {
    console.log('Initializing Settings Tab');
    
    // Form submission handlers
    document.getElementById('accountSettingsForm').addEventListener('submit', function(e) {
        e.preventDefault();
        saveAccountSettings(this);
    });
    
    document.getElementById('notificationSettingsForm').addEventListener('submit', function(e) {
        e.preventDefault();
        saveNotificationSettings(this);
    });
    
    document.getElementById('systemConfigForm').addEventListener('submit', function(e) {
        e.preventDefault();
        saveSystemConfig(this);
    });
    
    document.getElementById('chemistryTargetsForm').addEventListener('submit', function(e) {
        e.preventDefault();
        saveChemistryTargets(this);
    });
    
    document.getElementById('pumpConfigForm').addEventListener('submit', function(e) {
        e.preventDefault();
        savePumpConfig(this);
    });
    
    document.getElementById('turbiditySettingsForm').addEventListener('submit', function(e) {
        e.preventDefault();
        saveTurbiditySettings(this);
    });
    
    // Data management buttons
    document.getElementById('exportSettingsBtn').addEventListener('click', exportSettings);
    document.getElementById('importSettingsFile').addEventListener('change', importSettings);
    document.getElementById('saveRetentionBtn').addEventListener('click', saveRetentionSettings);
    document.getElementById('resetSettingsBtn').addEventListener('click', confirmResetSettings);
    document.getElementById('clearDataBtn').addEventListener('click', confirmClearData);
    
    // Load saved settings if available
    loadSavedSettings();
}

/**
 * Save account settings with password change
 */
function saveAccountSettings(form) {
    // Get form elements
    const currentPassword = document.getElementById('currentPassword');
    const newPassword = document.getElementById('newPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    const submitButton = form.querySelector('button[type="submit"]');
    
    // Set loading state
    const originalButtonText = submitButton.innerHTML;
    submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
    submitButton.disabled = true;
    
    // Validate passwords
    if (!currentPassword.value) {
        showToast('Please enter your current password', 'warning');
        submitButton.innerHTML = originalButtonText;
        submitButton.disabled = false;
        return;
    }
    
    if (newPassword.value !== confirmPassword.value) {
        showToast('New passwords do not match', 'warning');
        submitButton.innerHTML = originalButtonText;
        submitButton.disabled = false;
        return;
    }
    
    // For demo, we'll just simulate an API call with a timeout
    setTimeout(function() {
        // In a real app, you would send this to an API
        console.log('Password change saved');
        
        // Reset form and button
        form.reset();
        submitButton.innerHTML = originalButtonText;
        submitButton.disabled = false;
        
        showLocalizedToast('settingsSaved');
    }, 1000);
}

/**
 * Save notification settings
 */
function saveNotificationSettings(form) {
    // Get form elements
    const submitButton = form.querySelector('button[type="submit"]');
    
    // Set loading state
    const originalButtonText = submitButton.innerHTML;
    submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
    submitButton.disabled = true;
    
    // Get settings
    const notificationEmail = document.getElementById('notificationEmail').value;
    const alertNotifications = document.getElementById('alertNotifications').checked;
    const warningNotifications = document.getElementById('warningNotifications').checked;
    const maintenanceNotifications = document.getElementById('maintenanceNotifications').checked;
    const dailyReportNotifications = document.getElementById('dailyReportNotifications').checked;
    
    // Save to localStorage for demo - ensure this happens
    const notificationSettings = {
        notificationEmail,
        alertNotifications,
        warningNotifications,
        maintenanceNotifications,
        dailyReportNotifications
    };
    
    localStorage.setItem('notificationSettings', JSON.stringify(notificationSettings));
    
    // Simulated delay to show loading state
    setTimeout(function() {
        submitButton.innerHTML = originalButtonText;
        submitButton.disabled = false;
        showLocalizedToast('settingsSaved');
    }, 800);
}

/**
 * Save system configuration
 */
function saveSystemConfig(form) {
    // Get form elements
    const submitButton = form.querySelector('button[type="submit"]');
    
    // Set loading state
    const originalButtonText = submitButton.innerHTML;
    submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
    submitButton.disabled = true;
    
    // Get settings
    const systemName = document.getElementById('systemName').value;
    const poolSize = document.getElementById('poolSize').value;
    const refreshInterval = document.getElementById('refreshInterval').value;
    const defaultMode = document.getElementById('defaultModeAuto').checked ? 'auto' : 'manual';
    const language = document.getElementById('langEnglish').checked ? 'en' : 'sq';
    
    // Save to localStorage for demo
    const systemConfig = {
        systemName,
        poolSize,
        refreshInterval,
        defaultMode,
        language
    };
    
    console.log("Saving system config:", systemConfig); // Debug
    localStorage.setItem('systemConfig', JSON.stringify(systemConfig));
    
    // Update UI elements that depend on these settings
    document.querySelector('.sidebar-header h3').textContent = systemName;

    // Apply language change
    applyLanguage(language);
    
    // Simulated delay to show loading state
    setTimeout(function() {
        submitButton.innerHTML = originalButtonText;
        submitButton.disabled = false;
        
        // Show toast in current language
        if (language === 'en') {
            showLocalizedToast('settingsSaved');
        } else {
            showLocalizedToast('Cilësimet u ruajtën');
        }
    }, 800);
}

/**
 * Save chemistry targets
 */
function saveChemistryTargets(form) {
    // Get form elements
    const submitButton = form.querySelector('button[type="submit"]');
    
    // Set loading state
    const originalButtonText = submitButton.innerHTML;
    submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
    submitButton.disabled = true;
    
    // Get settings
    const phTargetMin = document.getElementById('phTargetMin').value;
    const phTargetMax = document.getElementById('phTargetMax').value;
    const orpTargetMin = document.getElementById('orpTargetMin').value;
    const orpTargetMax = document.getElementById('orpTargetMax').value;
    const freeClTargetMin = document.getElementById('freeClTargetMin').value;
    const freeClTargetMax = document.getElementById('freeClTargetMax').value;
    const combinedClMax = document.getElementById('combinedClMax').value;
    
    // Validate ranges
    if (parseFloat(phTargetMin) >= parseFloat(phTargetMax)) {
        showToast('pH minimum must be lower than maximum', 'warning');
        submitButton.innerHTML = originalButtonText;
        submitButton.disabled = false;
        return;
    }
    
    if (parseFloat(orpTargetMin) >= parseFloat(orpTargetMax)) {
        showToast('ORP minimum must be lower than maximum', 'warning');
        submitButton.innerHTML = originalButtonText;
        submitButton.disabled = false;
        return;
    }
    
    if (parseFloat(freeClTargetMin) >= parseFloat(freeClTargetMax)) {
        showToast('Chlorine minimum must be lower than maximum', 'warning');
        submitButton.innerHTML = originalButtonText;
        submitButton.disabled = false;
        return;
    }
    
    // Save to localStorage for demo
    const chemistryTargets = {
        phTargetMin,
        phTargetMax,
        orpTargetMin,
        orpTargetMax,
        freeClTargetMin,
        freeClTargetMax,
        combinedClMax
    };
    
    localStorage.setItem('chemistryTargets', JSON.stringify(chemistryTargets));
    
    // Update UI elements that display target ranges
    document.querySelector('#phValue').closest('.d-flex').querySelector('.parameter-info .text-muted.small').textContent = `Target: ${phTargetMin} - ${phTargetMax}`;
    document.querySelector('#orpValue').closest('.d-flex').querySelector('.parameter-info .text-muted.small').textContent = `mV (Target: ${orpTargetMin} - ${orpTargetMax})`;
    document.querySelector('#freeChlorineValue').closest('.d-flex').querySelector('.parameter-info .text-muted.small').textContent = `Free (mg/L) (Target: ${freeClTargetMin} - ${freeClTargetMax})`;
    
    // Simulated delay to show loading state
    setTimeout(function() {
        submitButton.innerHTML = originalButtonText;
        submitButton.disabled = false;
        showLocalizedToast('settingsSaved');
        updateUIFromSettings();
    }, 800);
}

/**
 * Save pump configuration
 */
function savePumpConfig(form) {
    // Get form elements
    const submitButton = form.querySelector('button[type="submit"]');
    
    // Set loading state
    const originalButtonText = submitButton.innerHTML;
    submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
    submitButton.disabled = true;
    
    // Get settings
    const phPumpFlowRate = document.getElementById('phPumpFlowRate').value;
    const clPumpFlowRate = document.getElementById('clPumpFlowRate').value;
    const pacMinFlow = document.getElementById('pacMinFlow').value;
    const pacMaxFlow = document.getElementById('pacMaxFlow').value;
    const phMaxDoseDuration = document.getElementById('phMaxDoseDuration').value;
    const clMaxDoseDuration = document.getElementById('clMaxDoseDuration').value;
    
    // Validate values
    if (parseInt(pacMinFlow) >= parseInt(pacMaxFlow)) {
        showToast('PAC minimum flow must be lower than maximum', 'warning');
        submitButton.innerHTML = originalButtonText;
        submitButton.disabled = false;
        return;
    }
    
    // Save to localStorage for demo
    const pumpConfig = {
        phPumpFlowRate,
        clPumpFlowRate,
        pacMinFlow,
        pacMaxFlow,
        phMaxDoseDuration,
        clMaxDoseDuration
    };
    
    localStorage.setItem('pumpConfig', JSON.stringify(pumpConfig));
    
    // Update mock data for simulation
    if (mockData) {
        // Recalculate PAC dosing rate based on new min/max
        mockData.pacDosingRate = parseInt(pacMinFlow) + Math.floor(Math.random() * (parseInt(pacMaxFlow) - parseInt(pacMinFlow)));
        
        // Update displayed PAC dosing rate
        const pacDosingRateEl = document.getElementById('pacDosingRate');
        if (pacDosingRateEl) {
            pacDosingRateEl.textContent = mockData.pacDosingRate;
        }
        
        // Also update the flowrate select options in the PAC tab
        const pacFlowRateSelect = document.getElementById('pacFlowRate');
        if (pacFlowRateSelect) {
            pacFlowRateSelect.innerHTML = `
                <option value="${pacMinFlow}">${pacMinFlow} ml/h (Minimum)</option>
                <option value="${Math.round((parseInt(pacMinFlow) + parseInt(pacMaxFlow))/3)}" selected>${Math.round((parseInt(pacMinFlow) + parseInt(pacMaxFlow))/3)} ml/h (Low)</option>
                <option value="${Math.round((parseInt(pacMinFlow) + parseInt(pacMaxFlow))/2)}">${Math.round((parseInt(pacMinFlow) + parseInt(pacMaxFlow))/2)} ml/h (Medium)</option>
                <option value="${Math.round(parseInt(pacMinFlow) + (parseInt(pacMaxFlow) - parseInt(pacMinFlow)) * 0.75)}">${Math.round(parseInt(pacMinFlow) + (parseInt(pacMaxFlow) - parseInt(pacMinFlow)) * 0.75)} ml/h (High)</option>
                <option value="${pacMaxFlow}">${pacMaxFlow} ml/h (Maximum)</option>
            `;
        }
    }
    
    // Simulated delay to show loading state
    setTimeout(function() {
        submitButton.innerHTML = originalButtonText;
        submitButton.disabled = false;
        showLocalizedToast('settingsSaved');
        updateUIFromSettings();
    }, 800);
}

/**
 * Save turbidity settings
 */
function saveTurbiditySettings(form) {
    // Get form elements
    const submitButton = form.querySelector('button[type="submit"]');
    
    // Set loading state
    const originalButtonText = submitButton.innerHTML;
    submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
    submitButton.disabled = true;
    
    // Get settings
    const turbidityTarget = document.getElementById('turbidityTarget').value;
    const turbidityLowThreshold = document.getElementById('turbidityLowThreshold').value;
    const turbidityHighThreshold = document.getElementById('turbidityHighThreshold').value;
    const filterBackwashLevel = document.getElementById('filterBackwashLevel').value;
    const autoBackwashAlerts = document.getElementById('autoBackwashAlerts').checked;
    
    // Validate thresholds
    if (parseFloat(turbidityLowThreshold) >= parseFloat(turbidityHighThreshold)) {
        showToast('Low threshold must be lower than high threshold', 'warning');
        submitButton.innerHTML = originalButtonText;
        submitButton.disabled = false;
        return;
    }
    
    if (parseFloat(turbidityTarget) <= parseFloat(turbidityLowThreshold) || 
        parseFloat(turbidityTarget) >= parseFloat(turbidityHighThreshold)) {
        showToast('Target must be between low and high thresholds', 'warning');
        submitButton.innerHTML = originalButtonText;
        submitButton.disabled = false;
        return;
    }
    
    // Save to localStorage for demo
    const turbiditySettings = {
        turbidityTarget,
        turbidityLowThreshold,
        turbidityHighThreshold,
        filterBackwashLevel,
        autoBackwashAlerts
    };
    
    console.log("Saving turbidity settings:", turbiditySettings); // Debug
    localStorage.setItem('turbiditySettings', JSON.stringify(turbiditySettings));
    
    // Update UI elements
    document.getElementById('pacTargetValue').value = turbidityTarget;
    document.getElementById('pacLowThreshold').value = turbidityLowThreshold;
    document.getElementById('pacHighThreshold').value = turbidityHighThreshold;
    
    // Simulated delay to show loading state
    setTimeout(function() {
        submitButton.innerHTML = originalButtonText;
        submitButton.disabled = false;
        showLocalizedToast('settingsSaved');
        updateUIFromSettings();
    }, 800);
}

/**
 * Export settings as a JSON file
 */
function exportSettings() {
    // Collect all settings from localStorage
    const allSettings = {
        systemConfig: JSON.parse(localStorage.getItem('systemConfig') || '{}'),
        notificationSettings: JSON.parse(localStorage.getItem('notificationSettings') || '{}'),
        chemistryTargets: JSON.parse(localStorage.getItem('chemistryTargets') || '{}'),
        pumpConfig: JSON.parse(localStorage.getItem('pumpConfig') || '{}'),
        turbiditySettings: JSON.parse(localStorage.getItem('turbiditySettings') || '{}')
    };
    
    // Create a blob and download link
    const blob = new Blob([JSON.stringify(allSettings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pool_settings_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 0);
    
    showToast('Settings exported successfully');
}

/**
 * Import settings from a JSON file
 */
function importSettings(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const settings = JSON.parse(e.target.result);
            console.log("Importing settings:", settings); // Debug
            
            // Save each settings group to localStorage
            if (settings.systemConfig) {
                localStorage.setItem('systemConfig', JSON.stringify(settings.systemConfig));
            }
            
            if (settings.notificationSettings) {
                localStorage.setItem('notificationSettings', JSON.stringify(settings.notificationSettings));
            }
            
            if (settings.chemistryTargets) {
                localStorage.setItem('chemistryTargets', JSON.stringify(settings.chemistryTargets));
            }
            
            if (settings.pumpConfig) {
                localStorage.setItem('pumpConfig', JSON.stringify(settings.pumpConfig));
            }
            
            if (settings.turbiditySettings) {
                localStorage.setItem('turbiditySettings', JSON.stringify(settings.turbiditySettings));
            }
            
            if (settings.retentionSettings) {
                localStorage.setItem('retentionSettings', JSON.stringify(settings.retentionSettings));
            }
            
            // Manually load settings into form fields
            if (settings.systemConfig) {
                document.getElementById('systemName').value = settings.systemConfig.systemName || 'Pool Automation System';
                document.getElementById('poolSize').value = settings.systemConfig.poolSize || '300';
                document.getElementById('refreshInterval').value = settings.systemConfig.refreshInterval || '10';
                
                if (settings.systemConfig.defaultMode === 'manual') {
                    document.getElementById('defaultModeManual').checked = true;
                } else {
                    document.getElementById('defaultModeAuto').checked = true;
                }
                
                if (settings.systemConfig.tempUnit === 'fahrenheit') {
                    document.getElementById('tempFahrenheit').checked = true;
                } else {
                    document.getElementById('tempCelsius').checked = true;
                }
            }
            
            if (settings.notificationSettings) {
                document.getElementById('notificationEmail').value = settings.notificationSettings.notificationEmail || '';
                document.getElementById('alertNotifications').checked = settings.notificationSettings.alertNotifications !== false;
                document.getElementById('warningNotifications').checked = settings.notificationSettings.warningNotifications !== false;
                document.getElementById('maintenanceNotifications').checked = settings.notificationSettings.maintenanceNotifications !== false;
                document.getElementById('dailyReportNotifications').checked = settings.notificationSettings.dailyReportNotifications === true;
            }
            
            if (settings.chemistryTargets) {
                document.getElementById('phTargetMin').value = settings.chemistryTargets.phTargetMin || '7.2';
                document.getElementById('phTargetMax').value = settings.chemistryTargets.phTargetMax || '7.6';
                document.getElementById('orpTargetMin').value = settings.chemistryTargets.orpTargetMin || '650';
                document.getElementById('orpTargetMax').value = settings.chemistryTargets.orpTargetMax || '750';
                document.getElementById('freeClTargetMin').value = settings.chemistryTargets.freeClTargetMin || '1.0';
                document.getElementById('freeClTargetMax').value = settings.chemistryTargets.freeClTargetMax || '2.0';
                document.getElementById('combinedClMax').value = settings.chemistryTargets.combinedClMax || '0.3';
            }
            
            if (settings.pumpConfig) {
                document.getElementById('phPumpFlowRate').value = settings.pumpConfig.phPumpFlowRate || '120';
                document.getElementById('clPumpFlowRate').value = settings.pumpConfig.clPumpFlowRate || '150';
                document.getElementById('pacMinFlow').value = settings.pumpConfig.pacMinFlow || '60';
                document.getElementById('pacMaxFlow').value = settings.pumpConfig.pacMaxFlow || '150';
                document.getElementById('phMaxDoseDuration').value = settings.pumpConfig.phMaxDoseDuration || '300';
                document.getElementById('clMaxDoseDuration').value = settings.pumpConfig.clMaxDoseDuration || '300';
            }
            
            if (settings.turbiditySettings) {
                document.getElementById('turbidityTarget').value = settings.turbiditySettings.turbidityTarget || '0.15';
                document.getElementById('turbidityLowThreshold').value = settings.turbiditySettings.turbidityLowThreshold || '0.12';
                document.getElementById('turbidityHighThreshold').value = settings.turbiditySettings.turbidityHighThreshold || '0.25';
                document.getElementById('filterBackwashLevel').value = settings.turbiditySettings.filterBackwashLevel || '70';
                document.getElementById('autoBackwashAlerts').checked = settings.turbiditySettings.autoBackwashAlerts !== false;
            }
            
            if (settings.retentionSettings) {
                document.getElementById('dataRetention').value = settings.retentionSettings.dataRetention || '90';
                document.getElementById('eventRetention').value = settings.retentionSettings.eventRetention || '90';
            }
            
            // Update UI elements
            updateUIFromSettings();
            
            showToast('Settings imported successfully');
        } catch (error) {
            console.error('Error importing settings:', error);
            showToast('Error importing settings. Invalid file format.', 'warning');
        }
    };
    
    reader.readAsText(file);
    
    // Clear the file input for future imports
    event.target.value = '';
}

/**
 * Save data retention settings
 */
function saveRetentionSettings() {
    // Get the button
    const button = document.getElementById('saveRetentionBtn');
    
    // Set loading state
    const originalButtonText = button.innerHTML;
    button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
    button.disabled = true;
    
    const dataRetention = document.getElementById('dataRetention').value;
    const eventRetention = document.getElementById('eventRetention').value;
    
    // Create retention settings object
    const retentionSettings = {
        dataRetention,
        eventRetention
    };
    
    localStorage.setItem('retentionSettings', JSON.stringify(retentionSettings));

    // Simulated delay to show loading state
    setTimeout(function() {
        button.innerHTML = originalButtonText;
        button.disabled = false;
        showLocalizedToast('settingsSaved');
    }, 800);
}

/**
 * Confirm reset of all settings to defaults
 */
function confirmResetSettings() {
    const confirmMsg = currentLanguage === 'sq' ? 
        'A jeni i sigurt që dëshironi të rivendosni të gjitha cilësimet në vlerat e parazgjedhura? Ky veprim nuk mund të zhbëhet.' : 
        'Are you sure you want to reset all settings to default values? This cannot be undone.';
        
    if (confirm(confirmMsg)) {
        console.log("Resetting settings to defaults");
        
        // Clear localStorage
        localStorage.removeItem('systemConfig');
        localStorage.removeItem('notificationSettings');
        localStorage.removeItem('chemistryTargets');
        localStorage.removeItem('pumpConfig');
        localStorage.removeItem('turbiditySettings');
        localStorage.removeItem('retentionSettings');
        
        // Set form fields to defaults
        // Account for all the form fields we need to reset
        
        // System config defaults
        document.getElementById('systemName').value = 'Pool Automation System';
        document.getElementById('poolSize').value = '300';
        document.getElementById('refreshInterval').value = '10';
        document.getElementById('defaultModeAuto').checked = true;
        
        // Chemistry targets defaults
        document.getElementById('phTargetMin').value = '7.2';
        document.getElementById('phTargetMax').value = '7.6';
        document.getElementById('orpTargetMin').value = '650';
        document.getElementById('orpTargetMax').value = '750';
        document.getElementById('freeClTargetMin').value = '1.0';
        document.getElementById('freeClTargetMax').value = '2.0';
        document.getElementById('combinedClMax').value = '0.3';
        
        // Pump config defaults
        document.getElementById('phPumpFlowRate').value = '120';
        document.getElementById('clPumpFlowRate').value = '150';
        document.getElementById('pacMinFlow').value = '60';
        document.getElementById('pacMaxFlow').value = '150';
        document.getElementById('phMaxDoseDuration').value = '300';
        document.getElementById('clMaxDoseDuration').value = '300';
        
        // Turbidity settings defaults
        document.getElementById('turbidityTarget').value = '0.15';
        document.getElementById('turbidityLowThreshold').value = '0.12';
        document.getElementById('turbidityHighThreshold').value = '0.25';
        document.getElementById('filterBackwashLevel').value = '70';
        document.getElementById('autoBackwashAlerts').checked = true;
        
        // Notification settings defaults
        document.getElementById('notificationEmail').value = '';
        document.getElementById('alertNotifications').checked = true;
        document.getElementById('warningNotifications').checked = true;
        document.getElementById('maintenanceNotifications').checked = true;
        document.getElementById('dailyReportNotifications').checked = false;
        
        // Retention settings defaults
        document.getElementById('dataRetention').value = '90';
        document.getElementById('eventRetention').value = '90';

        // Default to English language
        document.getElementById('langEnglish').checked = true;
        document.getElementById('langAlbanian').checked = false;
        
        // Now manually trigger each save function to ensure localStorage is updated and UI is refreshed
        
        // Save system config (simple approach without loading spinner)
        // Update systemConfig with language
        const systemConfig = {
            systemName: 'Pool Automation System',
            poolSize: '300',
            refreshInterval: '10',
            defaultMode: 'auto',
            language: 'en'  // Default to English
        };
        localStorage.setItem('systemConfig', JSON.stringify(systemConfig));
        
        // Save chemistry targets
        const chemistryTargets = {
            phTargetMin: '7.2',
            phTargetMax: '7.6',
            orpTargetMin: '650',
            orpTargetMax: '750',
            freeClTargetMin: '1.0',
            freeClTargetMax: '2.0',
            combinedClMax: '0.3'
        };
        localStorage.setItem('chemistryTargets', JSON.stringify(chemistryTargets));
        
        // Save pump config
        const pumpConfig = {
            phPumpFlowRate: '120',
            clPumpFlowRate: '150',
            pacMinFlow: '60',
            pacMaxFlow: '150',
            phMaxDoseDuration: '300',
            clMaxDoseDuration: '300'
        };
        localStorage.setItem('pumpConfig', JSON.stringify(pumpConfig));
        
        // Save turbidity settings
        const turbiditySettings = {
            turbidityTarget: '0.15',
            turbidityLowThreshold: '0.12',
            turbidityHighThreshold: '0.25',
            filterBackwashLevel: '70',
            autoBackwashAlerts: true
        };
        localStorage.setItem('turbiditySettings', JSON.stringify(turbiditySettings));
        
        // Save notification settings
        const notificationSettings = {
            notificationEmail: '',
            alertNotifications: true,
            warningNotifications: true,
            maintenanceNotifications: true,
            dailyReportNotifications: false
        };
        localStorage.setItem('notificationSettings', JSON.stringify(notificationSettings));
        
        // Save retention settings
        const retentionSettings = {
            dataRetention: '90',
            eventRetention: '90'
        };
        localStorage.setItem('retentionSettings', JSON.stringify(retentionSettings));
        
        // Update PAC dosing rate in mock data
        if (mockData) {
            mockData.pacDosingRate = 75; // Default value
        }
        
        // Apply English language
        applyLanguage('en');

        // Update UI
        updateUIFromSettings();
        
        // Update other UI components
        
        // Update pH target display
        const phTargetEl = document.querySelector('#phValue').closest('.d-flex').querySelector('.parameter-info .text-muted.small');
        if (phTargetEl) {
            phTargetEl.textContent = `Target: 7.2 - 7.6`;
        }
        
        // Update ORP target display
        const orpTargetEl = document.querySelector('#orpValue').closest('.d-flex').querySelector('.parameter-info .text-muted.small');
        if (orpTargetEl) {
            orpTargetEl.textContent = `mV (Target: 650 - 750)`;
        }
        
        // Update chlorine target display
        const clTargetEl = document.querySelector('#freeChlorineValue').closest('.d-flex').querySelector('.parameter-info .text-muted.small');
        if (clTargetEl) {
            clTargetEl.textContent = `Free (mg/L) (Target: 1.0 - 2.0)`;
        }
        
        // Update system name in header
        document.querySelector('.sidebar-header h3').textContent = 'Pool Automation System';
        
        console.log("Reset complete - UI should be updated");
        // Show toast in current language
        showToast(t('resetComplete'));
    }
}

/**
 * Confirm clearing of historical data
 */
function confirmClearData() {
    const confirmMsg = currentLanguage === 'sq' ? 
        'A jeni i sigurt që dëshironi të pastroni të gjitha të dhënat historike? Ky veprim nuk mund të zhbëhet.' : 
        'Are you sure you want to clear all historical data? This cannot be undone.';
        
    if (confirm(confirmMsg)) {
        // Show loading indicator
        const button = document.getElementById('clearDataBtn');
        const originalButtonText = button.innerHTML;
        button.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ${t('clearing')}...`;
        button.disabled = true;
        
        // In a real app, this would call an API to clear data
        setTimeout(function() {
            // Reset button state
            button.innerHTML = originalButtonText;
            button.disabled = false;
            
            // Clear any local chart data (simulated)
            if (historyChart) {
                historyChart.data.datasets.forEach(dataset => {
                    dataset.data = [];
                });
                historyChart.update();
            }
            
            // Clear table data (if we're on the history tab)
            const historyTable = document.getElementById('historyDataTable');
            if (historyTable && historyTable.querySelector('tbody')) {
                historyTable.querySelector('tbody').innerHTML = `<tr><td colspan="7" class="text-center">${t('noDataAvailable')}</td></tr>`;
            }
            
            const eventsTable = document.getElementById('eventsTable');
            if (eventsTable && eventsTable.querySelector('tbody')) {
                eventsTable.querySelector('tbody').innerHTML = `<tr><td colspan="5" class="text-center">${t('noEventsAvailable')}</td></tr>`;
            }
            
            showToast(t('clearDataComplete'));
        }, 1500);
    }
}

/**
 * Load saved settings from localStorage
 */
function loadSavedSettings() {
    // Load notification settings
    const notificationSettings = JSON.parse(localStorage.getItem('notificationSettings'));
    if (notificationSettings) {
        document.getElementById('notificationEmail').value = notificationSettings.notificationEmail || '';
        document.getElementById('alertNotifications').checked = notificationSettings.alertNotifications !== false;
        document.getElementById('warningNotifications').checked = notificationSettings.warningNotifications !== false;
        document.getElementById('maintenanceNotifications').checked = notificationSettings.maintenanceNotifications !== false;
        document.getElementById('dailyReportNotifications').checked = notificationSettings.dailyReportNotifications === true;
    }
    
    // Load system configuration
    const systemConfig = JSON.parse(localStorage.getItem('systemConfig'));
    if (systemConfig) {
        document.getElementById('systemName').value = systemConfig.systemName || 'Pool Automation System';
        document.getElementById('poolSize').value = systemConfig.poolSize || '300';
        document.getElementById('refreshInterval').value = systemConfig.refreshInterval || '10';
        
        if (systemConfig.defaultMode === 'manual') {
            document.getElementById('defaultModeManual').checked = true;
        } else {
            document.getElementById('defaultModeAuto').checked = true;
        }
        
        if (systemConfig.tempUnit === 'fahrenheit') {
            document.getElementById('tempFahrenheit').checked = true;
        } else {
            document.getElementById('tempCelsius').checked = true;
        }

        // Add this for language
        if (systemConfig.language === 'sq') {
            document.getElementById('langAlbanian').checked = true;
        } else {
            document.getElementById('langEnglish').checked = true;
        }
    }
    
    // Load chemistry targets
    const chemistryTargets = JSON.parse(localStorage.getItem('chemistryTargets'));
    if (chemistryTargets) {
        document.getElementById('phTargetMin').value = chemistryTargets.phTargetMin || '7.2';
        document.getElementById('phTargetMax').value = chemistryTargets.phTargetMax || '7.6';
        document.getElementById('orpTargetMin').value = chemistryTargets.orpTargetMin || '650';
        document.getElementById('orpTargetMax').value = chemistryTargets.orpTargetMax || '750';
        document.getElementById('freeClTargetMin').value = chemistryTargets.freeClTargetMin || '1.0';
        document.getElementById('freeClTargetMax').value = chemistryTargets.freeClTargetMax || '2.0';
        document.getElementById('combinedClMax').value = chemistryTargets.combinedClMax || '0.3';
    }
    
    // Load pump configuration
    const pumpConfig = JSON.parse(localStorage.getItem('pumpConfig'));
    if (pumpConfig) {
        document.getElementById('phPumpFlowRate').value = pumpConfig.phPumpFlowRate || '120';
        document.getElementById('clPumpFlowRate').value = pumpConfig.clPumpFlowRate || '150';
        document.getElementById('pacMinFlow').value = pumpConfig.pacMinFlow || '60';
        document.getElementById('pacMaxFlow').value = pumpConfig.pacMaxFlow || '150';
        document.getElementById('phMaxDoseDuration').value = pumpConfig.phMaxDoseDuration || '300';
        document.getElementById('clMaxDoseDuration').value = pumpConfig.clMaxDoseDuration || '300';
    }
    
    // Load turbidity settings
    const turbiditySettings = JSON.parse(localStorage.getItem('turbiditySettings'));
    if (turbiditySettings) {
        document.getElementById('turbidityTarget').value = turbiditySettings.turbidityTarget || '0.15';
        document.getElementById('turbidityLowThreshold').value = turbiditySettings.turbidityLowThreshold || '0.12';
        document.getElementById('turbidityHighThreshold').value = turbiditySettings.turbidityHighThreshold || '0.25';
        document.getElementById('filterBackwashLevel').value = turbiditySettings.filterBackwashLevel || '70';
        document.getElementById('autoBackwashAlerts').checked = turbiditySettings.autoBackwashAlerts !== false;
    }
    
    // Load retention settings
    const retentionSettings = JSON.parse(localStorage.getItem('retentionSettings'));
    if (retentionSettings) {
        document.getElementById('dataRetention').value = retentionSettings.dataRetention || '90';
        document.getElementById('eventRetention').value = retentionSettings.eventRetention || '90';
    }
}

function updateUIFromSettings() {
    // Get current settings
    const systemConfig = JSON.parse(localStorage.getItem('systemConfig') || '{}');
    const chemistryTargets = JSON.parse(localStorage.getItem('chemistryTargets') || '{}');
    const turbiditySettings = JSON.parse(localStorage.getItem('turbiditySettings') || '{}');
    
    // Update system name
    if (systemConfig.systemName) {
        document.querySelector('.sidebar-header h3').textContent = systemConfig.systemName;
    }
    
    // Update target ranges in overview cards
    if (chemistryTargets.phTargetMin && chemistryTargets.phTargetMax) {
        const phTargetEl = document.querySelector('#phValue').closest('.d-flex').querySelector('.parameter-info .text-muted.small');
        if (phTargetEl) {
            phTargetEl.textContent = `Target: ${chemistryTargets.phTargetMin} - ${chemistryTargets.phTargetMax}`;
        }
    }
    
    if (chemistryTargets.orpTargetMin && chemistryTargets.orpTargetMax) {
        const orpTargetEl = document.querySelector('#orpValue').closest('.d-flex').querySelector('.parameter-info .text-muted.small');
        if (orpTargetEl) {
            orpTargetEl.textContent = `mV (Target: ${chemistryTargets.orpTargetMin} - ${chemistryTargets.orpTargetMax})`;
        }
    }
    
    if (chemistryTargets.freeClTargetMin && chemistryTargets.freeClTargetMax) {
        const clTargetEl = document.querySelector('#freeChlorineValue').closest('.d-flex').querySelector('.parameter-info .text-muted.small');
        if (clTargetEl) {
            clTargetEl.textContent = `Free (mg/L) (Target: ${chemistryTargets.freeClTargetMin} - ${chemistryTargets.freeClTargetMax})`;
        }
    }
    
    // Update turbidity settings in PAC tab
    if (turbiditySettings.turbidityTarget) {
        document.getElementById('pacTargetValue').value = turbiditySettings.turbidityTarget;
    }
    
    if (turbiditySettings.turbidityLowThreshold) {
        document.getElementById('pacLowThreshold').value = turbiditySettings.turbidityLowThreshold;
    }
    
    if (turbiditySettings.turbidityHighThreshold) {
        document.getElementById('pacHighThreshold').value = turbiditySettings.turbidityHighThreshold;
    }
}

/**
 * Apply language translations to the UI
 * @param {string} lang - Language code ('en' or 'sq')
 */
function applyLanguage(lang) {
    // Validate language
    if (!translations[lang]) {
        console.error(`Language ${lang} not supported`);
        return;
    }
    
    // Store current language
    currentLanguage = lang;
    console.log(`Applying language: ${lang}`);
    
    // Store the language preference in localStorage
    const systemConfig = JSON.parse(localStorage.getItem('systemConfig') || '{}');
    systemConfig.language = lang;
    localStorage.setItem('systemConfig', JSON.stringify(systemConfig));
    
    // Set document language
    document.documentElement.lang = lang;
    
    // Update navigation links
    document.querySelectorAll('#sidebar .nav-link').forEach(link => {
        const href = link.getAttribute('href');
        if (href === '#overview-tab') {
            link.textContent = translations[lang].overview;
        } else if (href === '#water-chemistry-tab') {
            link.textContent = translations[lang].waterChemistry;
        } else if (href === '#turbidity-pac-tab') {
            link.textContent = translations[lang].turbidityPac;
        } else if (href === '#history-tab') {
            link.textContent = translations[lang].history;
        } else if (href === '#settings-tab') {
            link.textContent = translations[lang].settings;
        }
    });
    
    // Update tab headings
    document.querySelectorAll('#overview-tab h3').forEach(h3 => {
        h3.textContent = translations[lang].systemOverview;
    });
    
    document.querySelectorAll('#water-chemistry-tab h3').forEach(h3 => {
        h3.textContent = translations[lang].waterChemistry;
    });
    
    document.querySelectorAll('#turbidity-pac-tab h3').forEach(h3 => {
        h3.textContent = translations[lang].turbidityPac;
    });
    
    document.querySelectorAll('#history-tab h3').forEach(h3 => {
        h3.textContent = translations[lang].historicalData;
    });
    
    document.querySelectorAll('#settings-tab h3').forEach(h3 => {
        h3.textContent = translations[lang].settings;
    });
    
    // Update main buttons
    const autoBtn = document.getElementById('autoMode');
    if (autoBtn) {
        autoBtn.textContent = translations[lang].automatic;
    }
    
    const manualBtn = document.getElementById('manualMode');
    if (manualBtn) {
        manualBtn.textContent = translations[lang].manual;
    }
    
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.textContent = translations[lang].refresh;
    }
    
    // Update card titles
    document.querySelectorAll('.card-title').forEach(title => {
        const text = title.textContent.trim();
        if (text === 'pH') {
            title.textContent = translations[lang].pHTitle;
        } else if (text === 'ORP') {
            title.textContent = translations[lang].ORPTitle;
        } else if (text === 'Chlorine' || text === 'Klori') {
            title.textContent = translations[lang].chlorineTitle;
        } else if (text === 'Turbidity' || text === 'Turbullira') {
            title.textContent = translations[lang].turbidityTitle;
        } else if (text === 'Temperature' || text === 'Temperatura') {
            title.textContent = translations[lang].temperatureTitle;
        } else if (text === 'UV System' || text === 'Sistemi UV') {
            title.textContent = translations[lang].uvSystemTitle;
        } else if (text === 'Current Alerts' || text === 'Njoftimet Aktuale') {
            title.textContent = translations[lang].currentAlerts;
        } else if (text === 'pH Control' || text === 'Kontrolli i pH') {
            title.textContent = translations[lang].phControl;
        } else if (text === 'Chlorine Control' || text === 'Kontrolli i Klorit') {
            title.textContent = translations[lang].chlorineControl;
        } else if (text === 'Turbidity Monitoring' || text === 'Monitorimi i Turbullirës') {
            title.textContent = translations[lang].turbidityMonitoring;
        } else if (text === 'PAC Dosing Control' || text === 'Kontrolli i Dozimit PAC') {
            title.textContent = translations[lang].pacDosingControl;
        } else if (text === 'Account Settings' || text === 'Cilësimet e Llogarisë') {
            title.textContent = translations[lang].accountSettings;
        } else if (text === 'Notification Settings' || text === 'Cilësimet e Njoftimeve') {
            title.textContent = translations[lang].notificationSettings;
        } else if (text === 'System Configuration' || text === 'Konfigurimi i Sistemit') {
            title.textContent = translations[lang].systemConfiguration;
        } else if (text === 'Water Chemistry Targets' || text === 'Objektivat e Kimisë së Ujit') {
            title.textContent = translations[lang].waterChemistryTargets;
        } else if (text === 'Dosing Pump Configuration' || text === 'Konfigurimi i Pompës së Dozimit') {
            title.textContent = translations[lang].dosingPumpConfiguration;
        } else if (text === 'Turbidity Control Settings' || text === 'Cilësimet e Kontrollit të Turbullirës') {
            title.textContent = translations[lang].turbidityControlSettings;
        } else if (text === 'Data Management' || text === 'Menaxhimi i të Dhënave') {
            title.textContent = translations[lang].dataManagement;
        }
    });
    
    // Update status badges
    document.querySelectorAll('.badge').forEach(badge => {
        const text = badge.textContent.trim();
        if (text === 'Good' || text === 'Mirë') {
            badge.textContent = translations[lang].good;
        } else if (text === 'Fair' || text === 'Mesatar') {
            badge.textContent = translations[lang].fair;
        } else if (text === 'Poor' || text === 'Dobët') {
            badge.textContent = translations[lang].poor;
        } else if (text === 'All Systems Normal' || text === 'Të Gjitha Sistemet Normale') {
            badge.textContent = translations[lang].allSystemsNormal;
        } else if (text === 'Optimized' || text === 'Optimizuar') {
            badge.textContent = translations[lang].optimized;
        }
    });
    
    // Update pump status text
    document.querySelectorAll('[id$="PumpStatus"]').forEach(status => {
        if (status.textContent.includes('active') || status.textContent.includes('aktive')) {
            if (status.id === 'pacPumpStatus') {
                status.textContent = translations[lang].pacPumpActive;
            } else {
                status.textContent = translations[lang].pumpActive;
            }
        } else if (status.textContent.includes('inactive') || status.textContent.includes('joaktive')) {
            if (status.id === 'pacPumpStatus') {
                status.textContent = translations[lang].pacPumpInactive;
            } else {
                status.textContent = translations[lang].pumpInactive;
            }
        }
    });
    
    // Update alert messages
    document.querySelectorAll('.card-text.text-muted').forEach(text => {
        if (text.textContent.includes('No alerts') || text.textContent.includes('Nuk ka njoftime')) {
            text.textContent = translations[lang].noAlerts;
        }
    });

    // Add to your applyLanguage function

    // Update main title
    const mainTitle = document.querySelector('.sidebar-header h3');
    if (mainTitle) {
        mainTitle.textContent = translations[lang].poolAutomationTitle;
    }

    // Update dashboard title
    const dashTitle = document.querySelector('main h1.h2');
    if (dashTitle) {
        dashTitle.textContent = translations[lang].dashboard;
    }

    // Update UV status
    const uvStatus = document.getElementById('uvStatus');
    if (uvStatus) {
        uvStatus.textContent = translations[lang].active;
    }

    // Update chart titles
    document.querySelectorAll('h5.card-title').forEach(title => {
        const text = title.textContent.trim();
        if (text.includes('Historical Data')) {
            title.textContent = translations[lang].historicalData;
        } else if (text.includes('Turbidity History')) {
            title.textContent = translations[lang].turbidityHistory;
        } else if (text.includes('Sensor Data')) {
            title.textContent = translations[lang].sensorData;
        }
    });

    // Update parameter buttons
    document.querySelectorAll('.btn-group label.btn').forEach(btn => {
        const text = btn.textContent.trim();
        if (text === 'Free Chlorine' || text === 'Klori i Lirë') {
            btn.textContent = translations[lang].freeChlorine;
        } else if (text === 'Combined Cl' || text === 'Klori i Kombinuar') {
            btn.textContent = translations[lang].combinedCl;
        }
    });

    // Update export buttons
    const csvBtn = document.getElementById('exportCsvBtn');
    if (csvBtn) {
        csvBtn.textContent = translations[lang].csv;
    }

    const jsonBtn = document.getElementById('exportJsonBtn');
    if (jsonBtn) {
        jsonBtn.textContent = translations[lang].json;
    }

    // Update event type badges
    document.querySelectorAll('.badge').forEach(badge => {
        const text = badge.textContent.trim();
        if (text === 'System' || text === 'Sistemi') {
            badge.textContent = translations[lang].systemEvent;
        } else if (text === 'Dosing' || text === 'Dozimi') {
            badge.textContent = translations[lang].dosingEvent;
        } else if (text === 'Alert' || text === 'Alarm') {
            badge.textContent = translations[lang].alertEvent;
        } else if (text === 'User' || text === 'Përdoruesi') {
            badge.textContent = translations[lang].userEvent;
        }
    });

    // Update form labels
    document.querySelectorAll('label.form-label').forEach(label => {
        const text = label.textContent.trim();
        if (text.includes('Notification Preferences')) {
            label.textContent = translations[lang].notificationPreferences;
        } else if (text.includes('pH Pump Flow Rate')) {
            label.textContent = translations[lang].phPumpFlowRate;
        } else if (text.includes('Chlorine Pump Flow Rate')) {
            label.textContent = translations[lang].chlorinePumpFlowRate;
        } else if (text.includes('PAC Pump Flow Rate Configuration')) {
            label.textContent = translations[lang].pacPumpFlowConfig;
        } else if (text.includes('Minimum (ml/h)')) {
            label.textContent = translations[lang].minimumMlh;
        } else if (text.includes('Maximum (ml/h)')) {
            label.textContent = translations[lang].maximumMlh;
        } else if (text.includes('Maximum Dose Durations')) {
            label.textContent = translations[lang].maxDoseDurations;
        } else if (text.includes('pH Pump (seconds)')) {
            label.textContent = translations[lang].phPumpSeconds;
        } else if (text.includes('Chlorine Pump (seconds)')) {
            label.textContent = translations[lang].chlorinePumpSeconds;
        } else if (text.includes('Turbidity Target (NTU)')) {
            label.textContent = translations[lang].turbidityTargetNTU;
        } else if (text.includes('PAC Dosing Thresholds')) {
            label.textContent = translations[lang].pacDosingThresholds;
        } else if (text.includes('Low (NTU)')) {
            label.textContent = translations[lang].lowNTU;
        } else if (text.includes('High (NTU)')) {
            label.textContent = translations[lang].highNTU;
        } else if (text.includes('Filter Backwash Alert Level')) {
            label.textContent = translations[lang].filterBackwashLevel;
        } else if (text.includes('Sensor Readings Retention')) {
            label.textContent = translations[lang].sensorReadingsRetention;
        } else if (text.includes('System Events Retention')) {
            label.textContent = translations[lang].systemEventsRetention;
        } else if (text.includes('Additional Options')) {
            label.textContent = translations[lang].additionalOptions;
        }
    });

    // Update checkbox labels
    document.querySelectorAll('.form-check-label').forEach(label => {
        const text = label.textContent.trim();
        if (text.includes('Enable Automatic Backwash Alerts')) {
            label.textContent = translations[lang].enableAutoBackwash;
        }
    });

    // Update system settings save button
    const saveSystemBtn = document.querySelector('#systemConfigForm button.btn-primary');
    if (saveSystemBtn) {
        saveSystemBtn.textContent = translations[lang].saveSystemSettings;
    }

    // Update export settings button
    const exportSettingsBtn = document.getElementById('exportSettingsBtn');
    if (exportSettingsBtn) {
        exportSettingsBtn.textContent = translations[lang].exportSettings;
    }

    // Update time-related text in UV System card
    const uvRuntime = document.getElementById('uvRuntime');
    if (uvRuntime) {
        const hours = uvRuntime.textContent.match(/\d+,?\d*/);
        if (hours) {
            uvRuntime.textContent = `${hours[0]} ${translations[lang].hoursSince}`;
        }
    }

    // Update table headings in Water Chemistry tab
    document.querySelectorAll('#phDosingHistory thead tr, #clDosingHistory thead tr').forEach(row => {
        const headings = row.querySelectorAll('th');
        if (headings.length >= 4) {
            headings[0].textContent = translations[lang].time;
            headings[1].textContent = translations[lang].duration;
            headings[2].textContent = translations[lang].type;
            // Special case for pH and chlorine
            if (row.closest('#phDosingHistory')) {
                headings[3].textContent = `pH ${translations[lang].before}`;
            } else if (row.closest('#clDosingHistory')) {
                headings[3].textContent = `Cl ${translations[lang].before}`;
            }
        }
    });

    // Update table headings in PAC tab
    document.querySelectorAll('#pacDosingHistory thead tr').forEach(row => {
        const headings = row.querySelectorAll('th');
        if (headings.length >= 4) {
            headings[0].textContent = translations[lang].time;
            headings[1].textContent = translations[lang].duration;
            headings[2].textContent = translations[lang].flowRate;
            headings[3].textContent = translations[lang].type;
        }
    });

    // Update manual control headings
    document.querySelectorAll('h6').forEach(heading => {
        const text = heading.textContent.trim();
        if (text === 'Manual Control' || text === 'Kontrolli Manual') {
            heading.textContent = translations[lang].manualControl;
        } else if (text === 'Recent Dosing' || text === 'Dozimi i Fundit') {
            heading.textContent = translations[lang].recentDosing;
        } else if (text === 'Control Thresholds' || text === 'Pragjet e Kontrollit') {
            heading.textContent = translations[lang].controlThresholds;
        } else if (text === 'Filter Status' || text === 'Statusi i Filtrit') {
            heading.textContent = translations[lang].filterStatus;
        } else if (text === 'Backup & Restore' || text === 'Rezervo & Rikthe') {
            heading.textContent = translations[lang].backupRestore;
        } else if (text === 'Data Retention' || text === 'Ruajtja e të Dhënave') {
            heading.textContent = translations[lang].dataRetention;
        } else if (text === 'Reset & Maintenance' || text === 'Rivendosje & Mirëmbajtje') {
            heading.textContent = translations[lang].resetMaintenance;
        }
    });

    // Update text in visualizations area
    document.querySelectorAll('label.form-label').forEach(label => {
        const text = label.textContent.trim();
        if (text === 'Visualization' || text === 'Vizualizimi') {
            label.textContent = translations[lang].visualizationType;
        } else if (text === 'Resolution' || text === 'Rezolucioni') {
            label.textContent = translations[lang].dataResolution;
        } else if (text === 'Time Range' || text === 'Intervali Kohor') {
            label.textContent = translations[lang].timeRange;
        } else if (text === 'Parameters' || text === 'Parametrat') {
            label.textContent = translations[lang].parameters;
        }
    });

    // Update text in data resolution dropdown
    document.querySelectorAll('#dataResolution option').forEach(option => {
        const text = option.textContent.trim();
        if (text === 'Raw Data' || text === 'Të Dhëna të Papërpunuara') {
            option.textContent = translations[lang].rawData;
        } else if (text === '1 Minute' || text === 'Mesatare 1 Minutëshe') {
            option.textContent = translations[lang].minuteAvg;
        } else if (text === '1 Hour' || text === 'Mesatare 1 Orëshe') {
            option.textContent = translations[lang].hourAvg;
        } else if (text === '1 Day' || text === 'Mesatare 1 Ditore') {
            option.textContent = translations[lang].dayAvg;
        }
    });

    // Update visualization type dropdown
    document.querySelectorAll('#visualizationType option').forEach(option => {
        const text = option.textContent.trim();
        if (text === 'Line Chart' || text === 'Grafik Linear') {
            option.textContent = translations[lang].lineChart;
        } else if (text === 'Scatter Plot' || text === 'Grafik me Pika') {
            option.textContent = translations[lang].scatterPlot;
        } else if (text === 'Bar Chart' || text === 'Grafik me Shtylla') {
            option.textContent = translations[lang].barChart;
        }
    });

    // Update event type filter dropdown
    document.querySelectorAll('#eventTypeFilter option').forEach(option => {
        const text = option.textContent.trim();
        if (text === 'All Events' || text === 'Të Gjitha Ngjarjet') {
            option.textContent = translations[lang].allEvents;
        } else if (text === 'Dosing Events' || text === 'Ngjarjet e Dozimit') {
            option.textContent = translations[lang].dosingEvents;
        } else if (text === 'Alerts' || text === 'Alarmet') {
            option.textContent = translations[lang].alertEvents;
        } else if (text === 'System Events' || text === 'Ngjarjet e Sistemit') {
            option.textContent = translations[lang].systemEvents;
        } else if (text === 'User Actions' || text === 'Veprimet e Përdoruesit') {
            option.textContent = translations[lang].userActions;
        }
    });

    // Update form placeholder texts
    document.querySelectorAll('input[placeholder]').forEach(input => {
        const placeholder = input.getAttribute('placeholder');
        if (placeholder.includes('Enter email') || placeholder.includes('Vendosni email')) {
            input.setAttribute('placeholder', translations[lang].enterEmail);
        } else if (placeholder.includes('Enter current password') || placeholder.includes('Vendosni fjalëkalimin aktual')) {
            input.setAttribute('placeholder', `${translations[lang].enterCurrent} ${translations[lang].password}`);
        } else if (placeholder.includes('Enter new password') || placeholder.includes('Vendosni fjalëkalimin e ri')) {
            input.setAttribute('placeholder', `${translations[lang].enterNew} ${translations[lang].password}`);
        } else if (placeholder.includes('Confirm new password') || placeholder.includes('Konfirmoni fjalëkalimin e ri')) {
            input.setAttribute('placeholder', `${translations[lang].confirm} ${translations[lang].password}`);
        }
    });

    // Update min/max labels
    document.querySelectorAll('.input-group-text').forEach(text => {
        if (text.textContent === 'Min' || text.textContent === 'Min') {
            text.textContent = translations[lang].min;
        } else if (text.textContent === 'Max' || text.textContent === 'Max') {
            text.textContent = translations[lang].max;
        }
    });
    
    // Update form labels
    document.querySelectorAll('.form-label').forEach(label => {
        const text = label.textContent.trim();
        if (text.includes('Language') || text.includes('Gjuha')) {
            label.textContent = translations[lang].language;
        } else if (text.includes('System Name') || text.includes('Emri i Sistemit')) {
            label.textContent = translations[lang].systemName;
        } else if (text.includes('Pool Size') || text.includes('Madhësia e Pishinës')) {
            label.textContent = translations[lang].poolSize;
        } else if (text.includes('Refresh Interval') || text.includes('Intervali i Rifreskimit')) {
            label.textContent = translations[lang].refreshInterval;
        } else if (text.includes('Default Operation') || text.includes('Mënyra e Parazgjedhur')) {
            label.textContent = translations[lang].defaultMode;
        } else if (text.includes('Username') || text.includes('Emri i përdoruesit')) {
            label.textContent = translations[lang].username;
        } else if (text.includes('Password') || text.includes('Fjalëkalimi')) {
            label.textContent = translations[lang].password;
        } else if (text.includes('Email') || text.includes('Email')) {
            label.textContent = translations[lang].email;
        }
            // Check for specific labels with common text patterns
        if (text.includes('pH Range') || text.includes('Diapazoni i pH')) {
            label.textContent = translations[lang].phRange;
        } else if (text.includes('ORP Range') || text.includes('Diapazoni i ORP')) {
            label.textContent = translations[lang].orpRange;
        } else if (text.includes('Free Chlorine Range') || text.includes('Diapazoni i Klorit')) {
            label.textContent = translations[lang].freeChlorineRange;
        } else if (text.includes('Combined Chlorine') || text.includes('Klorit të Kombinuar')) {
            label.textContent = translations[lang].combinedChlorineMax;
        }
    });
    
    // Update form check labels
    document.querySelectorAll('.form-check-label').forEach(label => {
        if (label.getAttribute('for') === 'langEnglish') {
            label.textContent = translations[lang].english;
        } else if (label.getAttribute('for') === 'langAlbanian') {
            label.textContent = translations[lang].albanian;
        } else if (label.getAttribute('for') === 'defaultModeAuto') {
            label.textContent = translations[lang].automatic;
        } else if (label.getAttribute('for') === 'defaultModeManual') {
            label.textContent = translations[lang].manual;
        } else if (label.getAttribute('for') === 'showDosingEvents') {
            label.textContent = translations[lang].showDosingEvents;
        }
    });
    
    // Update buttons
    document.querySelectorAll('button').forEach(button => {
        const text = button.textContent.trim();
        if (text === 'Save System Settings' || text === 'Ruaj Cilësimet e Sistemit') {
            button.textContent = translations[lang].saveSettings;
        } else if (text === 'Save Chemistry Settings' || text === 'Ruaj Cilësimet e Kimisë') {
            button.textContent = translations[lang].saveSettings;
        } else if (text === 'Save Pump Settings' || text === 'Ruaj Cilësimet e Pompës') {
            button.textContent = translations[lang].saveSettings;
        } else if (text === 'Save Turbidity Settings' || text === 'Ruaj Cilësimet e Turbullirës') {
            button.textContent = translations[lang].saveSettings;
        } else if (text === 'Save Notification Settings' || text === 'Ruaj Cilësimet e Njoftimeve') {
            button.textContent = translations[lang].saveSettings;
        } else if (text === 'Change Password' || text === 'Ndrysho Fjalëkalimin') {
            button.textContent = translations[lang].changePassword;
        } else if (text === 'Export Settings' || text === 'Eksporto Cilësimet') {
            button.textContent = translations[lang].export + ' ' + translations[lang].settings;
        } else if (text === 'Import Settings' || text === 'Importo Cilësimet') {
            button.textContent = translations[lang].import + ' ' + translations[lang].settings;
        } else if (text === 'Save Retention Settings' || text === 'Ruaj Cilësimet e Ruajtjes') {
            button.textContent = translations[lang].saveSettings;
        } else if (text === 'Reset to Defaults' || text === 'Rivendos në Parazgjedhje') {
            button.textContent = translations[lang].resetToDefaults;
        } else if (text === 'Clear Historical Data' || text === 'Pastro të Dhënat Historike') {
            button.textContent = translations[lang].clearHistoricalData;
        } else if (text === 'Dose Acid' || text === 'Dozo Acid') {
            button.textContent = translations[lang].doseAcid;
        } else if (text === 'Dose Chlorine' || text === 'Dozo Klor') {
            button.textContent = translations[lang].doseChlorine;
        } else if (text === 'Stop Pump' || text === 'Ndalo Pompën') {
            button.textContent = translations[lang].stopPump;
        } else if (text === 'Start Dosing' || text === 'Fillo Dozimin') {
            button.textContent = translations[lang].startDosing;
        } else if (text === 'Apply' || text === 'Apliko') {
            button.textContent = translations[lang].apply;
        } else if (text === 'Export Data' || text === 'Eksporto të Dhënat') {
            button.textContent = translations[lang].exportData;
        }
    });
    
    // Update select options for time durations
    document.querySelectorAll('select option').forEach(option => {
        const text = option.textContent;
        if (text.includes('seconds') || text.includes('sekonda')) {
            const value = option.value;
            option.textContent = `${value} ${translations[lang].seconds}`;
        } else if (text.includes('minute') || text.includes('minuta')) {
            const value = option.value;
            option.textContent = `${value} ${translations[lang].minutes}`;
        } else if (text.includes('Last 24 Hours') || text.includes('24 Orët e Fundit')) {
            option.textContent = translations[lang].last24Hours;
        } else if (text.includes('Last 48 Hours') || text.includes('48 Orët e Fundit')) {
            option.textContent = translations[lang].last48Hours;
        } else if (text.includes('Last 7 Days') || text.includes('7 Ditët e Fundit')) {
            option.textContent = translations[lang].last7Days;
        } else if (text.includes('Last 30 Days') || text.includes('30 Ditët e Fundit')) {
            option.textContent = translations[lang].last30Days;
        } else if (text.includes('Custom Range') || text.includes('Interval i Personalizuar')) {
            option.textContent = translations[lang].customRange;
        }
    });
    
    // Update table headers in history tab
    if (document.querySelector('#historyDataTable')) {
        const headings = document.querySelector('#historyDataTable thead tr').querySelectorAll('th');
        if (headings.length >= 7) {
            headings[0].textContent = translations[lang].timestamp;
            // Keep parameter names unchanged (pH, ORP, etc.)
        }
    }
    
    if (document.querySelector('#eventsTable')) {
        const headings = document.querySelector('#eventsTable thead tr').querySelectorAll('th');
        if (headings.length >= 5) {
            headings[0].textContent = translations[lang].timestamp;
            headings[2].textContent = translations[lang].description;
            headings[3].textContent = translations[lang].parameter;
            headings[4].textContent = translations[lang].value;
        }
    }
    
    // Update record count text
    document.querySelectorAll('.d-flex div').forEach(div => {
        const text = div.textContent;
        if (text.includes('Showing') || text.includes('Duke shfaqur')) {
            const numbers = text.match(/\d+/g);
            if (numbers && numbers.length >= 2) {
                const shown = numbers[0];
                const total = numbers[1];
                if (text.includes('records') || text.includes('regjistrime')) {
                    div.textContent = `${translations[lang].showing} ${shown} ${translations[lang].of} ${total} ${translations[lang].records}`;
                } else if (text.includes('events') || text.includes('ngjarje')) {
                    div.textContent = `${translations[lang].showing} ${shown} ${translations[lang].of} ${total} ${translations[lang].events}`;
                }
            }
        }
    });

    // Update chart translations
    if (chemistryChart) {
        updateChartTranslations(chemistryChart, lang);
    }

    if (turbidityChart) {
        updateChartTranslations(turbidityChart, lang);
    }

    if (historyChart) {
        updateChartTranslations(historyChart, lang);
    }
    
    // Update radio buttons based on current language
    if (lang === 'sq') {
        document.getElementById('langAlbanian').checked = true;
    } else {
        document.getElementById('langEnglish').checked = true;
    }
    
    // Show toast notification for language change
    const message = lang === 'sq' ? 
        translations.sq.languageChanged : 
        translations.en.languageChanged;
    
    showToast(message);
}

/**
 * Show toast with message from translations
 * @param {string} messageKey - The translation key for the message
 * @param {string} type - Toast type (success, error, warning, info)
 */
function showLocalizedToast(messageKey, type = 'success') {
    const message = translations[currentLanguage][messageKey] || messageKey;
    showToast(message, type);
}

function t(key) {
    return translations[currentLanguage][key] || key;
}

/**
 * Get translation for a specific key based on current language
 * @param {string} key - The translation key to look up
 * @returns {string} - The translated text or the key itself if not found
 */
function t(key) {
    if (!currentLanguage || !translations[currentLanguage]) {
        return key;
    }
    return translations[currentLanguage][key] || key;
}

/**
 * Update chart labels and options with translations
 * @param {object} chart - Chart.js chart instance
 * @param {string} lang - Language code ('en' or 'sq')
 */
function updateChartTranslations(chart, lang) {
    if (!chart) return;
    
    // Update axis titles
    if (chart.options.scales['y-ph']) {
        chart.options.scales['y-ph'].title.text = 'pH';
    }
    
    if (chart.options.scales['y-chlorine']) {
        chart.options.scales['y-chlorine'].title.text = `${translations[lang].chlorineTitle} (mg/L)`;
    }
    
    if (chart.options.scales['y-orp']) {
        chart.options.scales['y-orp'].title.text = `ORP (mV)`;
    }
    
    if (chart.options.scales['y-turbidity']) {
        chart.options.scales['y-turbidity'].title.text = `${translations[lang].turbidityTitle} (NTU)`;
    }
    
    if (chart.options.scales['y-temp']) {
        chart.options.scales['y-temp'].title.text = `${translations[lang].temperatureTitle} (°C)`;
    }
    
    // Update dataset labels
    chart.data.datasets.forEach(dataset => {
        if (dataset.label === 'pH' || dataset.label === 'pH') {
            dataset.label = 'pH';
        } else if (dataset.label === 'ORP' || dataset.label === 'ORP') {
            dataset.label = 'ORP';
        } else if (dataset.label === 'Free Chlorine' || dataset.label === 'Klori i Lirë') {
            dataset.label = translations[lang].chlorineTitle;
        } else if (dataset.label === 'Combined Chlorine' || dataset.label === 'Klori i Kombinuar') {
            dataset.label = translations[lang].combinedChlorineTitle;
        } else if (dataset.label === 'Turbidity' || dataset.label === 'Turbullira') {
            dataset.label = translations[lang].turbidityTitle;
        } else if (dataset.label === 'Temperature' || dataset.label === 'Temperatura') {
            dataset.label = translations[lang].temperatureTitle;
        } else if (dataset.label === 'Dosing Events' || dataset.label === 'Ngjarjet e Dozimit') {
            dataset.label = translations[lang].dosingEvents;
        }
    });
    
    // Update chart
    chart.update();
}

/**
 * Test translation completeness
 * Logs any missing translations to the console
 */
function testTranslationCompleteness() {
    console.log("Testing translation completeness...");
    
    // Check for missing translations in Albanian compared to English
    const missingKeys = [];
    for (const key in translations.en) {
        if (!translations.sq[key]) {
            missingKeys.push(key);
        }
    }
    
    // Check for extra keys in Albanian not in English
    const extraKeys = [];
    for (const key in translations.sq) {
        if (!translations.en[key]) {
            extraKeys.push(key);
        }
    }
    
    if (missingKeys.length > 0) {
        console.warn("Missing translations in Albanian:", missingKeys);
    } else {
        console.log("All English keys have Albanian translations ✓");
    }
    
    if (extraKeys.length > 0) {
        console.warn("Extra keys in Albanian not in English:", extraKeys);
    }
    
    // Check DOM elements for translation coverage
    const missingElements = [];
    document.querySelectorAll('button, h1, h2, h3, h4, h5, h6, label, .card-title, .badge').forEach(el => {
        const text = el.textContent.trim();
        if (text && text.length > 1 && !/^\d+(\.\d+)?$/.test(text)) {
            // Skip numbers and very short texts
            let found = false;
            for (const key in translations.en) {
                if (translations.en[key] === text || translations.sq[key] === text) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                missingElements.push({
                    element: el.tagName,
                    text: text,
                    path: getElementPath(el)
                });
            }
        }
    });
    
    if (missingElements.length > 0) {
        console.warn("UI elements without translations:", missingElements);
    } else {
        console.log("All checked UI elements have translations ✓");
    }
}

/**
 * Get simplified path to element for debugging
 */
function getElementPath(el) {
    let path = [];
    while (el && el.nodeType === Node.ELEMENT_NODE) {
        let selector = el.nodeName.toLowerCase();
        if (el.id) {
            selector += '#' + el.id;
        } else if (el.className) {
            selector += '.' + el.className.replace(/\s+/g, '.');
        }
        path.unshift(selector);
        el = el.parentNode;
    }
    return path.join(' > ');
}