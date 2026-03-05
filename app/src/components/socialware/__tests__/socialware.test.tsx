import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppCatalogDialog } from '../AppCatalogDialog';
import { AppDetailView } from '../AppDetailView';

vi.mock('@/lib/api/socialware', () => ({
  listSocialware: vi.fn().mockResolvedValue([]),
  installSocialware: vi.fn().mockResolvedValue(undefined),
  uninstallSocialware: vi.fn().mockResolvedValue(undefined),
  startSocialware: vi.fn().mockResolvedValue(undefined),
  stopSocialware: vi.fn().mockResolvedValue(undefined),
}));

const mockApp = {
  id: 'sw-1',
  name: 'TaskArena',
  version: '1.0.0',
  status: 'running' as const,
  description: 'Task management',
  commands: ['/task'],
  datatypes: ['task'],
  roles: ['worker', 'manager'],
  room_tabs: ['Tasks'],
};

describe('AppCatalogDialog', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('renders catalog of available apps (TC-5-OPS-030)', async () => {
    const { listSocialware } = await import('@/lib/api/socialware');
    (listSocialware as ReturnType<typeof vi.fn>).mockResolvedValue([mockApp]);

    render(<AppCatalogDialog roomId="r1" open={true} onOpenChange={() => {}} installedIds={[]} onInstalled={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('TaskArena')).toBeInTheDocument();
      expect(screen.getByText('v1.0.0')).toBeInTheDocument();
    });
  });

  it('installs app to room (TC-5-OPS-031)', async () => {
    const { listSocialware, installSocialware } = await import('@/lib/api/socialware');
    (listSocialware as ReturnType<typeof vi.fn>).mockResolvedValue([mockApp]);
    (installSocialware as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const onInstalled = vi.fn();

    render(<AppCatalogDialog roomId="r1" open={true} onOpenChange={() => {}} installedIds={[]} onInstalled={onInstalled} />);

    await waitFor(() => { expect(screen.getByText('Install')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Install'));

    await waitFor(() => {
      expect(installSocialware).toHaveBeenCalledWith('sw-1', 'r1');
      expect(onInstalled).toHaveBeenCalled();
    });
  });

  it('shows Installed for already-installed apps', async () => {
    const { listSocialware } = await import('@/lib/api/socialware');
    (listSocialware as ReturnType<typeof vi.fn>).mockResolvedValue([mockApp]);

    render(<AppCatalogDialog roomId="r1" open={true} onOpenChange={() => {}} installedIds={['sw-1']} onInstalled={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Installed')).toBeInTheDocument();
    });
  });
});

describe('AppDetailView', () => {
  it('shows app details and registered components (TC-5-OPS-032)', () => {
    render(<AppDetailView app={mockApp} onUninstalled={() => {}} onStatusChange={() => {}} />);
    expect(screen.getByText('TaskArena')).toBeInTheDocument();
    expect(screen.getByText('Task management')).toBeInTheDocument();
    expect(screen.getByText('/task')).toBeInTheDocument();
    expect(screen.getByText('worker')).toBeInTheDocument();
  });

  it('uninstalls app with confirmation (TC-5-OPS-033)', async () => {
    const { uninstallSocialware } = await import('@/lib/api/socialware');
    (uninstallSocialware as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const onUninstalled = vi.fn();

    render(<AppDetailView app={mockApp} onUninstalled={onUninstalled} onStatusChange={() => {}} />);

    fireEvent.click(screen.getByText('Uninstall'));
    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => {
      expect(uninstallSocialware).toHaveBeenCalledWith('sw-1');
      expect(onUninstalled).toHaveBeenCalled();
    });
  });

  it('toggles app start/stop (TC-5-OPS-034)', async () => {
    const { stopSocialware } = await import('@/lib/api/socialware');
    (stopSocialware as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const onStatusChange = vi.fn();

    render(<AppDetailView app={mockApp} onUninstalled={() => {}} onStatusChange={onStatusChange} />);

    fireEvent.click(screen.getByText('Stop'));

    await waitFor(() => {
      expect(stopSocialware).toHaveBeenCalledWith('sw-1');
      expect(onStatusChange).toHaveBeenCalledWith({ ...mockApp, status: 'stopped' });
    });
  });
});
