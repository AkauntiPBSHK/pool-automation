"""Database models for the Pool Automation System."""
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class SensorReading(db.Model):
    """Model for sensor readings."""
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    sensor_type = db.Column(db.String(50), nullable=False)
    parameter = db.Column(db.String(50), nullable=False)
    value = db.Column(db.Float, nullable=False)
    unit = db.Column(db.String(20))
    
    def __repr__(self):
        return f"<SensorReading {self.parameter}={self.value}{self.unit} at {self.timestamp}>"
    
    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat(),
            "sensor_type": self.sensor_type,
            "parameter": self.parameter,
            "value": self.value,
            "unit": self.unit
        }

class DosingEvent(db.Model):
    """Model for dosing events."""
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    pump_type = db.Column(db.String(50), nullable=False)
    parameter = db.Column(db.String(50), nullable=False)
    duration_seconds = db.Column(db.Integer, nullable=False)
    flow_rate = db.Column(db.Float, nullable=False)
    is_automatic = db.Column(db.Boolean, default=True)
    parameter_value_before = db.Column(db.Float)
    
    def __repr__(self):
        return f"<DosingEvent {self.pump_type} {self.duration_seconds}s at {self.timestamp}>"
    
    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat(),
            "pump_type": self.pump_type,
            "parameter": self.parameter,
            "duration_seconds": self.duration_seconds,
            "flow_rate": self.flow_rate,
            "is_automatic": self.is_automatic,
            "parameter_value_before": self.parameter_value_before
        }

class SystemEvent(db.Model):
    """Model for system events and alerts."""
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    event_type = db.Column(db.String(50), nullable=False)
    severity = db.Column(db.String(20), default="info")  # info, warning, error
    message = db.Column(db.String(255), nullable=False)
    details = db.Column(db.Text)
    acknowledged = db.Column(db.Boolean, default=False)
    
    def __repr__(self):
        return f"<SystemEvent {self.event_type}/{self.severity} at {self.timestamp}>"
    
    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat(),
            "event_type": self.event_type,
            "severity": self.severity,
            "message": self.message,
            "details": self.details,
            "acknowledged": self.acknowledged
        }

def init_db(app):
    """Initialize database with the app."""
    db.init_app(app)
    
    # Create all tables
    with app.app_context():
        db.create_all()