import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Plus, Search, Mail, Building, MapPin } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';

export const Clients = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  
  const [form, setForm] = useState({ name: '', email: '', company: '', phone: '' });

  const { data: clients, isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => axiosClient.get('/clients').then(r => r.data.data.clients),
  });

  const createMutation = useMutation({
    mutationFn: (data) => axiosClient.post('/clients', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setShowModal(false);
      setForm({ name: '', email: '', company: '', phone: '' });
    }
  });

  const filteredClients = clients?.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.company?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PageWrapper
      title="Clients"
      subtitle="Manage your clients and their projects"
      actions={
        <Button onClick={() => setShowModal(true)} icon={<Plus className="w-4 h-4" />}>
          Add Client
        </Button>
      }
    >
      <div className="mb-6 max-w-md">
        <Input 
          placeholder="Search clients..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon={<Search className="w-4 h-4" />}
        />
      </div>

      {isLoading ? (
        <div className="text-sm text-[var(--text-muted)] animate-pulse">Loading clients...</div>
      ) : filteredClients?.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
          {filteredClients.map(client => (
            <Card 
              key={client._id} 
              className="cursor-pointer hover:border-brand-500 transition-colors"
              onClick={() => navigate(`/clients/${client._id}`)}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-[var(--text-primary)]">{client.name}</h3>
                  {client.company && <p className="text-xs text-[var(--text-muted)] mt-0.5 flex items-center gap-1"><Building className="w-3 h-3"/>{client.company}</p>}
                </div>
                <div className="w-8 h-8 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-xs font-semibold text-[var(--text-secondary)] uppercase">
                  {client.name.substring(0, 2)}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <Mail className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  {client.email}
                </div>
                {client.address && (
                  <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <MapPin className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    <span className="truncate">{client.address.city || 'Address details available'}</span>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState 
          title={search ? "No matches found" : "No clients yet"}
          description={search ? "Try a different search term" : "Add your first client to get started"}
          icon={<Users className="w-5 h-5" />}
          action={!search && <Button onClick={() => setShowModal(true)}>Add Client</Button>}
        />
      )}

      {/* Simple Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl shadow-xl w-full max-w-md p-6 animate-slide-up">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Add new client</h2>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
              <Input label="Name" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              <Input label="Email" type="email" required value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              <Input label="Company (Optional)" value={form.company} onChange={e => setForm({...form, company: e.target.value})} />
              <Input label="Phone (Optional)" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
              <div className="flex justify-end gap-2 mt-6">
                <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit" loading={createMutation.isPending}>Save Client</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageWrapper>
  );
};
