from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import json
import sys
import os

# Add parent directory to path to import main app
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from main import app
from mangum import Mangum

# Create Mangum handler
asgi_handler = Mangum(app, lifespan="off")

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.handle_request()
    
    def do_POST(self):
        self.handle_request()
    
    def do_PUT(self):
        self.handle_request()
    
    def do_DELETE(self):
        self.handle_request()
    
    def do_PATCH(self):
        self.handle_request()
    
    def do_OPTIONS(self):
        self.handle_request()
    
    def handle_request(self):
        try:
            # Parse the request
            parsed_path = urlparse(self.path)
            
            # Get headers
            headers = {key.lower(): value for key, value in self.headers.items()}
            
            # Get body for POST/PUT requests
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length) if content_length > 0 else b''
            
            # Create ASGI scope
            scope = {
                'type': 'http',
                'asgi': {'version': '3.0'},
                'http_version': '1.1',
                'method': self.command,
                'scheme': 'https',
                'path': parsed_path.path,
                'query_string': parsed_path.query.encode() if parsed_path.query else b'',
                'root_path': '',
                'headers': [[k.encode(), v.encode()] for k, v in headers.items()],
                'server': ('vercel.app', 443),
            }
            
            # Call Mangum handler
            async def receive():
                return {
                    'type': 'http.request',
                    'body': body,
                    'more_body': False,
                }
            
            response_started = False
            
            async def send(message):
                nonlocal response_started
                
                if message['type'] == 'http.response.start':
                    response_started = True
                    self.send_response(message['status'])
                    for header_name, header_value in message.get('headers', []):
                        self.send_header(
                            header_name.decode(),
                            header_value.decode()
                        )
                    self.end_headers()
                
                elif message['type'] == 'http.response.body':
                    body = message.get('body', b'')
                    if body:
                        self.wfile.write(body)
            
            # Run the ASGI app
            import asyncio
            asyncio.run(asgi_handler(scope, receive, send))
            
        except Exception as e:
            # Error response
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_response = json.dumps({
                'error': str(e),
                'message': 'Internal server error'
            })
            self.wfile.write(error_response.encode())