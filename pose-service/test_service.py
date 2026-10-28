import base64
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request

root = Path(__file__).resolve().parent
with socket.socket() as listener:
    listener.bind(('127.0.0.1', 0))
    port = listener.getsockname()[1]
secret = 'local-test-key-' + os.urandom(24).hex()
env = {**os.environ, 'POSE_ANALYSIS_API_KEY': secret}
process = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', str(port), '--no-access-log'], cwd=root, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
url = f'http://127.0.0.1:{port}'

def request(path, payload=None, token=None):
    data = None if payload is None else json.dumps(payload).encode()
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    try:
        with urllib.request.urlopen(urllib.request.Request(url + path, data=data, headers=headers), timeout=65) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, json.load(error)

try:
    for attempt in range(100):
        try:
            if request('/health')[0] == 200:
                break
        except OSError:
            time.sleep(.1)
    else:
        raise AssertionError('Service did not start')
    assert request('/analyze', {}, 'wrong-key')[0] == 401
    assert request('/analyze', {'mediaBase64': 'not-base64', 'mimeType': 'video/mp4'}, secret)[0] == 400
    clip = (root.parent / 'frontend/public/opening-app-animation.mp4').read_bytes()
    start = time.monotonic()
    status, body = request('/analyze', {'mediaBase64': base64.b64encode(clip).decode(), 'mimeType': 'video/mp4', 'analysisType': 'workout'}, secret)
    assert status == 200, (status, body)
    observations = body['analysis']['observations']
    metrics = body['analysis']['metrics']
    assert metrics['sampledFrames'] > 0 and 0 <= metrics['detectedFrames'] <= metrics['sampledFrames']
    assert all(0 <= joint['minAngle'] <= joint['maxAngle'] <= 180 and 0 < joint['visibleFrames'] <= metrics['sampledFrames'] for joint in metrics['joints'])
    assert any('landmarks were detected' in line for line in observations)
    assert not any('good form' in line.lower() or 'squat' in line.lower() for line in observations)
    print(f'Passed authorization, invalid payload, and real MP4 analysis in {time.monotonic() - start:.1f}s.')
finally:
    process.terminate()
    process.wait(timeout=15)
