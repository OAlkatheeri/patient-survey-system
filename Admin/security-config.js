// Minimal Security Manager - Safe version that won't break your dashboard
(function() {
    'use strict';

    const SecurityManager = {
        config: {
            maxLoginAttempts: 5,
            lockoutTime: 15 * 60 * 1000, // 15 minutes
            sessionTimeout: 30 * 60 * 1000, // 30 minutes
            enableHTTPS: true,
            enableConsoleWarning: true
        },

        loginAttempts: new Map(),
        lastActivity: Date.now(),
        warningShown: false,

        init: function(customConfig) {
            // Merge custom config
            this.config = { ...this.config, ...customConfig };
            
            // Only apply non-breaking security measures
            if (this.config.enableHTTPS) {
                this.enforceHTTPS();
            }
            
            if (this.config.enableConsoleWarning) {
                this.addConsoleWarning();
            }
            
            this.setupBasicSessionManagement();
            this.addBasicSecurityHeaders();
            
            console.log('🔒 Security Manager initialized (Safe Mode)');
        },

        // Force HTTPS (only in production)
        enforceHTTPS: function() {
            const isLocal = ['localhost', '127.0.0.1', '0.0.0.0'].includes(location.hostname) 
                         || location.hostname.startsWith('192.168.')
                         || location.hostname.startsWith('10.')
                         || location.hostname.endsWith('.local');
            
            if (!isLocal && location.protocol !== 'https:') {
                location.protocol = 'https:';
            }
        },

        // Add basic security headers
        addBasicSecurityHeaders: function() {
            const securityHeaders = [
                { 'http-equiv': 'X-Content-Type-Options', content: 'nosniff' },
                { 'http-equiv': 'X-Frame-Options', content: 'SAMEORIGIN' }
            ];

            securityHeaders.forEach(header => {
                if (!document.querySelector(`meta[http-equiv="${header['http-equiv']}"]`)) {
                    const meta = document.createElement('meta');
                    meta.httpEquiv = header['http-equiv'];
                    meta.content = header.content;
                    document.head.appendChild(meta);
                }
            });
        },

        // Basic session management without breaking anything
        setupBasicSessionManagement: function() {
            const self = this;
            
            // Reset timer on activity
            const resetTimer = () => {
                self.lastActivity = Date.now();
                self.warningShown = false;
            };

            // Only listen to major events
            ['click', 'keypress'].forEach(event => {
                document.addEventListener(event, resetTimer, { passive: true });
            });

            // Check for timeout every 5 minutes instead of every minute
            setInterval(() => {
                const timeInactive = Date.now() - self.lastActivity;
                const timeLeft = self.config.sessionTimeout - timeInactive;
                
                // Show warning at 5 minutes remaining
                if (timeLeft < 5 * 60 * 1000 && timeLeft > 0 && !self.warningShown) {
                    self.warningShown = true;
                    const minutes = Math.ceil(timeLeft / 60000);
                    console.log(`⚠️ Session will expire in ${minutes} minutes due to inactivity.`);
                }
                
                // Timeout
                if (timeInactive > self.config.sessionTimeout) {
                    self.handleSessionTimeout();
                }
            }, 300000); // Check every 5 minutes instead of every minute
        },

        // Handle session timeout
        handleSessionTimeout: function() {
            alert('Session expired due to inactivity. Please login again.');
            
            // Try to call the dashboard's logout function if it exists
            if (window.dashboardInstance && typeof window.dashboardInstance.handleLogout === 'function') {
                window.dashboardInstance.handleLogout();
            } else if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
                window.location.href = '/';
            }
        },

        // Add console warning
        addConsoleWarning: function() {
            const warningMessage = `%c⚠️ Security Warning

%cThis is a browser feature intended for developers. 
If someone told you to copy-paste something here, it is likely a scam.

%cDo not paste any code unless you understand what it does.`;

            setTimeout(() => {
                console.log(
                    warningMessage,
                    'color: red; font-size: 20px; font-weight: bold;',
                    'color: black; font-size: 14px;',
                    'color: red; font-size: 12px; font-weight: bold;'
                );
            }, 1000);
        }
    };

    // Make it globally available
    window.SecurityManager = SecurityManager;

})();