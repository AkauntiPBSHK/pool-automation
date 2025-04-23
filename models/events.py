# models/events.py
from . import db
from datetime import datetime

class DosingEvent(db.Model):
    """Model for storing dosing events."""
    __tablename__ = 'dosing_events'
    
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    pump_type = db.Column(db.String(20), nullable=False)  # 'ph', 'cl', 'pac'
    parameter = db.Column(db.String(20))  # 'ph', 'orp', 'turbidity', etc.
    duration_seconds = db.Column(db.Integer)
    flow_rate = db.Column(db.Float)  # ml/h
    is_automatic = db.Column(db.Boolean, default=True)
    parameter_value_before = db.Column(db.Float)
    
    def __repr__(self):
        return f"<DosingEvent(id={self.id}, pump='{self.pump_type}', flow={self.flow_rate})>"
    
    @classmethod
    def get_recent(cls, pump_type=None, limit=10):
        """Get recent dosing events, optionally filtered by pump type."""
        query = cls.query
        if pump_type:
            query = query.filter_by(pump_type=pump_type)
        return query.order_by(cls.timestamp.desc()).limit(limit).all()

class SystemEvent(db.Model):
    """Model for storing system events and alerts."""
    __tablename__ = 'system_events'
    
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    event_type = db.Column(db.String(20), nullable=False)  # 'alert', 'info', 'warning', 'error'
    description = db.Column(db.String(255), nullable=False)
    parameter = db.Column(db.String(20))
    value = db.Column(db.String(50))
    
    def __repr__(self):
        return f"<SystemEvent(id={self.id}, type='{self.event_type}', description='{self.description}')>"
    
    @classmethod
    def add_event(cls, event_type, description, parameter=None, value=None):
        """Add a new system event."""
        from . import db
        event = cls(
            event_type=event_type,
            description=description,
            parameter=parameter,
            value=value
        )
        db.session.add(event)
        db.session.commit()
        return event
    
    @classmethod
    def get_recent(cls, event_type=None, limit=20):
        """Get recent system events, optionally filtered by type."""
        query = cls.query
        if event_type:
            query = query.filter_by(event_type=event_type)
        return query.order_by(cls.timestamp.desc()).limit(limit).all()