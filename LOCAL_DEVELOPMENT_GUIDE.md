# Local Development Guide - Pool Automation System

## Quick Start

### 1. Start the Development Server

**Option A: From Windows Command Prompt**
```cmd
cd C:\Users\User\pool-automation
venv\Scripts\python.exe wsgi.py
```

**Option B: Use the batch file**
- Double-click `start_server.bat` in Windows Explorer

**Option C: From WSL**
```bash
cd /mnt/c/Users/User/pool-automation
venv/Scripts/python.exe wsgi.py
```

### 2. Access the Application
- **URL**: http://localhost:5000
- **Admin Login**:
  - Email: `admin@pool-automation.local`
  - Password: `admin123`

## Development Workflow

### Key Features Implemented

1. **Authentication System** ✅
   - Role-based access (Admin/Customer)
   - Secure password hashing
   - Session management

2. **Customer Management** ✅
   - Admin can create customers
   - Assign pools to customers
   - Customers see only their pools

3. **Pool Monitoring Dashboard**
   - Real-time sensor data
   - Automated dosing control
   - Historical charts

### Project Structure
```
pool-automation/
├── backend/
│   ├── api/           # Flask application
│   ├── models/        # Database models
│   ├── hardware/      # Sensor/actuator interfaces
│   └── utils/         # Security, validation, etc.
├── frontend/
│   ├── static/        # JavaScript, CSS
│   │   ├── js/       # Modular JS architecture
│   │   └── css/      # Stylesheets
│   └── templates/     # HTML templates
├── config/            # Configuration files
├── tests/            # Test suites
└── deployment/       # AWS deployment scripts
```

### Common Development Tasks

#### Create a Test Customer
```python
# Run: venv\Scripts\python.exe
from setup_admin import setup_admin_user
setup_admin_user("customer@test.com", "test123", "Test Customer")

# Then change role to customer in database
```

#### Reset Database
```bash
# Backup first!
mv pool_automation.db pool_automation.db.backup

# Recreate
venv/Scripts/python.exe -c "from backend.models.database import DatabaseHandler; DatabaseHandler()"
venv/Scripts/python.exe setup_admin.py
```

#### Run Tests
```bash
venv\Scripts\python.exe -m pytest tests/
```

### Environment Variables

The application uses `.env` files:
- `.env` - Local development settings
- `.env.production` - AWS production settings (DO NOT use locally)

### Key URLs When Running Locally

- **Login**: http://localhost:5000/login
- **Pools List**: http://localhost:5000/pools
- **Customer Management**: http://localhost:5000/customers (admin only)
- **Pool Dashboard**: http://localhost:5000/dashboard/{pool_id}

### API Endpoints

- `GET /api/status` - Current sensor readings
- `GET /api/history` - Historical data
- `POST /api/pump/control` - Manual pump control
- `POST /api/dosing/manual` - Manual dosing
- `GET /api/notifications` - Alert settings

### WebSocket Events

The dashboard uses Socket.IO for real-time updates:
- `parameter_update` - Sensor data updates (every 2 seconds)
- `dosing_event` - Dosing controller events
- `alert` - System alerts

### Security Features

- **Rate Limiting**: Prevents brute force attacks
- **CSRF Protection**: On all forms
- **XSS Prevention**: Input sanitization
- **Session Security**: Secure session handling

### Troubleshooting

**Server won't start:**
- Check if port 5000 is in use
- Kill existing Python processes
- Check for syntax errors in code

**Can't login:**
- Clear browser cache
- Run `setup_admin.py` to reset admin password
- Check database file exists

**No sensor data:**
- Server is in simulation mode by default
- Check browser console for WebSocket errors
- Ensure JavaScript files are loaded

### Next Development Steps

1. **Enhanced Customer Features**
   - Customer self-registration
   - Password reset functionality
   - Email notifications

2. **Pool Management**
   - Multiple pools per customer
   - Pool sharing between users
   - Maintenance scheduling

3. **Advanced Analytics**
   - Predictive maintenance
   - Water quality trends
   - Chemical usage optimization

4. **Mobile App**
   - React Native or Flutter
   - Push notifications
   - Offline support

## Git Workflow

```bash
# Check status
git status

# Create feature branch
git checkout -b feature/your-feature

# Commit changes
git add .
git commit -m "feat: your feature description"

# Push to GitHub
git push origin feature/your-feature
```

## Important Files

- `CLAUDE.md` - Project-specific instructions
- `AWS_DEPLOYMENT_GUIDE.md` - Production deployment
- `setup_admin.py` - Create admin users
- `config.py` - Application configuration