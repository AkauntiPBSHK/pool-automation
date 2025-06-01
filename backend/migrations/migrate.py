#!/usr/bin/env python3
"""
Database Migration CLI Tool
Usage: python migrate.py [command] [options]
"""

import os
import sys
import argparse
import logging
from pathlib import Path

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from migration_manager import MigrationManager

def setup_logging(verbose: bool = False):
    """Setup logging configuration"""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

def get_db_path():
    """Get database path from environment or default"""
    return os.environ.get('DATABASE_PATH', 'pool_automation.db')

def cmd_status(args):
    """Show migration status"""
    manager = MigrationManager(get_db_path())
    status = manager.get_status()
    
    print(f"Migration Status:")
    print(f"  Database: {get_db_path()}")
    print(f"  Current Version: {status['current_version'] or 'None'}")
    print(f"  Latest Version: {status['latest_version'] or 'None'}")
    print(f"  Applied: {status['applied_count']}/{status['total_migrations']}")
    print(f"  Pending: {status['pending_count']}")
    
    if status['applied_versions']:
        print(f"\nApplied Migrations:")
        for version in status['applied_versions']:
            print(f"  ✓ {version}")
    
    if status['pending_versions']:
        print(f"\nPending Migrations:")
        for version in status['pending_versions']:
            print(f"  ○ {version}")
    
    if status['pending_count'] == 0:
        print(f"\n✓ Database is up to date!")
    else:
        print(f"\n⚠ {status['pending_count']} migrations need to be applied")

def cmd_migrate(args):
    """Apply pending migrations"""
    manager = MigrationManager(get_db_path())
    
    if args.version:
        print(f"Migrating to version {args.version}...")
        success = manager.migrate(args.version)
    else:
        print("Applying all pending migrations...")
        success = manager.migrate()
    
    if success:
        print("✓ Migration completed successfully")
        cmd_status(args)
    else:
        print("✗ Migration failed")
        sys.exit(1)

def cmd_rollback(args):
    """Rollback to specific version"""
    if not args.version:
        print("Error: Version required for rollback")
        sys.exit(1)
    
    manager = MigrationManager(get_db_path())
    
    print(f"Rolling back to version {args.version}...")
    print("⚠ This will PERMANENTLY remove data created after this version!")
    
    if not args.force:
        confirm = input("Are you sure? (yes/no): ")
        if confirm.lower() != 'yes':
            print("Rollback cancelled")
            return
    
    success = manager.rollback(args.version)
    
    if success:
        print("✓ Rollback completed successfully")
        cmd_status(args)
    else:
        print("✗ Rollback failed")
        sys.exit(1)

def cmd_create(args):
    """Create new migration file"""
    if not args.name:
        print("Error: Migration name required")
        sys.exit(1)
    
    manager = MigrationManager(get_db_path())
    filepath = manager.create_migration_file(args.name, args.description or "")
    
    print(f"✓ Created migration file: {filepath}")
    print("Edit the file to add your SQL statements")

def cmd_init(args):
    """Initialize migration system"""
    manager = MigrationManager(get_db_path())
    print(f"✓ Migration system initialized for {get_db_path()}")
    cmd_status(args)

def main():
    parser = argparse.ArgumentParser(
        description="Database Migration Tool for Pool Automation",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python migrate.py status                    # Show migration status
  python migrate.py migrate                   # Apply all pending migrations
  python migrate.py migrate --version 003     # Migrate to specific version
  python migrate.py rollback --version 001    # Rollback to version 001
  python migrate.py create --name add_alerts  # Create new migration
        """
    )
    
    parser.add_argument('-v', '--verbose', action='store_true',
                       help='Enable verbose logging')
    
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Status command
    status_parser = subparsers.add_parser('status', help='Show migration status')
    
    # Migrate command
    migrate_parser = subparsers.add_parser('migrate', help='Apply migrations')
    migrate_parser.add_argument('--version', help='Target version (default: latest)')
    
    # Rollback command
    rollback_parser = subparsers.add_parser('rollback', help='Rollback migrations')
    rollback_parser.add_argument('--version', required=True, help='Target version')
    rollback_parser.add_argument('--force', action='store_true',
                                help='Skip confirmation prompt')
    
    # Create command
    create_parser = subparsers.add_parser('create', help='Create new migration')
    create_parser.add_argument('--name', required=True, help='Migration name')
    create_parser.add_argument('--description', help='Migration description')
    
    # Init command
    init_parser = subparsers.add_parser('init', help='Initialize migration system')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    setup_logging(args.verbose)
    
    try:
        # Command dispatch
        commands = {
            'status': cmd_status,
            'migrate': cmd_migrate,
            'rollback': cmd_rollback,
            'create': cmd_create,
            'init': cmd_init
        }
        
        if args.command in commands:
            commands[args.command](args)
        else:
            print(f"Unknown command: {args.command}")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\nOperation cancelled")
        sys.exit(1)
    except Exception as e:
        logging.error(f"Command failed: {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()