import React, { useState } from 'react';
import { GymAnalyzer } from './components/GymAnalyzer';
import { Settings } from './components/Settings';
import { ExerciseLibrary } from './components/ExerciseLibrary';
import { Dashboard } from './components/Dashboard';
import { LoginPage } from './components/LoginPage';
import { FitnessChat } from './components/FitnessChat';
import { 
    DashboardIcon,
    BarbellIcon,
    LibraryIcon,
    SettingsIcon,
    ChatIcon,
} from './components/shared/icons';
import { ToastContainer } from './components/shared/Toast';
import { Loader } from './components/shared/Loader';
import { useAuth } from './hooks/useAuth';

type Page = 'dashboard' | 'analyzer' | 'chat' | 'library' | 'settings';

const PAGE_COMPONENTS: Record<Page, React.FC<any>> = {
    dashboard: Dashboard,
    analyzer: GymAnalyzer,
    chat: FitnessChat,
    library: ExerciseLibrary,
    settings: Settings,
};

const NAV_ITEMS: { id: Page; title: string; icon: React.FC<{className?: string}> }[] = [
    { id: 'dashboard', title: 'Dashboard', icon: DashboardIcon },
    { id: 'analyzer', title: 'Analyzer', icon: BarbellIcon },
    { id: 'chat', title: 'Chat', icon: ChatIcon },
    { id: 'library', title: 'Library', icon: LibraryIcon },
    { id: 'settings', title: 'Settings', icon: SettingsIcon },
];

const App: React.FC = () => {
    const [activePage, setActivePage] = useState<Page>('dashboard');
    const { user, userProfile, loading } = useAuth();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-900">
                <Loader text="Loading Your Profile..." />
            </div>
        );
    }
    
    if (!user) {
        return <LoginPage />;
    }
    
    const PageComponent = PAGE_COMPONENTS[activePage];

    const NavButton: React.FC<{ item: typeof NAV_ITEMS[0] }> = ({ item }) => {
        const isActive = activePage === item.id;
        return (
            <button
                onClick={() => setActivePage(item.id)}
                className={`flex flex-col items-center justify-center w-full h-full transition-colors duration-200 ${
                    isActive ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
                }`}
            >
                <item.icon className="w-6 h-6 mb-1" />
                <span className="text-xs font-medium">{item.title}</span>
            </button>
        );
    };
    
    return (
        <>
            <ToastContainer />
            <div className="flex flex-col h-screen bg-slate-900 font-sans">
                {/* Main Content */}
                <main className="flex-1 overflow-y-auto pb-20"> {/* Padding bottom to clear nav bar */}
                    <div className="p-4 sm:p-6">
                        <PageComponent user={user} userProfile={userProfile} />
                    </div>
                </main>

                {/* Bottom Navigation Bar */}
                <nav className="fixed bottom-0 left-0 right-0 h-16 bg-slate-800/80 backdrop-blur-lg border-t border-slate-700/50 flex justify-around items-center z-50">
                    {NAV_ITEMS.map(item => (
                        <NavButton key={item.id} item={item} />
                    ))}
                </nav>
            </div>
        </>
    );
};

export default App;