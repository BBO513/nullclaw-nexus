import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nullclaw.nexus',
  appName: 'NullClaw Nexus',
  webDir: 'build',
  server: {
    // Allow loading from any scheme (needed for local gateway connections)
    androidScheme: 'https',
    // Allow mixed content so the app can talk to http:// gateways on LAN
    allowNavigation: ['*']
  },
  plugins: {
    CapacitorHttp: {
      enabled: true
    }
  },
  android: {
    // Allow cleartext traffic for local/LAN gateway connections (http://)
    allowMixedContent: true,
    backgroundColor: '#0a0a14'
  },
  ios: {
    backgroundColor: '#0a0a14',
    contentInset: 'automatic'
  }
};

export default config;
