# AWS Deployment Guide - Pool Automation System

## Current Production Setup

### Domain
- **URL**: https://dashboard.biopool.design
- **SSL**: Let's Encrypt (auto-renewed)

### AWS Infrastructure
- **Platform**: EC2 Instance (Ubuntu)
- **Database**: SQLite (file-based)
- **Web Server**: Nginx + Gunicorn

## How to Access Your AWS-Hosted Website

1. **Via Browser**: 
   - Go to: https://dashboard.biopool.design
   - Login credentials are in the PostgreSQL database on AWS

2. **Via SSH** (if you have the .pem key):
   ```bash
   ssh -i your-key.pem ubuntu@<EC2-IP-ADDRESS>
   ```

## How to Stop/Remove AWS Hosting (Save Costs)

### Option 1: Stop EC2 Instance (Recommended - Preserves Everything)
1. Log into AWS Console: https://console.aws.amazon.com
2. Go to EC2 Dashboard
3. Find your instance (look for one with Ubuntu)
4. Select the instance → Actions → Instance State → **Stop**
5. **Cost**: You'll only pay for EBS storage (~$0.10/GB/month)

### Option 2: Create Backup and Terminate (Maximum Savings)

#### Step 1: Backup Database
```bash
# SSH into your EC2 instance first
ssh -i your-key.pem ubuntu@<EC2-IP>

# Create database backup
cp /var/www/pool-automation/pool_automation.db /var/www/pool-automation/pool_automation_backup_$(date +%Y%m%d).db

# Download backup to your local machine
scp -i your-key.pem ubuntu@<EC2-IP>:/var/www/pool-automation/pool_automation_backup_*.db ./
```

#### Step 2: Backup Application Files
```bash
# On EC2 instance
cd /var/www
sudo tar -czf pool-automation-backup.tar.gz pool-automation/

# Download to local
scp -i your-key.pem ubuntu@<EC2-IP>:/var/www/pool-automation-backup.tar.gz ./
```

#### Step 3: Save Configuration
- Save your EC2 instance details (instance type, security groups, etc.)
- Note your Elastic IP (if you have one)
- Save your Route 53 DNS settings

#### Step 4: Terminate Instance
1. In AWS Console → EC2 → Instances
2. Select instance → Actions → Instance State → **Terminate**
3. Release Elastic IP (if not needed): EC2 → Elastic IPs → Release

#### Step 5: Update DNS
- Point dashboard.biopool.design to a holding page or remove the A record

## How to Re-Deploy When Ready

### Quick Re-deployment Steps

1. **Launch New EC2 Instance**
   - Ubuntu 22.04 LTS
   - t2.micro or t3.micro (for testing)
   - Security Group: Allow ports 22, 80, 443

2. **Run Deployment Script**
   ```bash
   # Upload your code as pool-automation.zip
   scp -i your-key.pem pool-automation.zip ubuntu@<NEW-EC2-IP>:~/

   # SSH into instance
   ssh -i your-key.pem ubuntu@<NEW-EC2-IP>

   # Run setup
   cd pool-automation/deployment
   chmod +x setup.sh
   sudo ./setup.sh ../pool-automation.zip
   ```

3. **Restore Database**
   ```bash
   cp pool_automation_backup.db /var/www/pool-automation/pool_automation.db
   sudo chown www-data:www-data /var/www/pool-automation/pool_automation.db
   ```

4. **Update DNS**
   - Point dashboard.biopool.design to new EC2 IP

5. **Setup Admin User**
   ```bash
   cd /var/www/pool-automation
   source venv/bin/activate
   export FLASK_ENV=production
   python setup_admin.py
   ```

## Important Files for Deployment

- `/deployment/setup.sh` - Main deployment script
- `/deployment/nginx.conf` - Nginx configuration
- `/deployment/pool-automation.service` - Systemd service
- `/.env.production` - Production environment variables
- `/setup_admin.py` - Admin user creation script

## Cost Savings Tips

1. **While Developing**: Stop EC2 instance (saves ~95% of costs)
2. **Use Free Tier**: t2.micro instance (750 hours/month free for first year)
3. **Consider RDS Free Tier**: For PostgreSQL (if using separate database)
4. **Delete Unused Resources**: Elastic IPs, EBS snapshots, etc.

## Security Notes

⚠️ **Important**: Before re-deploying, change these credentials:
- Flask SECRET_KEY
- Email SMTP password
- Admin user passwords

## Contact AWS Support
If you need help finding your instance:
- AWS Support: https://console.aws.amazon.com/support/
- Check all regions if you can't find your instance
- Look for billing details to identify which services are running