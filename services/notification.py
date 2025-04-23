# services/notification.py
import logging
import smtplib
import threading
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime

logger = logging.getLogger(__name__)

class NotificationManager:
    """Manages notifications for the system."""
    
    def __init__(self, config=None):
        """Initialize the notification manager."""
        self.config = config or {}
        self.enabled = self.config.get('enabled', False)
        
        # Email configuration
        self.email_config = self.config.get('email', {})
        self.email_enabled = self.email_config.get('enabled', False)
        
        logger.info(f"Notification manager initialized (enabled: {self.enabled})")
    
    def send_alert(self, message, level='info', parameter=None, value=None):
        """Send an alert notification.
        
        Args:
            message: Alert message
            level: Alert level ('info', 'warning', 'error', 'critical')
            parameter: Related parameter name (optional)
            value: Related parameter value (optional)
            
        Returns:
            bool: Success status
        """
        if not self.enabled:
            logger.debug(f"Notifications disabled, not sending: {message}")
            return False
        
        # Log the alert
        log_method = getattr(logger, level, logger.info)
        log_method(f"ALERT: {message}")
        
        # Send email notification in a separate thread
        if self.email_enabled:
            threading.Thread(
                target=self._send_email,
                args=(message, level, parameter, value),
                daemon=True
            ).start()
        
        return True
    
    def _send_email(self, message, level, parameter, value):
        """Send an email notification."""
        try:
            # Get email configuration
            smtp_server = self.email_config.get('smtp_server')
            smtp_port = self.email_config.get('smtp_port', 587)
            username = self.email_config.get('username')
            password = self.email_config.get('password')
            from_address = self.email_config.get('from_address')
            to_address = self.email_config.get('to_address')
            use_tls = self.email_config.get('use_tls', True)
            
            if not all([smtp_server, username, password, from_address, to_address]):
                logger.error("Incomplete email configuration")
                return False
            
            # Create email message
            msg = MIMEMultipart()
            msg['From'] = from_address
            msg['To'] = to_address
            msg['Subject'] = f"Pool Alert: {level.upper()} - {message[:50]}"
            
            # Email body
            body = f"""
            <html>
            <body>
                <h2>Pool Automation System Alert</h2>
                <p><strong>Level:</strong> {level.upper()}</p>
                <p><strong>Time:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
                <p><strong>Message:</strong> {message}</p>
                
                {f'<p><strong>Parameter:</strong> {parameter}</p>' if parameter else ''}
                {f'<p><strong>Value:</strong> {value}</p>' if value else ''}
            </body>
            </html>
            """
            
            msg.attach(MIMEText(body, 'html'))
            
            # Connect to SMTP server and send email
            with smtplib.SMTP(smtp_server, smtp_port) as server:
                if use_tls:
                    server.starttls()
                server.login(username, password)
                server.send_message(msg)
            
            logger.info(f"Email alert sent: {message}")
            return True
            
        except Exception as e:
            logger.error(f"Error sending email notification: {e}")
            return False