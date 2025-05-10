#!/bin/bash
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
BACKUP_DIR="/var/www/pool-automation/backups"
PGPASSWORD="secure-db-password" pg_dump -U pool_user pool_automation_db > "${BACKUP_DIR}/pool_automation_${TIMESTAMP}.sql"
find "${BACKUP_DIR}" -name "pool_automation_*.sql" -mtime +7 -delete