"use client";
import { useEffect, useState } from 'react';
import { getUser } from '../../../lib/auth';

function getApiBase(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_API_BASE_URL as string) || '';
  if (fromEnv && /^https?:\/\//.test(fromEnv)) return fromEnv.replace(/\/$/, '');
  if (typeof window !== 'undefined') return window.location.origin.replace(/\/$/, '');
  return '';
}
const API = getApiBase();

type IntegrationStatus = {
  configured: boolean;
  status?: 'success' | 'error';
  message?: string;
  [key: string]: any;
};

type Settings = {
  zoho_workdrive: IntegrationStatus;
  database: IntegrationStatus;
  smtp: IntegrationStatus;
  whatsapp: IntegrationStatus;
  github: IntegrationStatus;
};

export default function AdminSettings() {
  const [mounted, setMounted] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [zohoForm, setZohoForm] = useState({
    client_id: '',
    client_secret: '',
    refresh_token: '',
    dc: 'us',
    team_id: ''
  });

  useEffect(() => { setMounted(true); }, []);
  
  useEffect(() => {
    if (mounted) {
      loadSettings();
    }
  }, [mounted]);

  async function loadSettings() {
    try {
      const response = await fetch(`${API}/api/admin/settings`);
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  }

  async function saveZohoSettings() {
    try {
      const response = await fetch(`${API}/api/admin/settings/zoho`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(zohoForm)
      });
      
      const result = await response.json();
      if (response.ok) {
        alert(result.status === 'valid' ? 'Zoho settings saved and validated!' : `Settings saved but validation failed: ${result.error}`);
        loadSettings();
        setZohoForm({ client_id: '', client_secret: '', refresh_token: '', dc: 'us', team_id: '' });
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (e) {
      alert('Failed to save settings');
    }
  }

  async function testZoho() {
    setTesting(prev => ({ ...prev, zoho: true }));
    try {
      const response = await fetch(`${API}/api/admin/settings/test-zoho`, { method: 'POST' });
      const result = await response.json();
      
      if (settings) {
        setSettings(prev => ({
          ...prev!,
          zoho_workdrive: {
            ...prev!.zoho_workdrive,
            status: result.status,
            message: result.message
          }
        }));
      }
    } catch (e) {
      console.error('Test failed:', e);
    } finally {
      setTesting(prev => ({ ...prev, zoho: false }));
    }
  }

  const user = getUser();
  if (!mounted) return null;
  if (!user) return <main className="p-6 max-w-3xl mx-auto"><p>Please <a className="underline" href="/login">sign in</a>.</p></main>;
  if (user.role !== 'admin') return <main className="p-6 max-w-3xl mx-auto"><p>Access denied. Admins only.</p></main>;

  if (!settings) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <div className="text-center py-8">
          <div className="text-lg text-slate-600">Loading settings...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <a href="/admin" className="text-slate-600 hover:text-slate-800">← Back to Admin</a>
        <h2 className="text-2xl font-medium">API Settings & Integrations</h2>
      </div>

      <div className="space-y-6">
        {/* Zoho WorkDrive */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Zoho WorkDrive</h3>
            <div className="flex items-center gap-3">
              <div className={`px-2 py-1 rounded text-xs font-medium ${
                settings.zoho_workdrive.configured 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {settings.zoho_workdrive.configured ? 'Configured' : 'Not Configured'}
              </div>
              {settings.zoho_workdrive.configured && (
                <button 
                  onClick={testZoho}
                  disabled={testing.zoho}
                  className="btn-outline px-3 py-1 text-xs"
                >
                  {testing.zoho ? 'Testing...' : 'Test Connection'}
                </button>
              )}
            </div>
          </div>

          {settings.zoho_workdrive.message && (
            <div className={`mb-4 p-3 rounded text-sm ${
              settings.zoho_workdrive.status === 'success' 
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {settings.zoho_workdrive.message}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Client ID</label>
              <input 
                type="text" 
                className="input"
                placeholder="Enter Zoho Client ID"
                value={zohoForm.client_id}
                onChange={e => setZohoForm(prev => ({ ...prev, client_id: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Client Secret</label>
              <input 
                type="password" 
                className="input"
                placeholder="Enter Zoho Client Secret"
                value={zohoForm.client_secret}
                onChange={e => setZohoForm(prev => ({ ...prev, client_secret: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Refresh Token</label>
              <input 
                type="password" 
                className="input"
                placeholder="Enter Zoho Refresh Token"
                value={zohoForm.refresh_token}
                onChange={e => setZohoForm(prev => ({ ...prev, refresh_token: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Data Center</label>
              <select 
                className="select"
                value={zohoForm.dc}
                onChange={e => setZohoForm(prev => ({ ...prev, dc: e.target.value }))}
              >
                <option value="us">US (.com)</option>
                <option value="eu">EU (.eu)</option>
                <option value="in">India (.in)</option>
                <option value="au">Australia (.com.au)</option>
              </select>
            </div>
          </div>
          
          <div className="mt-4">
            <label className="block text-sm text-slate-600 mb-1">Team ID (optional)</label>
            <input 
              type="text" 
              className="input"
              placeholder="Auto-detected if blank"
              value={zohoForm.team_id}
              onChange={e => setZohoForm(prev => ({ ...prev, team_id: e.target.value }))}
            />
          </div>

          <div className="mt-4 pt-4 border-t">
            <button onClick={saveZohoSettings} className="btn-primary">
              Save Zoho Settings
            </button>
          </div>
        </div>

        {/* Database */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Database</h3>
            <div className={`px-2 py-1 rounded text-xs font-medium ${
              settings.database.configured 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-600'
            }`}>
              {settings.database.configured ? 'Configured' : 'Not Configured'}
            </div>
          </div>
          
          {settings.database.url_preview && (
            <div className="text-sm text-slate-600 mb-2">
              <strong>Current:</strong> {settings.database.url_preview}
            </div>
          )}
          
          <p className="text-sm text-slate-500">
            Database connection is configured via the DATABASE_URL environment variable.
            Currently using: {settings.database.configured ? 'PostgreSQL' : 'Local JSON files'}
          </p>
        </div>

        {/* SMTP */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">SMTP Email</h3>
            <div className={`px-2 py-1 rounded text-xs font-medium ${
              settings.smtp.configured 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-600'
            }`}>
              {settings.smtp.configured ? 'Configured' : 'Not Configured'}
            </div>
          </div>
          
          {settings.smtp.host && (
            <div className="text-sm text-slate-600 mb-2">
              <strong>Host:</strong> {settings.smtp.host}
            </div>
          )}
          
          <p className="text-sm text-slate-500">
            SMTP is configured via environment variables: SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM
          </p>
        </div>

        {/* WhatsApp */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">WhatsApp Business API</h3>
            <div className={`px-2 py-1 rounded text-xs font-medium ${
              settings.whatsapp.configured 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-600'
            }`}>
              {settings.whatsapp.configured ? 'Configured' : 'Not Configured'}
            </div>
          </div>
          
          <p className="text-sm text-slate-500">
            WhatsApp is configured via environment variables: WHATSAPP_TOKEN, WHATSAPP_PHONE_ID
          </p>
        </div>

        {/* GitHub */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">GitHub Integration</h3>
            <div className={`px-2 py-1 rounded text-xs font-medium ${
              settings.github.configured 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-600'
            }`}>
              {settings.github.configured ? 'Configured' : 'Not Configured'}
            </div>
          </div>
          
          <p className="text-sm text-slate-500">
            GitHub integration for automatic issue creation from feedback is configured via: GITHUB_TOKEN, GITHUB_REPO
          </p>
        </div>

        {/* Instructions */}
        <div className="card bg-blue-50 border-blue-200">
          <h3 className="text-lg font-medium mb-3">🔧 Configuration Instructions</h3>
          <div className="text-sm text-slate-700 space-y-2">
            <p><strong>Zoho WorkDrive Setup:</strong></p>
            <ol className="list-decimal list-inside space-y-1 ml-4 text-slate-600">
              <li>Go to <a href="https://api-console.zoho.com/" className="underline" target="_blank">Zoho API Console</a></li>
              <li>Create a new "Server-based Application"</li>
              <li>Add your domain to authorized redirect URIs</li>
              <li>Copy Client ID and Secret</li>
              <li>Generate a refresh token with scopes: WorkDrive.teamspace.ALL</li>
            </ol>
            
            <p className="mt-4"><strong>Environment Variables:</strong></p>
            <p className="text-slate-600">For production deployments, set these in your .env file or environment:</p>
            <ul className="list-disc list-inside space-y-1 ml-4 text-slate-600 text-xs font-mono">
              <li>DATABASE_URL=postgresql://user:pass@host:5432/db</li>
              <li>SMTP_HOST=smtp.gmail.com</li>
              <li>SMTP_USER=your-email@domain.com</li>
              <li>SMTP_PASS=your-app-password</li>
              <li>WHATSAPP_TOKEN=your-fb-token</li>
              <li>WHATSAPP_PHONE_ID=your-phone-id</li>
              <li>GITHUB_TOKEN=ghp_your-token</li>
              <li>GITHUB_REPO=owner/repo</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}