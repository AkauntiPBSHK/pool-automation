# models/__init__.py
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

def init_db(app):
    """Initialize the database with the Flask app."""
    db.init_app(app)
    with app.app_context():
        db.create_all()

# Import and expose model classes
from .sensors import SensorReading
from .events import DosingEvent, SystemEvent

# Export all models
__all__ = ['db', 'init_db', 'SensorReading', 'DosingEvent', 'SystemEvent']