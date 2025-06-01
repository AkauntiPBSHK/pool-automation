#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
WSGI entry point for Gunicorn to serve the Pool Automation System
"""

from backend.api.app import app, socketio

if __name__ == "__main__":
    socketio.run(app)