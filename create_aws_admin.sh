#!/bin/bash
# Script to create admin user on AWS production server
# Run this on your EC2 instance

echo "==================================="
echo "Pool Automation - Create AWS Admin"
echo "==================================="

# Navigate to application directory
cd /var/www/pool-automation

# Activate virtual environment
source venv/bin/activate

# Set production environment
export FLASK_ENV=production

# Create admin user
echo "Creating admin user..."
python3 << EOF
import sys
sys.path.insert(0, '/var/www/pool-automation')

from setup_admin import setup_admin_user

# Create main admin
setup_admin_user("admin@biopool.design", "BioPool2024!", "BioPool Admin")

# Create your personal admin
setup_admin_user("pierin.nauni@gmail.com", "YourSecurePassword123!", "Pierin Nauni")

print("\nAdmin users created successfully!")
print("You can now login at: https://dashboard.biopool.design")
EOF

echo "Done!"