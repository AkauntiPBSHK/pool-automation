# device_agent.py - to be installed on Raspberry Pi
import requests
import json
import time
import uuid
import socket
import os

# Configuration
API_URL = "https://dashboard.biopool.design/api"
CONFIG_FILE = "/etc/biopool/device_config.json"
POLLING_INTERVAL = 30  # seconds

def load_config():
    """Load device configuration."""
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, 'r') as f:
            return json.load(f)
    
    # Create default config if it doesn't exist
    device_id = str(uuid.uuid4())
    config = {
        "device_id": device_id,
        "registered": False,
        "pool_id": None,
        "api_key": None
    }
    
    os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
    with open(CONFIG_FILE, 'w') as f:
        json.dump(config, f)
    
    return config

def save_config(config):
    """Save device configuration."""
    with open(CONFIG_FILE, 'w') as f:
        json.dump(config, f)

def get_sensor_readings():
    """Get readings from connected sensors."""
    # In a real implementation, this would read from actual sensors
    # For now, return simulated values
    return {
        "temperature": round(25 + 3 * (0.5 - float(os.urandom(1)[0]) / 255), 1),
        "ph": round(7.4 + 0.2 * (0.5 - float(os.urandom(1)[0]) / 255), 1),
        "orp": int(720 + 40 * (0.5 - float(os.urandom(1)[0]) / 255)),
        "turbidity": round(0.15 + 0.05 * (0.5 - float(os.urandom(1)[0]) / 255), 3),
        "free_chlorine": round(1.2 + 0.3 * (0.5 - float(os.urandom(1)[0]) / 255), 2),
        "combined_chlorine": round(0.2 + 0.1 * (0.5 - float(os.urandom(1)[0]) / 255), 2)
    }

def send_data():
    """Send sensor data to the cloud."""
    config = load_config()
    
    # If not registered, just exit
    if not config.get("registered") or not config.get("api_key"):
        print("Device not registered. Waiting for registration...")
        return False
    
    # Get readings
    readings = get_sensor_readings()
    
    # Send data to API
    try:
        response = requests.post(
            f"{API_URL}/device/data",
            json={
                "device_id": config["device_id"],
                "pool_id": config["pool_id"],
                "timestamp": time.time(),
                "readings": readings
            },
            headers={"Authorization": f"Bearer {config['api_key']}"}
        )
        
        if response.status_code == 200:
            print("Data sent successfully.")
            return True
        else:
            print(f"Error sending data: {response.status_code} - {response.text}")
            return False
    
    except Exception as e:
        print(f"Error sending data: {e}")
        return False

def check_for_commands():
    """Check for pending commands from the cloud."""
    config = load_config()
    
    # If not registered, just exit
    if not config.get("registered") or not config.get("api_key"):
        return
    
    try:
        response = requests.get(
            f"{API_URL}/device/commands?device_id={config['device_id']}",
            headers={"Authorization": f"Bearer {config['api_key']}"}
        )
        
        if response.status_code == 200:
            commands = response.json()
            for command in commands:
                process_command(command)
                
            # Acknowledge processed commands
            if commands:
                requests.post(
                    f"{API_URL}/device/commands/ack",
                    json={
                        "device_id": config["device_id"],
                        "command_ids": [cmd["id"] for cmd in commands]
                    },
                    headers={"Authorization": f"Bearer {config['api_key']}"}
                )
    
    except Exception as e:
        print(f"Error checking commands: {e}")

def process_command(command):
    """Process a command from the cloud."""
    print(f"Processing command: {command}")
    
    command_type = command.get("type")
    
    if command_type == "dosing":
        # Control the PAC pump
        if command.get("action") == "start":
            # Start the pump (in a real implementation, this would activate GPIO)
            print(f"Starting PAC pump for {command.get('duration', 30)} seconds")
        elif command.get("action") == "stop":
            # Stop the pump
            print("Stopping PAC pump")
    
    elif command_type == "mode":
        # Change controller mode
        print(f"Changing mode to {command.get('mode')}")
    
    # Other command types...

def register_device():
    """Check if the device is registered, register if needed."""
    config = load_config()
    
    # If already registered, skip
    if config.get("registered") and config.get("api_key") and config.get("pool_id"):
        return True
    
    # Try to register
    hostname = socket.gethostname()
    
    try:
        response = requests.post(
            f"{API_URL}/device/register",
            json={
                "device_id": config["device_id"],
                "hostname": hostname
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Update config
            config["registered"] = True
            config["api_key"] = data["api_key"]
            config["pool_id"] = data.get("pool_id")
            save_config(config)
            
            print("Device registered successfully.")
            return True
        
        elif response.status_code == 409:
            # Device already registered but config is out of sync
            data = response.json()
            
            # Update config
            config["registered"] = True
            config["api_key"] = data["api_key"]
            config["pool_id"] = data.get("pool_id")
            save_config(config)
            
            print("Device registration restored.")
            return True
        
        else:
            print(f"Error registering device: {response.status_code} - {response.text}")
            return False
    
    except Exception as e:
        print(f"Error registering device: {e}")
        return False

def main():
    """Main loop."""
    print("BioPool Device Agent starting...")
    
    while True:
        # Try to register if needed
        register_device()
        
        # Send data and check for commands
        send_data()
        check_for_commands()
        
        # Sleep
        time.sleep(POLLING_INTERVAL)

if __name__ == "__main__":
    main()