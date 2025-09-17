import http.server
import socketserver

PORT = 8081

class HttpRequestHandler(http.server.SimpleHTTPRequestHandler):
	extensions_map = {
		'.css': 'text/css',
		'.html': 'text/html',
		'.jpg': 'image/jpg',
		'.js':'application/x-javascript',
		'.json': 'application/json',
		'.manifest': 'text/cache-manifest',
		'.png': 'image/png',
		'.svg': 'image/svg+xml',
		'.wasm': 'application/wasm',
		'.xml': 'application/xml',
		'': 'application/octet-stream',
	}

httpd = socketserver.TCPServer(("localhost", PORT), HttpRequestHandler)

httpd.serve_forever()
