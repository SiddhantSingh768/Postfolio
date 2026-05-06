import { useState }    from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Users, Building2,
  Mail, Phone, MoreHorizontal,
  Archive, Edit2, ExternalLink,
  Link2, Link2Off
} from 'lucide-react';
import { PageWrapper }     from '../../components/layout/PageWrapper';
import { Button }          from '../../components/ui/Button';
import { Badge }           from '../../components/ui/Badge';
import { EmptyState }      from '../../components/ui/EmptyState';
import { PageSpinner }     from '../../components/ui/Spinner';
import { ConfirmDialog }   from '../../components/shared/ConfirmDialog';
import { ClientDrawer }    from '../../components/shared/ClientDrawer';
import { useClientList, useArchiveClient } from '../../hooks/useClients';
import { clientsApi }      from '../../api/endpoints/clients.api';
import { useDebounce }     from '../../hooks/useDebounce';
import { useToast }        from '../../components/ui/Toast';
import { cn }              from '../../utils/cn';

export const ClientList = () => {
  const navigate    = useNavigate();
  const toast       = useToast();

  const [search, setSearch]         = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editClient, setEditClient] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [menuOpen, setMenuOpen]     = useState(null);
  const [portalLoading, setPortalLoading] = useState(null);

  const debouncedSearch = useDebounce(search, 300);
  const archiveMutation = useArchiveClient();

  const { data, isLoading } = useClientList({
    search:   debouncedSearch || undefined,
    archived: showArchived ? 'true' : undefined,
  });

  const clients    = data?.clients || [];
  const pagination = data?.pagination;

  const handleEdit = (client, e) => {
    e.stopPropagation();
    setMenuOpen(null);
    setEditClient(client);
    setDrawerOpen(true);
  };

  const handleArchive = async () => {
    try {
      await archiveMutation.mutateAsync(archiveTarget._id);
      toast.success(`${archiveTarget.name} archived`);
      setArchiveTarget(null);
    } catch {
      toast.error('Failed to archive client');
    }
  };

  const handleGeneratePortal = async (client, e) => {
    e.stopPropagation();
    setMenuOpen(null);
    setPortalLoading(client._id);
    try {
      const res = await clientsApi.generatePortalToken(client._id, { expiresInDays: 30 });
      const url  = res.data.data.portalUrl || res.data.data.token;
      await navigator.clipboard.writeText(url);
      toast.success('Portal link copied to clipboard');
    } catch {
      toast.error('Failed to generate portal link');
    } finally {
      setPortalLoading(null);
    }
  };

  return (
    <PageWrapper
      title="Clients"
      subtitle={pagination ? `${pagination.total} client${pagination.total !== 1 ? 's' : ''}` : ''}
      actions={
        <Button
          size="sm"
          onClick={() => { setEditClient(null); setDrawerOpen(true); }}
          icon={<Plus className="w-4 h-4" />}
        >
          Add client
        </Button>
      }
    >
      <div className="space-y-4 animate-fade-in">

        {/* Search and filter bar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search by name or company..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input pl-9"
            />
          </div>

          <button
            onClick={() => setShowArchived(s => !s)}
            className={cn(
              'h-9 px-3 rounded-md text-sm font-medium border transition-colors duration-150',
              showArchived
                ? 'bg-neutral-800 text-white border-neutral-700'
                : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
            )}
          >
            {showArchived ? 'Showing archived' : 'Show archived'}
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <PageSpinner />
        ) : clients.length === 0 ? (
          <EmptyState
            icon={<Users className="w-5 h-5" />}
            title={search ? 'No clients found' : 'No clients yet'}
            description={
              search
                ? `No clients match "${search}"`
                : 'Add your first client to get started'
            }
            action={
              !search && (
                <Button
                  size="sm"
                  onClick={() => { setEditClient(null); setDrawerOpen(true); }}
                  icon={<Plus className="w-4 h-4" />}
                >
                  Add client
                </Button>
              )
            }
          />
        ) : (
          <div className="card overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-12 gap-4 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--bg-tertiary)]">
              <span className="col-span-4 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                Client
              </span>
              <span className="col-span-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider hidden md:block">
                Contact
              </span>
              <span className="col-span-2 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider hidden lg:block">
                Country
              </span>
              <span className="col-span-2 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider hidden lg:block">
                Status
              </span>
              <span className="col-span-1" />
            </div>

            {/* Table rows */}
            {clients.map((client) => (
              <div
                key={client._id}
                onClick={() => navigate(`/clients/${client._id}`)}
                className="grid grid-cols-12 gap-4 px-4 py-3.5 border-b border-[var(--border)] last:border-0 table-row-hover cursor-pointer group"
              >
                {/* Client name + company */}
                <div className="col-span-4 flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-brand-700 dark:text-brand-400">
                      {client.name[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {client.name}
                    </p>
                    {client.company && (
                      <p className="text-xs text-[var(--text-muted)] truncate flex items-center gap-1">
                        <Building2 className="w-3 h-3 flex-shrink-0" />
                        {client.company}
                      </p>
                    )}
                  </div>
                </div>

                {/* Contact */}
                <div className="col-span-3 hidden md:flex flex-col justify-center gap-0.5 min-w-0">
                  <p className="text-xs text-[var(--text-secondary)] truncate flex items-center gap-1">
                    <Mail className="w-3 h-3 flex-shrink-0" />
                    {client.email}
                  </p>
                  {client.phone && (
                    <p className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                      <Phone className="w-3 h-3 flex-shrink-0" />
                      {client.phone}
                    </p>
                  )}
                </div>

                {/* Country */}
                <div className="col-span-2 hidden lg:flex items-center">
                  <span className="text-sm text-[var(--text-secondary)]">
                    {client.country || 'IN'}
                  </span>
                </div>

                {/* Status */}
                <div className="col-span-2 hidden lg:flex items-center">
                  <Badge status={client.isArchived ? 'cancelled' : 'active'} />
                </div>

                {/* Actions */}
                <div className="col-span-1 flex items-center justify-end relative">
                  <button
                    onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === client._id ? null : client._id); }}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] opacity-0 group-hover:opacity-100 transition-all duration-150"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>

                  {/* Dropdown menu */}
                  {menuOpen === client._id && (
                    <ClientMenu
                      client={client}
                      onEdit={handleEdit}
                      onArchive={() => { setMenuOpen(null); setArchiveTarget(client); }}
                      onPortal={handleGeneratePortal}
                      portalLoading={portalLoading === client._id}
                      onView={() => navigate(`/clients/${client._id}`)}
                      onClose={() => setMenuOpen(null)}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Drawer */}
      <ClientDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditClient(null); }}
        client={editClient}
      />

      {/* Archive confirm */}
      <ConfirmDialog
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleArchive}
        loading={archiveMutation.isPending}
        title={`Archive ${archiveTarget?.name}?`}
        description="This client will be hidden from your list. Their projects and invoices are preserved. You can re-add them with the same email later."
        confirmLabel="Archive client"
      />
    </PageWrapper>
  );
};

// Dropdown menu component
const ClientMenu = ({ client, onEdit, onArchive, onPortal, portalLoading, onView, onClose }) => {
  // Close when clicking outside
  const handleBackdrop = () => onClose();

  return (
    <>
      <div className="fixed inset-0 z-10" onClick={handleBackdrop} />
      <div className="absolute right-0 top-8 z-20 w-44 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-lg py-1 animate-fade-in">
        <MenuItem icon={<ExternalLink className="w-3.5 h-3.5" />} onClick={onView}>
          View detail
        </MenuItem>
        <MenuItem icon={<Edit2 className="w-3.5 h-3.5" />} onClick={(e) => onEdit(client, e)}>
          Edit
        </MenuItem>
        <MenuItem
          icon={<Link2 className="w-3.5 h-3.5" />}
          onClick={(e) => onPortal(client, e)}
          loading={portalLoading}
        >
          Copy portal link
        </MenuItem>
        <div className="h-px bg-[var(--border)] my-1" />
        <MenuItem
          icon={<Archive className="w-3.5 h-3.5" />}
          onClick={onArchive}
          danger
        >
          Archive
        </MenuItem>
      </div>
    </>
  );
};

const MenuItem = ({ icon, children, onClick, danger, loading }) => (
  <button
    onClick={onClick}
    disabled={loading}
    className={cn(
      'w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors duration-100',
      danger
        ? 'text-danger hover:bg-danger-light dark:hover:bg-red-900/20'
        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
    )}
  >
    {loading ? (
      <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
    ) : icon}
    {children}
  </button>
);