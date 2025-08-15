# Run these commands as Administrator to allow P2P connections:

# Allow Vite dev server
netsh advfirewall firewall add rule name="Vite Dev Server" dir=in action=allow protocol=TCP localport=3000

# Allow Cloudflare Worker dev
netsh advfirewall firewall add rule name="Cloudflare Worker Dev" dir=in action=allow protocol=TCP localport=8787

# Allow WebRTC P2P connections
netsh advfirewall firewall add rule name="WebRTC P2P UDP" dir=in action=allow protocol=UDP localportrange=49152-65535
netsh advfirewall firewall add rule name="WebRTC P2P TCP" dir=in action=allow protocol=TCP localportrange=49152-65535

# Test firewall rules
netsh advfirewall firewall show rule name="WebRTC P2P UDP"
netsh advfirewall firewall show rule name="Vite Dev Server"