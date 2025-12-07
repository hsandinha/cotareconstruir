import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ClienteDashboard from '../app/dashboard/cliente/page';
import { onAuthStateChanged } from 'firebase/auth';
import { getCountFromServer, getDoc } from 'firebase/firestore';

// Mock Firebase
jest.mock('../lib/firebase', () => ({
    auth: {},
    db: {},
}));

jest.mock('firebase/auth', () => ({
    onAuthStateChanged: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    getCountFromServer: jest.fn(),
    doc: jest.fn(),
    getDoc: jest.fn(),
}));

// Mock Child Components
jest.mock('../components/dashboard/client/ProfileSection', () => ({
    ClientProfileSection: () => <div data-testid="profile-section">Profile Section</div>,
}));
jest.mock('../components/dashboard/client/WorksSection', () => ({
    ClientWorksSection: () => <div data-testid="works-section">Works Section</div>,
}));
jest.mock('../components/dashboard/client/OrderSection', () => ({
    ClientOrderSection: () => <div data-testid="order-section">Order Section</div>,
}));
jest.mock('../components/dashboard/client/ExploreSection', () => ({
    ClientExploreSection: () => <div data-testid="explore-section">Explore Section</div>,
}));
jest.mock('../components/dashboard/client/OpportunitiesSection', () => ({
    ClientOpportunitiesSection: () => <div data-testid="opportunities-section">Opportunities Section</div>,
}));
jest.mock('../components/NotificationBell', () => ({
    NotificationBell: () => <div data-testid="notification-bell">Notification Bell</div>,
}));

describe('ClienteDashboard', () => {
    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Mock Auth State
        (onAuthStateChanged as jest.Mock).mockImplementation((auth, callback) => {
            callback({ uid: 'test-uid', email: 'test@example.com' });
            return jest.fn(); // unsubscribe
        });

        // Mock Firestore Data
        (getDoc as jest.Mock).mockResolvedValue({
            exists: () => true,
            data: () => ({ name: 'Test User' }),
        });

        (getCountFromServer as jest.Mock).mockResolvedValue({
            data: () => ({ count: 5 }),
        });
    });

    it('renders the dashboard with user name', async () => {
        render(<ClienteDashboard />);

        // Check for static text
        expect(screen.getByText('Cotar')).toBeInTheDocument();
        expect(screen.getByText('& Construir')).toBeInTheDocument();

        // Check for user name (async)
        await waitFor(() => {
            expect(screen.getByText('Test User')).toBeInTheDocument();
        });
    });

    it('renders stats correctly', async () => {
        render(<ClienteDashboard />);

        await waitFor(() => {
            // We expect 5 for all stats based on our mock
            const stats = screen.getAllByText('5');
            expect(stats.length).toBeGreaterThan(0);
        });
    });

    it('switches tabs correctly', async () => {
        render(<ClienteDashboard />);

        // Default tab is Profile
        expect(screen.getByTestId('profile-section')).toBeInTheDocument();

        // Click on "Obras & Endereços"
        fireEvent.click(screen.getByText('Obras & Endereços'));
        expect(screen.getByTestId('works-section')).toBeInTheDocument();

        // Click on "Nova Cotação"
        fireEvent.click(screen.getByText('Nova Cotação'));
        expect(screen.getByTestId('explore-section')).toBeInTheDocument();

        // Click on "Meus Pedidos"
        fireEvent.click(screen.getByText('Meus Pedidos'));
        expect(screen.getByTestId('order-section')).toBeInTheDocument();

        // Click on "Oportunidades"
        fireEvent.click(screen.getByText('Oportunidades'));
        expect(screen.getByTestId('opportunities-section')).toBeInTheDocument();
    });

    it('opens user menu', () => {
        render(<ClienteDashboard />);

        // Find user menu button (it has the user initial 'T' from Test User)
        // Wait for user data to load
        // Actually initial state is 'C' then updates to 'T'

        const menuButton = screen.getByText('Bem vindo').closest('button');
        expect(menuButton).toBeInTheDocument();

        if (menuButton) {
            fireEvent.click(menuButton);
            expect(screen.getByText('Sair')).toBeInTheDocument();
        }
    });
});
