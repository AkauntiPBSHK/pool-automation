#!/usr/bin/env python3
# simple_login.py - Direct login to bypass Flask-Login issues

import os
import sqlite3
import argparse
import uuid
import json
from werkzeug.security import check_password_hash
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database paths
DEV_DB_PATH = os.getenv('DATABASE_PATH', 'pool_automation.db')
PROD_DB_PATH = os.getenv('DATABASE_PATH', '/var/www/pool-automation/pool_automation.db')

def generate_user_token(email, user_id, role):
    """Generate a simple user token for authentication."""
    # Generate a unique token
    token = str(uuid.uuid4())
    
    # Store token in a simple JSON file with user info
    user_data = {
        'token': token,
        'email': email,
        'id': user_id,
        'role': role
    }
    
    # Write to file
    with open('user_token.json', 'w') as f:
        json.dump(user_data, f)
    
    return token, user_data

def get_user_by_email(email, password=None):
    """Get user from database by email, optionally verify password."""
    db_path = PROD_DB_PATH if os.getenv('FLASK_ENV') == 'production' else DEV_DB_PATH
    
    try:
        with sqlite3.connect(db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Get user data
            cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
            user = cursor.fetchone()
            
            if not user:
                print(f"User not found: {email}")
                return None
            
            # Check password if provided
            if password and not check_password_hash(user['password_hash'], password):
                print("Incorrect password")
                return None
            
            # Get column names
            column_names = [column[0] for column in cursor.description]
            
            # Get role
            role = 'customer'
            if 'role' in column_names and user['role']:
                role = user['role']
            
            # Return user data
            return {
                'id': user['id'],
                'email': user['email'],
                'name': user['name'] if 'name' in column_names else None,
                'role': role
            }
    
    except Exception as e:
        print(f"Error getting user: {e}")
        return None

def main():
    parser = argparse.ArgumentParser(description='Simple login tool')
    
    # Add arguments
    parser.add_argument('--email', required=True, help='User email')
    parser.add_argument('--password', help='User password (optional for admin override)')
    
    args = parser.parse_args()
    
    # Get user
    user = get_user_by_email(args.email, args.password)
    
    if not user:
        print("Login failed")
        return
    
    # Generate token
    token, user_data = generate_user_token(user['email'], user['id'], user['role'])
    
    print(f"Login successful for {user['email']} (role: {user['role']})")
    print(f"Token: {token}")
    print(f"User data saved to user_token.json")
    print("")
    print("To use this token, add this code to your app:")
    print("")
    print("```python")
    print("# Add this after login_manager setup")
    print("# Check for direct token access")
    print("@app.before_request")
    print("def check_token_auth():")
    print("    if current_user.is_authenticated:")
    print("        return  # User already logged in")
    print("    ")
    print("    # Check for token in session")
    print("    if 'user_token' in session:")
    print("        try:")
    print("            with open('user_token.json', 'r') as f:")
    print("                user_data = json.load(f)")
    print("            ")
    print("            if session['user_token'] == user_data['token']:")
    print("                # Create user object")
    print("                user = User(")
    print("                    id=user_data['id'],")
    print("                    email=user_data['email'],")
    print("                    password_hash='',  # Not needed")
    print("                    name=user_data.get('name'),")
    print("                    role=user_data.get('role', 'customer')")
    print("                )")
    print("                ")
    print("                # Log in user")
    print("                login_user(user)")
    print("        except Exception as e:")
    print("            print(f'Token auth error: {e}')")
    print("```")
    print("")
    print("Add this route to test token login:")
    print("")
    print("```python")
    print("@app.route('/token-login')")
    print("def token_login():")
    print("    try:")
    print("        with open('user_token.json', 'r') as f:")
    print("            user_data = json.load(f)")
    print("        ")
    print("        # Store token in session")
    print("        session['user_token'] = user_data['token']")
    print("        ")
    print("        return redirect('/pools')")
    print("    except Exception as e:")
    print("        return f'Token login error: {e}'")
    print("```")

if __name__ == '__main__':
    main()