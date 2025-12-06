
import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { Shield, Key, Lock, User as UserIcon, LogIn, RefreshCcw, Copy, Check, AlertCircle, Info, Eye, EyeOff } from 'lucide-react';
import { db } from '../services/db';

interface AuthScreenProps {
  users: User[];
  onLogin: (user: User) => void;
}

type AuthMode = 'LOGIN' | 'REGISTER' | 'RECOVER';

// Password Strength Regex: Min 8 chars, 1 Upper, 1 Lower, 1 Number, 1 Special
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const PASSWORD_REQUIREMENTS = "Password must be at least 8 characters and include uppercase, lowercase, number, and special character (@$!%*?&).";

export const AuthScreen: React.FC<AuthScreenProps> = ({ users, onLogin }) => {
  const [mode, setMode] = useState<AuthMode>('LOGIN');
  
  // Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryKeyInput, setRecoveryKeyInput] = useState('');
  
  // UI State
  const [showPassword, setShowPassword] = useState(false);
  
  // Feedback State
  const [error, setError] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Generate a random recovery key: RK-XXXX-XXXX-XXXX
  const generateRecoveryKey = () => {
    const segment = () => Math.random().toString(36).substring(2, 6).toUpperCase();
    return `RK-${segment()}-${segment()}-${segment()}`;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
        const user = await db.authenticate(username, password);
        if (user) {
            onLogin(user);
        } else {
            setError('Invalid username or password.');
        }
    } catch (err) {
        setError('Authentication error occurred.');
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password || !confirmPassword) {
      setError('All fields are required.');
      return;
    }

    if (!PASSWORD_REGEX.test(password)) {
        setError(PASSWORD_REQUIREMENTS);
        return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
        const newKey = generateRecoveryKey();
        const initials = username.slice(0, 2).toUpperCase();
        
        const newUser: Partial<User> = {
          username: username,
          name: username, 
          role: UserRole.USER, 
          avatarInitials: initials,
          recoveryKey: newKey
        };

        // DB Service handles hashing
        await db.createUser(newUser, password);
        setGeneratedKey(newKey);

    } catch (err: any) {
        if(err.message === 'Username already exists') {
            setError('Username already taken.');
        } else {
            setError('Registration failed.');
        }
    } finally {
        setIsLoading(false);
    }
  };

  const handleCompleteRegistration = async () => {
    // Auto-login after registration key is acknowledged
    const user = await db.authenticate(username, password);
    if (user) onLogin(user);
  };

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!recoveryKeyInput || !password) {
      setError('Please provide your Recovery Key and a new Password.');
      setIsLoading(false);
      return;
    }

    if (!PASSWORD_REGEX.test(password)) {
        setError(PASSWORD_REQUIREMENTS);
        setIsLoading(false);
        return;
    }

    try {
        const user = await db.resetPassword(recoveryKeyInput.trim(), password);
        if (user) {
            onLogin(user);
        } else {
            setError('Invalid Recovery Key.');
        }
    } catch (err) {
        setError('Recovery failed.');
    } finally {
        setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const togglePassword = () => setShowPassword(!showPassword);

  // ----------------------------------------------------------------------
  // VIEW: REGISTRATION SUCCESS (SHOW KEY)
  // ----------------------------------------------------------------------
  if (generatedKey) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center animate-in zoom-in-95 duration-300">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Key className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Account Created!</h2>
          <p className="text-slate-600 mb-6">
            This is your **Recovery Key**. It is the ONLY way to restore your account if you forget your password. We do not store your email.
          </p>
          
          <div className="bg-slate-100 border-2 border-slate-200 border-dashed rounded-xl p-4 mb-6 relative group">
            <code className="text-lg font-mono font-bold text-slate-800 tracking-wide break-all">
              {generatedKey}
            </code>
            <button 
              onClick={copyToClipboard}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-white rounded-lg transition-colors text-slate-400 hover:text-blue-600"
              title="Copy to clipboard"
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-start gap-2 mb-6 text-left">
            <Shield className="w-5 h-5 flex-shrink-0" />
            <p>Save this key in a password manager or write it down. If you lose it, your account cannot be recovered.</p>
          </div>

          <button 
            onClick={handleCompleteRegistration}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
          >
            I have saved my key, Log in
          </button>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------------
  // VIEW: AUTH FORMS
  // ----------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500 rounded-full blur-[100px]"></div>
      </div>

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden z-10 relative">
        <div className="flex border-b border-slate-100">
          <button 
            onClick={() => { setMode('LOGIN'); setError(''); }}
            className={`flex-1 py-4 text-sm font-bold transition-colors ${mode === 'LOGIN' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Login
          </button>
          <button 
            onClick={() => { setMode('REGISTER'); setError(''); }}
            className={`flex-1 py-4 text-sm font-bold transition-colors ${mode === 'REGISTER' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Sign Up
          </button>
        </div>

        <div className="p-8">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-600/30">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Impact Flow</h1>
            <p className="text-slate-500 text-sm mt-1">
              {mode === 'LOGIN' && 'Secure Work Management System'}
              {mode === 'REGISTER' && 'Create your secure profile'}
              {mode === 'RECOVER' && 'Recover access securely'}
            </p>
          </div>

          <form onSubmit={mode === 'LOGIN' ? handleLogin : mode === 'REGISTER' ? handleRegister : handleRecovery} className="space-y-4">
            
            {error && (
              <div className="bg-red-50 text-red-600 text-xs p-3 rounded-lg border border-red-100 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> 
                <span>{error}</span>
              </div>
            )}

            {mode === 'RECOVER' ? (
               <>
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Recovery Key</label>
                    <div className="relative">
                        <Key className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                        <input 
                            type="text" 
                            value={recoveryKeyInput}
                            onChange={(e) => setRecoveryKeyInput(e.target.value)}
                            placeholder="RK-XXXX-XXXX-XXXX"
                            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono uppercase placeholder:normal-case text-black"
                        />
                    </div>
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">New Password</label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                        <input 
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Set new password"
                            className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-black"
                        />
                        <button type="button" onClick={togglePassword} className="absolute right-3 top-3 text-slate-400 hover:text-slate-600">
                             {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                    </div>
                 </div>
               </>
            ) : (
                <>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Username</label>
                        <div className="relative">
                            <UserIcon className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                            <input 
                                type="text" 
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter username"
                                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-black"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                            <input 
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-black"
                            />
                            <button type="button" onClick={togglePassword} className="absolute right-3 top-3 text-slate-400 hover:text-slate-600">
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        {mode === 'REGISTER' && (
                            <div className="flex gap-1 mt-1 text-[10px] text-slate-400 px-1">
                                <Info className="w-3 h-3" /> 
                                <span>Min 8 chars, Upper, Lower, Number, Symbol</span>
                            </div>
                        )}
                    </div>

                    {mode === 'REGISTER' && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Confirm Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                                <input 
                                    type={showPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-black"
                                />
                                <button type="button" onClick={togglePassword} className="absolute right-3 top-3 text-slate-400 hover:text-slate-600">
                                     {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 mt-6 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
                {isLoading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : 
                 mode === 'LOGIN' ? <><LogIn className="w-5 h-5"/> Sign In</> :
                 mode === 'REGISTER' ? <><Shield className="w-5 h-5"/> Create Account</> :
                 <><RefreshCcw className="w-5 h-5"/> Reset Password</>}
            </button>
          </form>

          <div className="mt-6 text-center">
              {mode === 'LOGIN' && (
                  <button onClick={() => setMode('RECOVER')} className="text-sm text-slate-400 hover:text-blue-600 transition-colors">
                      Forgot Password? Use Recovery Key
                  </button>
              )}
               {mode === 'RECOVER' && (
                  <button onClick={() => setMode('LOGIN')} className="text-sm text-slate-400 hover:text-blue-600 transition-colors">
                      Back to Login
                  </button>
              )}
          </div>
        </div>
      </div>
    </div>
  );
};
