#!/bin/bash
# setup.sh - Deployment script for EC2 without git

# Update system packages
sudo apt update
sudo apt upgrade -y

# Install dependencies
sudo apt install -y python3-pip python3-venv nginx certbot python3-certbot-nginx postgresql postgresql-contrib unzip

# Set up PostgreSQL database
sudo -u postgres psql -c "CREATE USER pool_user WITH PASSWORD 'secure-db-password';"
sudo -u postgres psql -c "CREATE DATABASE pool_automation_db OWNER pool_user;"

# Set up application directory
sudo mkdir -p /var/www/pool-automation
sudo chown ubuntu:ubuntu /var/www/pool-automation

# Unzip application to deployment directory
unzip ~/pool-automation.zip -d /var/www/pool-automation
cd /var/www/pool-automation

# Set up Python environment
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn psycopg2-binary eventlet

# Copy production environment file
cp .env.production .env

# Set up Nginx configuration
sudo bash -c 'cat > /etc/nginx/sites-available/dashboard.biopool.design << EOF
server {
    listen 80;
    server_name dashboard.biopool.design www.dashboard.biopool.design;

    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /socket.io {
        proxy_pass http://localhost:5000/socket.io;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF'

# Enable site and test configuration
sudo ln -s /etc/nginx/sites-available/dashboard.biopool.design /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Set up systemd service
sudo bash -c 'cat > /etc/systemd/system/pool-automation.service << EOF
[Unit]
Description=Pool Automation System
After=network.target postgresql.service

[Service]
User=ubuntu
Group=ubuntu
WorkingDirectory=/var/www/pool-automation
Environment="PATH=/var/www/pool-automation/venv/bin"
ExecStart=/var/www/pool-automation/venv/bin/gunicorn --worker-class eventlet -w 1 --bind 127.0.0.1:5000 wsgi:app

[Install]
WantedBy=multi-user.target
EOF'

# Start and enable service
sudo systemctl daemon-reload
sudo systemctl start pool-automation
sudo systemctl enable pool-automation
sudo systemctl status pool-automation

# Set up SSL with Let's Encrypt
sudo certbot --nginx -d dashboard.biopool.design -d www.dashboard.biopool.design

# Setup complete
echo "Deployment complete!"