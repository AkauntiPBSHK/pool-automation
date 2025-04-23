# models/sensors.py
from . import db
from datetime import datetime

class SensorReading(db.Model):
    """Model for storing sensor readings."""
    __tablename__ = 'sensor_readings'
    
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    sensor_type = db.Column(db.String(50), nullable=False)
    value = db.Column(db.Float, nullable=False)
    
    # Additional metadata
    unit = db.Column(db.String(10))
    status = db.Column(db.String(20))  # 'good', 'fair', 'poor'
    
    def __repr__(self):
        return f"<SensorReading(id={self.id}, sensor_type='{self.sensor_type}', value={self.value})>"
    
    @classmethod
    def get_latest(cls, sensor_type):
        """Get the latest reading for a sensor type."""
        return cls.query.filter_by(sensor_type=sensor_type).order_by(cls.timestamp.desc()).first()
    
    @classmethod
    def get_history(cls, sensor_type, hours=24):
        """Get historical readings for a sensor type."""
        from datetime import datetime, timedelta
        cutoff = datetime.utcnow() - timedelta(hours=hours)
        return cls.query.filter_by(sensor_type=sensor_type).filter(cls.timestamp >= cutoff).order_by(cls.timestamp).all()