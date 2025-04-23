# api/simulation.py
from flask import Blueprint, jsonify, request
from hardware import simulation_env

simulation_api = Blueprint('simulation_api', __name__)

@simulation_api.route('/api/simulation/status', methods=['GET'])
def get_simulation_status():
    """Get simulation status."""
    if not simulation_env:
        return jsonify({"error": "Simulation environment not available"}), 503
    
    return jsonify({
        "running": simulation_env.running,
        "parameters": simulation_env.parameters,
        "behaviors": simulation_env.behaviors,
        "correlations": simulation_env.correlations,
        "time_acceleration": simulation_env.time_acceleration
    })

@simulation_api.route('/api/simulation/parameter', methods=['POST'])
def set_simulation_parameter():
    """Set a simulation parameter."""
    if not simulation_env:
        return jsonify({"error": "Simulation environment not available"}), 503
    
    data = request.json
    parameter = data.get('parameter')
    value = data.get('value')
    
    if not parameter or value is None:
        return jsonify({"error": "Parameter and value are required"}), 400
    
    # Convert string values to appropriate types
    if isinstance(value, str):
        if value.lower() == 'true':
            value = True
        elif value.lower() == 'false':
            value = False
        else:
            try:
                value = float(value)
            except ValueError:
                pass
    
    # Set parameter
    if parameter in simulation_env.parameters:
        simulation_env.parameters[parameter] = value
        return jsonify({"success": True, "parameter": parameter, "value": value})
    else:
        return jsonify({"error": f"Unknown parameter: {parameter}"}), 400

@simulation_api.route('/api/simulation/event', methods=['POST'])
def trigger_simulation_event():
    """Trigger a simulation event."""
    if not simulation_env:
        return jsonify({"error": "Simulation environment not available"}), 503
    
    data = request.json
    event_type = data.get('event_type')
    
    if not event_type:
        return jsonify({"error": "Event type is required"}), 400
    
    if event_type == 'swimmer_load':
        simulation_env.parameters['turbidity'] += 0.05
        simulation_env.parameters['free_cl'] -= 0.2
        simulation_env.parameters['comb_cl'] += 0.1
        simulation_env.parameters['ph'] += 0.1
        message = "Simulated swimmer load event"
    elif event_type == 'rainwater':
        simulation_env.parameters['ph'] -= 0.2
        simulation_env.parameters['temperature'] -= 0.5
        simulation_env.parameters['turbidity'] += 0.03
        message = "Simulated rainwater event"
    elif event_type == 'leaves':
        simulation_env.parameters['turbidity'] += 0.1
        simulation_env.parameters['free_cl'] -= 0.1
        message = "Simulated leaves in pool event"
    elif event_type == 'fault':
        fault_type = data.get('fault_type', 'random')
        
        if fault_type == 'random' or fault_type not in ['ph_spike', 'orp_dropout', 'chlorine_drift']:
            import random
            fault_type = random.choice(['ph_spike', 'orp_dropout', 'chlorine_drift'])
        
        if fault_type == 'ph_spike':
            simulation_env.parameters['ph'] += 1.0
            message = "Simulated pH sensor spike fault"
        elif fault_type == 'orp_dropout':
            simulation_env.parameters['orp'] = 0
            message = "Simulated ORP sensor dropout fault"
        elif fault_type == 'chlorine_drift':
            simulation_env.parameters['free_cl'] *= 2.5
            message = "Simulated chlorine sensor drift fault"
    else:
        return jsonify({"error": f"Unknown event type: {event_type}"}), 400
    
    return jsonify({"success": True, "message": message})

@simulation_api.route('/api/simulation/behavior', methods=['POST'])
def set_simulation_behavior():
    """Set a simulation behavior."""
    if not simulation_env:
        return jsonify({"error": "Simulation environment not available"}), 503
    
    data = request.json
    behavior = data.get('behavior')
    enabled = data.get('enabled')
    
    if not behavior or enabled is None:
        return jsonify({"error": "Behavior and enabled flag are required"}), 400
    
    if behavior in simulation_env.behaviors:
        simulation_env.behaviors[behavior] = bool(enabled)
        return jsonify({"success": True, "behavior": behavior, "enabled": simulation_env.behaviors[behavior]})
    else:
        return jsonify({"error": f"Unknown behavior: {behavior}"}), 400

@simulation_api.route('/api/simulation/timescale', methods=['POST'])
def set_simulation_timescale():
    """Set the simulation time scale."""
    if not simulation_env:
        return jsonify({"error": "Simulation environment not available"}), 503
    
    data = request.json
    time_acceleration = data.get('time_acceleration')
    
    if time_acceleration is None:
        return jsonify({"error": "Time acceleration factor is required"}), 400
    
    try:
        time_acceleration = float(time_acceleration)
    except ValueError:
        return jsonify({"error": "Time acceleration must be a number"}), 400
    
    if time_acceleration <= 0:
        return jsonify({"error": "Time acceleration must be positive"}), 400
    
    simulation_env.time_acceleration = time_acceleration
    return jsonify({"success": True, "time_acceleration": simulation_env.time_acceleration})