import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { LogoIcon } from './shared/icons';
import { ToastContainer } from './shared/Toast';

export const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoginView, setIsLoginView] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const { signIn, signUp } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) return;
        setIsLoading(true);
        try {
            if (isLoginView) {
                await signIn(email, password);
            } else {
                await signUp(email, password);
            }
        } catch (error) {
            // Error toast is handled by the useAuth hook
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
        <ToastContainer />
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-900 font-sans">
            <div className="w-full max-w-sm">
                <div className="flex flex-col items-center text-center gap-3 mb-8">
                    <LogoIcon className="w-12 h-12 text-amber-500" />
                    <div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-orange-500">ReddyFit AI Pro</h1>
                        <p className="text-slate-400 text-sm mt-1">Your AI-powered personal trainer.</p>
                    </div>
                </div>
                
                <div className="bg-slate-800/50 p-6 rounded-xl shadow-xl border border-slate-700/50">
                    <h2 className="text-xl font-bold text-center text-slate-100 mb-6">
                        {isLoginView ? 'Welcome Back' : 'Create Your Account'}
                    </h2>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label htmlFor="email" className="block mb-1.5 text-sm font-medium text-slate-300">Email Address</label>
                            <input
                                type="email"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg focus:ring-amber-500 focus:border-amber-500 block w-full p-3"
                                placeholder="you@example.com"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="block mb-1.5 text-sm font-medium text-slate-300">Password</label>
                            <input
                                type="password"
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg focus:ring-amber-500 focus:border-amber-500 block w-full p-3"
                                placeholder="••••••••"
                                required
                                minLength={6}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full px-5 py-3 text-base font-semibold text-center text-white bg-gradient-to-r from-amber-500 to-orange-600 rounded-lg hover:from-amber-600 hover:to-orange-700 focus:ring-4 focus:outline-none focus:ring-amber-300 disabled:opacity-50 transition-all"
                        >
                            {isLoading ? 'Processing...' : (isLoginView ? 'Sign In' : 'Create Account')}
                        </button>
                    </form>

                    <p className="text-sm text-center text-slate-400 mt-6">
                        {isLoginView ? "Don't have an account?" : "Already have an account?"}
                        <button onClick={() => setIsLoginView(!isLoginView)} className="font-medium text-amber-400 hover:underline ml-1">
                            {isLoginView ? 'Sign Up' : 'Sign In'}
                        </button>
                    </p>
                </div>
                <p className="text-xs text-center text-slate-500 mt-6 px-4">
                    Forgot your password? Contact admin at <a href="mailto:akhilreddydanda3@gmail.com" className="underline hover:text-slate-400">akhilreddydanda3@gmail.com</a>
                </p>
            </div>
        </div>
        </>
    );
};