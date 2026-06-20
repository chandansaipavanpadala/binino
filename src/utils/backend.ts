/**
 * Resolves the backend server API URL dynamically.
 * Stored in localStorage under 'binino_backend_url'.
 * Defaults to window.location.hostname (if local network/localhost) or localhost:8000.
 */
export const getBackendUrl = (): string => {
  const storedUrl = localStorage.getItem('binino_backend_url');
  if (storedUrl) return storedUrl;

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // Check if the hostname is a local IP or local domain name
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.') ||
      hostname.endsWith('.local')
    ) {
      return `http://${hostname}:8000`;
    }
  }

  // Fallback default for external hostings (e.g. GitHub Pages)
  return 'http://localhost:8000';
};
