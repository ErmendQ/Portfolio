"""Local preview server for the portfolio.

    py tools/serve.py [port]      -> http://127.0.0.1:8790

Same as `python -m http.server`, plus HTTP Range support: without it browsers
can't seek or loop the clips, and Safari won't play them at all.
"""
import os
import re
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Handler(SimpleHTTPRequestHandler):
    # The Windows registry sometimes maps these to text/plain.
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp',
                      '.mp4': 'video/mp4', '.svg': 'image/svg+xml', '.json': 'application/json'}

    def send_head(self):
        self._left = None
        path = self.translate_path(self.path)
        m = re.match(r'bytes=(\d*)-(\d*)$', self.headers.get('Range', ''))
        if not m or not any(m.groups()) or not os.path.isfile(path):
            return super().send_head()
        size = os.path.getsize(path)
        a, b = m.groups()
        start = int(a) if a else max(0, size - int(b))
        end = min(int(b), size - 1) if a and b else size - 1
        if start >= size or start > end:
            self.send_response(416)
            self.send_header('Content-Range', f'bytes */{size}')
            self.end_headers()
            return None
        f = open(path, 'rb')
        f.seek(start)
        self._left = end - start + 1
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length', str(self._left))
        self.end_headers()
        return f

    def copyfile(self, src, dst):
        try:
            if self._left is None:
                return super().copyfile(src, dst)
            while self._left > 0:
                chunk = src.read(min(65536, self._left))
                if not chunk:
                    break
                dst.write(chunk)
                self._left -= len(chunk)
        except ConnectionError:
            pass  # the browser dropped a media request; normal while scrubbing

    def end_headers(self):
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Cache-Control', 'no-store')  # edits show up on reload
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8790
    print(f'Serving {ROOT} at http://127.0.0.1:{port}')
    ThreadingHTTPServer(('127.0.0.1', port), partial(Handler, directory=ROOT)).serve_forever()
