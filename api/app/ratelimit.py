"""Simple in-memory rate limit per client and action (sliding window)."""

import threading
import time
from collections import defaultdict, deque


class RateLimit:
    def __init__(self, max_calls, window=600.0, clock=time.monotonic):
        self.max_calls = max_calls
        self.window = window
        self.clock = clock
        self.calls = defaultdict(deque)
        self.lock = threading.Lock()

    def allow(self, client, action):
        now = self.clock()
        with self.lock:
            q = self.calls[(client, action)]
            while q and now - q[0] > self.window:
                q.popleft()
            if len(q) >= self.max_calls:
                return False
            q.append(now)
            return True
