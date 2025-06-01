#!/usr/bin/env python3
"""
Test runner for Pool Automation System
Runs both backend and frontend tests with coverage reporting
"""

import os
import sys
import subprocess
import argparse
import json
from pathlib import Path

def run_command(cmd, cwd=None, check=True):
    """Run a command and return the result"""
    print(f"Running: {' '.join(cmd)}")
    try:
        result = subprocess.run(
            cmd, 
            cwd=cwd, 
            capture_output=True, 
            text=True, 
            check=check
        )
        if result.stdout:
            print(result.stdout)
        if result.stderr:
            print(result.stderr, file=sys.stderr)
        return result
    except subprocess.CalledProcessError as e:
        print(f"Command failed with exit code {e.returncode}")
        if e.stdout:
            print("STDOUT:", e.stdout)
        if e.stderr:
            print("STDERR:", e.stderr)
        if check:
            raise
        return e

def check_dependencies():
    """Check if required dependencies are available"""
    print("Checking dependencies...")
    
    # Check Python dependencies
    try:
        import pytest
        print(f"✓ pytest {pytest.__version__}")
    except ImportError:
        print("✗ pytest not found. Install with: pip install pytest")
        return False
    
    try:
        import coverage
        print(f"✓ coverage {coverage.__version__}")
    except ImportError:
        print("✗ coverage not found. Install with: pip install coverage")
        return False
    
    # Check Node.js and npm
    try:
        result = subprocess.run(['node', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✓ Node.js {result.stdout.strip()}")
        else:
            print("✗ Node.js not found")
            return False
    except FileNotFoundError:
        print("✗ Node.js not found")
        return False
    
    try:
        result = subprocess.run(['npm', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✓ npm {result.stdout.strip()}")
        else:
            print("✗ npm not found")
            return False
    except FileNotFoundError:
        print("✗ npm not found")
        return False
    
    return True

def install_frontend_deps(tests_dir):
    """Install frontend test dependencies"""
    frontend_tests_dir = tests_dir / 'frontend'
    
    if not (frontend_tests_dir / 'package.json').exists():
        print("No package.json found for frontend tests")
        return False
    
    print("Installing frontend test dependencies...")
    result = run_command(['npm', 'install'], cwd=frontend_tests_dir, check=False)
    return result.returncode == 0

def run_backend_tests(args):
    """Run backend Python tests"""
    print("\n" + "="*50)
    print("RUNNING BACKEND TESTS")
    print("="*50)
    
    # Setup test environment
    env = os.environ.copy()
    env['PYTHONPATH'] = str(Path(__file__).parent.parent / 'backend')
    env['DATABASE_PATH'] = ':memory:'
    
    pytest_args = [
        'python', '-m', 'pytest',
        str(Path(__file__).parent),
        '-v',
        '--tb=short'
    ]
    
    if args.coverage:
        pytest_args.extend([
            '--cov=backend',
            '--cov-report=term-missing',
            '--cov-report=html:tests/coverage/backend',
            '--cov-fail-under=70'  # Require at least 70% coverage
        ])
    
    if args.verbose:
        pytest_args.append('-vv')
    
    if args.pattern:
        pytest_args.extend(['-k', args.pattern])
    
    result = run_command(pytest_args, check=False)
    return result.returncode == 0

def run_frontend_tests(args):
    """Run frontend JavaScript tests"""
    print("\n" + "="*50)
    print("RUNNING FRONTEND TESTS")
    print("="*50)
    
    frontend_tests_dir = Path(__file__).parent / 'frontend'
    
    if not (frontend_tests_dir / 'node_modules').exists():
        print("Frontend dependencies not installed. Installing now...")
        if not install_frontend_deps(Path(__file__).parent):
            print("Failed to install frontend dependencies")
            return False
    
    jest_args = ['npm', 'test']
    
    if args.coverage:
        jest_args = ['npm', 'run', 'test:coverage']
    
    if args.watch:
        jest_args = ['npm', 'run', 'test:watch']
    
    result = run_command(jest_args, cwd=frontend_tests_dir, check=False)
    return result.returncode == 0

def run_migration_tests(args):
    """Run database migration tests"""
    print("\n" + "="*50)
    print("RUNNING MIGRATION TESTS")
    print("="*50)
    
    migrations_dir = Path(__file__).parent.parent / 'backend' / 'migrations'
    
    # Test migration CLI
    test_commands = [
        ['python', 'migrate.py', 'status'],
        ['python', 'migrate.py', 'init'],
    ]
    
    env = os.environ.copy()
    env['DATABASE_PATH'] = ':memory:'
    
    all_passed = True
    for cmd in test_commands:
        print(f"\nTesting migration command: {' '.join(cmd)}")
        result = run_command(cmd, cwd=migrations_dir, check=False)
        if result.returncode != 0:
            all_passed = False
            print(f"Migration test failed: {' '.join(cmd)}")
    
    return all_passed

def run_security_tests(args):
    """Run security-focused tests"""
    print("\n" + "="*50)
    print("RUNNING SECURITY TESTS")
    print("="*50)
    
    # Run specific security test modules
    security_test_files = [
        'test_auth_middleware.py',
        'test_rate_limiter.py'
    ]
    
    env = os.environ.copy()
    env['PYTHONPATH'] = str(Path(__file__).parent.parent / 'backend')
    env['DATABASE_PATH'] = ':memory:'
    
    all_passed = True
    for test_file in security_test_files:
        test_path = Path(__file__).parent / test_file
        if test_path.exists():
            print(f"\nRunning security tests: {test_file}")
            result = run_command([
                'python', '-m', 'pytest', str(test_path), '-v'
            ], check=False)
            if result.returncode != 0:
                all_passed = False
    
    return all_passed

def generate_test_report(args):
    """Generate comprehensive test report"""
    print("\n" + "="*50)
    print("GENERATING TEST REPORT")
    print("="*50)
    
    report = {
        'test_run': {
            'timestamp': subprocess.run(['date'], capture_output=True, text=True).stdout.strip(),
            'backend_tests': 'backend' in args.suite or 'all' in args.suite,
            'frontend_tests': 'frontend' in args.suite or 'all' in args.suite,
            'migration_tests': 'migration' in args.suite or 'all' in args.suite,
            'security_tests': 'security' in args.suite or 'all' in args.suite
        },
        'coverage': {
            'backend': None,
            'frontend': None
        },
        'results': {
            'backend': None,
            'frontend': None,
            'migration': None,
            'security': None
        }
    }
    
    # Try to read coverage reports
    backend_coverage_file = Path(__file__).parent / 'coverage' / 'backend' / 'index.html'
    frontend_coverage_file = Path(__file__).parent / 'frontend' / 'coverage' / 'lcov-report' / 'index.html'
    
    if backend_coverage_file.exists():
        report['coverage']['backend'] = str(backend_coverage_file)
    
    if frontend_coverage_file.exists():
        report['coverage']['frontend'] = str(frontend_coverage_file)
    
    # Save report
    report_file = Path(__file__).parent / 'test_report.json'
    with open(report_file, 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"Test report saved to: {report_file}")
    print(f"Backend coverage report: {report['coverage']['backend'] or 'Not generated'}")
    print(f"Frontend coverage report: {report['coverage']['frontend'] or 'Not generated'}")

def main():
    parser = argparse.ArgumentParser(description='Run Pool Automation System tests')
    parser.add_argument(
        '--suite', 
        choices=['all', 'backend', 'frontend', 'migration', 'security'],
        default='all',
        help='Test suite to run'
    )
    parser.add_argument('--coverage', action='store_true', help='Generate coverage reports')
    parser.add_argument('--verbose', action='store_true', help='Verbose output')
    parser.add_argument('--watch', action='store_true', help='Watch mode for frontend tests')
    parser.add_argument('--pattern', help='Test pattern to match')
    parser.add_argument('--no-deps-check', action='store_true', help='Skip dependency check')
    
    args = parser.parse_args()
    
    # Check dependencies
    if not args.no_deps_check and not check_dependencies():
        print("Dependency check failed. Use --no-deps-check to skip.")
        return 1
    
    # Create coverage directory
    coverage_dir = Path(__file__).parent / 'coverage'
    coverage_dir.mkdir(exist_ok=True)
    
    # Track results
    results = {}
    
    # Run selected test suites
    if args.suite == 'all' or args.suite == 'backend':
        results['backend'] = run_backend_tests(args)
    
    if args.suite == 'all' or args.suite == 'frontend':
        results['frontend'] = run_frontend_tests(args)
    
    if args.suite == 'all' or args.suite == 'migration':
        results['migration'] = run_migration_tests(args)
    
    if args.suite == 'all' or args.suite == 'security':
        results['security'] = run_security_tests(args)
    
    # Generate report
    if args.coverage:
        generate_test_report(args)
    
    # Print summary
    print("\n" + "="*50)
    print("TEST SUMMARY")
    print("="*50)
    
    all_passed = True
    for suite, passed in results.items():
        status = "✓ PASSED" if passed else "✗ FAILED"
        print(f"{suite.capitalize()}: {status}")
        if not passed:
            all_passed = False
    
    if all_passed:
        print("\n🎉 All tests passed!")
        return 0
    else:
        print("\n❌ Some tests failed!")
        return 1

if __name__ == '__main__':
    sys.exit(main())