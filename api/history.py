# api/history.py
from flask import Blueprint, jsonify, request
from models import db, SensorReading, DosingEvent, SystemEvent
from datetime import datetime, timedelta

history_api = Blueprint('history_api', __name__)

@history_api.route('/api/history/sensors', methods=['GET'])
def get_sensor_history():
    """Get historical sensor readings."""
    sensor_type = request.args.get('type')
    hours = request.args.get('hours', 24, type=int)
    resolution = request.args.get('resolution', 'hour')
    
    if hours <= 0 or hours > 720:  # Max 30 days
        return jsonify({"error": "Hours must be between 1 and 720"}), 400
    
    if not sensor_type:
        return jsonify({"error": "Sensor type is required"}), 400
    
    # Calculate cutoff time
    cutoff = datetime.utcnow() - timedelta(hours=hours)
    
    # Query for readings
    query = SensorReading.query.filter_by(sensor_type=sensor_type)
    query = query.filter(SensorReading.timestamp >= cutoff)
    query = query.order_by(SensorReading.timestamp)
    
    readings = query.all()
    
    # Apply resolution reduction if needed
    if resolution == 'minute' and len(readings) > 60:
        readings = _reduce_resolution(readings, timedelta(minutes=1))
    elif resolution == 'hour' and len(readings) > 24:
        readings = _reduce_resolution(readings, timedelta(hours=1))
    elif resolution == 'day' and len(readings) > 7:
        readings = _reduce_resolution(readings, timedelta(days=1))
    
    # Format the data for the response
    data = [{
        'timestamp': reading.timestamp.isoformat(),
        'value': reading.value,
        'unit': reading.unit,
        'status': reading.status
    } for reading in readings]
    
    return jsonify(data)

@history_api.route('/api/history/events', methods=['GET'])
def get_events_history():
    """Get system events history."""
    event_type = request.args.get('type')
    hours = request.args.get('hours', 24, type=int)
    limit = request.args.get('limit', 100, type=int)
    
    if hours <= 0 or hours > 720:  # Max 30 days
        return jsonify({"error": "Hours must be between 1 and 720"}), 400
    
    # Calculate cutoff time
    cutoff = datetime.utcnow() - timedelta(hours=hours)
    
    # Query for events
    query = SystemEvent.query
    if event_type:
        query = query.filter_by(event_type=event_type)
    
    query = query.filter(SystemEvent.timestamp >= cutoff)
    query = query.order_by(SystemEvent.timestamp.desc())
    query = query.limit(limit)
    
    events = query.all()
    
    # Format the data for the response
    data = [{
        'id': event.id,
        'timestamp': event.timestamp.isoformat(),
        'type': event.event_type,
        'description': event.description,
        'parameter': event.parameter,
        'value': event.value
    } for event in events]
    
    return jsonify(data)

@history_api.route('/api/history/dosing', methods=['GET'])
def get_dosing_history():
    """Get dosing events history."""
    pump_type = request.args.get('pump')
    hours = request.args.get('hours', 24, type=int)
    limit = request.args.get('limit', 100, type=int)
    
    if hours <= 0 or hours > 720:  # Max 30 days
        return jsonify({"error": "Hours must be between 1 and 720"}), 400
    
    # Calculate cutoff time
    cutoff = datetime.utcnow() - timedelta(hours=hours)
    
    # Query for dosing events
    query = DosingEvent.query
    if pump_type:
        query = query.filter_by(pump_type=pump_type)
    
    query = query.filter(DosingEvent.timestamp >= cutoff)
    query = query.order_by(DosingEvent.timestamp.desc())
    query = query.limit(limit)
    
    events = query.all()
    
    # Format the data for the response
    data = [{
        'id': event.id,
        'timestamp': event.timestamp.isoformat(),
        'pump': event.pump_type,
        'parameter': event.parameter,
        'duration': event.duration_seconds,
        'flow_rate': event.flow_rate,
        'is_automatic': event.is_automatic,
        'value_before': event.parameter_value_before
    } for event in events]
    
    return jsonify(data)

def _reduce_resolution(readings, interval):
    """Reduce the resolution of readings by averaging within time intervals."""
    if not readings:
        return []
    
    # Group readings by interval
    groups = {}
    current_interval = readings[0].timestamp.replace(second=0, microsecond=0)
    
    for reading in readings:
        while reading.timestamp >= current_interval + interval:
            current_interval += interval
        
        if current_interval not in groups:
            groups[current_interval] = []
        
        groups[current_interval].append(reading)
    
    # Average readings in each group
    result = []
    for timestamp, group in sorted(groups.items()):
        avg_value = sum(r.value for r in group) / len(group)
        
        # Create a new reading with the averaged value
        avg_reading = SensorReading(
            timestamp=timestamp,
            sensor_type=group[0].sensor_type,
            value=avg_value,
            unit=group[0].unit,
            status=group[0].status
        )
        
        result.append(avg_reading)
    
    return result